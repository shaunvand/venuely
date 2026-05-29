import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import {
  updateWeddingBasics, setPortalPassword,
  markInvoiced, markCouplePaid, markPlatformFeePaid,
  sendPortalInvite, rotatePortalAccess, revokeCoupleAccess,
} from "../actions";
import { addPayment, deletePayment, addCharge, deleteCharge } from "./ledger-actions";
import { PortalLinkCard } from "@/components/PortalLinkCard";
import { SendPortalInvite } from "@/components/SendPortalInvite";
import { WeddingDocuments } from "@/components/WeddingDocuments";
import { loadRules, computeTotals, applyMarkup, platformFee, type Charge, type Payment } from "@/lib/billing/compute";
import { whatsappUrl, bookingNotificationMessage } from "@/lib/whatsapp";

type WeddingState = {
  rentalSelections?: Record<string, { sel?: boolean; qty?: number; mg?: boolean; wed?: boolean; fb?: boolean }>;
  catalogueSelections?: Record<string, { sel?: boolean; mg?: boolean; wed?: boolean; fb?: boolean }>;
  guests?: string[];
  roomAssignments?: Record<string, string[]>;
  suppliers?: Array<{ id: number; name: string; category?: string; status?: string; price?: string; fromVendorId?: string }>;
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
  const host = h.get("host") ?? "venuely.co.za";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const portalUrl = `${proto}://${host}/${slug}`;

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, guest_count, status, total_budget, notes, wedding_state, wedding_state_updated_at, portal_password_hash, invoiced_at, invoice_total, couple_paid_at, platform_fee_owed, platform_fee_paid_at, deposit_due_at, balance_due_at, area_selections")
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
  const coupleMembers = (coupleMembersRes.data ?? []) as unknown as Array<{
    user_id: string;
    profiles: { id: string; full_name: string | null } | null;
  }>;

  const state = (wedding.wedding_state ?? {}) as WeddingState;
  const rules = await loadRules(supabase, venue.id);

  const [rentalsRes, cataRes, accomRes, vendorsRes, areasRes, areaPricingRes, paymentsRes, chargesRes, docsRes] = await Promise.all([
    supabase.from("rental_items").select("id, name, price, commission_value, commission_type, item_code, cost_treatment").eq("venue_id", venue.id),
    supabase.from("catalogue_items").select("id, name, price, commission_value, commission_type, cost_treatment").eq("venue_id", venue.id),
    supabase.from("accommodation_rooms").select("id, name, price_per_night, commission_value, commission_type, tier, cost_treatment, contact_name, contact_phone, contact_email, website_url, address").eq("venue_id", venue.id),
    supabase.from("vendor_partners").select("id, name, vendor_type, price_from, commission_value, commission_type, cost_treatment, contact_phone, contact_email, website_url").eq("venue_id", venue.id),
    supabase.from("venue_areas").select("id, name, slug, area_kind").eq("venue_id", venue.id).eq("active", true),
    supabase.from("area_pricing").select("area_id, day_type, price"),
    supabase.from("payment_ledger").select("id, amount, direction, kind, method, reference, paid_at, notes").eq("wedding_id", wedding.id).order("paid_at", { ascending: false }),
    supabase.from("wedding_charges").select("id, kind, label, qty, unit_price, amount, is_refundable, is_auto, day_type, notes").eq("wedding_id", wedding.id),
    supabase.from("wedding_documents").select("id, label, url, kind, visible_to_couple, created_at").eq("wedding_id", wedding.id).order("created_at", { ascending: false }),
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

  // Catalogue (per-head)
  const guestCount = wedding.guest_count ?? 0;
  for (const [code, v] of Object.entries(state.catalogueSelections ?? {})) {
    if (!v.sel && !v.mg && !v.wed && !v.fb) continue;
    const item = cataMap.get(code); if (!item) continue;
    const days = [v.mg ? "M&G" : null, v.wed ? "Wed" : null, v.fb ? "FB" : null].filter(Boolean);
    const dayCount = days.length || 1;
    const baseUnit = Number(item.price);
    const unit = applyMarkup(baseUnit, item.commission_value, item.commission_type);
    const units = dayCount * guestCount;
    const total = unit * units;
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    charges.push({
      kind: "catalogue",
      label: `${item.name} (${dayCount} day${dayCount>1?"s":""} × ${guestCount} guests)${included ? " (included)" : ""}`,
      qty: units,
      unit_price: unit,
      amount: included ? 0 : total,
      base_amount: included ? 0 : baseUnit * units,
      is_refundable: false,
    });
  }

  // Accommodation
  for (const [roomId, names] of Object.entries(state.roomAssignments ?? {})) {
    const room = accomMap.get(roomId); if (!room || !names.length) continue;
    const baseUnit = Number(room.price_per_night);
    const unit = applyMarkup(baseUnit, room.commission_value, room.commission_type);
    const included = (room as { cost_treatment?: string }).cost_treatment === "included";
    charges.push({
      kind: "accommodation",
      label: `${room.name} (${names.length} guests, 1 night)${included ? " (included)" : ""}`,
      qty: 1,
      unit_price: unit,
      amount: included ? 0 : unit,
      base_amount: included ? 0 : baseUnit,
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
  })) as Payment[];

  const totals = computeTotals(rules, charges, payments);

  const platformFeeRate = Number((venue as { platform_fee_rate?: number }).platform_fee_rate ?? 0.01);
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
            {wedding.wedding_date ?? "Date TBD"} · {wedding.guest_count ?? "?"} guests · <span className="vy-tag vy-tag-soft">{wedding.status}</span>
          </p>
          {wedding.wedding_state_updated_at && (
            <p className="text-xs text-stone-500 mt-1">
              Couple last updated their portal: {new Date(wedding.wedding_state_updated_at).toLocaleString()}
            </p>
          )}
        </div>
        <Link href={`/${wedding.slug}`} target="_blank" className="vy-btn vy-btn-secondary">Open couple portal →</Link>
      </div>

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

      {/* Link lifecycle: rotate the access code, or remove a couple's account access. */}
      <div className="vy-card space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="vy-eyebrow">Access lifecycle</div>
        </div>
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

      <form action={updateWeddingBasics.bind(null, wedding.id, wedding.slug)} className="vy-card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-3 space-y-1"><label className="vy-label">Couple names</label><input name="couple_names" required defaultValue={wedding.couple_names} className="vy-input" /></div>
        <div className="md:col-span-2 space-y-1"><label className="vy-label">Date</label><input name="wedding_date" type="date" defaultValue={wedding.wedding_date ?? ""} className="vy-input" /></div>
        <div className="space-y-1"><label className="vy-label">Guests</label><input name="guest_count" type="number" min="0" defaultValue={wedding.guest_count ?? ""} className="vy-input" /></div>
        <div className="md:col-span-2 space-y-1"><label className="vy-label">Total budget (R)</label><input name="total_budget" type="number" step="0.01" defaultValue={wedding.total_budget ?? ""} className="vy-input" /></div>
        <div className="md:col-span-2 space-y-1"><label className="vy-label">Status</label>
          <select name="status" defaultValue={wedding.status} className="vy-select">
            <option value="inquiry">inquiry</option><option value="provisional">provisional</option>
            <option value="booked">booked</option><option value="completed">completed</option><option value="cancelled">cancelled</option>
          </select></div>
        <div className="md:col-span-2 space-y-1"><label className="vy-label">Notes</label><input name="notes" defaultValue={wedding.notes ?? ""} className="vy-input" /></div>
        <div className="md:col-span-6"><button className="vy-btn vy-btn-primary">Save changes</button></div>
      </form>

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
                    <td>{(p as Payment & { method?: string }).method ?? "—"}</td>
                    <td className="font-mono text-xs">{(p as Payment & { reference?: string }).reference ?? "—"}</td>
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
