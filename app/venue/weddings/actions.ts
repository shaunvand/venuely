"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { loadRules, computeTotals, applyMarkup, type Charge, type Payment } from "@/lib/billing/compute";

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

// Rebuild a wedding's live charges the same way the venue/couple proforma does
// (see app/venue/weddings/[slug]/page.tsx). Used to recompute the platform fee
// authoritatively at invoice time rather than trusting client-bound totals.
async function buildWeddingCharges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  weddingId: string,
): Promise<{ grandTotal: number; feeRate: number }> {
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, guest_count, wedding_state, area_selections")
    .eq("id", weddingId)
    .single();
  if (!wedding) throw new Error("Wedding not found");

  const { data: venue } = await supabase
    .from("venues")
    .select("platform_fee_rate")
    .eq("id", venueId)
    .single();
  const feeRate = Number((venue as { platform_fee_rate?: number } | null)?.platform_fee_rate ?? 0.01);

  const state = (wedding.wedding_state ?? {}) as WeddingState;
  const rules = await loadRules(supabase, venueId);

  const [rentalsRes, cataRes, accomRes, vendorsRes, areasRes, areaPricingRes, paymentsRes, chargesRes] = await Promise.all([
    supabase.from("rental_items").select("id, name, price, commission_value, commission_type, item_code, cost_treatment").eq("venue_id", venueId),
    supabase.from("catalogue_items").select("id, name, price, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("accommodation_rooms").select("id, name, price_per_night, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("vendor_partners").select("id, name, vendor_type, price_from, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("venue_areas").select("id, name, slug, area_kind").eq("venue_id", venueId).eq("active", true),
    supabase.from("area_pricing").select("area_id, day_type, price"),
    supabase.from("payment_ledger").select("id, amount, direction, kind, paid_at").eq("wedding_id", weddingId),
    supabase.from("wedding_charges").select("id, kind, label, qty, unit_price, amount, is_refundable, day_type").eq("wedding_id", weddingId),
  ]);

  const rentalMap = new Map((rentalsRes.data ?? []).map((r) => [r.id, r]));
  const cataMap = new Map((cataRes.data ?? []).map((c) => [c.id, c]));
  const accomMap = new Map((accomRes.data ?? []).map((r) => [r.id, r]));
  const vendorMap = new Map((vendorsRes.data ?? []).map((v) => [v.id, v]));
  const areas = areasRes.data ?? [];
  const areaPriceMap: Record<string, Record<string, number>> = {};
  (areaPricingRes.data ?? []).forEach((p) => {
    areaPriceMap[p.area_id] = areaPriceMap[p.area_id] || {};
    areaPriceMap[p.area_id][p.day_type] = Number(p.price);
  });

  const charges: Charge[] = [];

  // Rentals
  for (const [code, v] of Object.entries(state.rentalSelections ?? {})) {
    if (!v.sel) continue;
    const item = rentalMap.get(code); if (!item) continue;
    const dayCount = [v.mg, v.wed, v.fb].filter(Boolean).length || 1;
    const qty = v.qty ?? 1;
    const unit = applyMarkup(Number(item.price), item.commission_value, item.commission_type);
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    charges.push({ kind: "rental", label: item.name, qty: qty * dayCount, unit_price: unit, amount: included ? 0 : unit * qty * dayCount, is_refundable: false });
  }

  // Catalogue (per-head)
  const guestCount = wedding.guest_count ?? 0;
  for (const [code, v] of Object.entries(state.catalogueSelections ?? {})) {
    if (!v.sel && !v.mg && !v.wed && !v.fb) continue;
    const item = cataMap.get(code); if (!item) continue;
    const dayCount = [v.mg, v.wed, v.fb].filter(Boolean).length || 1;
    const unit = applyMarkup(Number(item.price), item.commission_value, item.commission_type);
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    charges.push({ kind: "catalogue", label: item.name, qty: dayCount * guestCount, unit_price: unit, amount: included ? 0 : unit * dayCount * guestCount, is_refundable: false });
  }

  // Accommodation
  for (const [roomId, names] of Object.entries(state.roomAssignments ?? {})) {
    const room = accomMap.get(roomId); if (!room || !names.length) continue;
    const unit = applyMarkup(Number(room.price_per_night), room.commission_value, room.commission_type);
    const included = (room as { cost_treatment?: string }).cost_treatment === "included";
    charges.push({ kind: "accommodation", label: room.name, qty: 1, unit_price: unit, amount: included ? 0 : unit, is_refundable: false });
  }

  // Vendor partners selected
  (state.suppliers ?? []).forEach((s) => {
    if (s.status !== "booked" && !parseMoney(s.price)) return;
    const v = s.fromVendorId ? vendorMap.get(s.fromVendorId) : null;
    const fallback = v ? applyMarkup(Number(v.price_from ?? 0), v.commission_value, v.commission_type) : 0;
    const cost = parseMoney(s.price) || fallback;
    const included = v && (v as { cost_treatment?: string }).cost_treatment === "included";
    if (cost > 0) charges.push({ kind: "vendor", label: s.name, qty: 1, unit_price: cost, amount: included ? 0 : cost, is_refundable: false });
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
  return { grandTotal: totals.grand_total, feeRate };
}

function hashPassword(plain: string): string {
  // Lightweight salted hash: salt comes from a server-only env var, falls back to a fixed string in dev.
  const salt = process.env.PORTAL_PASSWORD_SALT ?? "venuely-portal-v1";
  return createHash("sha256").update(`${salt}::${plain}`).digest("hex");
}

// Turn "Alex & Sam Smith" → "AlexAndSamSmithWedding".
// Strips non-alphanumerics, joins words, appends "Wedding" suffix.
function pascalSlug(couples: string): string {
  const cleaned = couples
    .replace(/&/g, " And ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const camel = cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return `${camel}Wedding`;
}

async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  while (true) {
    const { data } = await supabase.from("weddings").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}${n++}`;
  }
}

export async function createWedding(venueId: string, _venueSlug: string, formData: FormData) {
  const supabase = await createClient();
  const couples = (formData.get("couple_names") as string).trim();
  const explicit = (formData.get("slug") as string || "").trim();

  const base = explicit ? explicit.replace(/[^a-zA-Z0-9]/g, "") : pascalSlug(couples);
  const slug = await uniqueSlug(supabase, base);

  const guestStr = formData.get("guest_count") as string;
  const statusStr = (formData.get("status") as string)?.trim() || "inquiry";
  const passwordStr = (formData.get("portal_password") as string)?.trim() || "";
  const { data, error } = await supabase
    .from("weddings")
    .insert({
      venue_id: venueId,
      slug,
      couple_names: couples,
      wedding_date: (formData.get("wedding_date") as string) || null,
      guest_count: guestStr ? Number(guestStr) : null,
      status: statusStr,
      portal_password_hash: passwordStr ? hashPassword(passwordStr) : null,
    })
    .select("slug")
    .single();

  if (error) throw new Error(`Could not create wedding: ${error.message}`);
  revalidatePath("/venue/weddings");
  if (data) redirect(`/venue/weddings/${data.slug}`);
}

export async function updateWeddingBasics(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const guestStr = formData.get("guest_count") as string;
  const budgetStr = formData.get("total_budget") as string;
  const patch: Record<string, unknown> = {
    couple_names: (formData.get("couple_names") as string)?.trim(),
    wedding_date: (formData.get("wedding_date") as string) || null,
    guest_count: guestStr ? Number(guestStr) : null,
    total_budget: budgetStr ? Number(budgetStr) : null,
    status: (formData.get("status") as string) || "inquiry",
    notes: (formData.get("notes") as string) || null,
  };
  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function setPortalPassword(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const pw = (formData.get("password") as string || "").trim();
  const patch = { portal_password_hash: pw ? hashPassword(pw) : null };
  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// NOTE: total/feeRate are still in the signature so the [slug] page's bound
// call keeps compiling, but they are NOT trusted — the invoice total and the
// platform fee are recomputed server-side from the wedding's live charges and
// the venue's authoritative platform_fee_rate. This prevents a tampered client
// form from understating (or inflating) the fee owed.
export async function markInvoiced(weddingId: string, slug: string, _total?: number, _feeRate?: number) {
  const supabase = await createClient();

  const { data: wed } = await supabase.from("weddings").select("venue_id").eq("id", weddingId).single();
  if (!wed?.venue_id) throw new Error("Wedding not found");

  const { grandTotal, feeRate } = await buildWeddingCharges(supabase, wed.venue_id as string, weddingId);
  const fee = Math.round(grandTotal * feeRate * 100) / 100;

  const { error } = await supabase.from("weddings").update({
    invoiced_at: new Date().toISOString(),
    invoice_total: grandTotal,
    platform_fee_owed: fee,
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function markCouplePaid(weddingId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({
    couple_paid_at: new Date().toISOString(),
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function markPlatformFeePaid(weddingId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({
    platform_fee_paid_at: new Date().toISOString(),
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}
