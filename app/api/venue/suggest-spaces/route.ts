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
  `You are helping a South African wedding venue list the SPACES couples can book ` +
  `(ceremony lawn, reception hall, gardens, chapel, on-site cottages used for the event, etc.).\n` +
  `From the website text, infer the distinct bookable spaces. Return ONLY a JSON array, no prose:\n` +
  `[{"name":"","type":"main|extra|overflow","sub_category":"","wedding_price":null,"note":""}]\n` +
  `Rules:\n` +
  `- name: the space's real name as on the site (e.g. "Ceremony Lawn", "Stone Chapel", "Reception Barn").\n` +
  `- type: "main" if it's a core included area (ceremony/reception), "extra" if it's an optional paid add-on, "overflow" for spill-over/secondary areas. Default to "main" for primary ceremony/reception spaces.\n` +
  `- sub_category: a short grouping label if natural (e.g. "Gardens", "Indoor", "Outdoor", "Chapels"); else "".\n` +
  `- wedding_price: a NUMBER in Rand ONLY if the site clearly states a hire/venue price for that space; otherwise null. Never guess a price.\n` +
  `- note: leave "" unless a tiny clarifying detail helps.\n` +
  `Return at most 12 spaces. If you cannot find any spaces, return [].`;

function parseSpaces(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    const kinds = new Set(["main", "extra", "overflow"]);
    return arr
      .map((o: Record<string, unknown>) => {
        const name = String(o?.name ?? "").trim();
        if (!name) return null;
        const type = kinds.has(String(o?.type)) ? String(o?.type) : "main";
        const rawPrice = o?.wedding_price;
        const price = rawPrice == null || rawPrice === "" ? null : Number(String(rawPrice).replace(/[^\d.]/g, ""));
        return {
          name: name.slice(0, 120),
          type,
          sub_category: String(o?.sub_category ?? "").trim().slice(0, 60),
          wedding_price: Number.isFinite(price) && (price as number) > 0 ? Math.round(price as number) : null,
          note: String(o?.note ?? "").trim().slice(0, 160),
        };
      })
      .filter(Boolean)
      .slice(0, 12);
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
    if (!target) return NextResponse.json({ ok: true, spaces: [], reason: "no_website" });
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    let parsed: URL;
    try { parsed = new URL(target); assertSafeUrl(parsed); }
    catch { return NextResponse.json({ ok: true, spaces: [], reason: "bad_url" }); }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    let html = "";
    try {
      const res = await safeFetch(parsed, {
        signal: ctrl.signal,
        headers: { "User-Agent": "VenuelySpacesBot/1.0 (+https://venuely.co.za)" },
      });
      if (!res.ok) return NextResponse.json({ ok: true, spaces: [], reason: "fetch_failed" });
      html = await res.text();
    } catch {
      return NextResponse.json({ ok: true, spaces: [], reason: "unreachable" });
    } finally {
      clearTimeout(timer);
    }

    const text = htmlToText(html);
    if (text.length < 80) return NextResponse.json({ ok: true, spaces: [], reason: "empty_site" });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: true, spaces: [], reason: "no_ai" });
    const anthropic = new Anthropic({ apiKey });

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: `${INSTRUCTION}\n\nWEBSITE (${parsed.hostname}):\n${text}` }],
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const spaces = parseSpaces(out);
    if (!spaces) return NextResponse.json({ ok: true, spaces: [], reason: "parse_failed" });

    return NextResponse.json({ ok: true, spaces, site: parsed.hostname });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
