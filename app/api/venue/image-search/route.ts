import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UTM = "?utm_source=venuely&utm_medium=referral";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    const q = String(query || "").trim();
    if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) {
      return NextResponse.json({
        error: "UNSPLASH_ACCESS_KEY not configured on Render.",
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
      return NextResponse.json({ error: `Unsplash ${res.status}: ${txt.slice(0, 200)}` }, { status: res.status === 403 ? 429 : 502 });
    }
    const data = await res.json();
    const results = (data.results || []).map((r: {
      id: string;
      urls: { regular: string; thumb: string };
      alt_description?: string;
      links?: { html?: string; download_location?: string };
      user: { name: string; username: string; links?: { html?: string } };
    }) => ({
      id: r.id,
      url: r.urls.regular,
      thumb: r.urls.thumb,
      alt: r.alt_description ?? "",
      photographer_name: r.user.name,
      photographer_username: r.user.username,
      photographer_profile_url: `https://unsplash.com/@${r.user.username}${UTM}`,
      unsplash_url: r.links?.html ? `${r.links.html}${UTM}` : `https://unsplash.com${UTM}`,
      download_location: r.links?.download_location ?? "",
    }));

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
