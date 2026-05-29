import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  loadRules, computeTotals, applyMarkup,
  type Charge, type Payment,
} from "@/lib/billing/compute";
import { sendEmail, depositReminder, balanceReminder } from "@/lib/notifications";

// Automated reminder runner. A Render Cron / pg_cron job (wired by the founder)
// hits POST /api/cron/reminders with the `x-cron-secret` header once a day. We
// find weddings whose deposit / balance is coming due in the next 7 days, email
// the couple the amount owed (recomputed server-side, never trusted), then stamp
// deposit_reminder_at / balance_reminder_at so the same couple is never re-emailed.
//
// This is the unattended sibling of app/venue/weddings/reminder-actions.ts, which
// does the same send on an owner button-tap. That action is session-scoped via
// getCurrentVenue(), so it can't be reused here — the charge build is replicated
// minimally below against a service-role admin client (mirrors the webhook routes).
//
// Fully env-gated: no CRON_SECRET → 503 (not configured); no RESEND_API_KEY →
// sendEmail is a clean no-op so nothing throws and no row is falsely stamped.

export const runtime = "nodejs";
// Generous ceiling: one Resend POST + a few small reads per due wedding. A daily
// batch is small, but we never want a partial run to be cut off mid-send.
export const maxDuration = 60;

// Service-role client (bypasses RLS for backend reads/writes), mirrors the
// Paystack / Yoco webhook routes.
function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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

// Build the live proforma totals for one wedding row (already loaded with its
// venue name). Mirrors reminder-actions.ts::loadWeddingTotals, minus the
// session/venue authz (the cron is service-role and operates fleet-wide).
async function totalsFor(
  supabase: SupabaseClient,
  wedding: {
    id: string;
    venue_id: string;
    guest_count: number | null;
    wedding_state: WeddingState | null;
    area_selections: Array<{ area_id: string; day_type: string }> | null;
  },
) {
  const venueId = wedding.venue_id;
  const state = (wedding.wedding_state ?? {}) as WeddingState;
  const rules = await loadRules(supabase, venueId);

  const [rentalsRes, cataRes, accomRes, vendorsRes, areasRes, areaPricingRes, paymentsRes, chargesRes] = await Promise.all([
    supabase.from("rental_items").select("id, name, price, commission_value, commission_type, item_code, cost_treatment").eq("venue_id", venueId),
    supabase.from("catalogue_items").select("id, name, price, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("accommodation_rooms").select("id, name, price_per_night, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("vendor_partners").select("id, name, vendor_type, price_from, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("venue_areas").select("id, name, slug, area_kind").eq("venue_id", venueId).eq("active", true),
    supabase.from("area_pricing").select("area_id, day_type, price"),
    supabase.from("payment_ledger").select("id, amount, direction, kind, paid_at").eq("wedding_id", wedding.id),
    supabase.from("wedding_charges").select("id, kind, label, qty, unit_price, amount, is_refundable, day_type").eq("wedding_id", wedding.id),
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

  // Accommodation
  for (const [roomId, names] of Object.entries(state.roomAssignments ?? {})) {
    const room = accomMap.get(roomId); if (!room || !names.length) continue;
    const baseUnit = Number(room.price_per_night);
    const unit = applyMarkup(baseUnit, room.commission_value, room.commission_type);
    const included = (room as { cost_treatment?: string }).cost_treatment === "included";
    charges.push({ kind: "accommodation", label: room.name, qty: 1, unit_price: unit, amount: included ? 0 : unit, base_amount: included ? 0 : baseUnit, is_refundable: false });
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

  return computeTotals(rules, charges, payments);
}

type RunSummary = { processed: number; sent: number; skipped: number };

// The window: anything due from now through +7 days that hasn't already been
// reminded. deposit_due_at / balance_due_at are DATE columns, so we compare
// against ISO date strings (inclusive of today).
function windowBounds(): { todayIso: string; horizonIso: string } {
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { todayIso: now.toISOString().slice(0, 10), horizonIso: horizon.toISOString().slice(0, 10) };
}

async function run(): Promise<RunSummary> {
  const supabase = adminClient();
  const { todayIso, horizonIso } = windowBounds();
  const nowIso = new Date().toISOString();
  const haveResend = !!process.env.RESEND_API_KEY;

  const summary: RunSummary = { processed: 0, sent: 0, skipped: 0 };

  // We need the venue name for the email shell. Pull it via a join so we don't
  // round-trip per wedding.
  const baseSelect =
    "id, venue_id, couple_names, wedding_date, couple_email, guest_count, wedding_state, area_selections, deposit_due_at, balance_due_at, venue:venues(name)";

  // --- Deposit reminders: deposit due within 7 days, not yet reminded ----------
  const { data: depositDue } = await supabase
    .from("weddings")
    .select(baseSelect)
    .is("deposit_reminder_at", null)
    .not("couple_email", "is", null)
    .not("deposit_due_at", "is", null)
    .gte("deposit_due_at", todayIso)
    .lte("deposit_due_at", horizonIso);

  for (const w of depositDue ?? []) {
    summary.processed += 1;
    const venueName = (w as { venue?: { name?: string | null } | null }).venue?.name ?? "your venue";
    const totals = await totalsFor(supabase, {
      id: w.id,
      venue_id: w.venue_id,
      guest_count: w.guest_count ?? null,
      wedding_state: (w.wedding_state ?? null) as WeddingState | null,
      area_selections: (w.area_selections ?? null) as Array<{ area_id: string; day_type: string }> | null,
    });
    const amount = totals.deposit_amount;
    if (amount <= 0 || !haveResend || !w.couple_email) {
      summary.skipped += 1;
      continue;
    }

    const msg = depositReminder(
      { couple_names: w.couple_names, wedding_date: w.wedding_date, venueName },
      amount,
      w.deposit_due_at,
    );
    const res = await sendEmail(w.couple_email, msg.subject, msg.html);
    if (!res.sent) {
      summary.skipped += 1;
      continue;
    }
    // Stamp only after a confirmed send so a transient failure retries next run.
    await supabase.from("weddings").update({ deposit_reminder_at: nowIso }).eq("id", w.id);
    summary.sent += 1;
  }

  // --- Balance reminders: balance due within 7 days, not yet reminded ----------
  const { data: balanceDue } = await supabase
    .from("weddings")
    .select(baseSelect)
    .is("balance_reminder_at", null)
    .not("couple_email", "is", null)
    .not("balance_due_at", "is", null)
    .gte("balance_due_at", todayIso)
    .lte("balance_due_at", horizonIso);

  for (const w of balanceDue ?? []) {
    summary.processed += 1;
    const venueName = (w as { venue?: { name?: string | null } | null }).venue?.name ?? "your venue";
    const totals = await totalsFor(supabase, {
      id: w.id,
      venue_id: w.venue_id,
      guest_count: w.guest_count ?? null,
      wedding_state: (w.wedding_state ?? null) as WeddingState | null,
      area_selections: (w.area_selections ?? null) as Array<{ area_id: string; day_type: string }> | null,
    });
    const amount = totals.balance_due;
    if (amount <= 0 || !haveResend || !w.couple_email) {
      summary.skipped += 1;
      continue;
    }

    const msg = balanceReminder(
      { couple_names: w.couple_names, wedding_date: w.wedding_date, venueName },
      amount,
      w.balance_due_at,
    );
    const res = await sendEmail(w.couple_email, msg.subject, msg.html);
    if (!res.sent) {
      summary.skipped += 1;
      continue;
    }
    await supabase.from("weddings").update({ balance_reminder_at: nowIso }).eq("id", w.id);
    summary.sent += 1;
  }

  return summary;
}

// Shared-secret gate. Unset secret → 503 (operator hasn't wired the cron yet);
// header mismatch → 401. Only a matching `x-cron-secret` reaches the runner.
function authorise(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = authorise(request);
  if (denied) return denied;
  const summary = await run();
  return NextResponse.json(summary);
}

// GET is supported too (some cron providers only issue GET). Same secret gate.
export async function GET(request: NextRequest) {
  const denied = authorise(request);
  if (denied) return denied;
  const summary = await run();
  return NextResponse.json(summary);
}
