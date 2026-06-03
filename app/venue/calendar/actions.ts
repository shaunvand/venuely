"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentVenue } from "@/lib/venue/current";

// ---------------------------------------------------------------------------
// Read-only occupancy model for the venue availability calendar.
//
// Pulls three signals for the current venue and folds them into a single
// per-ISO-date occupancy map:
//   1. weddings.wedding_date          → the event itself
//   2. accommodation_bookings         → on-site room nights (check_in..check_out)
//   3. rental_holds                   → rental inventory reserved for a weekend
//
// Everything here is venue-scoped via getCurrentVenue() (which redirects
// unauthenticated users) and the venue layout already enforces
// requireRole(['venue_admin','owner']).
// ---------------------------------------------------------------------------

export type CalendarWedding = {
  id: string;
  slug: string;
  couple_names: string;
  wedding_date: string; // yyyy-mm-dd
  wedding_end_date: string | null; // yyyy-mm-dd, inclusive — null = single day
  status: string | null;
  guest_count: number | null;
};

export type CalendarBooking = {
  date: string; // yyyy-mm-dd (each night a booking covers gets its own entry)
  room_id: string;
  room_name: string | null;
  wedding_id: string;
  wedding_slug: string | null;
  couple_names: string | null;
  guest_name: string | null;
};

export type CalendarHold = {
  weekend_of: string; // yyyy-mm-dd (Saturday)
  rental_id: string;
  rental_name: string | null;
  quantity: number;
  wedding_id: string;
  wedding_slug: string | null;
  couple_names: string | null;
};

export type CalendarData = {
  weddings: CalendarWedding[];
  bookings: CalendarBooking[];
  holds: CalendarHold[];
};

function isoSlice(d: string | null | undefined): string {
  return String(d ?? "").slice(0, 10);
}

// Expand a check_in..check_out range into one ISO date per night.
// Standard hotel semantics: a guest occupies check_in through (check_out − 1).
// We clamp to a sane upper bound to avoid runaway expansion on bad data.
function expandNights(checkIn: string, checkOut: string): string[] {
  const start = new Date(`${isoSlice(checkIn)}T00:00:00Z`);
  const end = new Date(`${isoSlice(checkOut)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [isoSlice(checkIn)].filter(Boolean);
  const out: string[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor < end && guard < 60) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  // Single-day or inverted ranges: at least surface the check-in night.
  if (out.length === 0) out.push(isoSlice(checkIn));
  return out;
}

// The venue's private calendar-subscription token. Pasting the .ics URL into
// Google/Apple Calendar gives a live, auto-updating feed of every booking.
export async function getVenueCalToken(): Promise<string | null> {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data } = await supabase.from("venues").select("ical_token").eq("id", venue.id).single();
  return (data?.ical_token as string) ?? null;
}

export async function getVenueCalendar(): Promise<CalendarData> {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: weddingRows } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, wedding_end_date, status, guest_count")
    .eq("venue_id", venue.id)
    .order("wedding_date", { ascending: true });

  const weddings: CalendarWedding[] = (weddingRows ?? [])
    .filter((w) => w.wedding_date)
    .map((w) => ({
      id: w.id,
      slug: w.slug,
      couple_names: w.couple_names,
      wedding_date: isoSlice(w.wedding_date),
      wedding_end_date: w.wedding_end_date ? isoSlice(w.wedding_end_date) : null,
      status: w.status ?? null,
      guest_count: w.guest_count ?? null,
    }));

  // Map wedding_id → display info for joining holds/bookings.
  const weddingById = new Map<string, { slug: string; couple_names: string }>();
  (weddingRows ?? []).forEach((w) => weddingById.set(w.id, { slug: w.slug, couple_names: w.couple_names }));
  const weddingIds = (weddingRows ?? []).map((w) => w.id);

  let bookings: CalendarBooking[] = [];
  let holds: CalendarHold[] = [];

  if (weddingIds.length > 0) {
    // accommodation_bookings are wedding-scoped (RLS via can_access_wedding).
    // We also need room names — scope rooms to this venue.
    const [{ data: bookingRows }, { data: roomRows }, { data: holdRows }, { data: rentalRows }] = await Promise.all([
      supabase
        .from("accommodation_bookings")
        .select("id, room_id, wedding_id, guest_name, check_in, check_out")
        .in("wedding_id", weddingIds),
      supabase
        .from("accommodation_rooms")
        .select("id, name")
        .eq("venue_id", venue.id),
      supabase
        .from("rental_holds")
        .select("rental_id, wedding_id, quantity, weekend_of")
        .in("wedding_id", weddingIds),
      supabase
        .from("rental_items")
        .select("id, name")
        .eq("venue_id", venue.id),
    ]);

    const roomName = new Map<string, string>();
    (roomRows ?? []).forEach((r) => roomName.set(r.id, r.name));
    const rentalName = new Map<string, string>();
    (rentalRows ?? []).forEach((r) => rentalName.set(r.id, r.name));

    bookings = (bookingRows ?? []).flatMap((b) => {
      const w = weddingById.get(b.wedding_id);
      const nights = expandNights(b.check_in, b.check_out);
      return nights.map((date) => ({
        date,
        room_id: b.room_id,
        room_name: roomName.get(b.room_id) ?? null,
        wedding_id: b.wedding_id,
        wedding_slug: w?.slug ?? null,
        couple_names: w?.couple_names ?? null,
        guest_name: b.guest_name ?? null,
      }));
    });

    holds = (holdRows ?? []).map((h) => {
      const w = weddingById.get(h.wedding_id);
      return {
        weekend_of: isoSlice(h.weekend_of),
        rental_id: h.rental_id,
        rental_name: rentalName.get(h.rental_id) ?? null,
        quantity: h.quantity,
        wedding_id: h.wedding_id,
        wedding_slug: w?.slug ?? null,
        couple_names: w?.couple_names ?? null,
      };
    });
  }

  return { weddings, bookings, holds };
}
