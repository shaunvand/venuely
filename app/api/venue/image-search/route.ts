import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UTM = "?utm_source=venuely&utm_medium=referral";

// Normalised result shape the UI consumes, regardless of provider. `source` /
// `source_url` drive attribution; `unsplash_url` is kept as a legacy alias of
// `source_url` so older callers keep working. `download_location` is only set
// for Unsplash (its API requires a download ping); empty for Pexels.
type ImageResult = {
  id: string;
  url: string;
  thumb: string;
  alt: string;
  photographer_name: string;
  photographer_username: string;
  photographer_profile_url: string;
  source: "Pexels" | "Unsplash";
  source_url: string;
  unsplash_url: string;
  download_location: string;
};

// ---- Pexels (preferred) ----------------------------------------------------
// Free, no per-download ping, better search relevance than Unsplash for the
// generic product/decor terms this feature searches. Key: PEXELS_API_KEY.
async function searchPexels(key: string, q: string): Promise<ImageResult[]> {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", "12");
  url.searchParams.set("orientation", "landscape");
  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pexels ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.photos || []).map((p: {
    id: number;
    alt?: string;
    url: string;
    photographer: string;
    photographer_url: string;
    src: { large?: string; landscape?: string; medium?: string; tiny?: string; small?: string };
  }): ImageResult => ({
    id: String(p.id),
    url: p.src.landscape || p.src.large || p.src.medium || "",
    thumb: p.src.tiny || p.src.small || p.src.medium || "",
    alt: p.alt ?? "",
    photographer_name: p.photographer ?? "",
    photographer_username: "",
    photographer_profile_url: p.photographer_url ?? "https://www.pexels.com",
    source: "Pexels",
    source_url: p.url ?? "https://www.pexels.com",
    unsplash_url: p.url ?? "https://www.pexels.com",
    download_location: "",
  }));
}

// ---- Unsplash (fallback) ---------------------------------------------------
async function searchUnsplash(key: string, q: string): Promise<ImageResult[]> {
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", q);
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
  if (!res.ok) {
    const txt = await res.text();
    // 403 from Unsplash is almost always the hourly demo-rate cap.
    throw Object.assign(new Error(`Unsplash ${res.status}: ${txt.slice(0, 200)}`), { httpStatus: res.status === 403 ? 429 : 502 });
  }
  const data = await res.json();
  return (data.results || []).map((r: {
    id: string;
    urls: { regular: string; thumb: string };
    alt_description?: string;
    links?: { html?: string; download_location?: string };
    user: { name: string; username: string };
  }): ImageResult => ({
    id: r.id,
    url: r.urls.regular,
    thumb: r.urls.thumb,
    alt: r.alt_description ?? "",
    photographer_name: r.user.name,
    photographer_username: r.user.username,
    photographer_profile_url: `https://unsplash.com/@${r.user.username}${UTM}`,
    source: "Unsplash",
    source_url: r.links?.html ? `${r.links.html}${UTM}` : `https://unsplash.com${UTM}`,
    unsplash_url: r.links?.html ? `${r.links.html}${UTM}` : `https://unsplash.com${UTM}`,
    download_location: r.links?.download_location ?? "",
  }));
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    const q = String(query || "").trim();
    if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

    const pexelsKey = process.env.PEXELS_API_KEY;
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

    if (!pexelsKey && !unsplashKey) {
      return NextResponse.json(
        { error: "No image provider configured. Set PEXELS_API_KEY (recommended) or UNSPLASH_ACCESS_KEY on Render." },
        { status: 503 },
      );
    }

    // Prefer Pexels; fall back to Unsplash if Pexels errors (or isn't set).
    if (pexelsKey) {
      try {
        return NextResponse.json({ ok: true, source: "Pexels", results: await searchPexels(pexelsKey, q) });
      } catch (e) {
        if (!unsplashKey) {
          return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
        }
        // fall through to Unsplash
      }
    }

    try {
      return NextResponse.json({ ok: true, source: "Unsplash", results: await searchUnsplash(unsplashKey!, q) });
    } catch (e) {
      const status = (e as { httpStatus?: number }).httpStatus ?? 502;
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
