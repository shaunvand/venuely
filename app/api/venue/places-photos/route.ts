import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// Pull a venue's own photos from Google Places and add them to the "Your Venue"
// gallery. These are the real photos of that specific property (far more
// relevant than stock), keyed off the google_place_id we captured at onboarding.
//
// IMPORTANT — keys: the public NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is HTTP-referrer
// restricted, which Google forbids for server-side web-service calls. This route
// needs a SEPARATE server key in GOOGLE_PLACES_API_KEY (no referrer restriction;
// ideally IP-restricted to Render, with the Places API enabled).

async function authVenue(venueId: string) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };
  const [{ data: member }, { data: profile }] = await Promise.all([
    auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle(),
    auth.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!member && profile?.role !== "owner") return { ok: false as const, status: 403, error: "Not your venue" };
  return { ok: true as const };
}

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Strip the <a>…</a> wrapper Google returns in html_attributions down to text.
function plainAttribution(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

const MAX_PHOTOS = 8;

export async function POST(req: NextRequest) {
  try {
    const { venue_id } = await req.json();
    const venueId = String(venue_id || "").trim();
    if (!venueId || !/^[a-zA-Z0-9-]+$/.test(venueId))
      return NextResponse.json({ error: "Missing or invalid venue_id" }, { status: 400 });

    const gate = await authVenue(venueId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "GOOGLE_PLACES_API_KEY not configured. Add a server Google API key (Places API enabled, no referrer restriction) on Render." },
        { status: 503 },
      );
    }

    const sb = admin();

    const { data: venue } = await sb
      .from("venues")
      .select("id, name, region, address, google_place_id")
      .eq("id", venueId)
      .single();
    if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

    // 1) Resolve the Google place_id (stored at onboarding, else text search).
    let placeId = (venue.google_place_id as string | null) || "";
    if (!placeId) {
      const q = [venue.name, venue.address || venue.region].filter(Boolean).join(", ");
      if (!q) return NextResponse.json({ error: "No google_place_id and no name/address to search by." }, { status: 422 });
      const findUrl = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
      findUrl.searchParams.set("input", q);
      findUrl.searchParams.set("inputtype", "textquery");
      findUrl.searchParams.set("fields", "place_id");
      findUrl.searchParams.set("key", key);
      const findRes = await fetch(findUrl);
      const findData = await findRes.json();
      if (findData.status !== "OK" || !findData.candidates?.length) {
        return NextResponse.json({ error: `Google could not find this venue (${findData.status || findRes.status}). ${findData.error_message ?? ""}`.trim() }, { status: 502 });
      }
      placeId = findData.candidates[0].place_id;
    }

    // 2) Place Details → photo references + attributions.
    const detUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    detUrl.searchParams.set("place_id", placeId);
    detUrl.searchParams.set("fields", "photos,name");
    detUrl.searchParams.set("key", key);
    const detRes = await fetch(detUrl);
    const detData = await detRes.json();
    if (detData.status !== "OK") {
      return NextResponse.json({ error: `Google Place Details ${detData.status || detRes.status}. ${detData.error_message ?? ""}`.trim() }, { status: 502 });
    }
    const photos = (detData.result?.photos ?? []) as Array<{ photo_reference: string; html_attributions?: string[] }>;
    if (photos.length === 0) {
      return NextResponse.json({ ok: true, added: 0, message: "Google has no photos for this venue." });
    }

    // Don't re-import: we tag each as "Google photo N" — skip slots already present.
    const { data: existing } = await sb
      .from("media_assets")
      .select("label")
      .eq("venue_id", venueId)
      .eq("owner_type", "venue");
    const haveLabels = (existing ?? []).map((r) => String(r.label ?? ""));

    let added = 0;
    const errors: string[] = [];
    for (let i = 0; i < Math.min(photos.length, MAX_PHOTOS); i++) {
      const label = `Google photo ${i + 1}`;
      // Already imported this slot (label may carry an appended attribution).
      if (haveLabels.some((l) => l === label || l.startsWith(`${label} ·`))) continue;
      const ph = photos[i];
      try {
        const photoUrl = new URL("https://maps.googleapis.com/maps/api/place/photo");
        photoUrl.searchParams.set("maxwidth", "1600");
        photoUrl.searchParams.set("photo_reference", ph.photo_reference);
        photoUrl.searchParams.set("key", key);
        const imgRes = await fetch(photoUrl); // follows the 302 to the image bytes
        if (!imgRes.ok) { errors.push(`photo ${i + 1}: ${imgRes.status}`); continue; }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
        const path = `gallery/${venueId}/google-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await sb.storage.from("venue-media").upload(path, buf, { contentType, upsert: false });
        if (upErr) { errors.push(`photo ${i + 1}: ${upErr.message}`); continue; }
        const { data: pub } = sb.storage.from("venue-media").getPublicUrl(path);
        // Google requires showing photo attribution; fold it into the label so
        // it travels with the asset and can be surfaced in the gallery.
        const attribution = (ph.html_attributions ?? []).map(plainAttribution).filter(Boolean).join(", ");
        const { error: insErr } = await sb.from("media_assets").insert({
          venue_id: venueId,
          owner_type: "venue",
          owner_id: venueId,
          kind: "photo",
          url: pub.publicUrl,
          label: attribution ? `${label} · © ${attribution}` : label,
          category: "Outside",
        });
        if (insErr) { errors.push(`photo ${i + 1}: ${insErr.message}`); continue; }
        added++;
      } catch (e) {
        errors.push(`photo ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      added,
      available: Math.min(photos.length, MAX_PHOTOS),
      message: added
        ? `Imported ${added} photo${added === 1 ? "" : "s"} from Google into “Outside”. Recategorise them as needed.`
        : "No new Google photos to import (already imported).",
      ...(errors.length ? { warnings: errors } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
