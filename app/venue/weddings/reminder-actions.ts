"use server";

// Owner-triggered payment-reminder sends. No scheduler — the venue admin taps a
// button on a wedding's proforma to email the couple their deposit / balance
// reminder. Amounts are recomputed server-side from the wedding's live charges
// (never trusted from the client), the same way markInvoiced does it, then the
// couple_email (captured at invite time, wave 3) is emailed via lib/notifications.
// Everything is env-gated: with no RESEND_API_KEY the action is a clean no-op.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentVenue } from "@/lib/venue/current";
import {
  loadRules, computeTotals, applyMarkup,
  type Charge, type Payment, type Computed,
} from "@/lib/billing/compute";
import { sendEmail, depositReminder, balanceReminder, type BankInfo, type InvoiceExtra } from "@/lib/notifications";
import { buildInvoicePdf } from "@/lib/billing/invoice-pdf";
import { nightsBetween, nightsLabel } from "@/lib/billing/charges";
import { buildAreaPriceMap, type Season, type AreaPriceRow } from "@/lib/venue/seasons";

type WeddingState = {
  rentalSelections?: Record<string, { sel?: boolean; qty?: number; mg?: boolean; wed?: boolean; fb?: boolean }>;
  catalogueSelections?: Record<string, { sel?: boolean; mg?: boolean; wed?: boolean; fb?: boolean }>;
  roomAssignments?: Record<string, string[]>;
  suppliers?: Array<{ id: number; name: string; category?: string; status?: string; price?: string; fromVendorId?: string }>;
};

function parseMoney(s: string | undefined | null): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type LoadedWedding = {
  id: string;
  slug: string;
  couple_names: string;
  wedding_date: string | null;
  couple_email: string | null;
  deposit_due_at: string | null;
  balance_due_at: string | null;
  venueName: string;
};

// Load a wedding (scoped to the caller's current venue for authz — RLS also
// enforces this) and recompute its live proforma totals. Mirrors the charge
// build in app/venue/weddings/[slug]/page.tsx + actions.ts::buildWeddingCharges
// so deposit_amount / balance_due are authoritative.
async function loadWeddingTotals(
  weddingId: string,
): Promise<{ wedding: LoadedWedding; totals: Computed; charges: Charge[]; banking: BankInfo; venueMeta: VenueMeta } | null> {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, wedding_end_date, couple_email, guest_count, wedding_state, area_selections, deposit_due_at, balance_due_at")
    .eq("id", weddingId)
    .eq("venue_id", venue.id)
    .maybeSingle();
  if (!wedding) return null;

  const state = (wedding.wedding_state ?? {}) as WeddingState;
  const rules = await loadRules(supabase, venue.id);

  const [rentalsRes, cataRes, accomRes, vendorsRes, areasRes, areaPricingRes, seasonsRes, paymentsRes, chargesRes] = await Promise.all([
    supabase.from("rental_items").select("id, name, price, commission_value, commission_type, item_code, cost_treatment").eq("venue_id", venue.id),
    supabase.from("catalogue_items").select("id, name, price, commission_value, commission_type, cost_treatment").eq("venue_id", venue.id),
    supabase.from("accommodation_rooms").select("id, name, price_per_night, commission_value, commission_type, cost_treatment").eq("venue_id", venue.id),
    supabase.from("vendor_partners").select("id, name, vendor_type, price_from, commission_value, commission_type, cost_treatment").eq("venue_id", venue.id),
    supabase.from("venue_areas").select("id, name, slug, area_kind").eq("venue_id", venue.id).eq("active", true),
    supabase.from("area_pricing").select("area_id, day_type, price, season_id"),
    supabase.from("venue_seasons").select("id, name, start_month, start_day, end_month, end_day, sort_order").eq("venue_id", venue.id),
    supabase.from("payment_ledger").select("id, amount, direction, kind, paid_at").eq("wedding_id", weddingId),
    supabase.from("wedding_charges").select("id, kind, label, qty, unit_price, amount, is_refundable, day_type").eq("wedding_id", weddingId),
  ]);

  const rentalMap = new Map((rentalsRes.data ?? []).map((r) => [r.id, r]));
  const cataMap = new Map((cataRes.data ?? []).map((c) => [c.id, c]));
  const accomMap = new Map((accomRes.data ?? []).map((r) => [r.id, r]));
  const vendorMap = new Map((vendorsRes.data ?? []).map((v) => [v.id, v]));
  const areas = areasRes.data ?? [];
  // Season-aware area prices: the wedding-day price resolves to this wedding's season.
  const seasons = (seasonsRes.data ?? []) as Season[];
  const areaPriceMap = buildAreaPriceMap(
    (areaPricingRes.data ?? []) as AreaPriceRow[],
    seasons,
    wedding.wedding_date as string | null,
  );

  const charges: Charge[] = [];

  // Rentals
  for (const [code, v] of Object.entries(state.rentalSelections ?? {})) {
    if (!v.sel) continue;
    const item = rentalMap.get(code); if (!item) continue;
    const dayCount = [v.mg, v.wed, v.fb].filter(Boolean).length || 1;
    const qty = v.qty ?? 1;
    const baseUnit = Number(item.price);
    const unit = applyMarkup(baseUnit, item.commission_value, item.commission_type);
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    const units = qty * dayCount;
    charges.push({ kind: "rental", label: item.name, qty: units, unit_price: unit, amount: included ? 0 : unit * units, base_amount: included ? 0 : baseUnit * units, is_refundable: false });
  }

  // Catalogue (per-head)
  const guestCount = wedding.guest_count ?? 0;
  for (const [code, v] of Object.entries(state.catalogueSelections ?? {})) {
    if (!v.sel && !v.mg && !v.wed && !v.fb) continue;
    const item = cataMap.get(code); if (!item) continue;
    const dayCount = [v.mg, v.wed, v.fb].filter(Boolean).length || 1;
    const baseUnit = Number(item.price);
    const unit = applyMarkup(baseUnit, item.commission_value, item.commission_type);
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    const units = dayCount * guestCount;
    charges.push({ kind: "catalogue", label: item.name, qty: units, unit_price: unit, amount: included ? 0 : unit * units, base_amount: included ? 0 : baseUnit * units, is_refundable: false });
  }

  // Accommodation — per night × the wedding's night count (single-day = 1 night).
  const nights = nightsBetween(wedding.wedding_date, (wedding as { wedding_end_date?: string | null }).wedding_end_date);
  for (const [roomId, names] of Object.entries(state.roomAssignments ?? {})) {
    const room = accomMap.get(roomId); if (!room || !names.length) continue;
    const baseUnit = Number(room.price_per_night);
    const unit = applyMarkup(baseUnit, room.commission_value, room.commission_type);
    const included = (room as { cost_treatment?: string }).cost_treatment === "included";
    charges.push({ kind: "accommodation", label: `${room.name} (${nightsLabel(nights)})`, qty: nights, unit_price: unit, amount: included ? 0 : unit * nights, base_amount: included ? 0 : baseUnit * nights, is_refundable: false });
  }

  // Vendor partners selected
  (state.suppliers ?? []).forEach((s) => {
    if (s.status !== "booked" && !parseMoney(s.price)) return;
    const v = s.fromVendorId ? vendorMap.get(s.fromVendorId) : null;
    const fallback = v ? applyMarkup(Number(v.price_from ?? 0), v.commission_value, v.commission_type) : 0;
    const cost = parseMoney(s.price) || fallback;
    const included = v && (v as { cost_treatment?: string }).cost_treatment === "included";
    const baseCost = v && !parseMoney(s.price) ? Number(v.price_from ?? 0) : cost;
    if (cost > 0) charges.push({ kind: "vendor", label: s.name, qty: 1, unit_price: cost, amount: included ? 0 : cost, base_amount: included ? 0 : baseCost, is_refundable: false });
  });

  // Areas (paid extras only)
  const selectedAreas = (wedding.area_selections ?? []) as Array<{ area_id: string; day_type: string }>;
  selectedAreas.forEach((sel) => {
    const a = areas.find((x) => x.id === sel.area_id);
    const price = areaPriceMap[sel.area_id]?.[sel.day_type] ?? 0;
    if (a && price > 0) charges.push({ kind: "area", label: a.name, qty: 1, unit_price: price, amount: price, is_refundable: false });
  });

  // Manual charges (from wedding_charges table)
  (chargesRes.data ?? []).forEach((c) => {
    charges.push({
      id: c.id,
      kind: c.kind as Charge["kind"],
      label: c.label,
      qty: Number(c.qty),
      unit_price: Number(c.unit_price),
      amount: Number(c.amount),
      is_refundable: c.is_refundable,
      day_type: c.day_type,
    });
  });

  // Breakage deposit (rule)
  if (rules.breakage_deposit > 0) {
    charges.push({ kind: "breakage", label: "Refundable breakage deposit", qty: 1, unit_price: rules.breakage_deposit, amount: rules.breakage_deposit, is_refundable: true });
  }

  const payments = (paymentsRes.data ?? []).map((p) => ({
    id: p.id, amount: Number(p.amount), direction: p.direction as "in" | "out", kind: p.kind, paid_at: p.paid_at,
  })) as Payment[];

  const totals = computeTotals(rules, charges, payments);

  // Venue banking + invoice template/branding — so the PDF matches the venue's
  // SAVED invoice template and carries its own details.
  const { data: vmeta } = await supabase
    .from("venues")
    .select("bank_name, bank_account_name, bank_account_number, bank_branch_code, bank_swift, bank_iban, invoice_template, invoice_theme, branding_logo_url, address, region, contact_email, contact_phone")
    .eq("id", venue.id)
    .maybeSingle();
  const banking: BankInfo = {
    bank_name: vmeta?.bank_name ?? null,
    account_name: vmeta?.bank_account_name ?? null,
    account_number: vmeta?.bank_account_number ?? null,
    branch_code: vmeta?.bank_branch_code ?? null,
    swift: vmeta?.bank_swift ?? null,
    iban: vmeta?.bank_iban ?? null,
  };
  const venueMeta = {
    templateId: (vmeta?.invoice_template as string | null) ?? null,
    theme: vmeta?.invoice_theme ?? null,
    logoUrl: (vmeta?.branding_logo_url as string | null) ?? null,
    address: (() => {
      const addr = String(vmeta?.address ?? "").trim();
      const region = String(vmeta?.region ?? "").trim();
      // Avoid duplicating province/country that the address already contains.
      if (region && addr && !addr.toLowerCase().includes(region.toLowerCase().split(",")[0])) return `${addr}, ${region}`;
      return addr || region || null;
    })(),
    email: (vmeta?.contact_email as string | null) ?? null,
    phone: (vmeta?.contact_phone as string | null) ?? null,
  };

  return {
    wedding: {
      id: wedding.id,
      slug: wedding.slug,
      couple_names: wedding.couple_names,
      wedding_date: wedding.wedding_date ?? null,
      couple_email: (wedding as { couple_email?: string | null }).couple_email ?? null,
      deposit_due_at: (wedding as { deposit_due_at?: string | null }).deposit_due_at ?? null,
      balance_due_at: (wedding as { balance_due_at?: string | null }).balance_due_at ?? null,
      venueName: venue.name,
    },
    totals,
    charges,
    banking,
    venueMeta,
  };
}

type VenueMeta = { templateId: string | null; theme: unknown; logoUrl: string | null; address: string | null; email: string | null; phone: string | null };

export type ReminderResult = {
  ok: boolean;
  sent: boolean;
  amount: number;
  reason?: "not_found" | "nothing_due" | "no_email" | "email_not_configured" | "send_failed" | "no_bank_details";
};

// Bank details are "set up" once there's an account number + bank name.
function hasBankDetails(b: BankInfo): boolean {
  return !!(String(b.account_number ?? "").trim() && String(b.bank_name ?? "").trim());
}

// Build the proforma invoice payload that rides along with a reminder.
function buildInvoice(charges: Charge[], totals: Computed, banking: BankInfo, reference: string): InvoiceExtra {
  const paid = totals.payments_in - totals.payments_out;
  return {
    lineItems: charges.filter((c) => Number(c.amount) > 0).map((c) => ({ label: c.label, amount: Number(c.amount) })),
    total: totals.grand_total,
    paid: paid > 0 ? paid : 0,
    balance: totals.balance_due,
    banking,
    reference,
  };
}

export async function sendDepositReminder(weddingId: string, slug: string): Promise<ReminderResult> {
  const loaded = await loadWeddingTotals(weddingId);
  if (!loaded) return { ok: false, sent: false, amount: 0, reason: "not_found" };

  const { wedding, totals, charges, banking, venueMeta } = loaded;
  const amount = totals.deposit_amount;
  if (amount <= 0) return { ok: true, sent: false, amount, reason: "nothing_due" };
  // The invoice must carry banking details — block the send if they're missing.
  if (!hasBankDetails(banking)) return { ok: false, sent: false, amount, reason: "no_bank_details" };

  const invoice = buildInvoice(charges, totals, banking, wedding.couple_names);
  const msg = depositReminder(
    { couple_names: wedding.couple_names, wedding_date: wedding.wedding_date, venueName: wedding.venueName },
    amount,
    wedding.deposit_due_at,
    invoice,
  );

  // Env-gated email. No key / no couple_email → clean no-op with a reason.
  if (!process.env.RESEND_API_KEY) return { ok: true, sent: false, amount, reason: "email_not_configured" };
  if (!wedding.couple_email) return { ok: true, sent: false, amount, reason: "no_email" };

  const pdf = await buildInvoicePdf({
    venueName: wedding.venueName, venueAddress: venueMeta.address, venueEmail: venueMeta.email, venuePhone: venueMeta.phone,
    templateId: venueMeta.templateId, theme: venueMeta.theme, logoFallbackUrl: venueMeta.logoUrl,
    coupleNames: wedding.couple_names, weddingDate: wedding.wedding_date,
    reference: wedding.couple_names, lineItems: invoice.lineItems ?? [],
    total: invoice.total ?? 0, paid: invoice.paid ?? 0, balance: invoice.balance ?? 0,
    amountDueNow: amount, amountDueLabel: "Deposit due", dueDate: wedding.deposit_due_at, banking,
  });
  const res = await sendEmail(wedding.couple_email, msg.subject, msg.html, {
    attachments: [{ filename: pdf.filename, content: pdf.base64 }],
  });
  revalidatePath(`/venue/weddings/${slug}`);
  return { ok: true, sent: res.sent, amount, reason: res.sent ? undefined : "send_failed" };
}

export async function sendBalanceReminder(weddingId: string, slug: string): Promise<ReminderResult> {
  const loaded = await loadWeddingTotals(weddingId);
  if (!loaded) return { ok: false, sent: false, amount: 0, reason: "not_found" };

  const { wedding, totals, charges, banking, venueMeta } = loaded;
  const amount = totals.balance_due;
  if (amount <= 0) return { ok: true, sent: false, amount, reason: "nothing_due" };
  if (!hasBankDetails(banking)) return { ok: false, sent: false, amount, reason: "no_bank_details" };

  const invoice = buildInvoice(charges, totals, banking, wedding.couple_names);
  const msg = balanceReminder(
    { couple_names: wedding.couple_names, wedding_date: wedding.wedding_date, venueName: wedding.venueName },
    amount,
    wedding.balance_due_at,
    invoice,
  );

  if (!process.env.RESEND_API_KEY) return { ok: true, sent: false, amount, reason: "email_not_configured" };
  if (!wedding.couple_email) return { ok: true, sent: false, amount, reason: "no_email" };

  const pdf = await buildInvoicePdf({
    venueName: wedding.venueName, venueAddress: venueMeta.address, venueEmail: venueMeta.email, venuePhone: venueMeta.phone,
    templateId: venueMeta.templateId, theme: venueMeta.theme, logoFallbackUrl: venueMeta.logoUrl,
    coupleNames: wedding.couple_names, weddingDate: wedding.wedding_date,
    reference: wedding.couple_names, lineItems: invoice.lineItems ?? [],
    total: invoice.total ?? 0, paid: invoice.paid ?? 0, balance: invoice.balance ?? 0,
    amountDueNow: amount, amountDueLabel: "Balance due", dueDate: wedding.balance_due_at, banking,
  });
  const res = await sendEmail(wedding.couple_email, msg.subject, msg.html, {
    attachments: [{ filename: pdf.filename, content: pdf.base64 }],
  });
  revalidatePath(`/venue/weddings/${slug}`);
  return { ok: true, sent: res.sent, amount, reason: res.sent ? undefined : "send_failed" };
}
