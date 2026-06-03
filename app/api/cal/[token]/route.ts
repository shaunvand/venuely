import { type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { buildIcs, type IcsEvent } from "@/lib/ical";

// Subscribable venue booking feed. The token IS the secret (no session) so the
// venue can paste a webcal:// URL into Google/Apple Calendar and see every booking
// auto-update. Lists confirmed/provisional weddings as all-day (multi-day) events.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const tok = token.replace(/\.ics$/i, "");
  if (!UUID.test(tok)) return new Response("Not found", { status: 404 });
  const db = admin();
  const stamp = new Date().toISOString();

  const { data: venue } = await db.from("venues").select("id, name").eq("ical_token", tok).single();
  if (!venue) return new Response("Not found", { status: 404 });

  const { data: weddings } = await db.from("weddings")
    .select("id, couple_names, wedding_date, wedding_end_date, status, guest_count")
    .eq("venue_id", venue.id)
    .not("wedding_date", "is", null)
    .neq("status", "cancelled");

  const events: IcsEvent[] = (weddings ?? []).map((w) => ({
    uid: `booking-${w.id}@venuely`, stamp,
    summary: `${w.couple_names || "Booking"}${w.status === "provisional" ? " (provisional)" : ""}`,
    description: [w.guest_count ? `${w.guest_count} guests` : null, w.status ? `Status: ${w.status}` : null].filter(Boolean).join(" · ") || undefined,
    date: w.wedding_date as string, endDate: (w.wedding_end_date as string) || undefined,
  }));

  const ics = buildIcs(`${venue.name || "Venue"} — Bookings`, events);
  return new Response(ics, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `inline; filename="venue-bookings.ics"` },
  });
}
