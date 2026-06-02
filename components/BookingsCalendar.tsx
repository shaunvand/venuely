import Link from "next/link";

type Booking = { slug: string; couple_names: string; wedding_date: string; wedding_end_date?: string | null };

// Expand a booking's wedding_date..wedding_end_date span into one ISO key per
// day so multi-day weddings light up every day they cover. A null/absent end
// date (or an end before the start) collapses to the single start day. Capped to
// keep bad data from runaway expansion.
function bookingDays(b: Booking): string[] {
  const start = String(b.wedding_date).slice(0, 10);
  if (!start) return [];
  const endRaw = b.wedding_end_date ? String(b.wedding_end_date).slice(0, 10) : "";
  if (!endRaw || endRaw <= start) return [start];
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${endRaw}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [start];
  const out: string[] = [];
  const cursor = new Date(s);
  let guard = 0;
  while (cursor <= e && guard < 120) {
    out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return out;
}

// Optional overlays for the dedicated availability calendar. The venue
// dashboard renders BookingsCalendar with just `bookings`, so every new prop
// is optional and the widget degrades to its original behaviour.
type RoomNight = { date: string; room_name: string | null; couple_names: string | null; guest_name: string | null };
type RentalHold = { weekend_of: string; rental_name: string | null; quantity: number; couple_names: string | null };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function BookingsCalendar({
  bookings,
  months: monthsToShow = 6,
  roomNights,
  rentalHolds,
  weddingHref = "/venue/weddings",
}: {
  bookings: Booking[];
  months?: number;
  roomNights?: RoomNight[];
  rentalHolds?: RentalHold[];
  weddingHref?: string;
}) {
  // Group bookings by ISO date (yyyy-mm-dd), expanding multi-day spans so each
  // covered day shows the wedding.
  const byDate = new Map<string, Booking[]>();
  for (const b of bookings) {
    for (const k of bookingDays(b)) {
      const list = byDate.get(k) ?? [];
      list.push(b);
      byDate.set(k, list);
    }
  }

  // Group accommodation room-nights by ISO date.
  const roomByDate = new Map<string, RoomNight[]>();
  for (const r of roomNights ?? []) {
    const k = String(r.date).slice(0, 10);
    const list = roomByDate.get(k) ?? [];
    list.push(r);
    roomByDate.set(k, list);
  }

  // Group rental holds by the Saturday they cover.
  const holdByDate = new Map<string, RentalHold[]>();
  for (const h of rentalHolds ?? []) {
    const k = String(h.weekend_of).slice(0, 10);
    const list = holdByDate.get(k) ?? [];
    list.push(h);
    holdByDate.set(k, list);
  }

  const hasOverlays = (roomNights?.length ?? 0) > 0 || (rentalHolds?.length ?? 0) > 0;

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

  type Cell = {
    day: number;
    key: string;
    bookings: Booking[];
    rooms: RoomNight[];
    holds: RentalHold[];
    isToday: boolean;
  };

  function buildGrid(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    // Mon=0 ... Sun=6
    const offset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Cell | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        day: d,
        key,
        bookings: byDate.get(key) ?? [],
        rooms: roomByDate.get(key) ?? [],
        holds: holdByDate.get(key) ?? [],
        isToday: key === todayKey,
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  // A clash = more than one DISTINCT wedding on the same date.
  function distinctCouples(c: Cell): number {
    const set = new Set<string>();
    c.bookings.forEach((b) => set.add(b.couple_names));
    return set.size;
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
        <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "var(--ink-2)" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: "var(--poppy)" }} /> Single booking
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: "var(--peach)" }} /> Multiple
          </span>
          {hasOverlays && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ background: "var(--sage)" }} /> Room night
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5" style={{ background: "var(--ink-2)" }} /> Rental hold
              </span>
            </>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ outline: "2px solid var(--sage)", background: "transparent" }} /> Today
          </span>
        </div>
      </div>

      <div className={hasOverlays ? "grid sm:grid-cols-2 gap-6" : "grid sm:grid-cols-2 lg:grid-cols-3 gap-6"}>
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
                  const couples = distinctCouples(c);
                  const clash = couples > 1;
                  const roomCount = c.rooms.length;
                  const holdQty = c.holds.reduce((s, h) => s + (Number(h.quantity) || 0), 0);

                  // Build a rich tooltip describing everything happening that day.
                  const tipLines: string[] = [];
                  if (count > 0) tipLines.push(...c.bookings.map((b) => `Wedding: ${b.couple_names}`));
                  if (clash) tipLines.push("⚠ Double-booking — more than one wedding this date");
                  if (roomCount > 0) {
                    tipLines.push(
                      `${roomCount} room night${roomCount === 1 ? "" : "s"} booked`,
                      ...c.rooms.slice(0, 6).map((r) => `· ${r.room_name ?? "Room"}${r.couple_names ? ` (${r.couple_names})` : ""}`)
                    );
                  }
                  if (holdQty > 0) {
                    tipLines.push(
                      `${holdQty} rental item${holdQty === 1 ? "" : "s"} held`,
                      ...c.holds.slice(0, 6).map((h) => `· ${h.rental_name ?? "Rental"} ×${h.quantity}${h.couple_names ? ` (${h.couple_names})` : ""}`)
                    );
                  }
                  const tooltip = tipLines.join("\n");

                  const colour = count === 0 ? "transparent" : couples === 1 ? "var(--poppy)" : "var(--peach)";
                  const txtColour = count === 0 ? "var(--ink)" : couples === 1 ? "#fff" : "var(--ink)";
                  const link = count === 1 ? `/venue/weddings/${c.bookings[0].slug}` : count > 1 ? weddingHref : null;

                  const cell = (
                    <div
                      className="relative w-9 h-9 mx-auto flex items-center justify-center text-xs rounded-full transition-transform hover:scale-110"
                      style={{
                        background: colour,
                        color: txtColour,
                        fontWeight: count ? 600 : 400,
                        outline: clash
                          ? "2px solid #b91c1c"
                          : c.isToday
                          ? "2px solid var(--sage)"
                          : undefined,
                        outlineOffset: clash || c.isToday ? "1px" : undefined,
                      }}
                      title={tooltip || undefined}
                    >
                      {c.day}
                      {couples > 1 && (
                        <span
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                          style={{ background: "#b91c1c", color: "#fff" }}
                        >
                          {couples}
                        </span>
                      )}
                      {/* Overlay markers along the bottom of the day cell. */}
                      {(roomCount > 0 || holdQty > 0) && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                          {roomCount > 0 && (
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: "var(--sage)" }}
                              aria-hidden
                            />
                          )}
                          {holdQty > 0 && (
                            <span
                              className="w-1.5 h-1.5"
                              style={{ background: "var(--ink-2)" }}
                              aria-hidden
                            />
                          )}
                        </span>
                      )}
                    </div>
                  );
                  return (
                    <div key={c.key} className="py-0.5">
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

      {bookings.length === 0 && !hasOverlays && (
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
