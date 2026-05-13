import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

type Imported = {
  name: string | null;
  description: string | null;
  region: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  catalogue: Array<{ name: string; description: string | null; price_zar: number | null; category: string | null }>;
  rentals:   Array<{ name: string; description: string | null; price_zar: number | null; category: string | null }>;
  accommodation: Array<{ name: string; description: string | null; sleeps: number | null; price_per_night_zar: number | null; room_type: string | null }>;
};

function abs(url: string, base: string): string {
  try { return new URL(url, base).toString(); } catch { return url; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, base: string) {
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
  const title = pick(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogImg = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const logo = pick(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i);
  return {
    title: ogTitle ?? title,
    description: ogDesc ?? desc,
    hero_image: ogImg ? abs(ogImg, base) : null,
    logo: logo ? abs(logo, base) : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }
    const target = url.startsWith("http") ? url : `https://${url}`;
    let parsed: URL;
    try { parsed = new URL(target); } catch { return NextResponse.json({ error: "Invalid URL" }, { status: 400 }); }

    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VenuelyImportBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return NextResponse.json({ error: `Site returned ${res.status}` }, { status: 400 });
    const html = await res.text();

    const meta = extractMeta(html, parsed.origin);
    const text = stripHtml(html).slice(0, 18000);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    const client = new Anthropic({ apiKey });

    const system = `You extract structured venue data from a wedding/event venue's website HTML.

CRITICAL RULES:
- Return ONLY JSON matching the schema. No prose, no markdown fences.
- Use null for any field you are not highly confident about. Do not guess.
- For prices: only include if explicitly stated as ZAR/R/Rand. Strip the R and return a number.
- For catalogue/rentals/accommodation arrays: only include items you can clearly identify by name. Empty array if uncertain.
- "catalogue" = food/beverage/service items the venue charges for (per-head menus, bar tabs, ceremony fees).
- "rentals" = physical items rented out (tables, chairs, decor, lighting).
- "accommodation" = on-site rooms/cottages/suites/tents for overnight stay.
- "region" = "City, Country" format (e.g. "Cape Town, South Africa") only if clearly stated.

Schema:
{
  "name": string | null,
  "description": string | null,        // 1-2 sentence venue tagline
  "region": string | null,
  "contact_email": string | null,
  "contact_phone": string | null,
  "logo_url": string | null,
  "hero_image_url": string | null,
  "catalogue": [{"name": string, "description": string | null, "price_zar": number | null, "category": string | null}],
  "rentals":   [{"name": string, "description": string | null, "price_zar": number | null, "category": string | null}],
  "accommodation": [{"name": string, "description": string | null, "sleeps": number | null, "price_per_night_zar": number | null, "room_type": string | null}]
}`;

    const userMsg = `Source URL: ${parsed.toString()}
Meta title: ${meta.title ?? "—"}
Meta description: ${meta.description ?? "—"}
Detected logo: ${meta.logo ?? "—"}
Detected hero image: ${meta.hero_image ?? "—"}

Page text (truncated):
${text}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userMsg }],
    });

    const block = response.content.find((c) => c.type === "text");
    const raw = block && block.type === "text" ? block.text.trim() : "";
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd < 0) {
      return NextResponse.json({ error: "Model did not return JSON", raw: raw.slice(0, 500) }, { status: 502 });
    }
    let data: Imported;
    try {
      data = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON from model", detail: String(e) }, { status: 502 });
    }

    if (!data.logo_url && meta.logo) data.logo_url = meta.logo;
    if (!data.hero_image_url && meta.hero_image) data.hero_image_url = meta.hero_image;

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
