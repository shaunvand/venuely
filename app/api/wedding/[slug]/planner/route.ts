import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import Anthropic from "@anthropic-ai/sdk";

// AI wedding planner — a chat recommendation tool grounded in THIS venue's actual
// assets, categories and the couple's wedding context. It guides couples on what to
// pick from what the venue offers (never invents items). Portal-gated.
export const runtime = "nodejs";
export const maxDuration = 60;
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { messages?: Msg[] };
  const messages = (body.messages ?? []).filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-12);
  if (!messages.length) return NextResponse.json({ error: "no messages" }, { status: 400 });

  const db = admin();
  const { data: w } = await db.from("weddings").select("venue_id, couple_names, wedding_date, guest_count, rsvp_settings").eq("id", access.wedding.id).single();
  const venueId = w?.venue_id;
  const [venue, rentals, catalogue, rooms, vendors] = venueId ? await Promise.all([
    db.from("venues").select("name, region, description").eq("id", venueId).single(),
    db.from("rental_items").select("name, category, price, cost_treatment").eq("venue_id", venueId).eq("active", true),
    db.from("catalogue_items").select("name, category, price, cost_treatment").eq("venue_id", venueId).eq("active", true),
    db.from("accommodation_rooms").select("name, sleeps, price_per_night").eq("venue_id", venueId).eq("active", true),
    db.from("vendor_partners").select("name, vendor_type, price_from").eq("venue_id", venueId).eq("active", true),
  ]) : [{ data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const list = (arr: Array<Record<string, unknown>>, fmt: (x: Record<string, unknown>) => string) => (arr ?? []).slice(0, 60).map(fmt).join("; ") || "(none listed)";
  const venueName = venue?.data?.name || "the venue";
  const system = `You are Venuely's AI wedding planner — a warm, concise recommendation assistant for a couple planning their wedding at ${venueName}${venue?.data?.region ? ` in ${venue.data.region}` : ""}.

Wedding context: couple ${w?.couple_names || "—"}, date ${w?.wedding_date || "TBC"}, ~${w?.guest_count ?? "?"} guests.
${venue?.data?.description ? `About the venue: ${String(venue.data.description).slice(0, 500)}` : ""}

ONLY recommend things the venue actually offers (listed below) plus general planning advice (timeline, etiquette, budgeting, RSVPs, seating). Never invent products or prices. When you suggest items, use their exact names and group by category. If something isn't offered, say so and suggest the closest alternative they DO offer or a partner vendor.

CATALOGUE (menu/per-head): ${list(catalogue.data as [], (c) => `${c.name}${c.category ? ` [${c.category}]` : ""}${c.cost_treatment === "included" ? " (included)" : c.price ? ` R${c.price}` : ""}`)}
RENTALS: ${list(rentals.data as [], (r) => `${r.name}${r.category ? ` [${r.category}]` : ""}${r.cost_treatment === "included" ? " (included)" : r.price ? ` R${r.price}` : ""}`)}
ACCOMMODATION: ${list(rooms.data as [], (r) => `${r.name} (sleeps ${r.sleeps ?? "?"}${r.price_per_night ? `, R${r.price_per_night}/night` : ""})`)}
PARTNER VENDORS: ${list(vendors.data as [], (v) => `${v.name}${v.vendor_type ? ` [${v.vendor_type}]` : ""}${v.price_from ? ` from R${v.price_from}` : ""}`)}

Keep replies short and practical (a few sentences or a tight bulleted list). Point couples to the relevant portal tab (Catalogue & Rentals, Accommodation, Suppliers, Seating, Inspiration, Invites) when useful.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
    });
    const reply = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "planner failed" }, { status: 500 });
  }
}
