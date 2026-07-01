// Shared proforma builder — rebuilds a wedding's live charges (couple-selection
// auto lines + manual wedding_charges + breakage) exactly the way the venue
// proforma page does, then computes totals. Single source of truth used by:
//   - app/venue/weddings/actions.ts (markInvoiced / approveSubmission / getWeddingTotals)
//   - app/api/paystack/checkout/route.ts (charge the couple the real outstanding amount)
// Pure data module (no "use server") so both server actions and route handlers
// can import it.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadRules, computeTotals, applyMarkup,
  type Charge, type Payment, type Computed,
} from "@/lib/billing/compute";
import { buildAreaPriceMap, type Season, type AreaPriceRow } from "@/lib/venue/seasons";
import { catalogueQuantity } from "@/lib/billing/catalogue-qty";

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

// Number of accommodation nights for a wedding: the days between start and end
// date when a multi-day range is set, otherwise 1 (single-day weddings keep the
// historical one-night behaviour).
export function nightsBetween(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 1;
  const a = new Date(String(start).slice(0, 10)).getTime();
  const b = new Date(String(end).slice(0, 10)).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000));
}

export function nightsLabel(nights: number): string {
  return `${nights} night${nights === 1 ? "" : "s"}`;
}

export type BuiltWeddingCharges = {
  grandTotal: number;
  /** venues.platform_fee_rate as a fraction (e.g. 0.005 = 0.5%). */
  feeRate: number;
  /** venues.platform_fee_active — when false the platform fee is waived (treat as 0). */
  feeActive: boolean;
  totals: Computed;
};

// Rebuild a wedding's live charges the same way the venue/couple proforma does
// (see app/venue/weddings/[slug]/page.tsx). Used to recompute the platform fee
// authoritatively at invoice/checkout time rather than trusting client-bound totals.
export async function buildWeddingCharges(
  supabase: SupabaseClient,
  venueId: string,
  weddingId: string,
  // When invoicing an approved submission, pass its frozen state so post-submit
  // edits to the couple's selections don't change what gets billed.
  stateOverride?: unknown,
): Promise<BuiltWeddingCharges> {
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, guest_count, wedding_state, area_selections, wedding_date, wedding_end_date")
    .eq("id", weddingId)
    .single();
  if (!wedding) throw new Error("Wedding not found");

  const { data: venue } = await supabase
    .from("venues")
    .select("platform_fee_rate, platform_fee_active")
    .eq("id", venueId)
    .single();
  const feeRate = Number((venue as { platform_fee_rate?: number } | null)?.platform_fee_rate ?? 0.005);
  const feeActive = (venue as { platform_fee_active?: boolean } | null)?.platform_fee_active ?? true;

  const state = (stateOverride ?? wedding.wedding_state ?? {}) as WeddingState;
  const rules = await loadRules(supabase, venueId);

  const [rentalsRes, cataRes, accomRes, vendorsRes, areasRes, areaPricingRes, seasonsRes, paymentsRes, chargesRes] = await Promise.all([
    supabase.from("rental_items").select("id, name, price, commission_value, commission_type, item_code, cost_treatment").eq("venue_id", venueId),
    supabase.from("catalogue_items").select("id, name, price, price_unit, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("accommodation_rooms").select("id, name, price_per_night, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("vendor_partners").select("id, name, vendor_type, price_from, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("venue_areas").select("id, name, slug, area_kind").eq("venue_id", venueId).eq("active", true),
    supabase.from("area_pricing").select("area_id, day_type, price, season_id"),
    supabase.from("venue_seasons").select("id, name, start_month, start_day, end_month, end_day, sort_order").eq("venue_id", venueId),
    supabase.from("payment_ledger").select("id, amount, direction, kind, paid_at").eq("wedding_id", weddingId),
    supabase.from("wedding_charges").select("id, kind, label, qty, unit_price, amount, is_refundable, day_type").eq("wedding_id", weddingId),
  ]);

  const rentalMap = new Map((rentalsRes.data ?? []).map((r) => [r.id, r]));
  const cataMap = new Map((cataRes.data ?? []).map((c) => [c.id, c]));
  const accomMap = new Map((accomRes.data ?? []).map((r) => [r.id, r]));
  const vendorMap = new Map((vendorsRes.data ?? []).map((v) => [v.id, v]));
  const areas = areasRes.data ?? [];
  // Season-aware area prices: the wedding-day price is resolved for the season
  // containing the wedding's date (mg/farewell keep a single null-season price).
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

  // Catalogue — quantity depends on price_unit + thresholds in the item name
  // (flat venue extras are NOT × guests; per-head items scale by the confirmed
  // guest count; "...over N"/">N pax" fees only apply past the threshold).
  // Confirmed guests: actual RSVP "attending" headcount when any have responded,
  // else the couple's guest_count estimate.
  const { data: guestRows } = await supabase
    .from("guests").select("rsvp_status, party_size").eq("wedding_id", weddingId);
  const attending = (guestRows ?? []).filter((g) => g.rsvp_status === "attending");
  const confirmedHeads = attending.reduce((s, g) => s + Math.max(1, Number(g.party_size) || 1), 0);
  const guestCount = confirmedHeads > 0 ? confirmedHeads : (wedding.guest_count ?? 0);
  for (const [code, v] of Object.entries(state.catalogueSelections ?? {})) {
    if (!v.sel && !v.mg && !v.wed && !v.fb) continue;
    const item = cataMap.get(code); if (!item) continue;
    const dayCount = [v.mg, v.wed, v.fb].filter(Boolean).length || 1;
    const baseUnit = Number(item.price);
    const unit = applyMarkup(baseUnit, item.commission_value, item.commission_type);
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    const q = catalogueQuantity({ name: item.name, priceUnit: (item as { price_unit?: string }).price_unit, guests: guestCount, days: dayCount });
    const units = q.units;
    charges.push({ kind: "catalogue", label: item.name, qty: units, unit_price: unit, amount: included ? 0 : unit * units, base_amount: included ? 0 : baseUnit * units, is_refundable: false });
  }

  // Accommodation — priced per night × the wedding's night count.
  const nights = nightsBetween(wedding.wedding_date as string | null, wedding.wedding_end_date as string | null);
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
    // Base = the supplier's price_from before markup when this is a known partner
    // priced off its catalogue entry. A manually keyed price (parseMoney) carries
    // no separable commission, so its base equals the charged amount.
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
  return { grandTotal: totals.grand_total, feeRate, feeActive, totals };
}
