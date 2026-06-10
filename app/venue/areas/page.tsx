import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addArea } from "./actions";
import { AreaManager, type AreaRow } from "@/components/AreaManager";

export default async function VenueAreas() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: areas } = await supabase.from("venue_areas").select("id, name, slug, description, area_kind, active, sort_order").eq("venue_id", venue.id).order("sort_order");
  const areaIds = (areas ?? []).map((a) => a.id);
  const [{ data: pricing }, { data: areaImages }, { data: gallery }] = await Promise.all([
    areaIds.length
      ? supabase.from("area_pricing").select("area_id, day_type, price").in("area_id", areaIds)
      : Promise.resolve({ data: [] as { area_id: string; day_type: string; price: number }[] }),
    supabase.from("media_assets").select("id, url, owner_id, sort_order").eq("venue_id", venue.id).eq("owner_type", "area").order("sort_order"),
    supabase.from("media_assets").select("url, label, category").eq("venue_id", venue.id).eq("owner_type", "venue").eq("kind", "photo").order("sort_order"),
  ]);

  const priceMap: Record<string, Record<string, number>> = {};
  (pricing ?? []).forEach((p) => {
    priceMap[p.area_id] = priceMap[p.area_id] || {};
    priceMap[p.area_id][p.day_type] = Number(p.price);
  });
  const imageMap: Record<string, { id: string; url: string }[]> = {};
  (areaImages ?? []).forEach((m) => {
    const k = String(m.owner_id);
    (imageMap[k] ??= []).push({ id: m.id, url: m.url });
  });

  const areaRows: AreaRow[] = (areas ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    area_kind: a.area_kind,
    description: a.description,
    active: a.active,
    prices: priceMap[a.id] ?? {},
    images: imageMap[a.id] ?? [],
  }));
  const galleryImgs = (gallery ?? []).map((g) => ({ url: g.url as string, label: (g as { label?: string | null }).label ?? null, category: (g as { category?: string | null }).category ?? null }));

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Setup</div>
        <h1 className="vy-h1 mt-1">Venue areas</h1>
        <p className="text-stone-600 text-sm mt-1">
          Spaces couples can use across their day — included main areas and optional extras. Add photos, set a single hire fee or price per day type, and couples see them in their portal.
        </p>
      </header>

      <form action={addArea.bind(null, venue.id)} className="vy-card grid gap-2.5 md:grid-cols-6 items-end" style={{ padding: "1rem 1.25rem" }}>
        <div className="md:col-span-2 space-y-0.5">
          <label className="vy-label">Area name</label>
          <input name="name" required placeholder="Oak Tree" className="vy-input" />
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
        <p className="md:col-span-6 text-[11px] text-stone-400 leading-tight">Hire fee applies to all day types — leave the per-day fields blank to use it.</p>
      </form>

      <AreaManager venueId={venue.id} areas={areaRows} gallery={galleryImgs} />
    </div>
  );
}
