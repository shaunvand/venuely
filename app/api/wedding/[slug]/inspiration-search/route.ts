import { NextResponse, type NextRequest } from "next/server";
import { portalAccess } from "@/lib/portal/access";

// Couple-side inspiration image search. Pinterest's API has no public keyword
// search for third parties, so we search our licensed image library (Pexels,
// Unsplash fallback) and present it Pinterest-style. Gated by portal access.
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ ok: true, results: [] });
  const query = /wedding|bridal|décor|decor|flower|venue/i.test(q) ? q : `${q} wedding`;

  const pexels = process.env.PEXELS_API_KEY;
  if (pexels) {
    try {
      const r = await fetch(`https://api.pexels.com/v1/search?per_page=30&orientation=portrait&query=${encodeURIComponent(query)}`, { headers: { Authorization: pexels } });
      if (r.ok) {
        const j = (await r.json()) as { photos?: Array<{ src?: { large?: string; medium?: string }; alt?: string; photographer?: string }> };
        const results = (j.photos ?? []).map((p) => ({ url: p.src?.large || p.src?.medium || "", thumb: p.src?.medium || p.src?.large || "", alt: p.alt || query, source: `Pexels · ${p.photographer ?? ""}`.trim() })).filter((x) => x.url);
        if (results.length) return NextResponse.json({ ok: true, results });
      }
    } catch { /* fall through */ }
  }

  const unsplash = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplash) {
    try {
      const r = await fetch(`https://api.unsplash.com/search/photos?per_page=30&orientation=portrait&query=${encodeURIComponent(query)}`, { headers: { Authorization: `Client-ID ${unsplash}` } });
      if (r.ok) {
        const j = (await r.json()) as { results?: Array<{ urls?: { regular?: string; small?: string }; alt_description?: string; user?: { name?: string } }> };
        const results = (j.results ?? []).map((p) => ({ url: p.urls?.regular || p.urls?.small || "", thumb: p.urls?.small || p.urls?.regular || "", alt: p.alt_description || query, source: `Unsplash · ${p.user?.name ?? ""}`.trim() })).filter((x) => x.url);
        return NextResponse.json({ ok: true, results });
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json({ ok: true, results: [], note: "no image provider configured" });
}
