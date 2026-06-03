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
    db.from("rental_items").select("id, name, category, price, cost_treatment").eq("venue_id", venueId).eq("active", true),
    db.from("catalogue_items").select("id, name, category, price, cost_treatment").eq("venue_id", venueId).eq("active", true),
    db.from("accommodation_rooms").select("id, name, sleeps, price_per_night").eq("venue_id", venueId).eq("active", true),
    db.from("vendor_partners").select("id, name, vendor_type, price_from").eq("venue_id", venueId).eq("active", true),
  ]) : [{ data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const catArr = (catalogue.data ?? []) as Array<Record<string, unknown>>;
  const rentArr = (rentals.data ?? []) as Array<Record<string, unknown>>;
  const roomArr = (rooms.data ?? []) as Array<Record<string, unknown>>;
  const vendArr = (vendors.data ?? []) as Array<Record<string, unknown>>;
  // Known IDs for server-side validation of any action the model proposes.
  const catIds = new Set(catArr.map((c) => String(c.id)));
  const rentIds = new Set(rentArr.map((r) => String(r.id)));
  const roomIds = new Set(roomArr.map((r) => String(r.id)));
  const TABS = ["Overview", "Our Venue", "Catalogue & Rentals", "Inspiration", "Flowers", "Dress", "Décor", "Accommodation", "Suppliers", "Guests", "Invites", "Seating", "Timeline", "Checklist", "Contacts", "Music", "Budget", "Payments", "Documents"];

  const list = (arr: Array<Record<string, unknown>>, fmt: (x: Record<string, unknown>) => string) => arr.slice(0, 60).map(fmt).join("\n") || "(none listed)";
  const venueName = venue?.data?.name || "the venue";
  const system = `You are Venuely's AI wedding planner for a couple planning their wedding at ${venueName}${venue?.data?.region ? ` in ${venue.data.region}` : ""}. Context: couple ${w?.couple_names || "—"}, date ${w?.wedding_date || "TBC"}, ~${w?.guest_count ?? "?"} guests.

You DO things, you don't just advise. When the couple expresses a preference, you respond with a SHORT line (<= 25 words) and a set of ACTION BUTTONS that, when tapped, set their choices up in the portal automatically. Only ever reference items the venue actually offers (IDs below). Never invent items or IDs.

Respond with ONLY a JSON object, no markdown, of shape:
{"reply":"<= 25 words","actions":[{"label":"short button label","type":"<type>","payload":{...}}]}

Allowed action types and payloads:
- "selectCatalogue" {"ids":["catalogue id",...]}  // pre-selects menu items
- "selectRentals" {"ids":["rental id",...]}        // pre-selects rentals
- "selectRooms" {"ids":["room id",...]}            // reserves accommodation
- "setPalette" {"colors":["#hex",...]}             // sets the inspiration colour palette
- "addChecklist" {"items":["task",...]}            // adds checklist tasks
- "addTimeline" {"items":[{"time":"14:00","title":"Ceremony"},...]}  // adds run-sheet items
- "goto" {"tab":"<one of the tabs>"}               // just navigate

Give 1-6 actions that best integrate what they asked. Prefer concrete select/add actions over "goto". Use exact IDs.

CATALOGUE (id — name [category] price): ${list(catArr, (c) => `${c.id} — ${c.name}${c.category ? ` [${c.category}]` : ""}${c.cost_treatment === "included" ? " (included)" : c.price ? ` R${c.price}` : ""}`)}
RENTALS: ${list(rentArr, (r) => `${r.id} — ${r.name}${r.category ? ` [${r.category}]` : ""}${r.cost_treatment === "included" ? " (included)" : r.price ? ` R${r.price}` : ""}`)}
ACCOMMODATION: ${list(roomArr, (r) => `${r.id} — ${r.name} (sleeps ${r.sleeps ?? "?"}${r.price_per_night ? `, R${r.price_per_night}/night` : ""})`)}
PARTNER VENDORS: ${list(vendArr, (v) => `${v.name}${v.vendor_type ? ` [${v.vendor_type}]` : ""}${v.price_from ? ` from R${v.price_from}` : ""}`)}
Tabs: ${TABS.join(", ")}.`;

  // Validate the model's proposed actions against real IDs / tabs.
  type Action = { label: string; type: string; payload: Record<string, unknown> };
  function sanitize(actions: unknown): Action[] {
    if (!Array.isArray(actions)) return [];
    const out: Action[] = [];
    for (const a of actions.slice(0, 6)) {
      if (!a || typeof a !== "object") continue;
      const { label, type, payload } = a as Action;
      if (!label || !type) continue;
      const p = (payload || {}) as Record<string, unknown>;
      const ids = Array.isArray(p.ids) ? p.ids.map(String) : [];
      if (type === "selectCatalogue") { const v = ids.filter((id) => catIds.has(id)); if (v.length) out.push({ label, type, payload: { ids: v } }); }
      else if (type === "selectRentals") { const v = ids.filter((id) => rentIds.has(id)); if (v.length) out.push({ label, type, payload: { ids: v } }); }
      else if (type === "selectRooms") { const v = ids.filter((id) => roomIds.has(id)); if (v.length) out.push({ label, type, payload: { ids: v } }); }
      else if (type === "setPalette") { const colors = (Array.isArray(p.colors) ? p.colors : []).map(String).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 8); if (colors.length) out.push({ label, type, payload: { colors } }); }
      else if (type === "addChecklist") { const items = (Array.isArray(p.items) ? p.items : []).map(String).filter(Boolean).slice(0, 12); if (items.length) out.push({ label, type, payload: { items } }); }
      else if (type === "addTimeline") { const items = (Array.isArray(p.items) ? p.items : []).filter((x) => x && typeof x === "object").map((x) => ({ time: String((x as Record<string, unknown>).time ?? ""), title: String((x as Record<string, unknown>).title ?? "") })).filter((x) => x.title).slice(0, 12); if (items.length) out.push({ label, type, payload: { items } }); }
      else if (type === "goto") { const tab = String(p.tab ?? ""); if (TABS.includes(tab)) out.push({ label, type, payload: { tab } }); }
    }
    return out;
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const m = out.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]) as { reply?: string; actions?: unknown };
        return NextResponse.json({ ok: true, reply: (parsed.reply || "").trim(), actions: sanitize(parsed.actions) });
      } catch { /* fall through to plain text */ }
    }
    return NextResponse.json({ ok: true, reply: out, actions: [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "planner failed" }, { status: 500 });
  }
}
