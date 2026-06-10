import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { YourVenueManager } from "@/components/YourVenueManager";
import { PortalDesigner } from "@/components/PortalDesigner";
import { resolveTemplate, resolveTheme } from "@/lib/portal/templates";

export default async function YourVenuePage() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const [{ data: media }, { data: floorplans }, { data: design }] = await Promise.all([
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
    supabase.from("venues").select("website, portal_template, portal_theme").eq("id", venue.id).single(),
  ]);

  const MEDIA_RE = /\.(jpe?g|png|webp|gif|avif|heic|mp4|mov|webm|m4v)(\?|$)/i;
  const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|heic|svg)(\?|$)/i;

  // Photos the owner marked as floor plans (interim category path) are pulled
  // out of the regular gallery so they only appear in the Floor Plans section.
  // Smart Import's PDF page-images arrive untagged but labelled (e.g. "Floor
  // Plan - Lodge Units"), so match on label too — otherwise a floor plan can
  // become the default couple-portal hero.
  const looksLikeFloorplan = (m: { category?: string | null; label?: string | null }) =>
    (m.category || "").trim().toLowerCase() === "floorplan" ||
    /floor\s*-?\s*plan|venue\s+layout|site\s*map|floorplan/i.test(String(m.label ?? ""));

  const clean = (media ?? [])
    .filter((m) => MEDIA_RE.test(String(m.url)))
    .filter((m) => !looksLikeFloorplan(m));

  const planMedia = [
    ...(floorplans ?? []),
    ...(media ?? []).filter((m) => looksLikeFloorplan(m)),
  ].filter((m) => IMAGE_RE.test(String(m.url)));

  // Portal design: chosen template + theme, falling back to the venue's existing
  // brand primary/logo when no portal theme has been saved yet.
  const designRow = design as { website: string | null; portal_template: string | null; portal_theme: unknown } | null;
  const initialTemplate = resolveTemplate(designRow?.portal_template).id;
  const savedTheme = resolveTheme(designRow?.portal_theme);
  const initialTheme = designRow?.portal_theme
    ? savedTheme
    : { primary: venue.branding_primary || savedTheme.primary, accent: savedTheme.accent, logoUrl: venue.branding_logo_url || null };
  const heroUrl = (clean[0]?.url as string | undefined) ?? null;
  const hasMedia = clean.length > 0 || planMedia.length > 0;

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

      {/* No photos yet → a highlighted call-to-action above the preview. */}
      {!hasMedia && <ImportPrompt highlighted />}

      <PortalDesigner
        venueId={venue.id}
        venueName={venue.name}
        website={designRow?.website ?? null}
        heroUrl={heroUrl}
        initialTemplate={initialTemplate}
        initialTheme={initialTheme}
        initiallySaved={!!designRow?.portal_theme}
      />

      <div id="venue-gallery">
        <YourVenueManager
          venueId={venue.id}
          items={clean as never}
          floorPlans={planMedia as never}
        />
      </div>

      {/* Once photos exist the prompt drops to the bottom, quietly. */}
      {hasMedia && <ImportPrompt />}
    </div>
  );
}

// Call-to-action nudging the venue to import/upload photos. `highlighted` is the
// attention-grabbing variant shown when no media exists yet.
function ImportPrompt({ highlighted = false }: { highlighted?: boolean }) {
  if (highlighted) {
    return (
      <a
        href="#venue-gallery"
        className="block rounded-2xl p-5 transition hover:shadow-md"
        style={{ background: "var(--cream)", border: "2px solid var(--peach)" }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{ background: "var(--peach)" }}>📸</span>
          <div className="flex-1 min-w-0">
            <div className="font-serif text-lg" style={{ fontWeight: 700 }}>Add your venue photos to bring the preview to life</div>
            <div className="text-sm" style={{ color: "var(--ink-2)" }}>
              Couples see these images in their portal. Import them from Google, run Smart Import, or upload your own — it only takes a minute.
            </div>
          </div>
          <span className="vy-btn vy-btn-primary flex-shrink-0">Add photos ↓</span>
        </div>
      </a>
    );
  }
  return (
    <a href="#venue-gallery" className="block text-center text-sm rounded-xl py-3 transition hover:bg-[color:var(--cream)]" style={{ border: "1px dashed var(--line)", color: "var(--ink-2)" }}>
      Need more photos? <span style={{ color: "var(--poppy)" }}>Import or upload more ↑</span>
    </a>
  );
}
