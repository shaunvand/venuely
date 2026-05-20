import Link from "next/link";

type Booking = { slug: string; couple_names: string; wedding_date: string };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function BookingsCalendar({ bookings, months: monthsToShow = 6 }: { bookings: Booking[]; months?: number }) {
  // Group bookings by ISO date (yyyy-mm-dd).
  const byDate = new Map<string, Booking[]>();
  for (const b of bookings) {
    const k = String(b.wedding_date).slice(0, 10);
    const list = byDate.get(k) ?? [];
    list.push(b);
    byDate.set(k, list);
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < monthsToShow; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
    });
  }

  function buildGrid(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    // Mon=0 ... Sun=6
    const offset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: ({ day: number; key: string; bookings: Booking[]; isToday: boolean } | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, key, bookings: byDate.get(key) ?? [], isToday: key === todayKey });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  return (
    <section className="vy-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
        <div>
          <div className="vy-eyebrow">Bookings calendar</div>
          <h2 className="vy-h2 mt-1">
            {monthsToShow === 1
              ? months[0]?.label ?? "This month"
              : `Next ${monthsToShow} months`}
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--ink-2)" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: "var(--poppy)" }} /> Single booking
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: "var(--peach)" }} /> Multiple
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ outline: "2px solid var(--sage)", background: "transparent" }} /> Today
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {months.map((m) => {
          const cells = buildGrid(m.year, m.month);
          return (
            <div key={m.label}>
              <div className="font-serif text-base mb-2">{m.label}</div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((w, i) => (
                  <div key={`${m.label}-h-${i}`} className="text-[10px] uppercase tracking-wider py-1" style={{ color: "var(--ink-2)" }}>
                    {w}
                  </div>
                ))}
                {cells.map((c, i) => {
                  if (!c) return <div key={`${m.label}-e-${i}`} />;
                  const count = c.bookings.length;
                  const tooltip = count > 0 ? c.bookings.map((b) => `${b.couple_names}`).join(", ") : "";
                  const colour =
                    count === 0 ? "transparent" : count === 1 ? "var(--poppy)" : "var(--peach)";
                  const txtColour = count === 0 ? "var(--ink)" : count === 1 ? "#fff" : "var(--ink)";
                  const link = count === 1 ? `/venue/weddings/${c.bookings[0].slug}` : count > 1 ? "/venue/weddings" : null;
                  const cell = (
                    <div
                      className="relative w-9 h-9 mx-auto flex items-center justify-center text-xs rounded-full transition-transform hover:scale-110"
                      style={{
                        background: colour,
                        color: txtColour,
                        fontWeight: count ? 600 : 400,
                        outline: c.isToday ? "2px solid var(--sage)" : undefined,
                        outlineOffset: c.isToday ? "1px" : undefined,
                      }}
                      title={tooltip || undefined}
                    >
                      {c.day}
                      {count > 1 && (
                        <span
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                          style={{ background: "var(--poppy)", color: "#fff" }}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  );
                  return (
                    <div key={c.key}>
                      {link ? (
                        <Link href={link} aria-label={tooltip || `${c.day} ${m.label}`}>
                          {cell}
                        </Link>
                      ) : (
                        cell
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {bookings.length === 0 && (
        <div className="vy-empty mt-5 text-xs">
          No bookings yet. Add a wedding from{" "}
          <Link href="/venue/weddings" className="underline" style={{ color: "var(--poppy)" }}>
            Weddings
          </Link>
          .
        </div>
      )}
    </section>
  );
}
