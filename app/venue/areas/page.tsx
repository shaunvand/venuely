import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addArea } from "./actions";
import { AreaManager, AreaSaveBar, type AreaRow } from "@/components/AreaManager";
import { SeasonsManager, type SeasonRow, type GroupRow } from "@/components/SeasonsManager";

export default async function VenueAreas() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const [{ data: areas }, { data: groups }, { data: seasons }] = await Promise.all([
    supabase.from("venue_areas").select("id, name, slug, description, area_kind, active, sort_order, group_id").eq("venue_id", venue.id).order("sort_order"),
    supabase.from("venue_area_groups").select("id, name, included, location, sort_order").eq("venue_id", venue.id).order("sort_order"),
    supabase.from("venue_seasons").select("id, name, start_month, start_day, end_month, end_day, sort_order").eq("venue_id", venue.id).order("sort_order"),
  ]);
  const areaIds = (areas ?? []).map((a) => a.id);
  const [{ data: pricing }, { data: areaImages }, { data: gallery }] = await Promise.all([
    areaIds.length
      ? supabase.from("area_pricing").select("area_id, day_type, price, season_id").in("area_id", areaIds)
      : Promise.resolve({ data: [] as { area_id: string; day_type: string; price: number; season_id: string | null }[] }),
    supabase.from("media_assets").select("id, url, owner_id, sort_order").eq("venue_id", venue.id).eq("owner_type", "area").order("sort_order"),
    supabase.from("media_assets").select("url, label, category").eq("venue_id", venue.id).eq("owner_type", "venue").eq("kind", "photo").order("sort_order"),
  ]);

  // Flat list of all price rows per area (mg/farewell with season_id NULL,
  // wedding one row per season + a NULL fallback). AreaManager resolves these.
  const priceRows: Record<string, { day_type: string; price: number; season_id: string | null }[]> = {};
  (pricing ?? []).forEach((p) => {
    (priceRows[p.area_id] ??= []).push({ day_type: p.day_type, price: Number(p.price), season_id: (p as { season_id?: string | null }).season_id ?? null });
  });
  const imageMap: Record<string, { id: string; url: string }[]> = {};
  (areaImages ?? []).forEach((m) => {
    const k = String(m.owner_id);
    (imageMap[k] ??= []).push({ id: m.id, url: m.url });
  });

  const seasonRows = (seasons ?? []) as SeasonRow[];
  const groupRows = (groups ?? []) as GroupRow[];

  const areaRows: AreaRow[] = (areas ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    area_kind: a.area_kind,
    description: a.description,
    active: a.active,
    group_id: (a as { group_id?: string | null }).group_id ?? null,
    priceRows: priceRows[a.id] ?? [],
    images: imageMap[a.id] ?? [],
  }));
  const galleryImgs = (gallery ?? []).map((g) => ({ url: g.url as string, label: (g as { label?: string | null }).label ?? null, category: (g as { category?: string | null }).category ?? null }));

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Setup</div>
        <h1 className="vy-h1 mt-1">Venue areas</h1>
        <p className="text-stone-600 text-sm mt-1">
          Spaces couples can use across their day — included main areas and optional extras. Group them into sub-categories, define your seasons, and set seasonal wedding-day pricing.
        </p>
      </header>

      <SeasonsManager venueId={venue.id} seasons={seasonRows} groups={groupRows} />

      <form action={addArea.bind(null, venue.id)} className="vy-card grid gap-2.5 md:grid-cols-6 items-end" style={{ padding: "1rem 1.25rem" }}>
        <div className="md:col-span-2 space-y-0.5">
          <label className="vy-label">Area name</label>
          <input name="name" required placeholder="Oak Tree" className="vy-input" />
        </div>
        <div className="space-y-0.5">
          <label className="vy-label">Sub-category</label>
          <select name="group_id" className="vy-select" defaultValue="none">
            <option value="none">No group</option>
            {groupRows.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-0.5">
          <label className="vy-label">Kind</label>
          <select name="area_kind" className="vy-select" defaultValue="extra">
            <option value="main">Main (included)</option>
            <option value="extra">Extra (paid)</option>
            <option value="overflow">Overflow</option>
          </select>
        </div>
        <div className="space-y-0.5">
          <label className="vy-label">Hire fee (R)</label>
          <input name="price_hire" type="number" step="0.01" min="0" placeholder="0" className="vy-input" />
        </div>
        <div className="space-y-0.5">
          <label className="vy-label">Wedding (R)</label>
          <input name="price_wedding" type="number" step="0.01" min="0" placeholder="0" className="vy-input" />
        </div>
        <div className="space-y-0.5">
          <label className="vy-label">M&G (R)</label>
          <input name="price_mg" type="number" step="0.01" min="0" placeholder="0" className="vy-input" />
        </div>
        <div className="space-y-0.5">
          <label className="vy-label">Farewell (R)</label>
          <input name="price_farewell" type="number" step="0.01" min="0" placeholder="0" className="vy-input" />
        </div>
        <div className="md:col-span-3 space-y-0.5">
          <label className="vy-label">Description</label>
          <input name="description" placeholder="Open meadow ceremony spot, mountain backdrop" className="vy-input" />
        </div>
        <div className="md:col-span-2 flex justify-end items-end">
          <button className="vy-btn vy-btn-primary whitespace-nowrap">+ Add area</button>
        </div>
        <p className="md:col-span-6 text-[11px] text-stone-400 leading-tight">Hire fee applies to all day types — leave the per-day fields blank to use it. Set per-season wedding-day prices on each area card below.</p>
      </form>

      <AreaManager venueId={venue.id} areas={areaRows} gallery={galleryImgs} seasons={seasonRows} groups={groupRows} />

      {areaRows.length > 0 && <AreaSaveBar />}
    </div>
  );
}
