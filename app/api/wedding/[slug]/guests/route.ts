import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// Couple-managed guest list. The couple authenticates via the portal password
// cookie (portalAccess); writes go through the service role since RLS hides the
// rows from an anonymous couple. Scoped strictly to access.wedding.id.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const COLS = "id, full_name, email, phone, rsvp_status, table_number, room_id, dietary, accessibility_needs, plus_one, is_child, side, notes, rsvp_token, invited_at, responded_at, party_size, rsvp_message, amount_due, amount_paid, payment_note";
const ALLOWED = new Set(["full_name", "email", "phone", "rsvp_status", "table_number", "room_id", "dietary", "accessibility_needs", "plus_one", "is_child", "side", "notes", "amount_due", "amount_paid", "payment_note"]);
const NUMERIC = new Set(["amount_due", "amount_paid"]);

function clean(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED.has(k)) continue;
    if (k === "table_number") out[k] = v === "" || v == null ? null : Number(v);
    else if (NUMERIC.has(k)) out[k] = v === "" || v == null ? 0 : Number(v);
    else if (k === "plus_one" || k === "is_child") out[k] = !!v;
    else out[k] = v === "" ? null : v;
  }
  return out;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const { data } = await admin().from("guests").select(COLS).eq("wedding_id", access.wedding.id).order("created_at");
  return NextResponse.json({ ok: true, guests: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = await req.json().catch(() => ({}));
  const name = String((body as { full_name?: string }).full_name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const row = { ...clean(body as Record<string, unknown>), wedding_id: access.wedding.id, consent_at: new Date().toISOString() };
  const { data, error } = await admin().from("guests").insert(row).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, guest: data });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = await req.json().catch(() => ({})) as { id?: string } & Record<string, unknown>;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await admin().from("guests").update(clean(body)).eq("id", body.id).eq("wedding_id", access.wedding.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = await req.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await admin().from("guests").delete().eq("id", body.id).eq("wedding_id", access.wedding.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
