import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import Anthropic from "@anthropic-ai/sdk";

// Whole-vibe match: looks at ALL the couple's pinned inspiration images together
// and returns which of THIS venue's actual catalogue/rentals/vendors best fit the
// overall style. Names are copied exactly from the venue list so the client can
// highlight the real items. Grounded in the venue's offerings (source of truth).
export const runtime = "nodejs";
export const maxDuration = 60;
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchImage(url: string): Promise<{ media_type: "image/png" | "image/webp" | "image/gif" | "image/jpeg"; data: string } | null> {
  try {
    const ir = await fetch(url);
    if (!ir.ok) return null;
    const ct = ir.headers.get("content-type") || "image/jpeg";
    const media_type = ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : ct.includes("gif") ? "image/gif" : "image/jpeg";
    const buf = Buffer.from(await ir.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null;
    return { media_type, data: buf.toString("base64") };
  } catch { return null; }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const db = admin();
  const { data: w } = await db.from("weddings").select("venue_id").eq("id", access.wedding.id).single();
  const venueId = w?.venue_id;

  // Up to 6 most recent pins with a real image URL.
  const { data: pins } = await db.from("wedding_inspiration")
    .select("source_url, file_path").eq("wedding_id", access.wedding.id).order("created_at", { ascending: false }).limit(6);
  const urls = (pins ?? []).map((p) => (p.source_url as string) || null).filter((u): u is string => !!u && /^https?:\/\//.test(u));
  if (urls.length === 0) return NextResponse.json({ error: "Pin a few inspiration images first." }, { status: 400 });

  const [rentals, catalogue, vendors] = venueId ? await Promise.all([
    db.from("rental_items").select("name, category").eq("venue_id", venueId).eq("active", true),
    db.from("catalogue_items").select("name, category").eq("venue_id", venueId).eq("active", true),
    db.from("vendor_partners").select("name, vendor_type").eq("venue_id", venueId).eq("active", true),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const offerings = [
    ...(rentals.data ?? []).map((r) => `${r.name} (rental${r.category ? `/${r.category}` : ""})`),
    ...(catalogue.data ?? []).map((c) => `${c.name} (catalogue${c.category ? `/${c.category}` : ""})`),
    ...(vendors.data ?? []).map((v) => `${v.name} (vendor${v.vendor_type ? `/${v.vendor_type}` : ""})`),
  ].slice(0, 150);

  const images = (await Promise.all(urls.map(fetchImage))).filter((x): x is NonNullable<typeof x> => !!x);
  if (images.length === 0) return NextResponse.json({ error: "Could not load your inspiration images." }, { status: 422 });

  const instruction = `You are a wedding stylist. These ${images.length} images are the couple's pinned inspiration — read them as ONE overall aesthetic. Respond with ONLY a JSON object (no prose):
{"style":"2-4 word overall style name","matches":["names copied EXACTLY from the venue list below that best fit this overall vibe, max 12"]}
Only include a name in matches if it genuinely suits the vibe. The venue offers:\n${offerings.join("\n") || "(no items listed)"}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{ role: "user", content: [
        { type: "text", text: instruction },
        ...images.map((im) => ({ type: "image" as const, source: { type: "base64" as const, media_type: im.media_type, data: im.data } })),
      ] }],
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "could not analyse" }, { status: 422 });
    const parsed = JSON.parse(m[0]) as { style?: string; matches?: string[] };
    const matches = Array.isArray(parsed.matches) ? parsed.matches.map(String) : [];

    // Persist onto wedding_state so the item tabs can highlight the matches.
    const { data: wed } = await db.from("weddings").select("wedding_state").eq("id", access.wedding.id).single();
    const state = (wed?.wedding_state as Record<string, unknown>) ?? {};
    await db.from("weddings").update({ wedding_state: { ...state, vibeMatches: matches, vibeStyle: parsed.style ?? null } }).eq("id", access.wedding.id);

    return NextResponse.json({ ok: true, style: parsed.style ?? null, matches });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "analysis failed" }, { status: 500 });
  }
}
