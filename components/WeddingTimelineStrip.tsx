"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// Horizontal phase Gantt for the visible month. One row per active wedding, with
// up to three coloured bars per wedding — Set-up → Wedding Weekend → Breakdown —
// laid out on a CSS grid whose columns are the days of the month. Client
// component: holds the visible month in state so Today / ‹ / › navigate. No deps.

export type TimelineWedding = {
  id: string;
  slug: string;
  couple_names: string;
  wedding_date: string; // yyyy-mm-dd
  wedding_end_date: string | null;
  setup_date?: string | null;
  breakdown_date?: string | null;
  status: string | null;
  guests?: number | null;
  couple_paid_at?: string | null;
};

type Phase = "setup" | "weekend" | "breakdown";

// Bar palette keyed by the wedding's status health, mapped to Venuely brand
// colours. The Wedding Weekend bar uses the SOLID status colour; Set-up and
// Breakdown shoulders use a lighter pre-tinted fill of the same hue.
type BarTone = "confirmed" | "paid" | "attention" | "tentative" | "cancelled";

const PHASE_LABEL: Record<Phase, string> = {
  setup: "Set-up",
  weekend: "Wedding Weekend",
  breakdown: "Breakdown",
};

// solid    → Wedding Weekend fill / solidText → its text colour
// shoulder → Set-up & Breakdown fill / shoulderText → their text colour
// dot      → legend swatch
type ToneStyle = {
  label: string;
  solid: string;
  solidText: string;
  shoulder: string;
  shoulderText: string;
  dot: string;
  border: string;
};

const TONE_STYLE: Record<BarTone, ToneStyle> = {
  // sage green
  confirmed: { label: "Confirmed", solid: "#8a9a86", solidText: "#fff", shoulder: "rgba(138,154,134,0.30)", shoulderText: "#3f4a3c", dot: "#8a9a86", border: "rgba(138,154,134,0.55)" },
  // deeper leaf green
  paid: { label: "Paid in Full", solid: "#BFDAD3", solidText: "#1f5d3e", shoulder: "rgba(191,218,211,0.45)", shoulderText: "#1f5d3e", dot: "#1f5d3e", border: "rgba(31,93,62,0.30)" },
  // Venuely coral
  attention: { label: "Needs Attention", solid: "#FA523C", solidText: "#fff", shoulder: "rgba(255,198,173,0.55)", shoulderText: "#9a2f1d", dot: "#FA523C", border: "rgba(250,82,60,0.45)" },
  // warm neutral
  tentative: { label: "Tentative", solid: "var(--cream)", solidText: "var(--ink-2)", shoulder: "rgba(255,246,240,0.9)", shoulderText: "var(--ink-2)", dot: "var(--bone)", border: "var(--line)" },
  // muted grey, de-emphasised
  cancelled: { label: "Cancelled", solid: "#ece9e7", solidText: "#8a8480", shoulder: "rgba(236,233,231,0.7)", shoulderText: "#a39e99", dot: "#d6d2cf", border: "var(--line)" },
};

function toneFor(status: string | null, attention: boolean, paid: boolean): BarTone {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelled" || s === "lost") return "cancelled";
  if (attention) return "attention";
  if (paid || s === "completed") return "paid";
  if (s === "booked" || s === "confirmed") return "confirmed";
  return "tentative"; // inquiry / provisional / unknown
}

function initialsOf(name: string): string {
  const parts = String(name ?? "")
    .replace(/&|\band\b/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Inclusive day index within the month for an ISO date, or null if outside.
function dayIndex(iso: string | null | undefined, year: number, month0: number, daysInMonth: number): number | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (y !== year || mo !== month0) return null;
  if (d < 1 || d > daysInMonth) return null;
  return d; // 1-based
}

// Clamp a [startIso, endIso] span to the visible month and return inclusive
// 1-based day columns, or null if the span doesn't intersect the month at all.
function spanColumns(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  year: number,
  month0: number,
  daysInMonth: number,
): { start: number; end: number } | null {
  const sRaw = startIso ? String(startIso).slice(0, 10) : null;
  const eRaw = endIso ? String(endIso).slice(0, 10) : sRaw;
  if (!sRaw || !eRaw) return null;
  // Month bounds as ISO for cheap string compare.
  const mm = String(month0 + 1).padStart(2, "0");
  const monthStart = `${year}-${mm}-01`;
  const monthEnd = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;
  const lo = sRaw < monthStart ? monthStart : sRaw;
  const hi = eRaw > monthEnd ? monthEnd : eRaw;
  if (lo > hi) return null;
  const start = dayIndex(lo, year, month0, daysInMonth);
  const end = dayIndex(hi, year, month0, daysInMonth);
  if (start == null || end == null) return null;
  return { start, end };
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Sun..Sat weekday letters (Date.getDay() order).
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const LEGEND: BarTone[] = ["confirmed", "attention", "paid", "tentative"];

export function WeddingTimelineStrip({
  weddings,
  year,
  month0,
  monthLabel: _monthLabel, // derived client-side from view; kept for compat
  cap = 6,
  attentionIds,
}: {
  weddings: TimelineWedding[];
  year: number;
  month0: number; // 0-based month
  monthLabel?: string;
  cap?: number;
  attentionIds?: Set<string>;
}) {
  // Visible month state (absolute month index from year 0 keeps arithmetic simple).
  const [viewIdx, setViewIdx] = useState(() => year * 12 + month0);
  const vYear = Math.floor(viewIdx / 12);
  const vMonth0 = ((viewIdx % 12) + 12) % 12;

  const monthLabel = useMemo(
    () => new Date(vYear, vMonth0, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
    [vYear, vMonth0],
  );

  const daysInMonth = new Date(vYear, vMonth0 + 1, 0).getDate();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayCol = dayIndex(todayIso, vYear, vMonth0, daysInMonth);
  const todayMonthIdx = today.getFullYear() * 12 + today.getMonth();

  // Only weddings whose any phase intersects the visible month, soonest first.
  const visible = useMemo(
    () =>
      weddings
        .filter((w) => {
          const wkEnd = w.wedding_end_date ?? w.wedding_date;
          const setupEnd = w.wedding_date ? addDaysIso(w.wedding_date, -1) : null;
          const breakStart = wkEnd ? addDaysIso(wkEnd, 1) : null;
          return (
            spanColumns(w.wedding_date, wkEnd, vYear, vMonth0, daysInMonth) ||
            (w.setup_date && spanColumns(w.setup_date, setupEnd, vYear, vMonth0, daysInMonth)) ||
            (w.breakdown_date && spanColumns(breakStart, w.breakdown_date, vYear, vMonth0, daysInMonth))
          );
        })
        .sort((a, b) => String(a.wedding_date).localeCompare(String(b.wedding_date))),
    [weddings, vYear, vMonth0, daysInMonth],
  );

  const shown = visible.slice(0, cap);
  const overflow = visible.length - shown.length;

  // Grid template: a label column + one column per day.
  const gridCols = `minmax(180px, 220px) repeat(${daysInMonth}, minmax(22px, 1fr))`;

  const stepBtn =
    "w-7 h-7 inline-flex items-center justify-center rounded-full border text-sm leading-none transition-colors hover:bg-[var(--cream)]";

  return (
    <section className="vy-card">
      {/* Header row: title + control cluster */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-serif text-[1.4rem] leading-tight" style={{ color: "var(--ink)" }}>
            Wedding timeline
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-2)" }}>
            Overview of bookings, set-up and breakdown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewIdx(todayMonthIdx)}
            className="px-3 h-7 inline-flex items-center rounded-full border text-xs font-medium transition-colors hover:bg-[var(--cream)]"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewIdx((i) => i - 1)}
            className={stepBtn}
            style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewIdx((i) => i + 1)}
            className={stepBtn}
            style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
          >
            ›
          </button>
          <span className="font-serif text-sm min-w-[7.5rem] text-right" style={{ color: "var(--ink)" }}>
            {monthLabel}
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="vy-empty text-sm">No weddings fall in {monthLabel}.</div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <div style={{ minWidth: 720 }}>
            {/* Day axis: number above weekday letter, today highlighted */}
            <div className="grid items-end gap-px mb-2" style={{ gridTemplateColumns: gridCols }}>
              <div />
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dow = new Date(vYear, vMonth0, day).getDay();
                const isToday = todayCol === day;
                return (
                  <div key={day} className="flex flex-col items-center leading-none gap-0.5">
                    <span
                      className="text-[11px] tabular-nums inline-flex items-center justify-center"
                      style={
                        isToday
                          ? {
                              width: 20,
                              height: 20,
                              borderRadius: 9999,
                              background: "var(--poppy)",
                              color: "#fff",
                              fontWeight: 700,
                            }
                          : { color: "var(--ink-2)", fontWeight: 500 }
                      }
                    >
                      {day}
                    </span>
                    <span className="text-[9px] uppercase" style={{ color: "var(--ink-2)", opacity: 0.6 }}>
                      {DOW[dow]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* One row per wedding */}
            <div className="space-y-2">
              {shown.map((w) => {
                const paid = !!w.couple_paid_at;
                const attention = attentionIds?.has(w.id) ?? false;
                const tone = toneFor(w.status, attention, paid);
                const style = TONE_STYLE[tone];
                const dim = tone === "cancelled";
                const wkEnd = w.wedding_end_date ?? w.wedding_date;
                const setupEnd = w.wedding_date ? addDaysIso(w.wedding_date, -1) : null;
                const breakStart = wkEnd ? addDaysIso(wkEnd, 1) : null;

                const bars: Array<{ phase: Phase; cols: { start: number; end: number } }> = [];
                const setup = w.setup_date && setupEnd ? spanColumns(w.setup_date, setupEnd, vYear, vMonth0, daysInMonth) : null;
                if (setup) bars.push({ phase: "setup", cols: setup });
                const weekend = spanColumns(w.wedding_date, wkEnd, vYear, vMonth0, daysInMonth);
                if (weekend) bars.push({ phase: "weekend", cols: weekend });
                const breakdown = w.breakdown_date && breakStart ? spanColumns(breakStart, w.breakdown_date, vYear, vMonth0, daysInMonth) : null;
                if (breakdown) bars.push({ phase: "breakdown", cols: breakdown });

                return (
                  <div
                    key={w.id}
                    className="grid items-center gap-px"
                    style={{ gridTemplateColumns: gridCols, minHeight: 40, opacity: dim ? 0.6 : 1 }}
                  >
                    {/* Label cell: avatar + name + guests */}
                    <Link
                      href={`/venue/weddings/${w.slug}`}
                      className="flex items-center gap-2.5 pr-3 min-w-0 group"
                      title={w.couple_names}
                    >
                      <span
                        className="shrink-0 w-9 h-9 rounded-full inline-flex items-center justify-center text-[11px] font-semibold"
                        style={{ background: style.shoulder, color: style.shoulderText, border: `1px solid ${style.border}` }}
                      >
                        {initialsOf(w.couple_names)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium truncate group-hover:underline" style={{ color: "var(--ink)" }}>
                          {w.couple_names}
                        </span>
                        {w.guests != null && (
                          <span className="block text-[11px] truncate" style={{ color: "var(--ink-2)" }}>
                            {w.guests} guests
                          </span>
                        )}
                      </span>
                    </Link>

                    {/* Day track — today gets a faint vertical highlight band */}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const dow = new Date(vYear, vMonth0, day).getDay();
                      const isToday = todayCol === day;
                      return (
                        <div
                          key={day}
                          className="h-[34px] rounded-[4px]"
                          style={{
                            gridColumn: day + 1,
                            gridRow: 1,
                            background: isToday
                              ? "rgba(255,198,173,0.45)"
                              : dow === 0 || dow === 6
                              ? "rgba(28,25,23,0.03)"
                              : "transparent",
                          }}
                        />
                      );
                    })}

                    {/* Phase bars */}
                    {bars.map((b) => {
                      const isWeekend = b.phase === "weekend";
                      const span = b.cols.end - b.cols.start + 1;
                      return (
                        <div
                          key={b.phase}
                          className="h-[24px] rounded-lg flex items-center justify-center px-2 overflow-hidden self-center"
                          style={{
                            gridColumn: `${b.cols.start + 1} / ${b.cols.end + 2}`,
                            gridRow: 1,
                            background: isWeekend ? style.solid : style.shoulder,
                            color: isWeekend ? style.solidText : style.shoulderText,
                            border: isWeekend ? "none" : `1px solid ${style.border}`,
                          }}
                          title={`${w.couple_names} · ${PHASE_LABEL[b.phase]}`}
                        >
                          {span >= 2 && (
                            <span className="text-[10px] font-medium truncate">
                              {PHASE_LABEL[b.phase]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {overflow > 0 && (
        <div className="mt-3 text-xs">
          <Link href="/venue/weddings" className="hover:underline" style={{ color: "var(--poppy)" }}>
            +{overflow} more wedding{overflow === 1 ? "" : "s"} this month →
          </Link>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-4 text-xs" style={{ color: "var(--ink-2)", borderTop: "1px solid var(--line)" }}>
        {LEGEND.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONE_STYLE[t].dot, border: `1px solid ${TONE_STYLE[t].border}` }} />
            {TONE_STYLE[t].label}
          </span>
        ))}
      </div>
    </section>
  );
}
