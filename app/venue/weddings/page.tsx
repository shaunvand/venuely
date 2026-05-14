import { headers } from "next/headers";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { createWedding, setPortalPassword, markCouplePaid } from "./actions";
import { WeddingRowActions } from "@/components/WeddingRowActions";

export default async function VenueWeddings() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const h = await headers();
  const host = h.get("host") ?? "venuely.co.za";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;

  const { data: weddings } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, guest_count, status, portal_password_hash, invoiced_at, couple_paid_at, platform_fee_owed, platform_fee_paid_at")
    .eq("venue_id", venue.id)
    .order("wedding_date", { ascending: false });

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Customers</div>
        <h1 className="vy-h1 mt-1">Weddings at {venue.name}</h1>
        <p className="text-stone-600 text-sm mt-1">
          Add a booked couple to generate their private portal URL.
        </p>
      </header>

      <form action={createWedding.bind(null, venue.id, venue.slug)} className="vy-card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-3 space-y-1">
          <label className="vy-label">Couple names</label>
          <input name="couple_names" required placeholder="Alex & Sam" className="vy-input" />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">URL slug (optional)</label>
          <input name="slug" placeholder="auto-generated" className="vy-input font-mono text-sm" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Guests</label>
          <input name="guest_count" type="number" min="0" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Date</label>
          <input name="wedding_date" type="date" className="vy-input" />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Status</label>
          <select name="status" defaultValue="inquiry" className="vy-select">
            <option value="inquiry">inquiry</option>
            <option value="provisional">provisional</option>
            <option value="booked">booked</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <div className="md:col-span-3 space-y-1">
          <label className="vy-label">Portal password (optional)</label>
          <input name="portal_password" type="text" placeholder="Leave blank for Supabase login access" className="vy-input" autoComplete="off" />
        </div>
        <div className="md:col-span-6 flex justify-end">
          <button className="vy-btn vy-btn-primary">+ Add wedding</button>
        </div>
      </form>

      {!weddings?.length ? (
        <div className="vy-empty">No weddings yet — add one above to generate the couple&apos;s portal URL.</div>
      ) : (
        <div className="vy-card p-0 overflow-hidden">
          <table className="vy-table">
            <thead>
              <tr>
                <th>Couple</th>
                <th>Date</th>
                <th>Guests</th>
                <th>Status</th>
                <th>Portal URL</th>
                <th>Fee</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {weddings.map((w) => {
                const portalUrl = `${base}/${w.slug}`;
                return (
                  <tr key={w.id} className="align-top">
                    <td><div className="font-medium">{w.couple_names}</div></td>
                    <td>{w.wedding_date ?? "—"}</td>
                    <td>{w.guest_count ?? "—"}</td>
                    <td><span className="vy-tag vy-tag-soft">{w.status}</span></td>
                    <td className="font-mono text-xs text-stone-500 max-w-[180px] truncate" title={portalUrl}>{portalUrl}</td>
                    <td className="text-xs">
                      {w.platform_fee_paid_at ? <span className="text-emerald-700">✓ settled</span>
                        : w.platform_fee_owed ? <span className="text-amber-700">R{Number(w.platform_fee_owed).toLocaleString()}</span>
                        : <span className="text-stone-400">—</span>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <WeddingRowActions
                        portalUrl={portalUrl}
                        slug={w.slug}
                        passwordSet={!!w.portal_password_hash}
                        invoicedAt={w.invoiced_at}
                        couplePaidAt={w.couple_paid_at}
                        setPasswordAction={setPortalPassword.bind(null, w.id, w.slug)}
                        markCouplePaidAction={markCouplePaid.bind(null, w.id, w.slug)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
