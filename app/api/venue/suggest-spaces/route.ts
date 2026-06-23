import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { assertSafeUrl, safeFetch } from "@/lib/security/guards";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

// Service-role client for reads AFTER membership is verified — avoids any RLS /
// session-cookie subtlety reading the venue's own website + existing areas.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Suggest a venue's bookable spaces from its website, so the onboarding "Your
// spaces" step starts pre-filled instead of blank. We fetch the homepage (best
// effort), strip it to text, and ask the model to infer each space's name, type
// (main/extra/overflow), a sub-category grouping, and a wedding-day price IF the
// site states one. Everything is a SUGGESTION — the wizard shows an edit-and-
// verify warning and the owner confirms before anything is saved.

async function authVenue(venueId: string) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };
  const [{ data: member }, { data: profile }] = await Promise.all([
    auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle(),
    auth.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!member && profile?.role !== "owner") return { ok: false as const, status: 403, error: "Not your venue" };
  return { ok: true as const, auth };
}

const INSTRUCTION =
  `You are helping a South African wedding venue list the SPACES couples can book, ` +
  `organised into CATEGORIES each holding one or more areas.\n` +
  `Typical categories: "Ceremony Spaces", "Reception Spaces", "Additional Spaces" — ` +
  `but use whatever groupings the site implies. Under each category list the real named areas ` +
  `(e.g. "Ancient Oak Tree Ceremony Site", "Main Reception Venue", "Poolside Entertainment Area").\n` +
  `From the website text, infer this structure. Return ONLY a JSON array, no prose:\n` +
  `[{"category":"","location":"venue|offsite","areas":[{"name":"","pricing":"included|separate","price":null}]}]\n` +
  `Rules:\n` +
  `- category: a short grouping name (e.g. "Ceremony Spaces").\n` +
  `- location: "offsite" only if the area is clearly away from the venue grounds; else "venue".\n` +
  `- areas[].name: use the space's name if the site gives one. If a space is only DESCRIBED (e.g. "the jetty overlooking the mountain dam", "a poplar forest with a stream", "a poolside setting"), give it a clear, concise name ("Mountain Dam Jetty", "Poplar Forest", "Poolside"). INFER the ceremony, reception and gathering spaces a wedding couple could realistically use from the venue's described features (gardens, dam, forest, lawns, farmhouse, patio, etc.) — be generous; the owner reviews and edits everything before saving.\n` +
  `- areas[].pricing: "included" if it's part of the core venue hire, "separate" if it's an optional paid add-on. Default to "included" for core ceremony/reception areas.\n` +
  `- areas[].price: a NUMBER in Rand ONLY if the site clearly states a price for a separate-cost area; otherwise null. Never guess a price.\n` +
  `Return at most 6 categories and 24 areas total. Only return [] if the text has no venue/wedding content at all.`;

function parseCategories(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    let areaBudget = 24;
    return arr
      .map((c: Record<string, unknown>) => {
        const category = String(c?.category ?? "").trim().slice(0, 80);
        const location = String(c?.location) === "offsite" ? "offsite" : "venue";
        const rawAreas = Array.isArray(c?.areas) ? (c.areas as Record<string, unknown>[]) : [];
        const areas = rawAreas
          .map((a) => {
            const name = String(a?.name ?? "").trim();
            if (!name) return null;
            const pricing = String(a?.pricing) === "separate" ? "separate" : "included";
            const raw = a?.price;
            const price = raw == null || raw === "" ? null : Number(String(raw).replace(/[^\d.]/g, ""));
            return {
              name: name.slice(0, 120),
              pricing,
              price: pricing === "separate" && Number.isFinite(price) && (price as number) > 0 ? Math.round(price as number) : null,
            };
          })
          .filter(Boolean)
          .slice(0, areaBudget) as Array<{ name: string; pricing: string; price: number | null }>;
        areaBudget -= areas.length;
        if (!areas.length) return null;
        return { category: category || "Spaces", location, areas };
      })
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return null;
  }
}

// Strip markup to readable text for the model (cheap + avoids huge token bills).
function htmlToText(html: string, cap = 24_000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, cap);
}

// Discover internal links worth crawling for SPACE info (weddings/functions/venue/
// ceremony/reception/accommodation pages), where venues actually list their areas.
const SPACE_HINT = /(wedding|function|venue|ceremony|reception|space|hall|chapel|garden|lawn|marquee|accommodat|cottage|glamping|event|celebrat)/i;
function discoverLinks(html: string, base: URL, max = 4): URL[] {
  const out: URL[] = [];
  const seen = new Set<string>([base.pathname.replace(/\/+$/, "")]);
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (out.length >= max) break;
    const href = m[1], anchor = m[2].replace(/<[^>]+>/g, " ");
    if (!SPACE_HINT.test(href) && !SPACE_HINT.test(anchor)) continue;
    let u: URL;
    try { u = new URL(href, base); } catch { continue; }
    if (u.hostname !== base.hostname) continue;             // same site only
    const key = u.pathname.replace(/\/+$/, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    try { assertSafeUrl(u); } catch { continue; }
    out.push(u);
  }
  return out;
}

// Browser-like UA: many WordPress / Cloudflare / Wordfence sites 403 a custom bot
// UA (or datacenter request), which is why the homepage came back empty in prod.
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
async function fetchPage(u: URL, timeoutMs = 12000): Promise<{ html: string; status: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await safeFetch(u, {
      signal: ctrl.signal,
      headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en" },
    });
    if (!res.ok) return { html: "", status: res.status };
    return { html: (await res.text()).slice(0, 600_000), status: res.status };
  } catch { return { html: "", status: 0 }; }
  finally { clearTimeout(timer); }
}

export async function POST(req: NextRequest) {
  try {
    const { venue_id } = await req.json();
    if (!venue_id) return NextResponse.json({ error: "Missing venue_id" }, { status: 400 });
    const a = await authVenue(String(venue_id));
    if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

    const db = admin();
    const { data: venue } = await db.from("venues").select("website").eq("id", venue_id).maybeSingle();
    let target = String(venue?.website ?? "").trim();
    if (!target) return NextResponse.json({ ok: true, categories: [], reason: "no_website" });
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    let parsed: URL;
    try { parsed = new URL(target); assertSafeUrl(parsed); }
    catch { return NextResponse.json({ ok: true, categories: [], reason: "bad_url" }); }

    // Homepage gets a generous timeout — slow/remote WordPress hosts were timing
    // out before. Report the HTTP status so a block (403/503) is diagnosable.
    const home = await fetchPage(parsed, 18000);
    if (!home.html) return NextResponse.json({ ok: true, categories: [], reason: home.status ? `blocked_${home.status}` : "unreachable" });

    // Homepage text + a few relevant sub-pages (weddings/functions/venue/accommodation),
    // where the actual ceremony/reception/space listings usually live.
    const subPages = discoverLinks(home.html, parsed, 4);
    const subTexts = await Promise.all(subPages.map((u) => fetchPage(u, 10000).then((r) => r.html ? htmlToText(r.html, 12_000) : "")));
    const text = [htmlToText(home.html, 16_000), ...subTexts.filter(Boolean)].join("\n\n---\n\n").slice(0, 40_000);
    if (text.length < 80) return NextResponse.json({ ok: true, categories: [], reason: "empty_site" });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: true, categories: [], reason: "no_ai" });
    const anthropic = new Anthropic({ apiKey });

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: `${INSTRUCTION}\n\nWEBSITE (${parsed.hostname}):\n${text}` }],
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed2 = parseCategories(out);
    if (!parsed2) return NextResponse.json({ ok: true, categories: [], reason: "parse_failed" });

    // Drop areas the venue already has (so this is safe to run even when some
    // spaces exist) — match on a normalised name.
    const { data: existing } = await db.from("venue_areas").select("name").eq("venue_id", venue_id);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const have = new Set((existing ?? []).map((r) => norm(String(r.name))));
    const categories = (parsed2.filter(Boolean) as Array<{ category: string; location: string; areas: Array<{ name: string; pricing: string; price: number | null }> }>)
      .map((c) => ({ ...c, areas: c.areas.filter((ar) => !have.has(norm(ar.name))) }))
      .filter((c) => c.areas.length > 0);

    return NextResponse.json({ ok: true, categories, site: parsed.hostname });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
