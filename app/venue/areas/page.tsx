import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addArea, deleteArea, toggleAreaActive, updateArea, updateAreaPrice } from "./actions";

const DAY_TYPES: Array<{ key: string; label: string }> = [
  { key: "wedding", label: "Wedding" },
  { key: "mg", label: "M&G" },
  { key: "farewell", label: "Farewell" },
];

export default async function VenueAreas() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const [{ data: areas }, { data: pricing }] = await Promise.all([
    supabase.from("venue_areas").select("id, name, slug, description, area_kind, active, sort_order").eq("venue_id", venue.id).order("sort_order"),
    supabase.from("area_pricing").select("area_id, day_type, price"),
  ]);
  const priceMap: Record<string, Record<string, number>> = {};
  (pricing ?? []).forEach((p) => {
    priceMap[p.area_id] = priceMap[p.area_id] || {};
    priceMap[p.area_id][p.day_type] = Number(p.price);
  });

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Setup</div>
        <h1 className="vy-h1 mt-1">Venue areas</h1>
        <p className="text-stone-600 text-sm mt-1">
          Spaces couples can use across their day — included main areas and optional extras. Set a single hire fee, or price per day type if your day types differ.
        </p>
      </header>

      <form action={addArea.bind(null, venue.id)} className="vy-card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Area name</label>
          <input name="name" required placeholder="Oak Tree" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Kind</label>
          <select name="area_kind" className="vy-select" defaultValue="extra">
            <option value="main">Main (included)</option>
            <option value="extra">Extra (paid)</option>
            <option value="overflow">Overflow</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="vy-label">Hire fee (R)</label>
          <input name="price_hire" type="number" step="0.01" min="0" placeholder="0" className="vy-input" />
          <p className="text-[11px] text-stone-400">Applies to all day types — leave the three below blank.</p>
        </div>
        <div className="md:col-span-2" />
        <div className="space-y-1">
          <label className="vy-label">Wedding (R)</label>
          <input name="price_wedding" type="number" step="0.01" min="0" placeholder="0" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">M&G (R)</label>
          <input name="price_mg" type="number" step="0.01" min="0" placeholder="0" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Farewell (R)</label>
          <input name="price_farewell" type="number" step="0.01" min="0" placeholder="0" className="vy-input" />
        </div>
        <div className="md:col-span-3 space-y-1">
          <label className="vy-label">Description</label>
          <input name="description" placeholder="Open meadow ceremony spot, mountain backdrop" className="vy-input" />
        </div>
        <div className="md:col-span-6 flex justify-end">
          <button className="vy-btn vy-btn-primary">+ Add area</button>
        </div>
      </form>

      {!areas?.length ? (
        <div className="vy-empty">No areas yet. Add Oak Tree, Hall/Lapa, Pool, etc.</div>
      ) : (
        <div className="space-y-4">
          {areas.map((a) => {
            const p = priceMap[a.id] ?? {};
            return (
              <div key={a.id} className="vy-card space-y-4">
                <form action={updateArea.bind(null, a.id)} className="grid gap-3 md:grid-cols-6 items-end">
                  <div className="md:col-span-2 space-y-1">
                    <label className="vy-label">Area name</label>
                    <input name="name" required defaultValue={a.name} className="vy-input" />
                  </div>
                  <div className="space-y-1">
                    <label className="vy-label">Kind</label>
                    <select name="area_kind" className="vy-select" defaultValue={a.area_kind}>
                      <option value="main">Main (included)</option>
                      <option value="extra">Extra (paid)</option>
                      <option value="overflow">Overflow</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="vy-label">Description</label>
                    <input name="description" defaultValue={a.description ?? ""} placeholder="Short description" className="vy-input" />
                  </div>
                  <div className="flex">
                    <button className="vy-btn vy-btn-secondary text-xs w-full">Save details</button>
                  </div>
                </form>

                <div className="grid gap-3 md:grid-cols-3">
                  {DAY_TYPES.map((dt) => (
                    <form key={dt.key} action={updateAreaPrice.bind(null, a.id, dt.key)} className="space-y-1">
                      <label className="vy-label">{dt.label} (R)</label>
                      <div className="flex gap-2">
                        <input
                          name="price"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={p[dt.key] ?? 0}
                          className="vy-input"
                        />
                        <button className="vy-btn vy-btn-secondary text-xs whitespace-nowrap">Save</button>
                      </div>
                    </form>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                  <form action={toggleAreaActive.bind(null, a.id, !a.active)}>
                    <button className={a.active ? "text-emerald-700 text-xs" : "text-stone-400 text-xs"}>
                      {a.active ? "● Active" : "○ Hidden"}
                    </button>
                  </form>
                  <form action={deleteArea.bind(null, a.id)}>
                    <button className="vy-btn vy-btn-danger text-xs">Remove</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
