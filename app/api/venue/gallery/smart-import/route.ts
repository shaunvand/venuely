import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { VENUE_LOCATIONS } from "../route";
import { extractPdfImages } from "@/lib/imports/extract-images";
import { safeFetch } from "@/lib/security/guards";

export const runtime = "nodejs";
export const maxDuration = 300;

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

const IMG_RE = /\.(jpe?g|png|webp|gif|avif|heic)(\?|$)/i;
const PDF_RE = /\.pdf(\?|$)/i;

// Smart Import: pull every image already attached anywhere on this venue AND
// rasterise PDF document-pack pages into images, then auto-categorise each by
// venue location and add them to the "Your Venue" gallery.
export async function POST(req: NextRequest) {
  try {
    const { venue_id } = await req.json();
    const venueId = String(venue_id || "").trim();
    if (!venueId || !/^[a-zA-Z0-9-]+$/.test(venueId))
      return NextResponse.json({ error: "Missing or invalid venue_id" }, { status: 400 });

    const gate = await authVenue(venueId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const sb = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Every media asset on this venue (any owner_type).
    const { data: assets } = await sb
      .from("media_assets")
      .select("id, url, label, owner_type, kind")
      .eq("venue_id", venueId);

    const all = (assets ?? []) as Array<{ id: string; url: string; label: string | null; owner_type: string; kind: string }>;

    // What's already a real (image/video) venue-gallery item — skip dupes.
    const have = new Set(
      all.filter((a) => a.owner_type === "venue" && (IMG_RE.test(a.url) || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(a.url))).map((a) => a.url)
    );

    // 1. Existing image files anywhere on the venue, not yet in the gallery.
    const imageCandidates = Array.from(
      new Map(
        all
          .filter((a) => a.url && IMG_RE.test(a.url) && !have.has(a.url))
          .map((a) => [a.url, { url: a.url, label: a.label }])
      ).values()
    );

    // 2. PDF document-pack files → rasterise each page to an image.
    const pdfRows = all.filter((a) => a.url && PDF_RE.test(a.url));
    const pdfCandidates: Array<{ url: string; label: string | null }> = [];
    const pdfRowIds: string[] = [];
    for (const pdf of pdfRows) {
      try {
        const resp = await safeFetch(pdf.url); // SSRF guard (blocks private/loopback hosts)
        if (!resp.ok) continue;
        const buf = Buffer.from(await resp.arrayBuffer());
        const pages = await extractPdfImages(buf, pdf.label || "document.pdf", venueId);
        const base = (pdf.label || "Document").replace(/\.pdf$/i, "");
        for (const pg of pages) {
          pdfCandidates.push({ url: pg.url, label: `${base} — p${pg.page}` });
        }
        if (pages.length > 0 || pdf.owner_type === "venue") pdfRowIds.push(pdf.id);
      } catch (e) {
        console.warn(`[smart-import] pdf ${pdf.label}: ${e instanceof Error ? e.message : e}`);
      }
    }

    const candidates = [...imageCandidates, ...pdfCandidates];
    if (candidates.length === 0) {
      // Still clear out unrenderable PDF rows so they don't show as broken tiles.
      if (pdfRowIds.length) await sb.from("media_assets").delete().in("id", pdfRowIds);
      return NextResponse.json({ ok: true, added: 0, message: "No images found to import." });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    const anthropic = new Anthropic({ apiKey });

    const list = candidates.map((c, i) => `${i}: ${JSON.stringify(c.label || "")}`).join("\n");
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content:
            `You are tagging images for a South African wedding venue's photo gallery. ` +
            `Each line is an image described by its source filename/page. Pick the single best ` +
            `venue location category from: ${VENUE_LOCATIONS.join(", ")}. ` +
            `Hints: floor plans / rooming / lodge / units / farmhouse → Accommodation; ` +
            `maps / roadmap / "how to find" / overall layout / aerial → Outside; ` +
            `garden → Gardens; bar / drinks → Bar; ceremony → Ceremony; ` +
            `reception / hall / marquee → Reception; price/stock/service-provider lists → Other.\n` +
            `Output JSONL, one line per item, no prose: {"i":<index>,"category":"<one of the list>"}\n\n` +
            list,
        },
      ],
    });

    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const cat: Record<number, string> = {};
    for (const line of text.split("\n")) {
      const s = line.trim().replace(/^```\w*$/, "").trim();
      if (!s.startsWith("{")) continue;
      try {
        const o = JSON.parse(s);
        if (typeof o.i === "number" && typeof o.category === "string") {
          const m = VENUE_LOCATIONS.find((v) => v.toLowerCase() === o.category.toLowerCase());
          cat[o.i] = m || "Other";
        }
      } catch {}
    }

    const rows = candidates.map((c, i) => ({
      venue_id: venueId,
      owner_type: "venue",
      owner_id: venueId,
      kind: "photo",
      url: c.url,
      label: c.label,
      category: cat[i] || "Other",
    }));

    const { error } = await sb.from("media_assets").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Remove the original PDF rows now that their pages are imported as images.
    if (pdfRowIds.length) await sb.from("media_assets").delete().in("id", pdfRowIds);

    return NextResponse.json({ ok: true, added: rows.length, pdfsProcessed: pdfRows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
