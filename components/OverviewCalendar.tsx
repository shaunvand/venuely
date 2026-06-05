"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// -----------------------------------------------------------------------------
// Interactive overview calendar.
//
// Drives the venue dashboard's top block: one large month grid the user can page
// through (arrows + a month dropdown), with multi-day weddings rendered as spans.
// Clicking days selects a date range, which live-updates the "Rooms available"
// panel — a room counts as unavailable if any accommodation booking touches a
// night in the selected range. "Accommodations available" beside it is the
// venue's static room inventory.
//
// Server component can't own client selection state, so the two availability
// panels live here in the same client tree as the calendar.
// -----------------------------------------------------------------------------

export type CalBooking = {
  slug: string;
  couple_names: string;
  wedding_date: string;            // yyyy-mm-dd (start)
  wedding_end_date?: string | null; // yyyy-mm-dd (inclusive end) — null = single day
  status?: string | null;
};

// Solid pill colours per wedding status (white text). A double-booked day overrides
// to a strong red regardless of status.
function pillColor(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "booked": return "var(--poppy)";        // confirmed
    case "provisional": case "quoted": return "#C99A2E"; // gold — pencilled in
    case "inquiry": case "new": case "interest": return "#8a9a86"; // sage — lead
    case "completed": return "#9aa39b";          // muted — done
    case "cancelled": case "lost": return "#c4bdb4"; // grey — dead
    default: return "var(--poppy)";
  }
}

export type CalRoom = { id: string; name: string; sleeps: number };

type Props = {
  bookings: CalBooking[];
  rooms: CalRoom[];
  // ISO date -> room_ids occupied that night (from accommodation bookings).
  roomOccupancy: Record<string, string[]>;
  weddingHref?: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function isoOf(date: Date) {
  return isoKey(date.getFullYear(), date.getMonth(), date.getDate());
}

// Expand an inclusive start..end ISO span into one ISO key per day (capped).
function eachDate(startISO: string, endISO?: string | null): string[] {
  const start = new Date(`${startISO}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];
  const end = endISO ? new Date(`${endISO}T00:00:00`) : start;
  const last = Number.isNaN(end.getTime()) || end < start ? start : end;
  const out: string[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= last && guard < 120) {
    out.push(isoOf(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return out;
}

function fmtShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function OverviewCalendar({ bookings, rooms, roomOccupancy, weddingHref = "/venue/weddings" }: Props) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  // Inclusive date range the user has picked on the grid.
  const [range, setRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

  const todayKey = isoOf(today);

  // Month dropdown window: 12 months back → 24 months forward from this month.
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string; year: number; month: number }[] = [];
    for (let i = -12; i <= 24; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      opts.push({
        value: `${d.getFullYear()}-${d.getMonth()}`,
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return opts;
    // today is stable enough across a render session; recompute only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const minOpt = monthOptions[0];
  const maxOpt = monthOptions[monthOptions.length - 1];
  const viewIndexAtMin = view.year * 12 + view.month <= minOpt.year * 12 + minOpt.month;
  const viewIndexAtMax = view.year * 12 + view.month >= maxOpt.year * 12 + maxOpt.month;

  // Map each ISO day → weddings that cover it (expanding multi-day spans once).
  const weddingByDate = useMemo(() => {
    const map = new Map<string, CalBooking[]>();
    for (const b of bookings) {
      const startISO = String(b.wedding_date).slice(0, 10);
      if (!startISO) continue;
      const endISO = b.wedding_end_date ? String(b.wedding_end_date).slice(0, 10) : null;
      for (const day of eachDate(startISO, endISO)) {
        const list = map.get(day) ?? [];
        list.push(b);
        map.set(day, list);
      }
    }
    return map;
  }, [bookings]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      const idx = d.getFullYear() * 12 + d.getMonth();
      if (idx < minOpt.year * 12 + minOpt.month) return v;
      if (idx > maxOpt.year * 12 + maxOpt.month) return v;
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function selectDay(key: string) {
    setRange((r) => {
      // No active range, or a completed range → start fresh.
      if (!r.start || (r.start && r.end)) return { start: key, end: null };
      // Have a start, picking the second endpoint.
      if (key < r.start) return { start: key, end: r.start };
      if (key === r.start) return { start: key, end: null };
      return { start: r.start, end: key };
    });
  }

  // Build the grid cells for the current view month (Mon-first).
  const firstDay = new Date(view.year, view.month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoKey(view.year, view.month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  // Selected days (inclusive). end falls back to start for a single-day pick.
  const selectedDays = useMemo(() => {
    if (!range.start) return new Set<string>();
    return new Set(eachDate(range.start, range.end ?? range.start));
  }, [range]);

  // Availability across the selection: a room is unavailable if any selected
  // night has an accommodation booking on it.
  const availability = useMemo(() => {
    if (!range.start) return null;
    const days = eachDate(range.start, range.end ?? range.start);
    const busy = new Set<string>();
    for (const day of days) {
      for (const rid of roomOccupancy[day] ?? []) busy.add(rid);
    }
    const free = rooms.filter((r) => !busy.has(r.id));
    const booked = rooms.filter((r) => busy.has(r.id));
    return { days, free, booked };
  }, [range, roomOccupancy, rooms]);

  const totalSleeps = rooms.reduce((s, r) => s + (Number(r.sleeps) || 0), 0);
  const rangeLabel = range.start
    ? range.end && range.end !== range.start
      ? `${fmtShort(range.start)} – ${fmtShort(range.end)}`
      : fmtShort(range.start)
    : null;
  const isRange = !!(range.end && range.end !== range.start);
  const addHref = range.start
    ? `/venue/weddings?date=${range.start}${isRange ? `&end=${range.end}` : ""}`
    : "/venue/weddings";

  return (
    <div className="space-y-4">
      {/* ---- Large calendar ---- */}
      <section className="vy-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="vy-eyebrow">Bookings &amp; availability</div>
            <h2 className="vy-h2 mt-1">Calendar</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={viewIndexAtMin}
              aria-label="Previous month"
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg disabled:opacity-30 transition-colors hover:bg-[color:var(--cream)]"
              style={{ border: "1px solid var(--line)" }}
            >
              ‹
            </button>
            <select
              className="vy-select"
              style={{ minWidth: "11rem" }}
              value={`${view.year}-${view.month}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                setView({ year: y, month: m });
              }}
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={viewIndexAtMax}
              aria-label="Next month"
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg disabled:opacity-30 transition-colors hover:bg-[color:var(--cream)]"
              style={{ border: "1px solid var(--line)" }}
            >
              ›
            </button>
          </div>
        </div>

        {/* legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs mb-3" style={{ color: "var(--ink-2)" }}>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#8a9a86" }} /> Inquiry</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#C99A2E" }} /> Provisional</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "var(--poppy)" }} /> Booked</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#9aa39b" }} /> Completed</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#b91c1c" }} /> Double-booked</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "var(--peach)" }} /> Selected</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ outline: "2px solid var(--sage)", background: "transparent" }} /> Today</span>
          <span className="ml-auto">Tap a day, then another, to check a date range</span>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-[11px] uppercase tracking-wider text-center py-1.5" style={{ color: "var(--ink-2)" }}>
              {w}
            </div>
          ))}
          {cells.map((key, i) => {
            if (!key) return <div key={`e-${i}`} className="min-h-[84px]" />;
            const day = Number(key.slice(8, 10));
            const weds = weddingByDate.get(key) ?? [];
            const distinct = new Set(weds.map((w) => w.couple_names));
            const clash = distinct.size > 1;
            const isToday = key === todayKey;
            const isSelected = selectedDays.has(key);
            const isRangeEnd = key === range.start || key === range.end;

            return (
              <button
                type="button"
                key={key}
                onClick={() => selectDay(key)}
                className="min-h-[84px] rounded-lg p-1.5 text-left flex flex-col gap-1 transition-colors"
                style={{
                  border: isRangeEnd ? "2px solid var(--poppy)" : "1px solid var(--line)",
                  background: isSelected ? "var(--peach)" : "transparent",
                }}
              >
                <span
                  className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full"
                  style={{
                    outline: isToday ? "2px solid var(--sage)" : undefined,
                    color: "var(--ink)",
                  }}
                >
                  {day}
                </span>
                <span className="flex flex-col gap-0.5 overflow-hidden">
                  {weds.slice(0, 2).map((w, idx) => (
                    <Link
                      key={`${w.slug}-${idx}`}
                      href={`/venue/weddings/${w.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate rounded px-1 py-0.5 text-[10px] leading-tight font-medium hover:opacity-90"
                      style={{ background: clash ? "#b91c1c" : pillColor(w.status), color: "#fff" }}
                      title={`${w.couple_names}${w.status ? ` · ${w.status}` : ""}${w.wedding_end_date ? ` (until ${fmtShort(String(w.wedding_end_date).slice(0, 10))})` : ""}`}
                    >
                      {w.couple_names}
                    </Link>
                  ))}
                  {weds.length > 2 && (
                    <Link
                      href={weddingHref}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] leading-tight px-1"
                      style={{ color: "var(--ink-2)" }}
                    >
                      +{weds.length - 2} more
                    </Link>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selection action bar — add a wedding/booking on the picked date(s) */}
        {range.start && (
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
            <span className="text-xs" style={{ color: "var(--ink-2)" }}>Selected: <strong style={{ color: "var(--ink)" }}>{rangeLabel}</strong></span>
            <div className="flex items-center gap-3">
              <Link href={addHref} className="vy-btn vy-btn-primary text-xs">+ Add wedding on {isRange ? "these dates" : "this date"}</Link>
              <button type="button" onClick={() => setRange({ start: null, end: null })} className="text-xs hover:underline" style={{ color: "var(--ink-2)" }}>Clear</button>
            </div>
          </div>
        )}
      </section>

      {/* ---- Availability panels ---- */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Accommodations available — static inventory */}
        <section className="vy-card">
          <div className="flex items-baseline justify-between">
            <div className="vy-eyebrow">Accommodations available</div>
            <Link href="/venue/accommodation" className="text-xs hover:underline" style={{ color: "var(--poppy)" }}>Manage →</Link>
          </div>
          <h2 className="vy-h2 mt-1 mb-1">
            {rooms.length} room{rooms.length === 1 ? "" : "s"}
          </h2>
          <p className="text-xs mb-3" style={{ color: "var(--ink-2)" }}>
            {totalSleeps ? `Sleeps up to ${totalSleeps} guest${totalSleeps === 1 ? "" : "s"} on-site` : "On-site stays you offer couples"}
          </p>
          {rooms.length === 0 ? (
            <div className="vy-empty text-left text-xs">
              No accommodation added yet.{" "}
              <Link href="/venue/accommodation" className="underline" style={{ color: "var(--poppy)" }}>Add a room</Link>.
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-56 overflow-auto pr-1">
              {rooms.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ border: "1px solid var(--line)" }}>
                  <span className="truncate">{r.name}</span>
                  <span className="text-xs flex-shrink-0 ml-2" style={{ color: "var(--ink-2)" }}>sleeps {r.sleeps || "?"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Rooms available — dynamic, driven by calendar selection */}
        <section className="vy-card">
          <div className="flex items-baseline justify-between">
            <div className="vy-eyebrow">Rooms available</div>
            {range.start && (
              <button type="button" onClick={() => setRange({ start: null, end: null })} className="text-xs hover:underline" style={{ color: "var(--poppy)" }}>
                Clear
              </button>
            )}
          </div>

          {!availability ? (
            <>
              <h2 className="vy-h2 mt-1 mb-1">Pick a date</h2>
              <p className="text-xs" style={{ color: "var(--ink-2)" }}>
                Select a day — or a start and end day — on the calendar above to see which rooms are free for that window.
              </p>
            </>
          ) : rooms.length === 0 ? (
            <>
              <h2 className="vy-h2 mt-1 mb-1">—</h2>
              <p className="text-xs" style={{ color: "var(--ink-2)" }}>No accommodation rooms configured.</p>
            </>
          ) : (
            <>
              <h2 className="vy-h2 mt-1 mb-1" style={{ color: availability.free.length ? "var(--poppy)" : "var(--ink-2)" }}>
                {availability.free.length} of {rooms.length} free
              </h2>
              <p className="text-xs mb-3" style={{ color: "var(--ink-2)" }}>
                {rangeLabel}
                {availability.days.length > 1 ? ` · ${availability.days.length} nights` : ""}
              </p>
              <ul className="space-y-1.5 max-h-44 overflow-auto pr-1">
                {availability.free.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ border: "1px solid var(--line)", background: "var(--cream)" }}>
                    <span className="truncate">{r.name}</span>
                    <span className="text-xs flex-shrink-0 ml-2" style={{ color: "var(--sage)" }}>free · sleeps {r.sleeps || "?"}</span>
                  </li>
                ))}
                {availability.booked.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2 opacity-55" style={{ border: "1px solid var(--line)" }}>
                    <span className="truncate line-through">{r.name}</span>
                    <span className="text-xs flex-shrink-0 ml-2" style={{ color: "var(--ink-2)" }}>booked</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
