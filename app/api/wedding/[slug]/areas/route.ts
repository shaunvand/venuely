import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// Couple selects paid venue spaces (areas) per day-type. Stored on
// weddings.area_selections — the same column getWeddingTotals/cron bill from.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const DAYS = new Set(["wedding", "mg", "farewell"]);

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const db = admin();

  const body = (await req.json().catch(() => ({}))) as { selections?: Array<{ area_id?: string; day_type?: string }> };
  const { data: w } = await db.from("weddings").select("venue_id").eq("id", access.wedding.id).single();
  const { data: vAreas } = w?.venue_id ? await db.from("venue_areas").select("id").eq("venue_id", w.venue_id) : { data: [] };
  const valid = new Set((vAreas ?? []).map((a) => a.id as string));

  const clean = (body.selections ?? [])
    .filter((s) => s && valid.has(String(s.area_id)) && DAYS.has(String(s.day_type)))
    .map((s) => ({ area_id: String(s.area_id), day_type: String(s.day_type) }));

  const { error } = await db.from("weddings").update({ area_selections: clean }).eq("id", access.wedding.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, selections: clean });
}
