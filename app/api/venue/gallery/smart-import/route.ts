import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { VENUE_LOCATIONS } from "../route";

export const runtime = "nodejs";
export const maxDuration = 120;

async function authVenue(venueId: string) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };
  const [{ data: member }, { data: profile }] = await Promise.all([
    auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle(),
    auth.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!member && profile?.role !== "owner") return { ok: false as const, status: 403, error: "Not your venue" };
  return { ok: true as const };
}

// Pull images already uploaded across the venue (areas, accommodation, catalogue,
// rentals, imports) and auto-label each by venue location, adding them to the gallery.
export async function POST(req: NextRequest) {
  try {
    const { venue_id } = await req.json();
    const venueId = String(venue_id || "").trim();
    if (!venueId || !/^[a-zA-Z0-9-]+$/.test(venueId))
      return NextResponse.json({ error: "Missing or invalid venue_id" }, { status: 400 });

    const gate = await authVenue(venueId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const sb = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Source images: everything for this venue that isn't already a venue-gallery item.
    const { data: assets } = await sb
      .from("media_assets")
      .select("url, label, owner_type")
      .eq("venue_id", venueId)
      .eq("kind", "photo")
      .neq("owner_type", "venue");

    const { data: existing } = await sb
      .from("media_assets")
      .select("url")
      .eq("venue_id", venueId)
      .eq("owner_type", "venue");
    const have = new Set((existing ?? []).map((r) => r.url as string));

    const candidates = Array.from(
      new Map(
        (assets ?? [])
          .filter((a) => a.url && !have.has(a.url as string))
          .map((a) => [a.url as string, a])
      ).values()
    );

    if (candidates.length === 0)
      return NextResponse.json({ ok: true, added: 0, message: "No new venue images found to import." });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    const anthropic = new Anthropic({ apiKey });

    const list = candidates
      .map((c, i) => `${i}: source=${c.owner_type} label=${JSON.stringify(c.label || "")}`)
      .join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content:
            `You are tagging photos for a South African wedding venue gallery. ` +
            `For each item below, choose the single best venue location category from this list: ` +
            `${VENUE_LOCATIONS.join(", ")}.\n` +
            `Output JSONL — one line per item, no prose, format: {"i":<index>,"category":"<one of the list>"}\n\n` +
            list,
        },
      ],
    });

    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const cat: Record<number, string> = {};
    for (const line of text.split("\n")) {
      const s = line.trim().replace(/^```\w*$/, "").trim();
      if (!s.startsWith("{")) continue;
      try {
        const o = JSON.parse(s);
        if (typeof o.i === "number" && typeof o.category === "string") {
          const m = VENUE_LOCATIONS.find((v) => v.toLowerCase() === o.category.toLowerCase());
          cat[o.i] = m || "Other";
        }
      } catch {}
    }

    const rows = candidates.map((c, i) => ({
      venue_id: venueId,
      owner_type: "venue",
      owner_id: venueId,
      kind: "photo",
      url: c.url,
      label: c.label,
      category: cat[i] || "Other",
    }));

    const { error } = await sb.from("media_assets").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, added: rows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
