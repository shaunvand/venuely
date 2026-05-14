import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Search Unsplash for an image matching the item's name + description.
// Returns up to 8 candidate URLs. Falls back to a clear error if no key set.
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    const q = String(query || "").trim();
    if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) {
      return NextResponse.json({
        error: "UNSPLASH_ACCESS_KEY not configured on Render. Sign up at https://unsplash.com/developers (free), then add the env var.",
      }, { status: 503 });
    }

    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", q);
    url.searchParams.set("per_page", "8");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high");

    const res = await fetch(url, {
      headers: { "Authorization": `Client-ID ${key}`, "Accept-Version": "v1" },
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `Unsplash ${res.status}: ${txt.slice(0, 200)}` }, { status: 502 });
    }
    const data = await res.json();
    const results = (data.results || []).map((r: { urls: { regular: string; thumb: string }; alt_description?: string; user: { name: string } }) => ({
      url: r.urls.regular,
      thumb: r.urls.thumb,
      alt: r.alt_description ?? "",
      attribution: r.user?.name ?? "",
    }));

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
