import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addRoom } from "./actions";
import { InventoryManager } from "@/components/InventoryManager";
import { INVENTORY_FIELDS } from "@/lib/inventory/schemas";

export default async function VenueAccommodation() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("accommodation_rooms")
    .select("id, name, room_type, sleeps, price_per_night, description, active, image_url")
    .eq("venue_id", venue.id)
    .order("sort_order");

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">On-site stays</div>
        <h1 className="vy-h1 mt-1">Accommodation</h1>
        <p className="text-stone-600 text-sm mt-1">
          Cottages, suites, tents — anything on the property. Couples assign their guests to rooms.
        </p>
      </header>

      <form action={addRoom.bind(null, venue.id)} className="vy-card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-3 space-y-1">
          <label className="vy-label">Room name</label>
          <input name="name" required placeholder="Oak Cottage" className="vy-input" />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Type</label>
          <input name="room_type" placeholder="Cottage / Suite / Tent" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Sleeps</label>
          <input name="sleeps" type="number" min="1" defaultValue="2" className="vy-input" />
        </div>
        <div className="md:col-span-4 space-y-1">
          <label className="vy-label">Description</label>
          <input name="description" placeholder="Open-plan cottage with double bed, slipper bath, fireplace…" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">R / night</label>
          <input name="price_per_night" type="number" step="0.01" required defaultValue="0" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">&nbsp;</label>
          <button className="vy-btn vy-btn-primary w-full">+ Add</button>
        </div>
      </form>

      <InventoryManager
        type="accommodation"
        venueId={venue.id}
        items={(rooms ?? []) as Array<Record<string, unknown> & { id: string }>}
        fields={INVENTORY_FIELDS.accommodation.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? null }))}
        priceColumn="price_per_night"
      />
    </div>
  );
}
