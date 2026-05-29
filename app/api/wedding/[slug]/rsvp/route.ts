import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Public per-guest RSVP endpoint. No portal password / auth — guests are not the
// couple. Appends/updates the guest in weddings.wedding_state.guests (the same
// shape app.js reads: a flat array of names), and stores richer RSVP detail in a
// sibling `rsvps` map + mirrors any meal note into `guestDietary` so the couple's
// existing Guest List / caterer views pick it up.

function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null;
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type RsvpBody = {
  name?: string;
  attending?: boolean;
  meal?: string | null;
  plus_one?: boolean;
  plus_one_name?: string | null;
};

type RsvpEntry = {
  attending: boolean;
  meal: string | null;
  plus_one: boolean;
  plus_one_name: string | null;
  responded_at: string;
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const ad = admin();
  if (!ad) {
    return NextResponse.json({ error: "RSVP is not configured" }, { status: 503 });
  }

  let body: RsvpBody;
  try { body = (await request.json()) as RsvpBody; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (name.length > 120) return NextResponse.json({ error: "name too long" }, { status: 400 });

  const attending = body.attending !== false; // default to attending
  const meal = body.meal ? String(body.meal).slice(0, 300).trim() || null : null;
  const plusOne = body.plus_one === true;
  const plusOneName = plusOne && body.plus_one_name ? String(body.plus_one_name).slice(0, 120).trim() || null : null;

  // Look up the wedding by slug + read its current state.
  const { data: wedding, error: wErr } = await ad
    .from("weddings")
    .select("id, wedding_state")
    .eq("slug", slug)
    .maybeSingle();
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
  if (!wedding) return NextResponse.json({ error: "wedding not found" }, { status: 404 });

  const state = (wedding.wedding_state ?? {}) as Record<string, unknown>;
  const guests = Array.isArray(state.guests) ? [...(state.guests as string[])] : [];
  const rsvps = (state.rsvps && typeof state.rsvps === "object" ? { ...(state.rsvps as Record<string, RsvpEntry>) } : {}) as Record<string, RsvpEntry>;
  const guestDietary = (state.guestDietary && typeof state.guestDietary === "object" ? { ...(state.guestDietary as Record<string, { dietary?: string }>) } : {}) as Record<string, { dietary?: string }>;

  // Upsert the primary guest name into the flat list (only when attending).
  function ensureGuest(g: string) {
    if (attending && !guests.includes(g)) guests.push(g);
  }
  ensureGuest(name);

  // Record the rich RSVP entry keyed by name.
  rsvps[name] = {
    attending,
    meal,
    plus_one: plusOne,
    plus_one_name: plusOneName,
    responded_at: new Date().toISOString(),
  };

  // Mirror meal note into the dietary map the caterer/guest views already read.
  if (meal) guestDietary[name] = { ...(guestDietary[name] ?? {}), dietary: meal };

  // Plus-one is added to the guest list (and gets a minimal rsvp marker).
  if (attending && plusOneName) {
    ensureGuest(plusOneName);
    rsvps[plusOneName] = {
      attending: true,
      meal: null,
      plus_one: false,
      plus_one_name: null,
      responded_at: new Date().toISOString(),
    };
  }

  const nextState = { ...state, guests, rsvps, guestDietary };

  const { error: uErr } = await ad
    .from("weddings")
    .update({ wedding_state: nextState, wedding_state_updated_at: new Date().toISOString() })
    .eq("id", wedding.id);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, attending });
}
