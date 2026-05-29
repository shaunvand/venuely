import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { YourVenueManager } from "@/components/YourVenueManager";

export default async function YourVenuePage() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const [{ data: media }, { data: floorplans }] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id, url, label, kind, category, sort_order")
      .eq("venue_id", venue.id)
      .eq("owner_type", "venue")
      .in("kind", ["photo", "video", "hero"])
      .order("sort_order"),
    // Floor-plan / layout images live as media_assets with kind='floorplan'
    // (what the couple-portal Floor Plans tab reads). The gallery upload route
    // can only set kind='photo', so newly uploaded floor plans are tagged
    // category='floorplan' until the API accepts a kind param — surface both.
    supabase
      .from("media_assets")
      .select("id, url, label, kind, category, sort_order")
      .eq("venue_id", venue.id)
      .eq("owner_type", "venue")
      .eq("kind", "floorplan")
      .order("sort_order"),
  ]);

  const MEDIA_RE = /\.(jpe?g|png|webp|gif|avif|heic|mp4|mov|webm|m4v)(\?|$)/i;
  const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|heic|svg)(\?|$)/i;

  // Photos the owner marked as floor plans (interim category path) are pulled
  // out of the regular gallery so they only appear in the Floor Plans section.
  const isFloorplanCategory = (c: string | null) =>
    (c || "").trim().toLowerCase() === "floorplan";

  const clean = (media ?? [])
    .filter((m) => MEDIA_RE.test(String(m.url)))
    .filter((m) => !isFloorplanCategory(m.category));

  const planMedia = [
    ...(floorplans ?? []),
    ...(media ?? []).filter((m) => isFloorplanCategory(m.category)),
  ].filter((m) => IMAGE_RE.test(String(m.url)));

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Overview</div>
        <h1 className="vy-h1 mt-1">Your Venue</h1>
        <p className="text-stone-600 text-sm mt-1">
          Photos and videos of your venue, grouped by location. These power the
          &ldquo;Our Venue&rdquo; gallery couples see in their portal. Use Smart
          Import to auto-pull and label images already uploaded elsewhere.
        </p>
      </header>

      <YourVenueManager
        venueId={venue.id}
        items={clean as never}
        floorPlans={planMedia as never}
      />
    </div>
  );
}
