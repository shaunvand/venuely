import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// Generic couple-managed list CRUD (timeline / contacts / songs). Couple auth via
// the portal password cookie; writes via service role, strictly scoped to the
// wedding. Columns are whitelisted per kind so junk can't be inserted.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const KINDS: Record<string, { table: string; cols: string[]; order: string }> = {
  timeline: { table: "wedding_timeline", cols: ["start_time", "title", "location", "responsible", "notes", "sort_order"], order: "sort_order" },
  contacts: { table: "wedding_contacts", cols: ["role", "name", "company", "phone", "email", "is_emergency", "notes"], order: "created_at" },
  songs: { table: "wedding_songs", cols: ["moment", "title", "artist", "notes", "sort_order"], order: "sort_order" },
};

function cfg(kind: string) { return KINDS[kind]; }
function clean(cols: string[], body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!cols.includes(k)) continue;
    if (k === "sort_order") out[k] = v === "" || v == null ? 0 : Number(v);
    else if (k === "is_emergency") out[k] = !!v;
    else out[k] = v === "" ? null : v;
  }
  return out;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await ctx.params;
  const c = cfg(kind); if (!c) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const { data } = await admin().from(c.table).select(`id, ${c.cols.join(", ")}`).eq("wedding_id", access.wedding.id).order(c.order);
  return NextResponse.json({ ok: true, rows: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await ctx.params;
  const c = cfg(kind); if (!c) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!String(body.title ?? body.name ?? "").trim()) return NextResponse.json({ error: "title/name required" }, { status: 400 });
  const { data, error } = await admin().from(c.table).insert({ ...clean(c.cols, body), wedding_id: access.wedding.id }).select(`id, ${c.cols.join(", ")}`).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await ctx.params;
  const c = cfg(kind); if (!c) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as { id?: string } & Record<string, unknown>;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await admin().from(c.table).update(clean(c.cols, body)).eq("id", body.id).eq("wedding_id", access.wedding.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await ctx.params;
  const c = cfg(kind); if (!c) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await admin().from(c.table).delete().eq("id", body.id).eq("wedding_id", access.wedding.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
