import Link from "next/link";

// Horizontal phase Gantt for the visible month. One row per active wedding, with
// up to three coloured bars per wedding — Set-up → Wedding Weekend → Breakdown —
// laid out on a CSS grid whose columns are the days of the month. No deps.

export type TimelineWedding = {
  id: string;
  slug: string;
  couple_names: string;
  wedding_date: string; // yyyy-mm-dd
  wedding_end_date: string | null;
  setup_date?: string | null;
  breakdown_date?: string | null;
  status: string | null;
};

type Phase = "setup" | "weekend" | "breakdown";

// Bar palette keyed by the wedding's status health. Tentative/inquiry get a soft
// fill; confirmed (booked) green; cancelled muted. Amber is reserved for the
// "needs attention" override the page passes in.
type BarTone = "confirmed" | "attention" | "tentative" | "cancelled";

const PHASE_LABEL: Record<Phase, string> = {
  setup: "Set-up",
  weekend: "Wedding weekend",
  breakdown: "Breakdown",
};

const TONE_STYLE: Record<BarTone, { bg: string; text: string; border?: string }> = {
  confirmed: { bg: "#cfe7d8", text: "#1f5d3e", border: "#8fc6a6" },
  attention: { bg: "#fdf0d4", text: "#8a6116", border: "#e7c878" },
  tentative: { bg: "var(--cream)", text: "var(--ink-2)", border: "var(--line)" },
  cancelled: { bg: "#ece9e7", text: "#8a8480", border: "var(--line)" },
};

function toneFor(status: string | null): BarTone {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelled" || s === "lost") return "cancelled";
  if (s === "booked" || s === "completed" || s === "confirmed") return "confirmed";
  return "tentative"; // inquiry / provisional / unknown
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

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function WeddingTimelineStrip({
  weddings,
  year,
  month0,
  monthLabel,
  cap = 6,
  attentionIds,
}: {
  weddings: TimelineWedding[];
  year: number;
  month0: number; // 0-based month
  monthLabel: string;
  cap?: number;
  attentionIds?: Set<string>;
}) {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const todayIso = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
  const todayCol = dayIndex(todayIso, year, month0, daysInMonth);

  // Only weddings whose any phase intersects the visible month, soonest first.
  const visible = weddings
    .filter((w) => {
      const wkEnd = w.wedding_end_date ?? w.wedding_date;
      const setupEnd = w.wedding_date ? addDaysIso(w.wedding_date, -1) : null;
      const breakStart = wkEnd ? addDaysIso(wkEnd, 1) : null;
      return (
        spanColumns(w.wedding_date, wkEnd, year, month0, daysInMonth) ||
        (w.setup_date && spanColumns(w.setup_date, setupEnd, year, month0, daysInMonth)) ||
        (w.breakdown_date && spanColumns(breakStart, w.breakdown_date, year, month0, daysInMonth))
      );
    })
    .sort((a, b) => String(a.wedding_date).localeCompare(String(b.wedding_date)));

  const shown = visible.slice(0, cap);
  const overflow = visible.length - shown.length;

  // Grid template: a label column + one column per day.
  const gridCols = `minmax(120px, 160px) repeat(${daysInMonth}, minmax(20px, 1fr))`;

  return (
    <section className="vy-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <div>
          <div className="vy-eyebrow">Phases</div>
          <h2 className="vy-h2 mt-1">Wedding timeline · {monthLabel}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--ink-2)" }}>
          {(["confirmed", "attention", "tentative", "cancelled"] as BarTone[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: TONE_STYLE[t].bg, border: `1px solid ${TONE_STYLE[t].border}` }} />
              {t === "confirmed" ? "Confirmed" : t === "attention" ? "Needs attention" : t === "tentative" ? "Tentative" : "Cancelled"}
            </span>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="vy-empty text-sm">No weddings fall in {monthLabel}.</div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <div style={{ minWidth: 640 }}>
            {/* Day header row */}
            <div className="grid items-end gap-px mb-1" style={{ gridTemplateColumns: gridCols }}>
              <div />
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dow = new Date(year, month0, day).getDay();
                const isToday = todayCol === day;
                const weekend = dow === 0 || dow === 6;
                return (
                  <div key={day} className="text-center leading-tight" style={{ color: isToday ? "var(--poppy)" : "var(--ink-2)" }}>
                    <div className="text-[9px] uppercase" style={{ opacity: weekend ? 1 : 0.6 }}>{DOW[dow]}</div>
                    <div className="text-[10px] tabular-nums" style={{ fontWeight: isToday ? 700 : 400 }}>{day}</div>
                  </div>
                );
              })}
            </div>

            {/* One row per wedding */}
            <div className="space-y-1.5">
              {shown.map((w) => {
                const tone = attentionIds?.has(w.id) ? "attention" : toneFor(w.status);
                const style = TONE_STYLE[tone];
                const wkEnd = w.wedding_end_date ?? w.wedding_date;
                const setupEnd = w.wedding_date ? addDaysIso(w.wedding_date, -1) : null;
                const breakStart = wkEnd ? addDaysIso(wkEnd, 1) : null;

                const bars: Array<{ phase: Phase; cols: { start: number; end: number } }> = [];
                const setup = w.setup_date && setupEnd ? spanColumns(w.setup_date, setupEnd, year, month0, daysInMonth) : null;
                if (setup) bars.push({ phase: "setup", cols: setup });
                const weekend = spanColumns(w.wedding_date, wkEnd, year, month0, daysInMonth);
                if (weekend) bars.push({ phase: "weekend", cols: weekend });
                const breakdown = w.breakdown_date && breakStart ? spanColumns(breakStart, w.breakdown_date, year, month0, daysInMonth) : null;
                if (breakdown) bars.push({ phase: "breakdown", cols: breakdown });

                return (
                  <div key={w.id} className="grid items-center gap-px" style={{ gridTemplateColumns: gridCols, minHeight: 30 }}>
                    <Link
                      href={`/venue/weddings/${w.slug}`}
                      className="text-xs font-medium truncate pr-2 hover:underline"
                      style={{ color: "var(--ink)" }}
                      title={w.couple_names}
                    >
                      {w.couple_names}
                    </Link>
                    {/* The day cells form the track; bars are placed by gridColumn. */}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      const dow = new Date(year, month0, day).getDay();
                      const isToday = todayCol === day;
                      return (
                        <div
                          key={day}
                          className="h-[26px] rounded-[3px]"
                          style={{
                            gridColumn: day + 1,
                            gridRow: 1,
                            background: dow === 0 || dow === 6 ? "rgba(28,25,23,0.035)" : "transparent",
                            outline: isToday ? "1px solid var(--peach)" : undefined,
                            outlineOffset: -1,
                          }}
                        />
                      );
                    })}
                    {bars.map((b) => (
                      <div
                        key={b.phase}
                        className="h-[18px] rounded-full flex items-center px-2 overflow-hidden self-center"
                        style={{
                          gridColumn: `${b.cols.start + 1} / ${b.cols.end + 2}`,
                          gridRow: 1,
                          background: style.bg,
                          border: `1px solid ${style.border ?? "transparent"}`,
                          color: style.text,
                        }}
                        title={`${w.couple_names} · ${PHASE_LABEL[b.phase]}`}
                      >
                        <span className="text-[9px] font-medium uppercase tracking-wide truncate">
                          {b.phase === "weekend" ? "Wedding" : PHASE_LABEL[b.phase]}
                        </span>
                      </div>
                    ))}
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
    </section>
  );
}
