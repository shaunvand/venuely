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
  // Operations-dashboard fields (editable / invoice / payment lifecycle). All
  // optional so existing CalendarData consumers keep working.
  setup_date?: string | null; // yyyy-mm-dd — venue team set-up day (editable)
  breakdown_date?: string | null; // yyyy-mm-dd — venue team breakdown day (editable)
  invoice_total?: number | null;
  invoiced_at?: string | null;
  deposit_due_at?: string | null;
  balance_due_at?: string | null;
  couple_paid_at?: string | null;
  paid?: number; // signed payment_ledger total (in − out) for this wedding
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

// ---------------------------------------------------------------------------
// Operations dashboard. Extends the calendar model with the per-wedding money +
// lifecycle fields, the venue's active room count, and the ledger receipts the
// stats strip / wedding cards need. Venue-scoped throughout.
// ---------------------------------------------------------------------------

export type CalendarSubmission = { wedding_id: string; slug: string | null; couple_names: string | null };

export type CalendarOpsData = CalendarData & {
  weddings: CalendarWedding[];
  activeRoomCount: number; // accommodation_rooms where active ≠ false
  pendingSubmissions: CalendarSubmission[];
};

export async function getCalendarOps(): Promise<CalendarOpsData> {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: weddingRows } = await supabase
    .from("weddings")
    .select(
      "id, slug, couple_names, wedding_date, wedding_end_date, status, guest_count, setup_date, breakdown_date, invoice_total, invoiced_at, deposit_due_at, balance_due_at, couple_paid_at",
    )
    .eq("venue_id", venue.id)
    .order("wedding_date", { ascending: true });

  const weddingById = new Map<string, { slug: string; couple_names: string }>();
  (weddingRows ?? []).forEach((w) => weddingById.set(w.id, { slug: w.slug, couple_names: w.couple_names }));
  const weddingIds = (weddingRows ?? []).map((w) => w.id);

  let bookings: CalendarBooking[] = [];
  let holds: CalendarHold[] = [];
  let activeRoomCount = 0;
  let ledgerRows: Array<{ wedding_id: string; amount: number | string; direction: string | null }> = [];
  let pendingSubmissions: CalendarSubmission[] = [];

  // Active room count is venue-scoped regardless of whether any weddings exist.
  const { data: roomCountRows } = await supabase
    .from("accommodation_rooms")
    .select("id, active")
    .eq("venue_id", venue.id);
  activeRoomCount = (roomCountRows ?? []).filter((r) => r.active !== false).length;

  if (weddingIds.length > 0) {
    const [
      { data: bookingRows },
      { data: roomRows },
      { data: holdRows },
      { data: rentalRows },
      { data: ledgerRaw },
      { data: subRows },
    ] = await Promise.all([
      supabase
        .from("accommodation_bookings")
        .select("id, room_id, wedding_id, guest_name, check_in, check_out")
        .in("wedding_id", weddingIds),
      supabase.from("accommodation_rooms").select("id, name").eq("venue_id", venue.id),
      supabase.from("rental_holds").select("rental_id, wedding_id, quantity, weekend_of").in("wedding_id", weddingIds),
      supabase.from("rental_items").select("id, name").eq("venue_id", venue.id),
      supabase.from("payment_ledger").select("wedding_id, amount, direction").in("wedding_id", weddingIds),
      supabase
        .from("submissions")
        .select("wedding_id, wedding:weddings!inner(slug, couple_names, venue_id)")
        .eq("wedding.venue_id", venue.id)
        .eq("status", "pending"),
    ]);

    const roomName = new Map<string, string>();
    (roomRows ?? []).forEach((r) => roomName.set(r.id, r.name));
    const rentalName = new Map<string, string>();
    (rentalRows ?? []).forEach((r) => rentalName.set(r.id, r.name));

    bookings = (bookingRows ?? []).flatMap((b) => {
      const w = weddingById.get(b.wedding_id);
      return expandNights(b.check_in, b.check_out).map((date) => ({
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

    ledgerRows = (ledgerRaw ?? []) as typeof ledgerRows;

    pendingSubmissions = (subRows ?? []).map((s) => {
      const w = (s as { wedding?: unknown }).wedding;
      const single = Array.isArray(w) ? (w[0] ?? null) : (w ?? null);
      const wj = single as { slug: string; couple_names: string } | null;
      return { wedding_id: (s as { wedding_id: string }).wedding_id, slug: wj?.slug ?? null, couple_names: wj?.couple_names ?? null };
    });
  }

  // Signed payment total per wedding (in − out).
  const paidByWedding = new Map<string, number>();
  ledgerRows.forEach((r) => {
    const signed = (r.direction === "out" ? -1 : 1) * Number(r.amount || 0);
    paidByWedding.set(r.wedding_id, (paidByWedding.get(r.wedding_id) ?? 0) + signed);
  });

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
      setup_date: w.setup_date ? isoSlice(w.setup_date) : null,
      breakdown_date: w.breakdown_date ? isoSlice(w.breakdown_date) : null,
      invoice_total: w.invoice_total ?? null,
      invoiced_at: w.invoiced_at ?? null,
      deposit_due_at: w.deposit_due_at ?? null,
      balance_due_at: w.balance_due_at ?? null,
      couple_paid_at: w.couple_paid_at ?? null,
      paid: paidByWedding.get(w.id) ?? 0,
    }));

  return { weddings, bookings, holds, activeRoomCount, pendingSubmissions };
}
