import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addArea, deleteArea, toggleAreaActive } from "./actions";

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
          Spaces couples can use across their day — included main areas and optional extras. Price varies per day type (M&G / Wedding / Farewell).
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
          <label className="vy-label">Wedding (R)</label>
          <input name="price_wedding" type="number" step="0.01" defaultValue="2500" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">M&G (R)</label>
          <input name="price_mg" type="number" step="0.01" defaultValue="2000" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Farewell (R)</label>
          <input name="price_farewell" type="number" step="0.01" defaultValue="2000" className="vy-input" />
        </div>
        <div className="md:col-span-5 space-y-1">
          <label className="vy-label">Description</label>
          <input name="description" placeholder="Open meadow ceremony spot, mountain backdrop" className="vy-input" />
        </div>
        <div className="md:col-span-1 flex items-end">
          <button className="vy-btn vy-btn-primary w-full">+ Add area</button>
        </div>
      </form>

      {!areas?.length ? (
        <div className="vy-empty">No areas yet. Add Oak Tree, Hall/Lapa, Pool, etc.</div>
      ) : (
        <div className="vy-card p-0 overflow-hidden">
          <table className="vy-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Kind</th>
                <th>Wedding</th>
                <th>M&G</th>
                <th>Farewell</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => {
                const p = priceMap[a.id] ?? {};
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="font-medium">{a.name}</div>
                      {a.description && <div className="text-xs text-stone-500 mt-0.5">{a.description}</div>}
                    </td>
                    <td><span className="vy-tag vy-tag-soft">{a.area_kind}</span></td>
                    <td>R{(p.wedding ?? 0).toLocaleString()}</td>
                    <td>R{(p.mg ?? 0).toLocaleString()}</td>
                    <td>R{(p.farewell ?? 0).toLocaleString()}</td>
                    <td>
                      <form action={toggleAreaActive.bind(null, a.id, !a.active)}>
                        <button className={a.active ? "text-emerald-700 text-xs" : "text-stone-400 text-xs"}>
                          {a.active ? "● Active" : "○ Hidden"}
                        </button>
                      </form>
                    </td>
                    <td className="text-right">
                      <form action={deleteArea.bind(null, a.id)}>
                        <button className="vy-btn vy-btn-danger text-xs">Remove</button>
                      </form>
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
