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

const KINDS: Record<string, { table: string; cols: string[]; order: string; name: string; numeric?: string[]; bool?: string[] }> = {
  timeline: { table: "wedding_timeline", cols: ["start_time", "title", "location", "responsible", "notes", "sort_order"], order: "sort_order", name: "title" },
  contacts: { table: "wedding_contacts", cols: ["role", "name", "company", "phone", "email", "is_emergency", "notes"], order: "created_at", name: "name", bool: ["is_emergency"] },
  songs: { table: "wedding_songs", cols: ["moment", "title", "artist", "notes", "sort_order"], order: "sort_order", name: "title" },
  budget: { table: "wedding_budget", cols: ["category", "description", "estimated", "actual", "paid", "vendor_name", "due_date", "notes"], order: "created_at", name: "category", numeric: ["estimated", "actual", "paid"] },
  checklist: { table: "wedding_checklist", cols: ["title", "due_date", "done", "notes", "sort_order"], order: "sort_order", name: "title", bool: ["done"] },
  flowers: { table: "wedding_flowers", cols: ["title", "category", "notes"], order: "created_at", name: "title" },
  dress: { table: "wedding_dress", cols: ["title", "shop", "notes"], order: "created_at", name: "title" },
  decor: { table: "wedding_decor", cols: ["title", "area", "notes"], order: "created_at", name: "title" },
};

function cfg(kind: string) { return KINDS[kind]; }
function clean(c: { cols: string[]; numeric?: string[]; bool?: string[] }, body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const numeric = new Set(c.numeric ?? []);
  const bool = new Set([...(c.bool ?? []), "is_emergency"]);
  for (const [k, v] of Object.entries(body)) {
    if (!c.cols.includes(k)) continue;
    if (k === "sort_order") out[k] = v === "" || v == null ? 0 : Number(v);
    else if (bool.has(k)) out[k] = !!v;
    else if (numeric.has(k)) out[k] = v === "" || v == null ? null : Number(v);
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
  if (!String((body as Record<string, unknown>)[c.name] ?? "").trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const { data, error } = await admin().from(c.table).insert({ ...clean(c, body), wedding_id: access.wedding.id }).select(`id, ${c.cols.join(", ")}`).single();
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
  const { error } = await admin().from(c.table).update(clean(c, body)).eq("id", body.id).eq("wedding_id", access.wedding.id);
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
