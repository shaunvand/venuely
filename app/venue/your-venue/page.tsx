import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { YourVenueManager } from "@/components/YourVenueManager";

export default async function YourVenuePage() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: media } = await supabase
    .from("media_assets")
    .select("id, url, label, kind, category, sort_order")
    .eq("venue_id", venue.id)
    .eq("owner_type", "venue")
    .in("kind", ["photo", "video", "hero"])
    .order("sort_order");

  const MEDIA_RE = /\.(jpe?g|png|webp|gif|avif|heic|mp4|mov|webm|m4v)(\?|$)/i;
  const clean = (media ?? []).filter((m) => MEDIA_RE.test(String(m.url)));

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

      <YourVenueManager venueId={venue.id} items={clean as never} />
    </div>
  );
}
