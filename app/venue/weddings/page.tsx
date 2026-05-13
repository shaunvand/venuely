import Link from "next/link";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { createWedding } from "./actions";

export default async function VenueWeddings() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: weddings } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, guest_count, status")
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
        <div className="md:col-span-5 flex items-end">
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {weddings.map((w) => (
                <tr key={w.id}>
                  <td><div className="font-medium">{w.couple_names}</div></td>
                  <td>{w.wedding_date ?? "—"}</td>
                  <td>{w.guest_count ?? "—"}</td>
                  <td><span className="vy-tag vy-tag-soft">{w.status}</span></td>
                  <td className="font-mono text-xs text-stone-500">/{w.slug}</td>
                  <td className="text-right whitespace-nowrap">
                    <Link href={`/venue/weddings/${w.slug}`} className="vy-btn vy-btn-secondary mr-1">Manage</Link>
                    <Link href={`/${w.slug}`} className="vy-btn vy-btn-primary">Open portal →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
