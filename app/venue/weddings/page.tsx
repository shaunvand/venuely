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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Weddings · {venue.name}</h1>

      <form action={createWedding.bind(null, venue.id, venue.slug)} className="flex flex-wrap gap-2 border rounded p-4">
        <input name="couple_names" required placeholder="Couple names (Alex & Sam)" className="border rounded px-3 py-2 flex-1 min-w-60" />
        <input name="slug" required placeholder="url-slug" className="border rounded px-3 py-2 w-40" />
        <input name="wedding_date" type="date" className="border rounded px-3 py-2" />
        <input name="guest_count" type="number" min="0" placeholder="Guests" className="border rounded px-3 py-2 w-24" />
        <button className="px-4 py-2 bg-black text-white rounded">Create</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th>Couple</th><th>Date</th><th>Guests</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {weddings?.map((w) => (
            <tr key={w.id} className="border-t">
              <td className="py-2">{w.couple_names}</td>
              <td>{w.wedding_date}</td>
              <td>{w.guest_count}</td>
              <td>{w.status}</td>
              <td>
                <Link href={`/venue/weddings/${w.slug}`} className="text-blue-600 hover:underline text-xs">manage</Link>
                {" · "}
                <Link href={`/portal/${venue.slug}/${w.slug}`} className="text-blue-600 hover:underline text-xs">portal</Link>
              </td>
            </tr>
          ))}
          {!weddings?.length && <tr><td colSpan={5} className="py-4 text-gray-500">No weddings yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
