import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import { applyMarkup } from "@/lib/billing/compute";

export const runtime = "nodejs";

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function isoSlice(d: string | null | undefined): string {
  return String(d ?? "").slice(0, 10);
}

// Each physical accommodation_rooms row is one bookable unit, so its per-night
// capacity is 1. "remaining" for a wedding's date is 1 minus any booking that
// another wedding holds for that room on that night.
const ROOM_CAPACITY = 1;

// Derive the night a wedding occupies a room when the couple hasn't specified
// explicit nights: stay the night OF the wedding (check_in = wedding_date,
// check_out = the following day).
function nightsForWedding(weddingDate: string | null): { check_in: string; check_out: string } | null {
  const ci = isoSlice(weddingDate);
  if (!ci) return null;
  const d = new Date(`${ci}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return { check_in: ci, check_out: d.toISOString().slice(0, 10) };
}

// Build a per-room remaining-capacity map for a target ISO date by counting
// OTHER weddings' bookings on the given (already venue-scoped) rooms that
// cover that date.
async function remainingByRoom(
  ad: ReturnType<typeof admin>,
  roomIds: string[],
  targetDate: string,
  excludeWeddingId: string,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!targetDate || roomIds.length === 0) {
    roomIds.forEach((id) => (out[id] = ROOM_CAPACITY));
    return out;
  }
  // A booking covers targetDate when check_in <= targetDate < check_out.
  const { data: rows } = await ad
    .from("accommodation_bookings")
    .select("room_id, wedding_id, check_in, check_out")
    .in("room_id", roomIds)
    .lte("check_in", targetDate)
    .gt("check_out", targetDate);

  const used: Record<string, number> = {};
  (rows ?? []).forEach((r) => {
    if (r.wedding_id === excludeWeddingId) return; // our own holds don't reduce what's left for us
    used[r.room_id] = (used[r.room_id] ?? 0) + 1;
  });
  roomIds.forEach((id) => {
    out[id] = Math.max(0, ROOM_CAPACITY - (used[id] ?? 0));
  });
  return out;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const ad = admin();
  const [{ data: wedding }, { data: rooms }, { data: media }] = await Promise.all([
    ad.from("weddings").select("wedding_state, wedding_date").eq("id", access.wedding.id).single(),
    ad.from("accommodation_rooms")
      .select("id, name, room_type, tier, sleeps, ideal_sleeps, max_sleeps, price_per_night, description, image_url, hero_image_url, floor_plan_url, amenities, bridal_suite, parent_room_id, bed_config, commission_value, commission_type, active, sort_order")
      .eq("venue_id", access.wedding.venue_id)
      .eq("active", true)
      .order("sort_order"),
    ad.from("media_assets")
      .select("id, owner_id, kind, url, label, sort_order")
      .eq("venue_id", access.wedding.venue_id)
      .in("kind", ["photo", "floorplan"])
      .order("sort_order"),
  ]);

  const mediaByOwner: Record<string, Array<{ url: string; kind: string; label: string | null }>> = {};
  (media ?? []).forEach((m) => {
    if (!m.owner_id) return;
    (mediaByOwner[m.owner_id] = mediaByOwner[m.owner_id] || []).push({ url: m.url, kind: m.kind, label: m.label });
  });

  const enriched = (rooms ?? []).map((r) => ({
    ...r,
    price_per_night: applyMarkup(Number(r.price_per_night), r.commission_value as number | null, r.commission_type as string | null),
    gallery: mediaByOwner[r.id] ?? [],
  }));

  const state = (wedding?.wedding_state ?? {}) as { roomAssignments?: Record<string, string[]>; guests?: string[] };
  const weddingDate = isoSlice(wedding?.wedding_date);

  // Remaining capacity per room for the wedding's date (excludes our own holds).
  const roomIds = (rooms ?? []).map((r) => r.id);
  const remaining = await remainingByRoom(ad, roomIds, weddingDate, access.wedding.id);

  return NextResponse.json({
    rooms: enriched,
    roomAssignments: state.roomAssignments ?? {},
    guests: state.guests ?? [],
    weddingDate: weddingDate || null,
    roomCapacity: ROOM_CAPACITY,
    remainingByRoom: remaining,
  });
}

// Confirm room assignments → materialise accommodation_bookings rows.
// Body: { roomAssignments: Record<roomId, guestNames[]>, nights?: { check_in, check_out } }
// Behaviour: replace this wedding's existing bookings with one row per room that
// has at least one assigned guest, using derived (or supplied) nights. Also
// patches wedding_state.roomAssignments so the source of truth stays in sync.
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }
  const { roomAssignments, nights } = body as {
    roomAssignments?: Record<string, string[]>;
    nights?: { check_in?: string; check_out?: string };
  };
  if (!roomAssignments || typeof roomAssignments !== "object") {
    return NextResponse.json({ error: "roomAssignments required" }, { status: 400 });
  }

  const ad = admin();

  const { data: wedding } = await ad
    .from("weddings")
    .select("wedding_state, wedding_date")
    .eq("id", access.wedding.id)
    .single();

  // Resolve the nights for the booking rows.
  const resolved = nights?.check_in && nights?.check_out
    ? { check_in: isoSlice(nights.check_in), check_out: isoSlice(nights.check_out) }
    : nightsForWedding(wedding?.wedding_date);
  if (!resolved || !resolved.check_in || !resolved.check_out) {
    return NextResponse.json(
      { error: "Cannot derive booking dates — set the wedding date first or pass explicit nights." },
      { status: 400 }
    );
  }
  const stay = resolved;

  // Only rooms that belong to this venue and actually have guests assigned.
  const { data: venueRooms } = await ad
    .from("accommodation_rooms")
    .select("id, name")
    .eq("venue_id", access.wedding.venue_id);
  const validRoomIds = new Set((venueRooms ?? []).map((r) => r.id));

  const roomsToBook = Object.entries(roomAssignments)
    .filter(([rid, names]) => validRoomIds.has(rid) && Array.isArray(names) && names.length > 0)
    .map(([rid, names]) => ({ rid, names: names as string[] }));

  // Capacity warning: flag rooms where another wedding already holds the night.
  const remaining = await remainingByRoom(
    ad,
    roomsToBook.map((r) => r.rid),
    stay.check_in,
    access.wedding.id
  );
  const roomName = new Map((venueRooms ?? []).map((r) => [r.id, r.name as string]));
  const overbooked = roomsToBook
    .filter((r) => (remaining[r.rid] ?? ROOM_CAPACITY) <= 0)
    .map((r) => roomName.get(r.rid) ?? r.rid);

  // Idempotent replace: clear this wedding's bookings, then insert current set.
  // We DO NOT hard-block on overbooking — the warning is surfaced to the couple.
  const { error: delErr } = await ad
    .from("accommodation_bookings")
    .delete()
    .eq("wedding_id", access.wedding.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  let inserted = 0;
  if (roomsToBook.length > 0) {
    // One booking row per room (the room is the bookable unit). Capture the
    // first assigned guest as a human label; the room still books as a whole.
    const rows = roomsToBook.map((r) => ({
      room_id: r.rid,
      wedding_id: access.wedding.id,
      guest_name: r.names.slice(0, 4).join(", ") || null,
      check_in: stay.check_in,
      check_out: stay.check_out,
    }));
    const { error: insErr } = await ad.from("accommodation_bookings").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    inserted = rows.length;
  }

  // Keep wedding_state.roomAssignments authoritative too.
  const current = (wedding?.wedding_state ?? {}) as Record<string, unknown>;
  const nextState = { ...current, roomAssignments };
  const { error: stateErr } = await ad
    .from("weddings")
    .update({ wedding_state: nextState, wedding_state_updated_at: new Date().toISOString() })
    .eq("id", access.wedding.id);
  if (stateErr) return NextResponse.json({ error: stateErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    booked: inserted,
    nights: stay,
    warnings: overbooked.length
      ? [`These rooms are already held by another wedding on ${stay.check_in}: ${overbooked.join(", ")}. The booking was saved anyway — please confirm with the venue.`]
      : [],
  });
}
