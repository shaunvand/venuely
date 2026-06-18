import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { assertSafeUrl, safeFetch } from "@/lib/security/guards";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  `- areas[].name: the area's real name as on the site.\n` +
  `- areas[].pricing: "included" if it's part of the core venue hire, "separate" if it's an optional paid add-on. Default to "included" for core ceremony/reception areas.\n` +
  `- areas[].price: a NUMBER in Rand ONLY if the site clearly states a price for a separate-cost area; otherwise null. Never guess a price.\n` +
  `Return at most 6 categories and 24 areas total. If you cannot find any spaces, return [].`;

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
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24_000);
}

export async function POST(req: NextRequest) {
  try {
    const { venue_id } = await req.json();
    if (!venue_id) return NextResponse.json({ error: "Missing venue_id" }, { status: 400 });
    const a = await authVenue(String(venue_id));
    if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

    const { data: venue } = await a.auth.from("venues").select("website").eq("id", venue_id).maybeSingle();
    let target = String(venue?.website ?? "").trim();
    if (!target) return NextResponse.json({ ok: true, categories: [], reason: "no_website" });
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    let parsed: URL;
    try { parsed = new URL(target); assertSafeUrl(parsed); }
    catch { return NextResponse.json({ ok: true, categories: [], reason: "bad_url" }); }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    let html = "";
    try {
      const res = await safeFetch(parsed, {
        signal: ctrl.signal,
        headers: { "User-Agent": "VenuelySpacesBot/1.0 (+https://venuely.co.za)" },
      });
      if (!res.ok) return NextResponse.json({ ok: true, categories: [], reason: "fetch_failed" });
      html = await res.text();
    } catch {
      return NextResponse.json({ ok: true, categories: [], reason: "unreachable" });
    } finally {
      clearTimeout(timer);
    }

    const text = htmlToText(html);
    if (text.length < 80) return NextResponse.json({ ok: true, categories: [], reason: "empty_site" });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: true, categories: [], reason: "no_ai" });
    const anthropic = new Anthropic({ apiKey });

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: `${INSTRUCTION}\n\nWEBSITE (${parsed.hostname}):\n${text}` }],
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const categories = parseCategories(out);
    if (!categories) return NextResponse.json({ ok: true, categories: [], reason: "parse_failed" });

    return NextResponse.json({ ok: true, categories, site: parsed.hostname });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
