import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import Anthropic from "@anthropic-ai/sdk";

// Analyse a pinned inspiration image with Claude vision: identify the style,
// recommend categories + a colour palette, and — grounded in THIS venue's actual
// catalogue/rentals/vendors — suggest which of the venue's offerings fit the look.
// Keeps the venue the source of truth (we only surface what they actually offer).
export const runtime = "nodejs";
export const maxDuration = 60;
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const { imageUrl } = (await req.json().catch(() => ({}))) as { imageUrl?: string };
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  const db = admin();
  const { data: w } = await db.from("weddings").select("venue_id").eq("id", access.wedding.id).single();
  const venueId = w?.venue_id;
  const [rentals, catalogue, vendors] = venueId ? await Promise.all([
    db.from("rental_items").select("name, category").eq("venue_id", venueId).eq("active", true),
    db.from("catalogue_items").select("name, category").eq("venue_id", venueId).eq("active", true),
    db.from("vendor_partners").select("name, vendor_type").eq("venue_id", venueId).eq("active", true),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const offerings = [
    ...(rentals.data ?? []).map((r) => `${r.name} (rental${r.category ? `/${r.category}` : ""})`),
    ...(catalogue.data ?? []).map((c) => `${c.name} (catalogue${c.category ? `/${c.category}` : ""})`),
    ...(vendors.data ?? []).map((v) => `${v.name} (vendor${v.vendor_type ? `/${v.vendor_type}` : ""})`),
  ].slice(0, 120);

  // Fetch the image bytes.
  let media_type: "image/png" | "image/webp" | "image/gif" | "image/jpeg" = "image/jpeg";
  let b64 = "";
  try {
    const ir = await fetch(imageUrl);
    if (!ir.ok) throw new Error("image fetch failed");
    const ct = ir.headers.get("content-type") || "image/jpeg";
    media_type = ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : ct.includes("gif") ? "image/gif" : "image/jpeg";
    const buf = Buffer.from(await ir.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return NextResponse.json({ error: "image too large to analyse" }, { status: 413 });
    b64 = buf.toString("base64");
  } catch {
    return NextResponse.json({ error: "could not load that image" }, { status: 422 });
  }

  const instruction = `You are a wedding stylist. Analyse this wedding inspiration image. Respond with ONLY a JSON object (no prose) of shape:
{"style":"2-4 word style name","categories":["3-6 short style/theme tags"],"palette":["#hex","..."],"venueMatches":["names copied EXACTLY from the venue list below that fit this look, max 6"],"suggestions":["3-5 short concrete decor/styling product ideas that fit"]}
Only put a name in venueMatches if it genuinely suits the image's style. The venue offers:\n${offerings.join("\n") || "(no items listed)"}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{ role: "user", content: [
        { type: "text", text: instruction },
        { type: "image", source: { type: "base64", media_type, data: b64 } },
      ] }],
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "could not analyse" }, { status: 422 });
    const parsed = JSON.parse(m[0]);
    return NextResponse.json({ ok: true, analysis: parsed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "analysis failed" }, { status: 500 });
  }
}
