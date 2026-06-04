import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// Couple-managed seating tables. Couples either add their own (name/shape/seats/
// ends) or import the venue's tables (venue_tables, expanded by quantity).
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const SHAPES = new Set(["long", "horseshoe", "individual"]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const { data } = await admin().from("wedding_tables").select("id, name, shape, seats, include_ends, sort_order").eq("wedding_id", access.wedding.id).order("sort_order");
  return NextResponse.json({ ok: true, tables: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const db = admin();
  const body = (await req.json().catch(() => ({}))) as { name?: string; shape?: string; seats?: number; include_ends?: boolean; importVenue?: boolean };

  // Import the venue's tables (venue_tables × quantity) as a starting point.
  if (body.importVenue) {
    const { data: w } = await db.from("weddings").select("venue_id").eq("id", access.wedding.id).single();
    const { data: vt } = w?.venue_id ? await db.from("venue_tables").select("label, shape, seats, quantity").eq("venue_id", w.venue_id).eq("active", true).order("sort_order") : { data: [] };
    const { count } = await db.from("wedding_tables").select("id", { count: "exact", head: true }).eq("wedding_id", access.wedding.id);
    let order = count ?? 0;
    const rows: Array<Record<string, unknown>> = [];
    for (const t of vt ?? []) {
      const qty = Number(t.quantity) || 1;
      const shape = t.shape === "round" || t.shape === "square" ? "individual" : t.shape === "long" ? "long" : "individual";
      for (let i = 0; i < qty; i++) rows.push({ wedding_id: access.wedding.id, name: qty > 1 ? `${t.label} ${i + 1}` : t.label, shape, seats: Number(t.seats) || 8, include_ends: shape === "long", sort_order: order++ });
    }
    if (rows.length) { const { error } = await db.from("wedding_tables").insert(rows); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); }
    return NextResponse.json({ ok: true, imported: rows.length });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const shape = SHAPES.has(String(body.shape)) ? String(body.shape) : "long";
  const seats = Math.max(1, Math.min(40, Number(body.seats) || 8));
  const { count } = await db.from("wedding_tables").select("id", { count: "exact", head: true }).eq("wedding_id", access.wedding.id);
  const { data, error } = await db.from("wedding_tables").insert({ wedding_id: access.wedding.id, name, shape, seats, include_ends: body.include_ends !== false, sort_order: count ?? 0 }).select("id, name, shape, seats, include_ends, sort_order").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, table: data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = admin();
  // Unseat anyone at this table, then remove it.
  await db.from("guests").update({ seat_table_id: null, seat_index: null }).eq("wedding_id", access.wedding.id).eq("seat_table_id", body.id);
  const { error } = await db.from("wedding_tables").delete().eq("id", body.id).eq("wedding_id", access.wedding.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
