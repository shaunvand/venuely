import Link from "next/link";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { BookingsCalendar } from "@/components/BookingsCalendar";
import { CalendarSubscribe } from "@/components/CalendarSubscribe";
import { WeddingTimelineStrip, type TimelineWedding } from "@/components/WeddingTimelineStrip";
import { CalendarOpsCards, WeddingOverviewCards, type OpsStat, type OpsAction, type OpsCard } from "@/components/CalendarOpsCards";
import { computeWeddingsProgress, HEALTH_LABEL } from "@/lib/venue/progress";
import { getCalendarOps, getVenueCalToken, type CalendarWedding } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function fmtRand(n: number): string {
  return `R${Math.round(n).toLocaleString("en-ZA")}`;
}

// Cancelled/lost weddings still show on the calendar but never count as active.
function isCancelledStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "cancelled" || s === "lost";
}

// Expand an inclusive wedding_date..wedding_end_date span into one ISO date per
// day, so multi-day weddings register on every day they cover.
function eachDate(startISO: string, endISO?: string | null): string[] {
  const start = String(startISO).slice(0, 10);
  if (!start) return [];
  const endRaw = endISO ? String(endISO).slice(0, 10) : "";
  if (!endRaw || endRaw <= start) return [start];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${endRaw}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [start];
  const out: string[] = [];
  const cursor = new Date(s);
  let guard = 0;
  while (cursor <= e && guard < 120) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }
  return out;
}

export default async function VenueCalendar() {
  await requireRole(["venue_admin", "owner"]);

  const { weddings, bookings, holds, activeRoomCount, pendingSubmissions } = await getCalendarOps();
  const supabase = await createClient();
  const progressMap = await computeWeddingsProgress(supabase, weddings.map((w) => ({ id: w.id })));

  const icalToken = await getVenueCalToken();
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const feedUrl = icalToken && host ? `${proto}://${host}/api/cal/${icalToken}.ics` : null;

  // -----------------------------------------------------------------------
  // Clash detection (kept from the original): dates with >1 active wedding.
  // -----------------------------------------------------------------------
  const activeCouplesByDate = new Map<string, Set<string>>();
  for (const w of weddings) {
    if (isCancelledStatus(w.status)) continue;
    for (const date of eachDate(w.wedding_date, w.wedding_end_date)) {
      (activeCouplesByDate.get(date) ?? activeCouplesByDate.set(date, new Set()).get(date)!).add(w.couple_names);
    }
  }
  const todayIso = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
  const clashes = Array.from(activeCouplesByDate.entries())
    .filter(([date, couples]) => date >= todayIso && couples.size > 1)
    .map(([date, couples]) => ({ date, couples: Array.from(couples) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // -----------------------------------------------------------------------
  // Current SAST month bounds.
  // -----------------------------------------------------------------------
  const nowSast = new Date(Date.now() + 2 * 3600 * 1000);
  const year = nowSast.getUTCFullYear();
  const month0 = nowSast.getUTCMonth();
  const monthLabel = new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const mm = String(month0 + 1).padStart(2, "0");
  const monthStart = `${year}-${mm}-01`;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const monthEnd = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;

  const activeWeddings = weddings.filter((w) => !isCancelledStatus(w.status));

  // Weddings this month = active weddings whose span intersects the month.
  const weddingsThisMonth = activeWeddings.filter((w) => {
    const start = w.wedding_date;
    const end = w.wedding_end_date ?? w.wedding_date;
    return start <= monthEnd && end >= monthStart;
  });

  // -----------------------------------------------------------------------
  // Revenue this month = payment_ledger 'in' receipts (paid_at in month). We
  // fetch the receipts venue-scoped via the wedding join, same pattern as the
  // venue dashboard. (getCalendarOps already returns per-wedding signed totals,
  // but the dated month sum needs paid_at — fetched here.)
  // -----------------------------------------------------------------------
  const { data: ledgerRaw } = await supabase
    .from("payment_ledger")
    .select("amount, direction, paid_at, wedding:weddings!inner(venue_id)")
    .in("wedding_id", weddings.map((w) => w.id).length ? weddings.map((w) => w.id) : ["00000000-0000-0000-0000-000000000000"]);
  type LedgerRow = { amount: number | string; direction: string | null; paid_at: string | null };
  const revenueThisMonth = ((ledgerRaw ?? []) as unknown as LedgerRow[]).reduce((s, r) => {
    if (r.direction === "out") return s; // count receipts (in) only
    const k = String(r.paid_at ?? "").slice(0, 10);
    return k >= monthStart && k <= monthEnd ? s + Number(r.amount || 0) : s;
  }, 0);

  // -----------------------------------------------------------------------
  // Accommodation occupancy % = booked room-nights this month ÷ (active rooms ×
  // days in month), clamped 0–100.
  // -----------------------------------------------------------------------
  const roomNightsThisMonth = bookings.filter((b) => b.date >= monthStart && b.date <= monthEnd).length;
  const capacity = activeRoomCount * daysInMonth;
  const occupancyPct = capacity > 0 ? Math.max(0, Math.min(100, Math.round((roomNightsThisMonth / capacity) * 100))) : 0;

  // Booked room-nights per wedding (for "Fully booked" + card rooms X/Y).
  const roomNightsByWedding = new Map<string, number>();
  for (const b of bookings) roomNightsByWedding.set(b.wedding_id, (roomNightsByWedding.get(b.wedding_id) ?? 0) + 1);
  const distinctRoomsByWedding = new Map<string, Set<string>>();
  for (const b of bookings) (distinctRoomsByWedding.get(b.wedding_id) ?? distinctRoomsByWedding.set(b.wedding_id, new Set()).get(b.wedding_id)!).add(b.room_id);

  // -----------------------------------------------------------------------
  // Outstanding balance + due-date per invoiced wedding (deposit deadline until
  // anything is paid, then the balance deadline). Same shape as the dashboard.
  // -----------------------------------------------------------------------
  const in14 = new Date(Date.now() + 2 * 3600 * 1000 + 14 * 86400000).toISOString().slice(0, 10);
  type Balance = { wedding: CalendarWedding; due: string | null; outstanding: number; overdue: boolean; dueSoon: boolean };
  const balances: Balance[] = [];
  for (const w of activeWeddings) {
    if (!w.invoiced_at || Number(w.invoice_total ?? 0) <= 0) continue;
    const paid = w.paid ?? 0;
    const outstanding = Math.max(0, Number(w.invoice_total ?? 0) - paid);
    if (outstanding <= 0) continue;
    const dueRaw = (paid <= 0 ? w.deposit_due_at ?? w.balance_due_at : w.balance_due_at ?? w.deposit_due_at) ?? null;
    const due = dueRaw ? String(dueRaw).slice(0, 10) : null;
    balances.push({
      wedding: w,
      due,
      outstanding,
      overdue: !!(due && due < todayIso),
      dueSoon: !!(due && due >= todayIso && due <= in14),
    });
  }
  const balanceByWedding = new Map(balances.map((b) => [b.wedding.id, b]));
  const pendingByWedding = new Set(pendingSubmissions.map((s) => s.wedding_id));

  // Awaiting action = weddings with an overdue/due-soon balance OR a pending
  // submission.
  const awaitingActionIds = new Set<string>();
  balances.forEach((b) => { if (b.overdue || b.dueSoon) awaitingActionIds.add(b.wedding.id); });
  pendingSubmissions.forEach((s) => awaitingActionIds.add(s.wedding_id));

  // -----------------------------------------------------------------------
  // Stats strip.
  // -----------------------------------------------------------------------
  const stats: OpsStat[] = [
    { label: "Weddings this month", value: String(weddingsThisMonth.length), sub: monthLabel, href: "/venue/weddings", accent: "var(--poppy)" },
    { label: "Revenue this month", value: fmtRand(revenueThisMonth), sub: "Received this month", href: "/venue/payments", accent: "var(--sage)" },
    { label: "Accommodation occupancy", value: `${occupancyPct}%`, sub: activeRoomCount ? `${roomNightsThisMonth} of ${capacity} room-nights` : "No active rooms", href: "/venue/accommodation", accent: "var(--sage)" },
    { label: "Awaiting action", value: String(awaitingActionIds.size), sub: awaitingActionIds.size ? "Need a response" : "All caught up", href: "/venue/payments", accent: awaitingActionIds.size ? "var(--poppy)" : "var(--sage)" },
  ];

  // -----------------------------------------------------------------------
  // Upcoming actions (max 3): pending submission → Review invoice; overdue
  // payment → Send reminder; imminent wedding → Open.
  // -----------------------------------------------------------------------
  const actions: OpsAction[] = [];
  for (const s of pendingSubmissions) {
    if (!s.slug) continue;
    actions.push({ id: `sub-${s.wedding_id}`, name: s.couple_names ?? "Wedding", detail: "Submitted their selections", action: "Review invoice", href: `/venue/weddings/${s.slug}`, primary: true });
  }
  for (const b of balances.filter((x) => x.overdue).sort((a, c) => (a.due ?? "").localeCompare(c.due ?? ""))) {
    actions.push({ id: `od-${b.wedding.id}`, name: b.wedding.couple_names, detail: `Payment overdue · was due ${b.due}`, action: "Send reminder", href: `/venue/weddings/${b.wedding.slug}` });
  }
  for (const w of activeWeddings.filter((x) => x.wedding_date >= todayIso && x.wedding_date <= in14).sort((a, c) => a.wedding_date.localeCompare(c.wedding_date))) {
    const days = Math.max(0, Math.round((new Date(`${w.wedding_date}T00:00:00`).getTime() - Date.now()) / 86400000));
    actions.push({ id: `wd-${w.id}`, name: w.couple_names, detail: days <= 0 ? "Wedding is today 🎉" : `Wedding in ${days} day${days === 1 ? "" : "s"}`, action: "Open", href: `/venue/weddings/${w.slug}` });
  }
  const topActions = actions.slice(0, 3);

  // -----------------------------------------------------------------------
  // Wedding cards (one per active wedding, soonest first).
  // -----------------------------------------------------------------------
  const sorted = [...activeWeddings].sort((a, b) => a.wedding_date.localeCompare(b.wedding_date));
  const cards: OpsCard[] = sorted.map((w) => {
    const prog = progressMap.get(w.id);
    const bal = balanceByWedding.get(w.id);
    const pending = pendingByWedding.has(w.id);
    const roomsBooked = distinctRoomsByWedding.get(w.id)?.size ?? 0;
    const end = w.wedding_end_date ?? w.wedding_date;
    const dateLabel = end !== w.wedding_date ? `${fmtDate(w.wedding_date)} → ${fmtDate(end)}` : fmtDate(w.wedding_date);

    // Health flag line — prefer concrete money/submission state, fall back to
    // the planning-progress engine.
    let flag = "On track";
    let flagTone: OpsCard["flagTone"] = "ok";
    if (pending) { flag = "Submission to review"; flagTone = "warn"; }
    else if (bal?.overdue) { flag = `${fmtRand(bal.outstanding)} overdue`; flagTone = "warn"; }
    else if (bal?.dueSoon) { flag = `${fmtRand(bal.outstanding)} due soon`; flagTone = "warn"; }
    else if (bal) { flag = `${fmtRand(bal.outstanding)} outstanding`; flagTone = "muted"; }
    else if (w.couple_paid_at) { flag = "Paid in full"; flagTone = "ok"; }
    else if (prog) { flag = `${prog.pct}% planned · ${HEALTH_LABEL[prog.health]}`; flagTone = prog.health === "healthy" ? "ok" : "warn"; }

    const needsAttention = pending || !!bal?.overdue || prog?.health === "risk";
    const awaitingPayment = !!bal && bal.outstanding > 0;

    return {
      id: w.id,
      slug: w.slug,
      couple: w.couple_names,
      dateLabel,
      guests: w.guest_count,
      roomsBooked,
      roomsTotal: activeRoomCount,
      totalLabel: Number(w.invoice_total ?? 0) > 0 ? fmtRand(Number(w.invoice_total)) : "—",
      flag,
      flagTone,
      upcoming: end >= todayIso,
      needsAttention,
      awaitingPayment,
      fullyBooked: activeRoomCount > 0 && roomsBooked >= activeRoomCount,
      hasAccommodation: roomsBooked > 0,
    };
  });

  // Timeline rows (the strip filters to the visible month itself).
  const timelineWeddings: TimelineWedding[] = weddings.map((w) => ({
    id: w.id,
    slug: w.slug,
    couple_names: w.couple_names,
    wedding_date: w.wedding_date,
    wedding_end_date: w.wedding_end_date,
    setup_date: w.setup_date ?? null,
    breakdown_date: w.breakdown_date ?? null,
    status: w.status,
    guests: w.guest_count ?? null,
    couple_paid_at: w.couple_paid_at ?? null,
  }));

  // Overlays for the month grid (unchanged behaviour).
  const roomNights = bookings.map((b) => ({ date: b.date, room_name: b.room_name, couple_names: b.couple_names, guest_name: b.guest_name }));
  const rentalHolds = holds.map((hd) => ({ weekend_of: hd.weekend_of, rental_name: hd.rental_name, quantity: hd.quantity, couple_names: hd.couple_names }));

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Operations</div>
        <h1 className="vy-h1 mt-1">Calendar</h1>
        <p className="text-stone-600 text-sm mt-1">
          Bookings, phases, occupancy and what needs your attention — every wedding on one timeline. Dates with more than one wedding are flagged so you never double-book.
        </p>
      </header>

      {clashes.length > 0 && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#fca5a5", background: "#fef2f2", color: "#991b1b" }}>
          <div className="font-semibold">⚠ {clashes.length} date{clashes.length === 1 ? "" : "s"} with more than one wedding</div>
          <ul className="mt-1 space-y-0.5">
            {clashes.map((d) => (
              <li key={d.date}><span className="font-medium">{fmtDate(d.date)}</span> — {d.couples.join(", ")}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats strip + upcoming actions. */}
      <CalendarOpsCards stats={stats} actions={topActions} />

      {/* Phase timeline for the visible month. */}
      <WeddingTimelineStrip
        weddings={timelineWeddings}
        year={year}
        month0={month0}
        monthLabel={monthLabel}
        attentionIds={awaitingActionIds}
      />

      {/* Month grid — BookingsCalendar with multi-day spans + clashes. */}
      <BookingsCalendar
        bookings={weddings.map((w) => ({ slug: w.slug, couple_names: w.couple_names, wedding_date: w.wedding_date, wedding_end_date: w.wedding_end_date, status: w.status }))}
        months={6}
        roomNights={roomNights}
        rentalHolds={rentalHolds}
        weddingHref="/venue/calendar"
      />

      {/* Wedding overview — the polished card row, at the bottom. */}
      <WeddingOverviewCards cards={cards} />

      {feedUrl && (
        <section className="vy-card">
          <div className="vy-eyebrow">Sync</div>
          <h2 className="vy-h2 mt-1 mb-1">Subscribe to your bookings</h2>
          <p className="text-stone-600 text-sm mb-3">Add this private link to Google or Apple Calendar to see every booking on your own calendar — it stays in sync automatically.</p>
          <CalendarSubscribe url={feedUrl} />
        </section>
      )}

      {cards.length === 0 && (
        <div className="vy-empty text-sm">
          Nothing scheduled yet. Add a wedding from{" "}
          <Link href="/venue/weddings" className="underline" style={{ color: "var(--poppy)" }}>Weddings</Link>.
        </div>
      )}
    </div>
  );
}
