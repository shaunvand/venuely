import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import {
  updateWeddingBasics, setPortalPassword,
  markInvoiced, markCouplePaid, markPlatformFeePaid,
} from "../actions";
import { PortalLinkCard } from "@/components/PortalLinkCard";

type WeddingState = {
  rentalSelections?: Record<string, { sel?: boolean; qty?: number; mg?: boolean; wed?: boolean; fb?: boolean }>;
  catalogueSelections?: Record<string, { sel?: boolean; mg?: boolean; wed?: boolean; fb?: boolean }>;
  guests?: string[];
  roomAssignments?: Record<string, string[]>;
  totalBudget?: string;
  suppliers?: Array<{ id: number; name: string; category?: string; status?: string; price?: string; depositPaid?: boolean; finalPaymentPaid?: boolean; fromVendorId?: string }>;
};

function applyMarkup(price: number, value: number | null | undefined, type: string | null | undefined): number {
  const v = Number(value ?? 0);
  if (!v) return price;
  if (type === "percent") return Math.round((price * (1 + v / 100)) * 100) / 100;
  return Math.round((price + v) * 100) / 100;
}

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
    .select("id, slug, couple_names, wedding_date, guest_count, status, total_budget, notes, wedding_state, wedding_state_updated_at, portal_password_hash, invoiced_at, invoice_total, couple_paid_at, platform_fee_owed, platform_fee_paid_at")
    .eq("venue_id", venue.id)
    .eq("slug", slug)
    .single();
  if (!wedding) notFound();

  const state = (wedding.wedding_state ?? {}) as WeddingState;
  const platformFeeRate = Number((venue as { platform_fee_rate?: number }).platform_fee_rate ?? 0.01);

  const [rentals, catalogueItems, accomRooms, vendors] = await Promise.all([
    supabase.from("rental_items").select("id, name, price, commission_value, commission_type").eq("venue_id", venue.id),
    supabase.from("catalogue_items").select("id, name, price, commission_value, commission_type").eq("venue_id", venue.id),
    supabase.from("accommodation_rooms").select("id, name, price_per_night, commission_value, commission_type").eq("venue_id", venue.id),
    supabase.from("vendor_partners").select("id, name, vendor_type, price_from, commission_value, commission_type").eq("venue_id", venue.id),
  ]);
  const rentalMap = new Map((rentals.data ?? []).map((r) => [r.id, r]));
  const cataMap = new Map((catalogueItems.data ?? []).map((c) => [c.id, c]));
  const accomMap = new Map((accomRooms.data ?? []).map((r) => [r.id, r]));
  const vendorMap = new Map((vendors.data ?? []).map((v) => [v.id, v]));

  // Build line items
  const rentalsSelected = Object.entries(state.rentalSelections ?? {}).filter(([, v]) => v.sel);
  let rentalsTotal = 0;
  const rentalLines = rentalsSelected.map(([code, v]) => {
    const item = rentalMap.get(code);
    const days = [v.mg ? "M&G" : "", v.wed ? "Wed" : "", v.fb ? "FB" : ""].filter(Boolean);
    const dayCount = days.length || 1;
    const qty = v.qty ?? 1;
    const unitPrice = item ? applyMarkup(Number(item.price), item.commission_value, item.commission_type) : 0;
    const cost = unitPrice * dayCount * qty;
    rentalsTotal += cost;
    return { code, name: item?.name ?? code, days, qty, cost };
  });

  const catalogueSelected = Object.entries(state.catalogueSelections ?? {}).filter(([, v]) => v.sel || v.mg || v.wed || v.fb);
  let cataTotal = 0;
  const cataLines = catalogueSelected.map(([code, v]) => {
    const item = cataMap.get(code);
    const days = [v.mg ? "M&G" : "", v.wed ? "Wed" : "", v.fb ? "FB" : ""].filter(Boolean);
    const dayCount = days.length || 1;
    const unitPrice = item ? applyMarkup(Number(item.price), item.commission_value, item.commission_type) : 0;
    const cost = unitPrice * dayCount * (wedding.guest_count ?? 0);
    cataTotal += cost;
    return { code, name: item?.name ?? code, days, cost };
  });

  // Booked suppliers (couple's own list, with prices typed in or from vendor recommendations)
  const supplierLines = (state.suppliers ?? [])
    .filter((s) => s.status === "booked" || parseMoney(s.price) > 0)
    .map((s) => {
      const v = s.fromVendorId ? vendorMap.get(s.fromVendorId) : null;
      const fallback = v ? applyMarkup(Number(v.price_from ?? 0), v.commission_value, v.commission_type) : 0;
      const cost = parseMoney(s.price) || fallback;
      return { id: s.id, name: s.name, category: s.category ?? "", cost, status: s.status ?? "pending" };
    });
  const suppliersTotal = supplierLines.reduce((a, s) => a + s.cost, 0);

  const accomLines = Object.entries(state.roomAssignments ?? {}).map(([roomId, names]) => {
    const r = accomMap.get(roomId);
    const unit = r ? applyMarkup(Number(r.price_per_night), r.commission_value, r.commission_type) : 0;
    return { id: roomId, name: r?.name ?? roomId, guests: names.length, cost: unit };
  });
  const accomTotal = accomLines.reduce((a, x) => a + x.cost, 0);

  const grandTotal = rentalsTotal + cataTotal + accomTotal + suppliersTotal;
  const projectedFee = Math.round(grandTotal * platformFeeRate * 100) / 100;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <div className="vy-eyebrow">Wedding</div>
          <h1 className="vy-h1 mt-1">{wedding.couple_names}</h1>
          <p className="text-stone-600 text-sm">{wedding.wedding_date ?? "Date TBD"} · {wedding.guest_count ?? "?"} guests · <span className="vy-tag vy-tag-soft">{wedding.status}</span></p>
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

      <form action={updateWeddingBasics.bind(null, wedding.id, wedding.slug)} className="vy-card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-3 space-y-1">
          <label className="vy-label">Couple names</label>
          <input name="couple_names" required defaultValue={wedding.couple_names} className="vy-input" />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Date</label>
          <input name="wedding_date" type="date" defaultValue={wedding.wedding_date ?? ""} className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Guests</label>
          <input name="guest_count" type="number" min="0" defaultValue={wedding.guest_count ?? ""} className="vy-input" />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Total budget (R)</label>
          <input name="total_budget" type="number" step="0.01" defaultValue={wedding.total_budget ?? ""} className="vy-input" />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Status</label>
          <select name="status" defaultValue={wedding.status} className="vy-select">
            <option value="inquiry">inquiry</option>
            <option value="provisional">provisional</option>
            <option value="booked">booked</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Notes</label>
          <input name="notes" defaultValue={wedding.notes ?? ""} className="vy-input" />
        </div>
        <div className="md:col-span-6">
          <button className="vy-btn vy-btn-primary">Save changes</button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Rentals" value={`R${rentalsTotal.toLocaleString()}`} />
        <Stat label="Catalogue" value={`R${cataTotal.toLocaleString()}`} />
        <Stat label="Accommodation" value={`R${accomTotal.toLocaleString()}`} />
        <Stat label="Suppliers" value={`R${suppliersTotal.toLocaleString()}`} />
      </div>

      <div className="vy-card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="vy-eyebrow">Grand total (couple sees)</div>
            <div className="font-serif text-3xl mt-1">R{grandTotal.toLocaleString()}</div>
            <div className="text-xs text-stone-500 mt-1">Platform fee at {(platformFeeRate * 100).toFixed(2)}%: R{projectedFee.toLocaleString()}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!wedding.invoiced_at ? (
              <form action={markInvoiced.bind(null, wedding.id, wedding.slug, grandTotal, platformFeeRate)}>
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
        <div className="grid grid-cols-3 gap-3 text-sm border-t border-stone-200 pt-3">
          <div>
            <div className="text-stone-500 text-xs">Invoiced</div>
            <div>{wedding.invoiced_at ? new Date(wedding.invoiced_at).toLocaleDateString() + ` · R${Number(wedding.invoice_total ?? 0).toLocaleString()}` : "—"}</div>
          </div>
          <div>
            <div className="text-stone-500 text-xs">Couple paid</div>
            <div>{wedding.couple_paid_at ? new Date(wedding.couple_paid_at).toLocaleDateString() : "—"}</div>
          </div>
          <div>
            <div className="text-stone-500 text-xs">Platform fee</div>
            <div>{wedding.platform_fee_paid_at ? `Settled ${new Date(wedding.platform_fee_paid_at).toLocaleDateString()}` : wedding.platform_fee_owed ? `R${Number(wedding.platform_fee_owed).toLocaleString()} due` : "—"}</div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Rentals selected ({rentalLines.length})</h2>
        {rentalLines.length === 0 ? <p className="text-sm text-stone-500">No rentals selected.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-stone-500 text-xs">
              <tr><th className="py-2">Item</th><th>Qty</th><th>Days</th><th className="text-right">Cost</th></tr>
            </thead>
            <tbody>
              {rentalLines.map((r) => (
                <tr key={r.code} className="border-t border-stone-100">
                  <td className="py-2">{r.name}</td><td>{r.qty}</td><td>{r.days.join(" · ") || "—"}</td><td className="text-right">R{r.cost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Catalogue ({cataLines.length})</h2>
        {cataLines.length === 0 ? <p className="text-sm text-stone-500">Nothing ticked.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-stone-500 text-xs">
              <tr><th className="py-2">Item</th><th>Days</th><th className="text-right">Cost</th></tr>
            </thead>
            <tbody>
              {cataLines.map((c) => (
                <tr key={c.code} className="border-t border-stone-100">
                  <td className="py-2">{c.name}</td><td>{c.days.join(" · ") || "—"}</td><td className="text-right">R{c.cost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Suppliers ({supplierLines.length})</h2>
        {supplierLines.length === 0 ? <p className="text-sm text-stone-500">No suppliers on the couple&apos;s list yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-stone-500 text-xs">
              <tr><th className="py-2">Supplier</th><th>Category</th><th>Status</th><th className="text-right">Cost</th></tr>
            </thead>
            <tbody>
              {supplierLines.map((s) => (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="py-2">{s.name}</td><td>{s.category}</td><td><span className="vy-tag vy-tag-soft">{s.status}</span></td><td className="text-right">R{s.cost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="vy-card">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
