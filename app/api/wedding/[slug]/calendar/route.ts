import { type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import { buildIcs, type IcsEvent } from "@/lib/ical";

// Couple "Add to calendar" — the wedding day (multi-day aware) plus any run-sheet
// timeline events, as a downloadable .ics. Portal-gated.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const hhmm = (t: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(t.trim()); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null; };

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return new Response(access.reason, { status: access.status });
  const db = admin();
  const stamp = new Date().toISOString();

  const { data: w } = await db.from("weddings").select("id, couple_names, wedding_date, wedding_end_date, venue_id").eq("id", access.wedding.id).single();
  if (!w?.wedding_date) return new Response("No wedding date set", { status: 404 });
  const { data: venue } = await db.from("venues").select("name, address, region").eq("id", w.venue_id).single();
  const location = [venue?.name, venue?.address || venue?.region].filter(Boolean).join(", ");
  const couple = w.couple_names || "Our wedding";

  const events: IcsEvent[] = [{
    uid: `wedding-${w.id}@venuely`, stamp,
    summary: `💍 ${couple}`,
    description: `Wedding day${venue?.name ? ` at ${venue.name}` : ""}.`,
    location, date: w.wedding_date, endDate: w.wedding_end_date || undefined,
  }];

  // Run-sheet items with a parseable time become timed events on the wedding day.
  const { data: tl } = await db.from("wedding_timeline").select("id, start_time, title, location, notes").eq("wedding_id", w.id).order("sort_order");
  for (const t of tl ?? []) {
    const time = t.start_time ? hhmm(String(t.start_time)) : null;
    if (!time || !t.title) continue;
    events.push({
      uid: `tl-${t.id}@venuely`, stamp,
      summary: t.title as string,
      description: (t.notes as string) || undefined,
      location: (t.location as string) || location,
      start: `${w.wedding_date}T${time}`,
    });
  }

  const ics = buildIcs(couple, events);
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-wedding.ics"`,
    },
  });
}
