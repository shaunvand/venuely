"use client";

import { useState, useTransition } from "react";

type RoomCap = {
  id: string;
  name: string;
  remaining: number;
  capacity: number;
  assigned: number; // guests this wedding currently has in the room
};

// Co-located confirm panel for the couple accommodation page. The
// AccommodationGrid above persists roomAssignments to /state continuously;
// this panel materialises those assignments into accommodation_bookings rows
// (so the venue calendar sees the hold) and surfaces per-room remaining
// capacity for the wedding date. It re-reads the latest assignments from the
// API before confirming so it always books what the couple actually saved.
export function ConfirmBookings({
  weddingSlug,
  weddingDate,
  initialRooms,
}: {
  weddingSlug: string;
  weddingDate: string | null;
  initialRooms: RoomCap[];
}) {
  const [rooms] = useState<RoomCap[]>(initialRooms);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const roomsWithGuests = rooms.filter((r) => r.assigned > 0);
  const dateLabel = weddingDate
    ? new Date(`${weddingDate}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })
    : null;

  function confirm() {
    setMsg(null);
    setWarnings([]);
    start(async () => {
      try {
        // Pull the freshest assignments so we book exactly what was saved.
        const cur = await fetch(`/api/wedding/${weddingSlug}/accommodation`, { cache: "no-store" });
        if (!cur.ok) {
          const j = await cur.json().catch(() => ({}));
          setMsg(`Could not load latest assignments: ${j.error ?? cur.status}`);
          return;
        }
        const { roomAssignments } = (await cur.json()) as { roomAssignments?: Record<string, string[]> };

        const res = await fetch(`/api/wedding/${weddingSlug}/accommodation`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomAssignments: roomAssignments ?? {} }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg(`Could not confirm: ${j.error ?? res.status}`);
          return;
        }
        setWarnings(Array.isArray(j.warnings) ? j.warnings : []);
        setMsg(`✓ Confirmed ${j.booked ?? 0} room${(j.booked ?? 0) === 1 ? "" : "s"}${dateLabel ? ` for ${dateLabel}` : ""}`);
      } catch (e) {
        setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }

  return (
    <section className="mt-8 bg-white rounded-2xl border border-stone-200 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Confirm rooming</div>
          <h2 className="font-serif text-xl mt-0.5">Lock in your rooms</h2>
          <p className="text-sm text-stone-600 mt-1">
            {dateLabel
              ? <>Reserves each assigned room for the night of <span className="font-medium">{dateLabel}</span>, so the venue holds them for you.</>
              : <>Your wedding date isn&apos;t set yet — the venue will confirm exact nights with you.</>}
          </p>
        </div>
        <button
          onClick={confirm}
          disabled={pending || roomsWithGuests.length === 0}
          className="rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          style={{ background: "var(--poppy, #FA523C)" }}
        >
          {pending ? "Confirming…" : `Confirm ${roomsWithGuests.length} room${roomsWithGuests.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {/* Per-room remaining-capacity badges for the wedding date. */}
      <div className="mt-4 grid sm:grid-cols-2 gap-2">
        {rooms.map((r) => {
          const wouldExceed = r.assigned > 0 && r.remaining <= 0;
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: wouldExceed ? "#fca5a5" : "var(--line, rgba(28,25,23,0.10))", background: wouldExceed ? "#fef2f2" : "transparent" }}
            >
              <span className="truncate">
                {r.name}
                {r.assigned > 0 && <span className="text-stone-500"> · {r.assigned} guest{r.assigned === 1 ? "" : "s"}</span>}
              </span>
              <span
                className="shrink-0 text-xs px-2 py-0.5 rounded-full"
                style={
                  wouldExceed
                    ? { background: "#fee2e2", color: "#991b1b" }
                    : { background: "var(--sage-2, #D5DBCC)", color: "var(--ink, #1c1917)" }
                }
              >
                {dateLabel
                  ? `${r.remaining} of ${r.capacity} left${dateLabel ? ` on ${new Date(`${weddingDate}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}` : ""}`
                  : `${r.capacity} available`}
              </span>
            </div>
          );
        })}
      </div>

      {msg && <div className="mt-3 text-sm text-stone-700">{msg}</div>}
      {warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm" style={{ color: "#991b1b" }}>
          {warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
