import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { assertSafeUrl, safeFetch } from "@/lib/security/guards";

export const runtime = "nodejs";
export const maxDuration = 30;

// Best-effort brand-colour sniff: fetch the venue's website and surface the most
// prominent non-neutral colours (theme-color meta first, then frequent hex codes
// in inline styles / <style> blocks). Heuristic — the owner confirms the pick.

function normaliseHex(h: string): string | null {
  let s = h.trim().toLowerCase();
  if (!s.startsWith("#")) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

function hsl(hex: string): { s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

// Keep colours that read as a brand colour: enough saturation, not near-white/black.
function isBrandable(hex: string): boolean {
  const { s, l } = hsl(hex);
  return s > 0.22 && l > 0.12 && l < 0.9;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await createServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { url } = await req.json();
    let target = String(url || "").trim();
    if (!target) return NextResponse.json({ error: "No website set on your venue. Add one in Settings first." }, { status: 400 });
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    let parsed: URL;
    try { parsed = new URL(target); } catch { return NextResponse.json({ error: "Invalid website URL." }, { status: 400 }); }
    // SSRF guard: http/https to a public host only (also re-validated per redirect hop below).
    try { assertSafeUrl(parsed); } catch { return NextResponse.json({ error: "Unsupported URL." }, { status: 400 }); }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    let html = "";
    try {
      const res = await safeFetch(parsed, {
        signal: ctrl.signal,
        headers: { "User-Agent": "VenuelyBrandBot/1.0 (+https://venuely.co.za)" },
      });
      if (!res.ok) return NextResponse.json({ error: `Couldn't load the site (${res.status}).` }, { status: 502 });
      html = (await res.text()).slice(0, 600_000);
    } catch {
      return NextResponse.json({ error: "Couldn't reach the website (timeout or blocked)." }, { status: 502 });
    } finally {
      clearTimeout(timer);
    }

    const ordered: string[] = [];
    const seen = new Set<string>();
    const push = (raw: string | null) => {
      if (!raw) return;
      const h = normaliseHex(raw);
      if (h && isBrandable(h) && !seen.has(h)) { seen.add(h); ordered.push(h); }
    };

    // 1) <meta name="theme-color"> wins.
    const meta = html.match(/<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']theme-color["']/i);
    if (meta) push(meta[1]);

    // 2) Frequent hex colours in markup/CSS.
    const counts = new Map<string, number>();
    for (const m of html.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
      const h = normaliseHex(m[0]);
      if (h && isBrandable(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([h]) => push(h));

    return NextResponse.json({ ok: true, colors: ordered.slice(0, 6), site: parsed.hostname });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
