import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addRoom, deleteRoom, toggleRoomActive } from "./actions";

export default async function VenueAccommodation() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("accommodation_rooms")
    .select("id, name, room_type, sleeps, price_per_night, active")
    .eq("venue_id", venue.id)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accommodation · {venue.name}</h1>

      <form action={addRoom.bind(null, venue.id)} className="flex flex-wrap gap-2 border rounded p-4">
        <input name="name" required placeholder="Room name" className="border rounded px-3 py-2 flex-1 min-w-40" />
        <input name="room_type" placeholder="Type (cottage / suite)" className="border rounded px-3 py-2" />
        <input name="sleeps" type="number" min="1" defaultValue="2" className="border rounded px-3 py-2 w-20" />
        <input name="price_per_night" type="number" step="0.01" required defaultValue="0" placeholder="R/night" className="border rounded px-3 py-2 w-28" />
        <input name="description" placeholder="Description" className="border rounded px-3 py-2 w-full" />
        <button className="px-4 py-2 bg-black text-white rounded">Add room</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th>Name</th><th>Type</th><th>Sleeps</th><th>R/night</th><th>Active</th><th></th></tr>
        </thead>
        <tbody>
          {rooms?.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2">{r.name}</td>
              <td>{r.room_type}</td>
              <td>{r.sleeps}</td>
              <td>R{Number(r.price_per_night).toLocaleString()}</td>
              <td>
                <form action={toggleRoomActive.bind(null, r.id, !r.active)}>
                  <button className={r.active ? "text-green-600" : "text-gray-400"}>{r.active ? "✓" : "○"}</button>
                </form>
              </td>
              <td>
                <form action={deleteRoom.bind(null, r.id)}>
                  <button className="text-red-600 text-xs hover:underline">delete</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
