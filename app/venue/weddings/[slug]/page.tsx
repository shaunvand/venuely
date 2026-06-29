import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import {
  updateWeddingBasics, setPortalPassword,
  markInvoiced, markCouplePaid, markPlatformFeePaid,
  sendPortalInvite, rotatePortalAccess, revokeCoupleAccess, approveSubmission,
} from "../actions";
import { catalogueQuantity } from "@/lib/billing/catalogue-qty";
import { statusColor } from "@/lib/wedding/status";
import { computeWeddingsProgress, HEALTH_COLOR, HEALTH_LABEL } from "@/lib/venue/progress";
import { SaveButton } from "@/components/SaveButton";
import { addPayment, deletePayment, addCharge, deleteCharge } from "./ledger-actions";
import { ReminderButtons } from "@/components/ReminderButtons";
import { depositReminder, balanceReminder } from "@/lib/notifications";
import { PortalLinkCard } from "@/components/PortalLinkCard";
import { SendPortalInvite } from "@/components/SendPortalInvite";
import { WeddingDocuments } from "@/components/WeddingDocuments";
import { loadRules, computeTotals, applyMarkup, platformFee, type Charge, type Payment } from "@/lib/billing/compute";
import { nightsBetween, nightsLabel } from "@/lib/billing/charges";
import { buildAreaPriceMap, type Season, type AreaPriceRow } from "@/lib/venue/seasons";
import { whatsappUrl, bookingNotificationMessage } from "@/lib/whatsapp";
import { SupplierIntrosPanel, type SupplierIntro } from "@/components/SupplierIntrosPanel";

type WeddingState = {
  rentalSelections?: Record<string, { sel?: boolean; qty?: number; mg?: boolean; wed?: boolean; fb?: boolean }>;
  catalogueSelections?: Record<string, { sel?: boolean; mg?: boolean; wed?: boolean; fb?: boolean }>;
  guests?: string[];
  roomAssignments?: Record<string, string[]>;
  suppliers?: Array<{ id: number; name: string; category?: string; status?: string; price?: string; fromVendorId?: string }>;
  customRequests?: Array<{ id: string; name: string; note?: string }>;
};

function parseMoney(s: string | undefined | null): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default async function WeddingDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const h = await headers();
  // Prefer x-forwarded-host so links use the public domain, not Render's internal
  // dyno host (localhost:10000).
  const host = h.get("x-forwarded-host") || h.get("host") || "venuely.co.za";
  const proto = h.get("x-forwarded-proto") || "https";
  // Canonical share URL = the clean password gate at /{slug} (same link the
  // invite email sends). /p/{slug} is the internal post-auth page (the venue's
  // own "open" button below uses it directly since they're already signed in).
  const portalUrl = `${proto}://${host}/${slug}`;

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, wedding_end_date, setup_date, breakdown_date, guest_count, status, total_budget, notes, wedding_state, wedding_state_updated_at, portal_password_hash, invoiced_at, invoice_total, couple_paid_at, platform_fee_owed, platform_fee_paid_at, deposit_due_at, balance_due_at, couple_email, area_selections")
    .eq("venue_id", venue.id)
    .eq("slug", slug)
    .single();
  if (!wedding) notFound();

  // Couple-access lifecycle: last-opened (from portal_access_log) + couple members (for Remove).
  const [lastOpenedRes, coupleMembersRes] = await Promise.all([
    supabase.from("portal_access_log").select("accessed_at").eq("wedding_id", wedding.id).order("accessed_at", { ascending: false }).limit(1),
    supabase.from("wedding_members").select("user_id, profiles:profiles(id, full_name)").eq("wedding_id", wedding.id),
  ]);
  const lastOpenedAt = (lastOpenedRes.data?.[0]?.accessed_at as string | undefined) ?? null;
  // Couple submissions awaiting venue review.
  const { data: submissionRows } = await supabase
    .from("submissions")
    .select("id, kind, message, totals, status, created_at")
    .eq("wedding_id", wedding.id)
    .order("created_at", { ascending: false });
  const submissions = (submissionRows ?? []) as Array<{ id: string; kind: string; message: string | null; totals: unknown; status: string | null; created_at: string }>;
  const pendingSubmissions = submissions.filter((s) => (s.status ?? "pending") === "pending");

  // Guest RSVP + dietary/accessibility roll-up for the caterer handover.
  const { data: guestRows } = await supabase
    .from("guests")
    .select("rsvp_status, dietary, accessibility_needs, is_child, party_size")
    .eq("wedding_id", wedding.id);
  const gl = (guestRows ?? []) as Array<{ rsvp_status: string | null; dietary: string | null; accessibility_needs: string | null; is_child: boolean | null; party_size: number | null }>;
  // Confirmed-RSVP headcount for per-head billing — identical rule to
  // lib/billing/charges.ts so the proforma matches the invoice + couple total.
  const billingGuests = (() => {
    const attending = gl.filter((g) => g.rsvp_status === "attending");
    const heads = attending.reduce((s, g) => s + Math.max(1, Number(g.party_size) || 1), 0);
    return heads > 0 ? heads : (wedding.guest_count ?? 0);
  })();
  const dietaryList = gl.filter((g) => (g.dietary ?? "").trim()).map((g) => (g.dietary as string).trim());
  const dietaryCounts = dietaryList.reduce<Record<string, number>>((m, d) => { const k = d.toLowerCase(); m[k] = (m[k] || 0) + 1; return m; }, {});
  const guestStats = {
    total: gl.length,
    attending: gl.filter((g) => g.rsvp_status === "attending").length,
    pending: gl.filter((g) => (g.rsvp_status ?? "pending") === "pending").length,
    declined: gl.filter((g) => g.rsvp_status === "declined").length,
    children: gl.filter((g) => g.is_child).length,
    accessibility: gl.filter((g) => (g.accessibility_needs ?? "").trim()).map((g) => (g.accessibility_needs as string).trim()),
  };
  const coupleMembers = (coupleMembersRes.data ?? []) as unknown as Array<{
    user_id: string;
    profiles: { id: string; full_name: string | null } | null;
  }>;

  const state = (wedding.wedding_state ?? {}) as WeddingState;
  const rules = await loadRules(supabase, venue.id);

  const [rentalsRes, cataRes, accomRes, vendorsRes, areasRes, areaPricingRes, paymentsRes, chargesRes, docsRes, seasonsRes] = await Promise.all([
    supabase.from("rental_items").select("id, name, price, commission_value, commission_type, item_code, cost_treatment").eq("venue_id", venue.id),
    supabase.from("catalogue_items").select("id, name, price, price_unit, commission_value, commission_type, cost_treatment").eq("venue_id", venue.id),
    supabase.from("accommodation_rooms").select("id, name, price_per_night, commission_value, commission_type, tier, cost_treatment, contact_name, contact_phone, contact_email, website_url, address").eq("venue_id", venue.id),
    supabase.from("vendor_partners").select("id, name, vendor_type, price_from, commission_value, commission_type, cost_treatment, contact_phone, contact_email, website_url").eq("venue_id", venue.id),
    supabase.from("venue_areas").select("id, name, slug, area_kind").eq("venue_id", venue.id).eq("active", true),
    supabase.from("area_pricing").select("area_id, day_type, price, season_id"),
    supabase.from("payment_ledger").select("id, amount, direction, kind, method, reference, paid_at, notes").eq("wedding_id", wedding.id).order("paid_at", { ascending: false }),
    supabase.from("wedding_charges").select("id, kind, label, qty, unit_price, amount, is_refundable, is_auto, day_type, notes").eq("wedding_id", wedding.id),
    supabase.from("wedding_documents").select("id, label, url, kind, visible_to_couple, created_at").eq("wedding_id", wedding.id).order("created_at", { ascending: false }),
    supabase.from("venue_seasons").select("id, name, start_month, start_day, end_month, end_day, sort_order").eq("venue_id", venue.id),
  ]);
  // Weekend view + planning progress data.
  const [progressMap, { data: introRows }] = await Promise.all([
    computeWeddingsProgress(supabase, [{ id: wedding.id, area_selections: wedding.area_selections }]),
    supabase.from("supplier_intros")
      .select("id, supplier_name, supplier_type, supplier_email, supplier_phone, commission_type, commission_value, status, booking_value, commission_amount, intro_sent_at, booked_at")
      .eq("wedding_id", wedding.id)
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false }),
  ]);
  const supplierIntros = (introRows ?? []) as SupplierIntro[];
  const introCommissionDue = supplierIntros
    .filter((i) => i.status === "booked")
    .reduce((s, i) => s + (Number(i.commission_amount) || 0), 0);
  const weddingProgress = progressMap.get(wedding.id) ?? null;
  const rentalMap = new Map((rentalsRes.data ?? []).map((r) => [r.id, r]));
  const cataMap = new Map((cataRes.data ?? []).map((c) => [c.id, c]));
  const accomMap = new Map((accomRes.data ?? []).map((r) => [r.id, r]));
  const vendorMap = new Map((vendorsRes.data ?? []).map((v) => [v.id, v]));
  const areas = areasRes.data ?? [];
  // Season-aware area prices: the wedding-day price resolves to the season
  // containing this wedding's date (mg/farewell keep a single null-season price).
  const seasons = (seasonsRes.data ?? []) as Season[];
  const areaPriceMap = buildAreaPriceMap(
    (areaPricingRes.data ?? []) as AreaPriceRow[],
    seasons,
    wedding.wedding_date as string | null,
  );

  // -----------------------------------------------------------------
  // Build the charges list — auto (from couple selections) + manual
  // -----------------------------------------------------------------
  const charges: Charge[] = [];

  // Rentals
  for (const [code, v] of Object.entries(state.rentalSelections ?? {})) {
    if (!v.sel) continue;
    const item = rentalMap.get(code); if (!item) continue;
    const days = [v.mg ? "M&G" : null, v.wed ? "Wed" : null, v.fb ? "FB" : null].filter(Boolean);
    const dayCount = days.length || 1;
    const qty = v.qty ?? 1;
    const baseUnit = Number(item.price);
    const unit = applyMarkup(baseUnit, item.commission_value, item.commission_type);
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    const units = qty * dayCount;
    const fullAmount = unit * units;
    charges.push({
      kind: "rental",
      label: `${item.name}${dayCount > 1 ? ` × ${dayCount} days` : ""}${included ? " (included)" : ""}`,
      qty: units,
      unit_price: unit,
      amount: included ? 0 : fullAmount,
      base_amount: included ? 0 : baseUnit * units,
      is_refundable: false,
    });
  }

  // Catalogue — quantity respects price_unit + name thresholds (flat extras are
  // NOT × guests; per-head items scale by confirmed RSVPs; ">N pax" fees only
  // apply past the threshold), identical to lib/billing/charges.ts so the
  // proforma total agrees with the invoiced + couple-facing total.
  for (const [code, v] of Object.entries(state.catalogueSelections ?? {})) {
    if (!v.sel && !v.mg && !v.wed && !v.fb) continue;
    const item = cataMap.get(code); if (!item) continue;
    const dayCount = [v.mg, v.wed, v.fb].filter(Boolean).length || 1;
    const baseUnit = Number(item.price);
    const unit = applyMarkup(baseUnit, item.commission_value, item.commission_type);
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    const q = catalogueQuantity({ name: item.name, priceUnit: (item as { price_unit?: string }).price_unit, guests: billingGuests, days: dayCount });
    const units = q.units;
    charges.push({
      kind: "catalogue",
      label: `${item.name} (${q.perUnitNote})${included ? " (included)" : ""}`,
      qty: units,
      unit_price: unit,
      amount: included ? 0 : unit * units,
      base_amount: included ? 0 : baseUnit * units,
      is_refundable: false,
    });
  }

  // Accommodation — per night × the wedding's night count (multi-day weddings
  // span wedding_date → wedding_end_date; single-day stays 1 night).
  const nights = nightsBetween(wedding.wedding_date, wedding.wedding_end_date);
  for (const [roomId, names] of Object.entries(state.roomAssignments ?? {})) {
    const room = accomMap.get(roomId); if (!room || !names.length) continue;
    const baseUnit = Number(room.price_per_night);
    const unit = applyMarkup(baseUnit, room.commission_value, room.commission_type);
    const included = (room as { cost_treatment?: string }).cost_treatment === "included";
    charges.push({
      kind: "accommodation",
      label: `${room.name} (${names.length} guests, ${nightsLabel(nights)})${included ? " (included)" : ""}`,
      qty: nights,
      unit_price: unit,
      amount: included ? 0 : unit * nights,
      base_amount: included ? 0 : baseUnit * nights,
      is_refundable: false,
    });
  }

  // Vendor partners selected
  (state.suppliers ?? []).forEach((s) => {
    if (s.status !== "booked" && !parseMoney(s.price)) return;
    const v = s.fromVendorId ? vendorMap.get(s.fromVendorId) : null;
    const fallback = v ? applyMarkup(Number(v.price_from ?? 0), v.commission_value, v.commission_type) : 0;
    const cost = parseMoney(s.price) || fallback;
    const included = v && (v as { cost_treatment?: string }).cost_treatment === "included";
    // Base = the partner's price_from before markup when priced off its catalogue
    // entry; a manually keyed price carries no separable commission (base = cost).
    const baseCost = v && !parseMoney(s.price) ? Number(v.price_from ?? 0) : cost;
    if (cost > 0) {
      charges.push({
        kind: "vendor",
        label: `${s.name} (${s.category ?? "supplier"})${included ? " (included)" : ""}`,
        qty: 1,
        unit_price: cost,
        amount: included ? 0 : cost,
        base_amount: included ? 0 : baseCost,
        is_refundable: false,
      });
    }
  });

  // Areas (paid extras only)
  const selectedAreas = (wedding.area_selections ?? []) as Array<{ area_id: string; day_type: string }>;
  selectedAreas.forEach((sel) => {
    const a = areas.find((x) => x.id === sel.area_id);
    const price = areaPriceMap[sel.area_id]?.[sel.day_type] ?? 0;
    if (a && price > 0) charges.push({ kind: "area", label: `${a.name} (${sel.day_type})`, qty: 1, unit_price: price, amount: price, is_refundable: false });
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
    charges.push({ kind: "breakage", label: `Refundable breakage deposit`, qty: 1, unit_price: rules.breakage_deposit, amount: rules.breakage_deposit, is_refundable: true });
  }

  const payments = (paymentsRes.data ?? []).map((p) => ({
    id: p.id, amount: Number(p.amount), direction: p.direction as "in" | "out", kind: p.kind, paid_at: p.paid_at,
    method: p.method ?? null, reference: p.reference ?? null, notes: p.notes ?? null,
  })) as Payment[];

  const totals = computeTotals(rules, charges, payments);

  const platformFeeRate = Number((venue as { platform_fee_rate?: number }).platform_fee_rate ?? 0.005);
  // Venuely fee = rate × (grand_total − venue commission); the venue keeps 100%
  // of its commission. projectedFee is therefore charged on platform_fee_base.
  const projectedFee = platformFee(totals, platformFeeRate);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <div className="vy-eyebrow">Wedding</div>
          <h1 className="vy-h1 mt-1">{wedding.couple_names}</h1>
          <p className="text-stone-600 text-sm">
            {wedding.wedding_date ? (wedding.wedding_end_date ? `${wedding.wedding_date} → ${wedding.wedding_end_date}` : wedding.wedding_date) : "Date TBD"} · {wedding.guest_count ?? "?"} guests · <span className="text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: statusColor(wedding.status).bg, color: statusColor(wedding.status).text }}>{wedding.status}</span>
            {weddingProgress && (
              <span className="text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full ml-2" style={{ background: HEALTH_COLOR[weddingProgress.health].bg, color: HEALTH_COLOR[weddingProgress.health].text }} title={weddingProgress.missing.length ? `Still to do: ${weddingProgress.missing.join(", ")}` : "Everything in place"}>
                {weddingProgress.pct}% planned · {HEALTH_LABEL[weddingProgress.health]}
              </span>
            )}
          </p>
          {wedding.wedding_state_updated_at && (
            <p className="text-xs text-stone-500 mt-1">
              Couple last updated their portal: {new Date(wedding.wedding_state_updated_at).toLocaleString()}
            </p>
          )}
        </div>
        <Link href={`/p/${wedding.slug}`} target="_blank" className="vy-btn vy-btn-secondary">Open Couples Portal →</Link>
      </div>

      {/* ── Share the couple portal — ONE place: the link, the invite, access ── */}
      <section className="space-y-3">
        <header>
          <div className="vy-eyebrow">Share with the couple</div>
          <h2 className="vy-h2 mt-1">Their private portal</h2>
          <p className="text-sm text-stone-600 mt-0.5">One link to share, send their invite, and manage who has access — all in one place.</p>
        </header>

        <PortalLinkCard
          portalUrl={portalUrl}
          passwordSet={!!wedding.portal_password_hash}
          setPasswordAction={setPortalPassword.bind(null, wedding.id, wedding.slug)}
        />

        <SendPortalInvite
          portalUrl={portalUrl}
          passwordSet={!!wedding.portal_password_hash}
          lastOpenedAt={lastOpenedAt}
          sendAction={sendPortalInvite.bind(null, wedding.id, wedding.slug)}
        />

        {/* Access: rotate the code, or remove a couple's account access. */}
        <div className="vy-card space-y-3">
          <div className="vy-eyebrow">Portal access</div>
          <div className="flex gap-2 flex-wrap items-center">
            <form action={rotatePortalAccess.bind(null, wedding.id, wedding.slug)}>
              <button className="vy-btn vy-btn-secondary text-sm">Rotate access code</button>
            </form>
            <p className="text-xs text-stone-500">
              Rotating issues a fresh code and invalidates the old link/cookie. Re-send the invite afterwards.
            </p>
          </div>
          {coupleMembers.length > 0 && (
            <div className="border-t border-stone-200 pt-3 space-y-2">
              <div className="text-xs font-medium text-stone-600">Couple accounts with access</div>
              <ul className="space-y-1.5">
                {coupleMembers.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-2 py-1.5 border-b border-stone-100 last:border-0">
                    <span className="text-sm">{m.profiles?.full_name ?? m.user_id}</span>
                    <form action={revokeCoupleAccess.bind(null, wedding.id, m.user_id, wedding.slug)}>
                      <button className="text-xs text-stone-500 hover:text-red-700">Remove access</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Couple's custom item requests — quote these and add them as charges. */}
      {(state.customRequests ?? []).length > 0 && (
        <section className="vy-card" style={{ border: "2px solid var(--peach)" }}>
          <div className="vy-eyebrow">Custom requests from the couple</div>
          <p className="text-sm mt-1 mb-3" style={{ color: "var(--ink-2)" }}>
            Items they want that aren&apos;t in your catalogue — quote each one and add it as a charge in the proforma below.
          </p>
          <ul className="space-y-2">
            {(state.customRequests ?? []).map((r) => (
              <li key={r.id} className="rounded-lg px-3 py-2.5 text-sm" style={{ border: "1px solid var(--line)", background: "#fff" }}>
                <span className="font-medium">{r.name}</span>
                {r.note && <span className="ml-2" style={{ color: "var(--ink-2)" }}>— {r.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={updateWeddingBasics.bind(null, wedding.id, wedding.slug)} className="vy-card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-3 space-y-1"><label className="vy-label">Couple names</label><input name="couple_names" required defaultValue={wedding.couple_names} className="vy-input" /></div>
        <div className="space-y-1"><label className="vy-label">Guests</label><input name="guest_count" type="number" min="0" defaultValue={wedding.guest_count ?? ""} className="vy-input" /></div>
        <div className="md:col-span-2 space-y-1"><label className="vy-label">Total budget (R)</label><input name="total_budget" type="number" step="0.01" defaultValue={wedding.total_budget ?? ""} className="vy-input" /></div>
        <div className="md:col-span-2 space-y-1"><label className="vy-label">Start date</label><input name="wedding_date" type="date" defaultValue={wedding.wedding_date ?? ""} className="vy-input" /></div>
        <div className="md:col-span-2 space-y-1"><label className="vy-label">End date <span style={{ color: "var(--ink-2)", fontWeight: 400 }}>(optional)</span></label><input name="wedding_end_date" type="date" defaultValue={wedding.wedding_end_date ?? ""} className="vy-input" /></div>
        <div className="md:col-span-3 space-y-1"><label className="vy-label">Set-up date <span style={{ color: "var(--ink-2)", fontWeight: 400 }}>(optional)</span></label><input name="setup_date" type="date" defaultValue={(wedding as { setup_date?: string | null }).setup_date ?? ""} className="vy-input" /></div>
        <div className="md:col-span-3 space-y-1"><label className="vy-label">Breakdown date <span style={{ color: "var(--ink-2)", fontWeight: 400 }}>(optional)</span></label><input name="breakdown_date" type="date" defaultValue={(wedding as { breakdown_date?: string | null }).breakdown_date ?? ""} className="vy-input" /></div>
        <p className="md:col-span-6 text-xs -mt-1" style={{ color: "var(--ink-2)" }}>When your team sets up / breaks down — shown on the calendar timeline.</p>
        <div className="md:col-span-2 space-y-1"><label className="vy-label">Status</label>
          <select name="status" defaultValue={wedding.status} className="vy-select">
            <option value="inquiry">inquiry</option><option value="provisional">provisional</option>
            <option value="booked">booked</option><option value="completed">completed</option><option value="cancelled">cancelled</option>
          </select></div>
        <div className="md:col-span-2 space-y-1"><label className="vy-label">Notes</label><input name="notes" defaultValue={wedding.notes ?? ""} className="vy-input" /></div>
        <div className="md:col-span-6"><SaveButton /></div>
      </form>

      {/* Couple submissions awaiting review → approve sends the EFT invoice */}
      {pendingSubmissions.length > 0 && (
        <div className="vy-card space-y-3" style={{ border: "2px solid var(--peach)" }}>
          <div className="flex items-center gap-2">
            <span className="vy-eyebrow">Action needed</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--peach)", color: "var(--poppy-deep)" }}>{pendingSubmissions.length} to review</span>
          </div>
          <h2 className="vy-h2">Couple submitted their selections</h2>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            Review the proforma above, then approve to email the couple their EFT invoice and record your {+(platformFeeRate * 100).toFixed(2)}% Venuely commission.
          </p>
          <div className="space-y-2">
            {pendingSubmissions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 flex-wrap rounded-lg px-3 py-2" style={{ border: "1px solid var(--line)" }}>
                <div className="text-sm">
                  <span className="font-medium capitalize">{s.kind}</span> selection
                  <span className="text-xs ml-2" style={{ color: "var(--ink-2)" }}>{new Date(s.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</span>
                  {s.message && <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>“{s.message}”</div>}
                </div>
                <form action={approveSubmission.bind(null, s.id, wedding.id, wedding.slug)}>
                  <button className="vy-btn vy-btn-primary text-xs">Approve &amp; send invoice</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guest RSVP + dietary roll-up (caterer handover) */}
      {guestStats.total > 0 && (
        <div className="vy-card space-y-3">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <div className="vy-eyebrow">Guests</div>
              <h2 className="vy-h2 mt-1">{guestStats.attending} attending · {guestStats.pending} pending · {guestStats.declined} declined</h2>
            </div>
            <div className="text-xs" style={{ color: "var(--ink-2)" }}>{guestStats.total} on the list{guestStats.children ? ` · ${guestStats.children} children` : ""}</div>
          </div>
          {Object.keys(dietaryCounts).length > 0 && (
            <div>
              <div className="vy-label mb-1">Dietary requirements</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(dietaryCounts).sort((a, b) => b[1] - a[1]).map(([d, n]) => (
                  <span key={d} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--cream)", color: "var(--ink)", border: "1px solid var(--line)" }}>{d} <strong>×{n}</strong></span>
                ))}
              </div>
            </div>
          )}
          {guestStats.accessibility.length > 0 && (
            <div className="text-xs" style={{ color: "var(--ink-2)" }}>
              <strong style={{ color: "var(--ink)" }}>Accessibility:</strong> {guestStats.accessibility.join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Financial summary card */}
      <div className="vy-card space-y-4">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div className="vy-eyebrow">Proforma</div>
            <div className="font-serif text-3xl mt-1">R{totals.grand_total.toLocaleString()}</div>
            <div className="text-xs text-stone-500 mt-1">
              VAT {rules.vat_inclusive ? "inclusive" : "exclusive"} ({(rules.vat_rate * 100).toFixed(0)}%): R{totals.vat_amount.toLocaleString()}
              {totals.breakage > 0 && <> · refundable deposit R{totals.breakage.toLocaleString()}</>}
            </div>
            <div className="text-xs text-stone-500">
              Couple pays R{totals.grand_total.toLocaleString()}
              {totals.commission_total > 0 && <> · Your commission R{totals.commission_total.toLocaleString()} (you keep this)</>}
              {" · "}Venuely fee {(platformFeeRate * 100).toFixed(2)}% of R{totals.platform_fee_base.toLocaleString()} = R{projectedFee.toLocaleString()}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {!wedding.invoiced_at ? (
              <form action={markInvoiced.bind(null, wedding.id, wedding.slug, totals.grand_total, platformFeeRate)}>
                <button className="vy-btn vy-btn-primary">Mark invoiced</button>
              </form>
            ) : !wedding.couple_paid_at ? (
              <form action={markCouplePaid.bind(null, wedding.id, wedding.slug)}>
                <button className="vy-btn vy-btn-primary">Mark couple paid</button>
              </form>
            ) : null}
            {wedding.couple_paid_at && !wedding.platform_fee_paid_at && (
              <form action={markPlatformFeePaid.bind(null, wedding.id, wedding.slug)}>
                <button className="vy-btn vy-btn-secondary">Settle platform fee</button>
              </form>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-sm border-t border-stone-200 pt-3">
          <div><div className="text-stone-500 text-xs">Subtotal</div><div>R{totals.subtotal.toLocaleString()}</div></div>
          <div><div className="text-stone-500 text-xs">Deposit ({(rules.deposit_pct*100).toFixed(0)}%)</div><div>R{totals.deposit_amount.toLocaleString()}</div></div>
          <div><div className="text-stone-500 text-xs">Paid in</div><div className="text-emerald-700">R{totals.payments_in.toLocaleString()}</div></div>
          <div><div className="text-stone-500 text-xs">Balance due</div><div className={totals.balance_due > 0 ? "text-amber-700" : "text-emerald-700"}>R{totals.balance_due.toLocaleString()}</div></div>
        </div>

        {/* Payment reminders — owner-triggered. Email goes to couple_email (set when
            you sent the portal invite); WhatsApp opens a pre-filled message you pick
            the chat for. No scheduler — tap to send each one. */}
        {(() => {
          const depMsg = depositReminder(
            { couple_names: wedding.couple_names, wedding_date: wedding.wedding_date, venueName: venue.name },
            totals.deposit_amount,
            wedding.deposit_due_at,
          );
          const balMsg = balanceReminder(
            { couple_names: wedding.couple_names, wedding_date: wedding.wedding_date, venueName: venue.name },
            totals.balance_due,
            wedding.balance_due_at,
          );
          const coupleEmail = (wedding as { couple_email?: string | null }).couple_email ?? null;
          return (
            <div className="border-t border-stone-200 pt-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="vy-eyebrow">Payment reminders</div>
                <span className="text-xs text-stone-500">
                  {coupleEmail ? <>Emails go to {coupleEmail}</> : "No couple email yet — send the portal invite first, or use WhatsApp"}
                </span>
              </div>
              <ReminderButtons
                weddingId={wedding.id}
                slug={wedding.slug}
                depositAmount={totals.deposit_amount}
                balanceDue={totals.balance_due}
                coupleEmail={coupleEmail}
                depositWa={depMsg.whatsappText}
                balanceWa={balMsg.whatsappText}
              />
            </div>
          );
        })()}
      </div>

      {/* Charges table */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Line items ({charges.length})</h2>
        {charges.length === 0 ? <p className="text-sm text-stone-500">No charges yet.</p> : (
          <div className="vy-card p-0 overflow-hidden">
            <table className="vy-table">
              <thead><tr><th>Kind</th><th>Description</th><th>Qty</th><th>Unit</th><th className="text-right">Amount</th><th></th></tr></thead>
              <tbody>
                {charges.map((c, i) => (
                  <tr key={c.id ?? `auto-${i}`}>
                    <td><span className="vy-tag vy-tag-soft">{c.kind}</span></td>
                    <td>{c.label}{c.is_refundable && <span className="ml-2 text-xs text-emerald-700">refundable</span>}</td>
                    <td>{c.qty}</td>
                    <td>R{c.unit_price.toLocaleString()}</td>
                    <td className="text-right">R{c.amount.toLocaleString()}</td>
                    <td className="text-right">
                      {c.id && c.kind !== "breakage" && (
                        <form action={deleteCharge.bind(null, c.id, wedding.slug)}>
                          <button className="text-stone-500 hover:text-red-700 text-xs">×</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={addCharge.bind(null, wedding.id, wedding.slug)} className="vy-card grid gap-2 md:grid-cols-6 mt-3">
          <select name="kind" defaultValue="custom" className="vy-select md:col-span-1">
            <option value="custom">Custom</option><option value="venue">Venue fee</option>
            <option value="area">Area</option><option value="vendor">Vendor</option>
            <option value="discount">Discount</option>
          </select>
          <input name="label" required placeholder="Label" className="vy-input md:col-span-2" />
          <input name="qty" type="number" step="0.01" defaultValue="1" placeholder="Qty" className="vy-input" />
          <input name="unit_price" type="number" step="0.01" required placeholder="Unit price" className="vy-input" />
          <button className="vy-btn vy-btn-primary">+ Add charge</button>
        </form>
      </section>

      {/* Payments ledger */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Payment ledger ({payments.length})</h2>
        {payments.length === 0 ? <p className="text-sm text-stone-500">No payments recorded yet.</p> : (
          <div className="vy-card p-0 overflow-hidden">
            <table className="vy-table">
              <thead><tr><th>Date</th><th>Kind</th><th>Method</th><th>Reference</th><th>Direction</th><th className="text-right">Amount</th><th></th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.paid_at).toLocaleDateString()}</td>
                    <td><span className="vy-tag vy-tag-soft">{p.kind}</span></td>
                    <td>{p.method ?? "—"}</td>
                    <td className="font-mono text-xs">{p.reference ?? "—"}</td>
                    <td>{p.direction === "in" ? "↘ in" : "↗ out"}</td>
                    <td className={`text-right ${p.direction === "in" ? "text-emerald-700" : "text-stone-700"}`}>R{p.amount.toLocaleString()}</td>
                    <td className="text-right">
                      <form action={deletePayment.bind(null, p.id, wedding.slug)}>
                        <button className="text-stone-500 hover:text-red-700 text-xs">×</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={addPayment.bind(null, wedding.id, wedding.slug)} className="vy-card grid gap-2 md:grid-cols-7 mt-3">
          <input name="paid_at" type="date" className="vy-input" />
          <select name="direction" defaultValue="in" className="vy-select"><option value="in">In</option><option value="out">Out (refund)</option></select>
          <select name="kind" defaultValue="deposit" className="vy-select">
            <option value="deposit">Deposit</option><option value="progress">Progress</option>
            <option value="balance">Balance</option><option value="breakage">Breakage</option>
            <option value="refund">Refund</option><option value="adjustment">Adjustment</option>
          </select>
          <input name="method" placeholder="EFT / Card / Yoco" className="vy-input" />
          <input name="reference" placeholder="Reference" className="vy-input" />
          <input name="amount" type="number" step="0.01" required placeholder="Amount" className="vy-input" />
          <button className="vy-btn vy-btn-primary">+ Add payment</button>
        </form>
      </section>

      {/* Supplier intros & commission ledger */}
      <section className="vy-card space-y-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="vy-eyebrow">Supplier intros &amp; commission</div>
            <h2 className="vy-h2 mt-1">{supplierIntros.length} introduction{supplierIntros.length === 1 ? "" : "s"}</h2>
          </div>
          {introCommissionDue > 0 && (
            <div className="text-sm font-medium" style={{ color: "var(--poppy-deep)" }}>
              R{Math.round(introCommissionDue).toLocaleString("en-ZA")} commission to invoice
            </div>
          )}
        </div>
        <SupplierIntrosPanel intros={supplierIntros} weddingId={wedding.id} slug={wedding.slug} />
      </section>

      {/* Notify suppliers via WhatsApp */}
      {(() => {
        type ContactRow = { label: string; phone: string | null | undefined; contact_name?: string | null; itemLabel: string };
        const contacts: ContactRow[] = [];
        // Booked vendor partners with phone
        (state.suppliers ?? []).forEach((s) => {
          if (s.status !== "booked") return;
          const v = s.fromVendorId ? vendorMap.get(s.fromVendorId) : null;
          if (v?.contact_phone) contacts.push({ label: v.name, phone: v.contact_phone, itemLabel: `${v.name} — ${s.category ?? "supplier"}` });
        });
        // Accommodation rooms with contact_phone (external lodges)
        Object.entries(state.roomAssignments ?? {}).forEach(([rid, names]) => {
          if (!names.length) return;
          const r = accomMap.get(rid) as { name: string; contact_name?: string | null; contact_phone?: string | null } | undefined;
          if (r?.contact_phone) contacts.push({ label: r.name, phone: r.contact_phone, contact_name: r.contact_name, itemLabel: `${r.name} (${names.length} guests)` });
        });
        if (!contacts.length) return null;
        return (
          <section className="vy-card space-y-3">
            <div className="vy-eyebrow">Notify suppliers</div>
            <h3 className="font-medium">WhatsApp the booked vendors</h3>
            <p className="text-xs text-stone-500">
              Click a row to open WhatsApp with a templated booking confirmation message. Reviewed before sending.
            </p>
            <ul className="space-y-1.5">
              {contacts.map((c, i) => {
                const msg = bookingNotificationMessage({
                  venueName: venue.name,
                  coupleNames: wedding.couple_names,
                  weddingDate: wedding.wedding_date,
                  itemLabel: c.itemLabel,
                  contactName: c.contact_name ?? null,
                });
                const wa = whatsappUrl(c.phone, msg);
                return (
                  <li key={i} className="flex items-center justify-between gap-2 py-2 border-b border-stone-100 last:border-0">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.label}</div>
                      <div className="text-xs text-stone-500">{c.phone}</div>
                    </div>
                    {wa ? (
                      <a href={wa} target="_blank" rel="noopener noreferrer"
                        className="rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-emerald-700 whitespace-nowrap">
                        ↗ Message on WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-stone-400">Invalid phone</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })()}

      <WeddingDocuments weddingId={wedding.id} docs={docsRes.data ?? []} />
    </div>
  );
}
