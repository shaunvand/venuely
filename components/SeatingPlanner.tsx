"use client";

import { useEffect, useState } from "react";

type Guest = { id: string; full_name: string; table_number: number | null; is_child?: boolean | null };
type TableType = { id: string; label: string; shape: string; seats: number; quantity: number };
type Slot = { number: number; label: string; shape: string; seats: number };

const shapeIcon = (s: string) => (s === "round" ? "⭕" : s === "long" ? "▬" : s === "square" ? "⬜" : "🪑");

// Seat guests onto the venue's tables. Each venue table type is expanded into
// numbered tables; assigning sets the guest's table_number (saved via the guests
// API), so the venue's dietary/seating roll-up sees it too.
export function SeatingPlanner({ slug, tables, primary, accent, heading, cardRadius }: {
  slug: string; tables: TableType[]; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/wedding/${slug}/guests`).then((r) => r.json()).then((j) => { setGuests(j.guests ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, [slug]);

  // Expand venue table types into numbered tables.
  const slots: Slot[] = [];
  let n = 0;
  for (const t of tables) for (let i = 0; i < t.quantity; i++) { n++; slots.push({ number: n, label: t.quantity > 1 ? `${t.label} ${i + 1}` : t.label, shape: t.shape, seats: t.seats }); }

  async function seat(guestId: string, tableNumber: number | null) {
    setGuests((g) => g.map((x) => x.id === guestId ? { ...x, table_number: tableNumber } : x));
    await fetch(`/api/wedding/${slug}/guests`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: guestId, table_number: tableNumber }) });
  }

  const unseated = guests.filter((g) => !g.table_number);
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, ...extra });

  if (tables.length === 0) {
    return <div style={{ padding: 24, textAlign: "center", color: "#8a8a8a", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12 }}>Your venue hasn&apos;t set up its tables yet.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Seating plan</h2>
        <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Seat your guests at {slots.length} tables · {guests.length - unseated.length}/{guests.length} seated</div>
      </div>

      {/* Unseated guests */}
      <div style={card({ padding: 14 })}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700, marginBottom: 8 }}>Not yet seated ({unseated.length})</div>
        {loading ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading…</span> : unseated.length === 0 ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>Everyone&apos;s seated 🎉</span> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {unseated.map((g) => (
              <span key={g.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "var(--bone,#FFF6F0)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 999, padding: "4px 6px 4px 12px" }}>
                {g.full_name}
                <select defaultValue="" onChange={(e) => { if (e.target.value) seat(g.id, Number(e.target.value)); }} style={{ fontSize: 11, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 999, padding: "2px 4px", cursor: "pointer" }}>
                  <option value="">Seat at…</option>
                  {slots.map((s) => { const taken = guests.filter((x) => x.table_number === s.number).length; return <option key={s.number} value={s.number} disabled={taken >= s.seats}>{s.label}{taken >= s.seats ? " (full)" : ` (${taken}/${s.seats})`}</option>; })}
                </select>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
        {slots.map((s) => {
          const seated = guests.filter((g) => g.table_number === s.number);
          const full = seated.length >= s.seats;
          return (
            <div key={s.number} style={card({ padding: 14, borderColor: full ? primary : "rgba(0,0,0,0.08)" })}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...heading, fontWeight: 700 }}>{shapeIcon(s.shape)} {s.label}</span>
                <span style={{ fontSize: 11, color: full ? primary : "#57534e", fontWeight: 700 }}>{seated.length}/{s.seats}</span>
              </div>
              <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                {seated.length === 0 ? <span style={{ fontSize: 12, color: "#b0b0b0" }}>Empty</span> : seated.map((g) => (
                  <span key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, background: `${accent}22`, borderRadius: 8, padding: "3px 8px" }}>
                    {g.full_name}{g.is_child ? " 🧒" : ""}
                    <button onClick={() => seat(g.id, null)} title="Unseat" style={{ border: "none", background: "transparent", color: "#b42318", cursor: "pointer" }}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
