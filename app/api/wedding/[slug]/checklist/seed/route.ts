import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// One-time seed of the standard phase-grouped wedding checklist. Idempotent: does
// nothing if the wedding already has any checklist tasks.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const DEFAULTS: Array<[string, string[]]> = [
  ["12+ Months Before", ["Set your overall wedding budget", "Choose your wedding date", "Book the ceremony & reception venue", "Start your guest list", "Hire a wedding planner (optional)"]],
  ["9–12 Months Before", ["Book photographer & videographer", "Book caterer", "Book officiant", "Book band or DJ", "Begin dress & suit shopping"]],
  ["6–9 Months Before", ["Send save-the-dates", "Book florist", "Book hair & makeup artist", "Plan your honeymoon", "Set up a gift registry"]],
  ["3–6 Months Before", ["Send wedding invitations", "Order the wedding cake", "Plan the rehearsal dinner", "Arrange guest accommodation", "Plan seating chart"]],
  ["1–3 Months Before", ["Final dress fitting", "Confirm all vendors", "Obtain marriage license", "Write your vows", "Create day-of timeline"]],
  ["Final Week", ["Give final headcount to caterer", "Pick up wedding rings", "Break in wedding shoes", "Pack for honeymoon", "Rest and enjoy the moment!"]],
];

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const db = admin();

  const { count } = await db.from("wedding_checklist").select("id", { count: "exact", head: true }).eq("wedding_id", access.wedding.id);
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true, seeded: 0 });

  let order = 0;
  const rows: Array<Record<string, unknown>> = [];
  for (const [phase, tasks] of DEFAULTS) for (const title of tasks) rows.push({ wedding_id: access.wedding.id, title, phase, done: false, sort_order: order++ });
  const { error } = await db.from("wedding_checklist").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, seeded: rows.length });
}
