import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addRoom, deleteRoom, toggleRoomActive } from "./actions";
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

      <InventoryManager
        type="accommodation"
        venueId={venue.id}
        items={(rooms ?? []) as Array<Record<string, unknown> & { id: string }>}
        fields={INVENTORY_FIELDS.accommodation.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? null }))}
        priceColumn="price_per_night"
      />

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

      {!rooms?.length ? (
        <div className="vy-empty">No accommodation yet. Add your first room above.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rooms.map((r) => (
            <div key={r.id} className="vy-card flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl text-[color:var(--forest)]">{r.name}</h3>
                  <div className="text-xs text-stone-500 mt-1 flex gap-3">
                    {r.room_type && <span>{r.room_type}</span>}
                    <span>Sleeps {r.sleeps}</span>
                    <span>R{Number(r.price_per_night).toLocaleString()}/night</span>
                  </div>
                </div>
                <span className={`vy-tag ${r.active ? "vy-tag-active" : "vy-tag-soft"}`}>
                  {r.active ? "active" : "hidden"}
                </span>
              </div>
              {r.description && (
                <p className="text-sm text-stone-600 mt-3 whitespace-pre-line">{r.description}</p>
              )}
              <div className="flex gap-2 mt-4 pt-4 border-t border-[color:var(--line)]">
                <form action={toggleRoomActive.bind(null, r.id, !r.active)}>
                  <button className="vy-btn vy-btn-ghost text-sm">{r.active ? "Hide" : "Show"}</button>
                </form>
                <form action={deleteRoom.bind(null, r.id)}>
                  <button className="vy-btn vy-btn-danger">Remove</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
