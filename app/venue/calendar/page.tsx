import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { BookingsCalendar } from "@/components/BookingsCalendar";
import { getVenueCalendar } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default async function VenueCalendar() {
  // Venue layout already gates, but make the page's contract explicit.
  await requireRole(["venue_admin", "owner"]);

  const { weddings, bookings, holds } = await getVenueCalendar();

  // Per-date occupancy summary, keyed by ISO date. Combines weddings (distinct
  // couples), room nights, and rental holds so the agenda can flag clashes.
  type DayAgg = {
    date: string;
    couples: Set<string>;
    weddingSlugs: Map<string, string>; // couple_names → slug
    roomNights: number;
    holdQty: number;
  };
  const days = new Map<string, DayAgg>();
  function ensure(date: string): DayAgg {
    let d = days.get(date);
    if (!d) {
      d = { date, couples: new Set(), weddingSlugs: new Map(), roomNights: 0, holdQty: 0 };
      days.set(date, d);
    }
    return d;
  }
  for (const w of weddings) {
    const d = ensure(w.wedding_date);
    d.couples.add(w.couple_names);
    d.weddingSlugs.set(w.couple_names, w.slug);
  }
  for (const b of bookings) ensure(b.date).roomNights += 1;
  for (const h of holds) ensure(h.weekend_of).holdQty += Number(h.quantity) || 0;

  const todayIso = new Date().toISOString().slice(0, 10);
  const agenda = Array.from(days.values())
    .filter((d) => d.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));

  const clashes = agenda.filter((d) => d.couples.size > 1);

  // Map for the calendar overlays.
  const roomNights = bookings.map((b) => ({
    date: b.date,
    room_name: b.room_name,
    couple_names: b.couple_names,
    guest_name: b.guest_name,
  }));
  const rentalHolds = holds.map((h) => ({
    weekend_of: h.weekend_of,
    rental_name: h.rental_name,
    quantity: h.quantity,
    couple_names: h.couple_names,
  }));

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Availability</div>
        <h1 className="vy-h1 mt-1">Calendar</h1>
        <p className="text-stone-600 text-sm mt-1">
          Every wedding, room night and rental hold on one timeline. Dates with more than one wedding are flagged so you never double-book.
        </p>
      </header>

      {clashes.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "#fca5a5", background: "#fef2f2", color: "#991b1b" }}
        >
          <div className="font-semibold">⚠ {clashes.length} date{clashes.length === 1 ? "" : "s"} with more than one wedding</div>
          <ul className="mt-1 space-y-0.5">
            {clashes.map((d) => (
              <li key={d.date}>
                <span className="font-medium">{fmtDate(d.date)}</span> — {Array.from(d.couples).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <BookingsCalendar
        bookings={weddings.map((w) => ({ slug: w.slug, couple_names: w.couple_names, wedding_date: w.wedding_date }))}
        months={6}
        roomNights={roomNights}
        rentalHolds={rentalHolds}
        weddingHref="/venue/calendar"
      />

      <section className="vy-card">
        <div className="vy-eyebrow">Upcoming</div>
        <h2 className="vy-h2 mt-1 mb-4">Agenda</h2>
        {agenda.length === 0 ? (
          <div className="vy-empty text-sm">
            Nothing scheduled yet. Add a wedding from{" "}
            <Link href="/venue/weddings" className="underline" style={{ color: "var(--poppy)" }}>
              Weddings
            </Link>
            .
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
            {agenda.map((d) => {
              const clash = d.couples.size > 1;
              return (
                <li key={d.date} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="w-44 shrink-0 text-sm font-medium">{fmtDate(d.date)}</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {Array.from(d.weddingSlugs.entries()).map(([name, slug]) => (
                      <Link
                        key={slug}
                        href={`/venue/weddings/${slug}`}
                        className="vy-tag vy-tag-soft hover:underline"
                        style={clash ? { borderColor: "#fca5a5", color: "#991b1b" } : undefined}
                      >
                        {name}
                      </Link>
                    ))}
                    {d.couples.size === 0 && d.roomNights === 0 && d.holdQty === 0 && (
                      <span className="text-stone-400">—</span>
                    )}
                    {d.roomNights > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--sage)", color: "var(--ink)" }}>
                        {d.roomNights} room night{d.roomNights === 1 ? "" : "s"}
                      </span>
                    )}
                    {d.holdQty > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--cream)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
                        {d.holdQty} rental hold{d.holdQty === 1 ? "" : "s"}
                      </span>
                    )}
                    {clash && (
                      <span className="text-xs font-semibold" style={{ color: "#b91c1c" }}>⚠ double-booked</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
