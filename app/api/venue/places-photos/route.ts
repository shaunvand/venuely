import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { VENUE_LOCATIONS } from "../gallery/route";

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

// Downscale an image buffer to a small JPEG (base64) for cheap/fast vision
// classification. Returns null if the buffer can't be decoded.
async function thumbBase64(buf: Buffer): Promise<string | null> {
  try {
    const img = await loadImage(buf);
    const maxW = 512;
    const scale = Math.min(1, maxW / (img.width || maxW));
    const w = Math.max(1, Math.round((img.width || maxW) * scale));
    const h = Math.max(1, Math.round((img.height || maxW) * scale));
    const canvas = createCanvas(w, h);
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toBuffer("image/jpeg").toString("base64");
  } catch {
    return null;
  }
}

// Classify each thumbnail into one of VENUE_LOCATIONS via a single Claude vision
// call. Best-effort: returns {} (callers fall back to "Outside") if the API key
// is absent or anything goes wrong. Keys are the thumbnail array index.
async function classifyByVision(thumbs: Array<string | null>): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const usable = thumbs.filter((t): t is string => !!t).length;
  if (!apiKey || usable === 0) return out;
  try {
    const anthropic = new Anthropic({ apiKey });
    const content: Anthropic.ContentBlockParam[] = [
      {
        type: "text",
        text:
          `You are tagging photos for a South African wedding venue's gallery. For EACH image pick the single best ` +
          `location category from: ${VENUE_LOCATIONS.join(", ")}.\n` +
          `Guidance: building exteriors / driveways / aerial / parking → Outside; lawns, gardens, trees, flowerbeds, ` +
          `outdoor greenery → Gardens; ceremony arch / aisle / chapel seating → Ceremony; dining hall / marquee / set ` +
          `banquet tables / dance floor → Reception; bar counter / drinks station → Bar; indoor lounges / foyers / ` +
          `interiors not set for dining → Interior; bedrooms / cottages / lodge / guest rooms → Accommodation; unclear → Other.\n` +
          `Images follow in order from index 0. Output JSONL, one object per image, no prose: {"i":<index>,"category":"<one of the list>"}`,
      },
    ];
    let idx = 0;
    for (const t of thumbs) {
      if (!t) { idx++; continue; }
      content.push({ type: "text", text: `Image ${idx}:` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: t } });
      idx++;
    }
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    for (const line of text.split("\n")) {
      const s = line.trim();
      if (!s.startsWith("{")) continue;
      try {
        const o = JSON.parse(s);
        if (typeof o.i === "number" && typeof o.category === "string") {
          const match = VENUE_LOCATIONS.find((v) => v.toLowerCase() === o.category.toLowerCase());
          if (match) out[o.i] = match;
        }
      } catch {}
    }
  } catch {
    // best-effort — leave out empty so callers default the category
  }
  return out;
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

    const errors: string[] = [];

    // Phase 1 — download the new photos (skip slots already imported) and build
    // a downscaled thumbnail of each for vision classification.
    type Pending = { label: string; buf: Buffer; contentType: string; attribution: string; thumb: string | null };
    const pending: Pending[] = [];
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
        const attribution = (ph.html_attributions ?? []).map(plainAttribution).filter(Boolean).join(", ");
        pending.push({ label, buf, contentType, attribution, thumb: await thumbBase64(buf) });
      } catch (e) {
        errors.push(`photo ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (pending.length === 0) {
      return NextResponse.json({
        ok: true,
        added: 0,
        available: Math.min(photos.length, MAX_PHOTOS),
        message: "No new Google photos to import (already imported).",
        ...(errors.length ? { warnings: errors } : {}),
      });
    }

    // Phase 2 — classify each photo into a venue location (best-effort; falls
    // back to "Outside" when vision is unavailable).
    const categories = await classifyByVision(pending.map((p) => p.thumb));

    // Phase 3 — upload + insert each photo under its assigned category.
    let added = 0;
    const byCategory: Record<string, number> = {};
    for (let j = 0; j < pending.length; j++) {
      const p = pending[j];
      const category = categories[j] || "Outside";
      try {
        const ext = p.contentType.includes("png") ? "png" : p.contentType.includes("webp") ? "webp" : "jpg";
        const path = `gallery/${venueId}/google-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await sb.storage.from("venue-media").upload(path, p.buf, { contentType: p.contentType, upsert: false });
        if (upErr) { errors.push(`${p.label}: ${upErr.message}`); continue; }
        const { data: pub } = sb.storage.from("venue-media").getPublicUrl(path);
        // Google requires showing photo attribution; fold it into the label so
        // it travels with the asset and can be surfaced in the gallery.
        const { error: insErr } = await sb.from("media_assets").insert({
          venue_id: venueId,
          owner_type: "venue",
          owner_id: venueId,
          kind: "photo",
          url: pub.publicUrl,
          label: p.attribution ? `${p.label} · © ${p.attribution}` : p.label,
          category,
        });
        if (insErr) { errors.push(`${p.label}: ${insErr.message}`); continue; }
        added++;
        byCategory[category] = (byCategory[category] || 0) + 1;
      } catch (e) {
        errors.push(`${p.label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const autoTagged = Object.keys(categories).length > 0;
    const breakdown = Object.entries(byCategory).map(([c, n]) => `${n} ${c}`).join(", ");
    return NextResponse.json({
      ok: true,
      added,
      available: Math.min(photos.length, MAX_PHOTOS),
      categories: byCategory,
      message: added
        ? autoTagged
          ? `Imported ${added} photo${added === 1 ? "" : "s"} from Google${breakdown ? ` (${breakdown})` : ""}. Tweak any categories in the gallery.`
          : `Imported ${added} photo${added === 1 ? "" : "s"} from Google into “Outside”. Recategorise them as needed.`
        : "No new Google photos to import (already imported).",
      ...(errors.length ? { warnings: errors } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
