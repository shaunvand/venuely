import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import Anthropic from "@anthropic-ai/sdk";

// AI-draft a reminder email (RSVP or guest-payment) for the couple to edit. Uses
// the wedding + venue context and the right placeholders. Returns {subject, body}.
export const runtime = "nodejs";
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { kind?: string; tone?: string };
  const kind = body.kind === "payment" ? "payment" : "rsvp";
  const tone = (body.tone || "warm and friendly").slice(0, 60);

  const db = admin();
  const { data: w } = await db.from("weddings").select("couple_names, wedding_date, venue_id").eq("id", access.wedding.id).single();
  const { data: venue } = w?.venue_id ? await db.from("venues").select("name").eq("id", w.venue_id).single() : { data: null };
  const couple = w?.couple_names || "the couple";
  const venueName = venue?.name || "our venue";
  const dateLabel = w?.wedding_date ? new Date(`${String(w.wedding_date).slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "our wedding day";

  const placeholders = kind === "rsvp"
    ? "{name} (guest first name), {couple}, {link} (their personal RSVP link)"
    : "{name} (guest first name), {couple}, {amount} (amount outstanding)";
  const purpose = kind === "rsvp"
    ? `a gentle reminder asking a guest who hasn't responded yet to RSVP for ${couple}'s wedding on ${dateLabel} at ${venueName}. Encourage them to use their RSVP link.`
    : `a polite reminder to a guest about an outstanding contribution they owe towards ${couple}'s wedding. Mention the amount and that payment details follow.`;

  const instruction = `Write ${purpose}
Tone: ${tone}. Keep it short (2-4 sentences). South African English.
You MUST use these placeholders literally where appropriate: ${placeholders}.
Respond with ONLY JSON: {"subject":"...","body":"..."}. No markdown.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 500, messages: [{ role: "user", content: instruction }] });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "could not draft" }, { status: 422 });
    const parsed = JSON.parse(m[0]) as { subject?: string; body?: string };
    return NextResponse.json({ ok: true, subject: (parsed.subject || "").trim(), body: (parsed.body || "").trim() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "draft failed" }, { status: 500 });
  }
}
