"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// Horizontal phase Gantt for the visible month. One row per active wedding, with
// up to three bars per wedding — Set-up → Wedding Weekend → Breakdown — on a CSS
// grid whose columns are the days of the month. Client component: holds the
// visible month in state so Today / ‹ / › navigate. No deps. Styled to match the
// reference mockup in Venuely colours.

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
type BarTone = "confirmed" | "paid" | "attention" | "tentative" | "cancelled";

const PHASE_LABEL: Record<Phase, string> = {
  setup: "Set-up",
  weekend: "Wedding Weekend",
  breakdown: "Breakdown",
};

// Three fills per tone: solid (Wedding Weekend), mid (Set-up), faint (Breakdown).
// onSolid = text on solid/mid, onFaint = text on the faint shoulder. dot = legend.
type ToneStyle = {
  label: string;
  solid: string;
  mid: string;
  faint: string;
  onSolid: string;
  onFaint: string;
  dot: string;
};

const TONE_STYLE: Record<BarTone, ToneStyle> = {
  // Confirmed → deep forest green (mockup's darkest bars)
  confirmed: { label: "Confirmed", solid: "#3f6e54", mid: "#557f67", faint: "#d6e4da", onSolid: "#ffffff", onFaint: "#2f5a43", dot: "#3f6e54" },
  // Paid in Full → medium sage green
  paid: { label: "Paid in Full", solid: "#8fae8a", mid: "#a6c1a1", faint: "#dcebd8", onSolid: "#1d3f2c", onFaint: "#1f5d3e", dot: "#8fae8a" },
  // Needs Attention → warm coral-peach (Venuely poppy family)
  attention: { label: "Needs Attention", solid: "#eda579", mid: "#f3c0a1", faint: "#f9e0cf", onSolid: "#7d3f1d", onFaint: "#8a4a25", dot: "#ef8a5c" },
  // Tentative → warm taupe/beige
  tentative: { label: "Tentative", solid: "#d8c8ac", mid: "#e3d7c0", faint: "#eee5d4", onSolid: "#6b5d44", onFaint: "#6b5d44", dot: "#d2c2a4" },
  // Cancelled → muted grey, de-emphasised
  cancelled: { label: "Cancelled", solid: "#e4e0dc", mid: "#ece9e6", faint: "#f4f2f0", onSolid: "#8a8480", onFaint: "#a39e99", dot: "#d6d2cf" },
};

function toneFor(status: string | null, attention: boolean, paid: boolean): BarTone {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelled" || s === "lost") return "cancelled";
  if (attention) return "attention";
  if (paid || s === "completed") return "paid";
  if (s === "booked" || s === "confirmed") return "confirmed";
  return "tentative";
}

function initialsOf(name: string): string {
  const parts = String(name ?? "").replace(/&|\band\b/gi, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function dayIndex(iso: string | null | undefined, year: number, month0: number, daysInMonth: number): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).slice(0, 10));
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]) - 1; const d = Number(m[3]);
  if (y !== year || mo !== month0) return null;
  if (d < 1 || d > daysInMonth) return null;
  return d;
}

function spanColumns(startIso: string | null | undefined, endIso: string | null | undefined, year: number, month0: number, daysInMonth: number): { start: number; end: number } | null {
  const sRaw = startIso ? String(startIso).slice(0, 10) : null;
  const eRaw = endIso ? String(endIso).slice(0, 10) : sRaw;
  if (!sRaw || !eRaw) return null;
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

const DOW = ["S", "M", "T", "W", "T", "F", "S"]; // Date.getDay() order
const LEGEND: BarTone[] = ["confirmed", "attention", "paid", "tentative"];

export function WeddingTimelineStrip({
  weddings,
  year,
  month0,
  cap = 6,
  attentionIds,
}: {
  weddings: TimelineWedding[];
  year: number;
  month0: number;
  monthLabel?: string;
  cap?: number;
  attentionIds?: Set<string>;
}) {
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

  const gridCols = `minmax(170px, 210px) repeat(${daysInMonth}, minmax(22px, 1fr))`;
  const stepBtn = "w-8 h-8 inline-flex items-center justify-center rounded-lg border text-sm leading-none transition-colors hover:bg-[var(--cream)]";

  return (
    <section className="vy-card">
      {/* Header: title + control cluster (‹ › · Today · Month) */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-serif text-[1.45rem] leading-tight" style={{ color: "var(--ink)" }}>Wedding timeline</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink-2)" }}>Overview of bookings, set-up and breakdown.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setViewIdx((i) => i - 1)} className={stepBtn} style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>‹</button>
          <button type="button" aria-label="Next month" onClick={() => setViewIdx((i) => i + 1)} className={stepBtn} style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>›</button>
          <button type="button" onClick={() => setViewIdx(todayMonthIdx)} className="px-3.5 h-8 inline-flex items-center rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--cream)]" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>Today</button>
          <span className="px-3.5 h-8 inline-flex items-center gap-2 rounded-lg border font-serif text-sm" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
            {monthLabel}
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" aria-hidden><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="vy-empty text-sm">No weddings fall in {monthLabel}.</div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <div style={{ minWidth: 760 }}>
            {/* Day axis: number above weekday letter, today softly circled */}
            <div className="grid items-end gap-px mb-1.5" style={{ gridTemplateColumns: gridCols }}>
              <div />
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dow = new Date(vYear, vMonth0, day).getDay();
                const isToday = todayCol === day;
                return (
                  <div key={day} className="flex flex-col items-center leading-none gap-1">
                    <span
                      className="text-[12px] tabular-nums inline-flex items-center justify-center"
                      style={isToday ? { width: 22, height: 22, borderRadius: 9999, background: "var(--bone, #ECE6DD)", color: "var(--ink)", fontWeight: 700 } : { color: "var(--ink)", fontWeight: 600 }}
                    >
                      {day}
                    </span>
                    <span className="text-[9px] uppercase" style={{ color: "var(--ink-2)", opacity: 0.65 }}>{DOW[dow]}</span>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            <div>
              {shown.map((w, ri) => {
                const paid = !!w.couple_paid_at;
                const attention = attentionIds?.has(w.id) ?? false;
                const tone = toneFor(w.status, attention, paid);
                const st = TONE_STYLE[tone];
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
                    style={{ gridTemplateColumns: gridCols, minHeight: 64, opacity: dim ? 0.6 : 1, borderTop: ri === 0 ? "none" : "1px solid var(--line)" }}
                  >
                    {/* Label: avatar + name + guests */}
                    <Link href={`/venue/weddings/${w.slug}`} className="flex items-center gap-3 pr-3 min-w-0 group" title={w.couple_names}>
                      <span className="shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center text-[12px] font-semibold" style={{ background: "var(--cream)", color: "var(--poppy-deep)" }}>
                        {initialsOf(w.couple_names)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold truncate group-hover:underline" style={{ color: "var(--ink)" }}>{w.couple_names}</span>
                        {w.guests != null && <span className="block text-[12px] truncate" style={{ color: "var(--ink-2)" }}>{w.guests} guests</span>}
                      </span>
                    </Link>

                    {/* Day track — today gets a faint peach vertical band */}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const dow = new Date(vYear, vMonth0, day).getDay();
                      const isToday = todayCol === day;
                      return (
                        <div
                          key={day}
                          style={{
                            gridColumn: day + 1,
                            gridRow: 1,
                            alignSelf: "stretch",
                            background: isToday ? "rgba(255,198,173,0.4)" : dow === 0 || dow === 6 ? "rgba(28,25,23,0.025)" : "transparent",
                          }}
                        />
                      );
                    })}

                    {/* Phase bars */}
                    {bars.map((b) => {
                      const span = b.cols.end - b.cols.start + 1;
                      const fill = b.phase === "weekend" ? st.solid : b.phase === "setup" ? st.mid : st.faint;
                      const text = b.phase === "breakdown" ? st.onFaint : st.onSolid;
                      return (
                        <div
                          key={b.phase}
                          className="h-[32px] rounded-[10px] flex items-center justify-center px-2 overflow-hidden self-center"
                          style={{ gridColumn: `${b.cols.start + 1} / ${b.cols.end + 2}`, gridRow: 1, background: fill, color: text }}
                          title={`${w.couple_names} · ${PHASE_LABEL[b.phase]}`}
                        >
                          {span >= 2 && <span className="text-[11px] font-medium truncate">{PHASE_LABEL[b.phase]}</span>}
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
          <Link href="/venue/weddings" className="hover:underline" style={{ color: "var(--poppy)" }}>+{overflow} more wedding{overflow === 1 ? "" : "s"} this month →</Link>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-5 pt-4 text-xs" style={{ color: "var(--ink-2)", borderTop: "1px solid var(--line)" }}>
        {LEGEND.map((t) => (
          <span key={t} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONE_STYLE[t].dot }} />
            {TONE_STYLE[t].label}
          </span>
        ))}
      </div>
    </section>
  );
}
