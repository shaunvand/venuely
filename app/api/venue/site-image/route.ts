import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { requireVenueMember, assertSafeUrl, safeFetch, isAllowedImageType, imageExtForMime } from "@/lib/security/guards";

export const runtime = "nodejs";
export const maxDuration = 30;

// Pull a representative picture from a supplier's own website to use as their image:
// prefer og:image (usually a hero/brand photo), else twitter:image, else a header
// logo <img>, else the largest icon. The chosen image is downloaded and re-hosted in
// venue-media so it stays stable (no hotlink/expiry).
function abs(href: string, base: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function pickImage(html: string, base: string): string | null {
  const m = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
  const og = m(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
    || m(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  if (og) return abs(og, base);
  // Header/nav logo <img>.
  for (const im of html.matchAll(/<img[^>]+>/gi)) {
    const src = im[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src && !/^data:/i.test(src) && (/logo/i.test(im[0]) || /logo/i.test(src))) return abs(src, base);
  }
  // Largest icon link.
  let best: string | null = null, score = -1;
  for (const lk of html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)) {
    const href = lk[0].match(/\bhref=["']([^"']+)["']/i)?.[1]; if (!href) continue;
    const rel = (lk[0].match(/\brel=["']([^"']+)["']/i)?.[1] || "").toLowerCase();
    const sizes = lk[0].match(/\bsizes=["']([^"']+)["']/i)?.[1] || "";
    const dim = parseInt(sizes.split(/[x×]/)[0], 10) || (rel.includes("apple-touch") ? 180 : 32);
    const s = dim + (rel.includes("apple-touch") ? 1000 : 0);
    if (s > score) { score = s; best = href; }
  }
  return best ? abs(best, base) : null;
}

export async function POST(req: NextRequest) {
  try {
    const { url, venue_id } = (await req.json().catch(() => ({}))) as { url?: string; venue_id?: string };
    let site = String(url ?? "").trim();
    if (!site) return NextResponse.json({ error: "No website URL" }, { status: 400 });
    if (!/^https?:\/\//i.test(site)) site = `https://${site}`;
    if (!venue_id || !/^[a-zA-Z0-9-]+$/.test(venue_id)) return NextResponse.json({ error: "Missing venue_id" }, { status: 400 });

    const gate = await requireVenueMember(venue_id);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    // SSRF guard: validate the user-supplied URL up front, then fetch with
    // manual redirect handling so every hop is re-validated too.
    try { assertSafeUrl(site); } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid URL" }, { status: 400 });
    }
    const page = await safeFetch(site, { headers: { "user-agent": "Mozilla/5.0 (VenuelyBot)" } });
    if (!page.ok) return NextResponse.json({ error: `site returned ${page.status}` }, { status: 422 });
    const html = await page.text();
    const imgUrl = pickImage(html, page.url || site);
    if (!imgUrl) return NextResponse.json({ error: "no image found on the page" }, { status: 422 });

    try { assertSafeUrl(imgUrl); } catch {
      return NextResponse.json({ error: "no usable image found on the page" }, { status: 422 });
    }
    const ir = await safeFetch(imgUrl, { headers: { "user-agent": "Mozilla/5.0 (VenuelyBot)", referer: site } });
    if (!ir.ok) return NextResponse.json({ error: "couldn't download the image" }, { status: 422 });
    const ct = (ir.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!isAllowedImageType(ct)) return NextResponse.json({ error: "linked file isn't a supported image (JPEG/PNG/WebP/GIF/AVIF)" }, { status: 422 });
    const buf = Buffer.from(await ir.arrayBuffer());
    if (buf.length < 256 || buf.length > 8 * 1024 * 1024) return NextResponse.json({ error: "image too small or too large" }, { status: 422 });

    // Extension derived from the validated MIME type — never the remote filename.
    const ext = imageExtForMime(ct)!;
    const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const path = `${venue_id}/site-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await admin.storage.from("venue-media").upload(path, buf, { contentType: ct, upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: pub } = admin.storage.from("venue-media").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
