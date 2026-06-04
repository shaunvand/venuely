import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// Seed a default day-of timeline guide on the wedding's start date. Idempotent:
// does nothing if the wedding already has any timeline entries.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const GUIDE: Array<{ start_time: string; title: string; notes: string }> = [
  { start_time: "12:00", title: "Guests arrive", notes: "Welcome drinks & canapés" },
  { start_time: "15:00", title: "Ceremony", notes: "Exchange of vows" },
  { start_time: "16:00", title: "Photos", notes: "Couple & family portraits" },
  { start_time: "18:00", title: "Reception", notes: "Dinner & speeches" },
  { start_time: "20:00", title: "First dance", notes: "Dance floor opens" },
  { start_time: "23:00", title: "Last song", notes: "Farewell" },
];

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const db = admin();

  const { count } = await db.from("wedding_timeline").select("id", { count: "exact", head: true }).eq("wedding_id", access.wedding.id);
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true, seeded: 0 });

  const { data: w } = await db.from("weddings").select("wedding_date").eq("id", access.wedding.id).single();
  const day = w?.wedding_date ? String(w.wedding_date).slice(0, 10) : null;

  const rows = GUIDE.map((g, i) => ({ wedding_id: access.wedding.id, ...g, event_date: day, sort_order: i }));
  const { error } = await db.from("wedding_timeline").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, seeded: rows.length });
}
