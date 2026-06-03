"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Guest = { id: string; full_name: string; table_number: number | null; is_child?: boolean | null; rsvp_status?: string | null };
type TableType = { id: string; label: string; shape: string; seats: number; quantity: number };
type Slot = { number: number; label: string; shape: string; seats: number };
type Pos = { x: number; y: number };

const CANVAS_W = 760, CANVAS_H = 560, TABLE_W = 132, TABLE_H = 104;
const shapeIcon = (s: string) => (s === "round" ? "⭕" : s === "long" ? "▬" : s === "square" ? "⬜" : "🪑");

// Auto-arrange tables into a tidy grid (also the default before any drag).
function gridLayout(slots: Slot[]): Record<number, Pos> {
  const cols = Math.max(1, Math.floor(CANVAS_W / (TABLE_W + 20)));
  const out: Record<number, Pos> = {};
  slots.forEach((s, i) => { out[s.number] = { x: 16 + (i % cols) * (TABLE_W + 20), y: 16 + Math.floor(i / cols) * (TABLE_H + 24) }; });
  return out;
}

// Drag-and-drop floor plan. Tables come from the venue (venue_tables, expanded by
// quantity). Couples drag tables to lay out the room and drag guests onto tables.
// Table positions persist in wedding_state.floorplan; guest seating writes
// guests.table_number so the venue's roll-up stays in sync. A "seat at…" select +
// tap-to-move keeps it usable on touch screens.
export function FloorPlanner({ slug, tables, initialPositions, primary, accent, heading, cardRadius }: {
  slug: string; tables: TableType[]; initialPositions: Record<number, Pos>; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const slots: Slot[] = [];
  let n = 0;
  for (const t of tables) for (let i = 0; i < t.quantity; i++) { n++; slots.push({ number: n, label: t.quantity > 1 ? `${t.label} ${i + 1}` : t.label, shape: t.shape, seats: t.seats }); }

  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Record<number, Pos>>(() => ({ ...gridLayout(slots), ...(initialPositions || {}) }));
  const [dragGuest, setDragGuest] = useState<string | null>(null);
  const [overTable, setOverTable] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<{ num: number; dx: number; dy: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/wedding/${slug}/guests`).then((r) => r.json()).then((j) => { setGuests(j.guests ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, [slug]);

  const savePositions = useCallback((next: Record<number, Pos>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/wedding/${slug}/state`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ patch: { floorplan: { positions: next } } }) });
    }, 500);
  }, [slug]);

  async function seat(guestId: string, tableNumber: number | null) {
    setGuests((g) => g.map((x) => x.id === guestId ? { ...x, table_number: tableNumber } : x));
    await fetch(`/api/wedding/${slug}/guests`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: guestId, table_number: tableNumber }) });
  }

  // Table dragging (pointer) — drag from the table's header bar.
  function onTablePointerDown(e: React.PointerEvent, num: number) {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    const p = positions[num] || { x: 16, y: 16 };
    moveRef.current = { num, dx: e.clientX - (rect.left + p.x), dy: e.clientY - (rect.top + p.y) };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }
  function onPointerMove(e: PointerEvent) {
    const d = moveRef.current; const rect = canvasRef.current?.getBoundingClientRect(); if (!d || !rect) return;
    const x = Math.max(0, Math.min(CANVAS_W - TABLE_W, e.clientX - rect.left - d.dx));
    const y = Math.max(0, Math.min(CANVAS_H - TABLE_H, e.clientY - rect.top - d.dy));
    setPositions((p) => ({ ...p, [d.num]: { x, y } }));
  }
  function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (moveRef.current) { setPositions((p) => { savePositions(p); return p; }); moveRef.current = null; }
  }

  function autoArrange() { const g = gridLayout(slots); setPositions(g); savePositions(g); }

  const unseated = guests.filter((g) => !g.table_number);
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, ...extra });

  if (tables.length === 0) {
    return <div style={{ padding: 24, textAlign: "center", color: "#8a8a8a", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12 }}>Your venue hasn&apos;t set up its tables yet — once they do, you can arrange your floor plan here.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Floor plan &amp; seating</h2>
          <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Drag tables to lay out your room, then drag guests onto a table · {guests.length - unseated.length}/{guests.length} seated</div>
        </div>
        <button onClick={autoArrange} style={{ border: `1px solid ${primary}`, background: "#fff", color: primary, borderRadius: 999, padding: "7px 14px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>⤢ Auto-arrange</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 220px", gap: 14, alignItems: "start" }}>
        {/* Canvas */}
        <div style={{ overflow: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, background: "repeating-linear-gradient(45deg,#fafafa,#fafafa 14px,#f3f3f3 14px,#f3f3f3 15px)" }}>
          <div ref={canvasRef} style={{ position: "relative", width: CANVAS_W, height: CANVAS_H }}>
            {slots.map((s) => {
              const pos = positions[s.number] || { x: 16, y: 16 };
              const seated = guests.filter((g) => g.table_number === s.number);
              const full = seated.length >= s.seats;
              const isOver = overTable === s.number;
              return (
                <div key={s.number}
                  onDragOver={(e) => { if (dragGuest) { e.preventDefault(); setOverTable(s.number); } }}
                  onDragLeave={() => setOverTable((t) => (t === s.number ? null : t))}
                  onDrop={(e) => { e.preventDefault(); setOverTable(null); if (dragGuest && !full) seat(dragGuest, s.number); setDragGuest(null); }}
                  style={{ position: "absolute", left: pos.x, top: pos.y, width: TABLE_W, minHeight: TABLE_H, background: "#fff", border: `2px solid ${isOver ? accent : full ? primary : "rgba(0,0,0,0.12)"}`, borderRadius: s.shape === "round" ? 18 : 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", userSelect: "none" }}>
                  <div onPointerDown={(e) => onTablePointerDown(e, s.number)} title="Drag to move" style={{ cursor: "grab", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 11.5, fontWeight: 700 }}>
                    <span>{shapeIcon(s.shape)} {s.label}</span>
                    <span style={{ color: full ? primary : "#8a8a8a" }}>{seated.length}/{s.seats}</span>
                  </div>
                  <div style={{ padding: "4px 6px", display: "grid", gap: 2 }}>
                    {seated.length === 0 ? <span style={{ fontSize: 10.5, color: "#c0c0c0", padding: "2px 4px" }}>Drop guests here</span> : seated.map((g) => (
                      <span key={g.id} draggable onDragStart={() => setDragGuest(g.id)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, background: `${accent}22`, borderRadius: 6, padding: "2px 6px", cursor: "grab" }}>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.full_name}{g.is_child ? " 🧒" : ""}</span>
                        <button onClick={() => seat(g.id, null)} title="Unseat" style={{ border: "none", background: "transparent", color: "#b42318", cursor: "pointer", fontSize: 11, lineHeight: 1 }}>✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unseated sidebar (also a drop target to unseat) */}
        <div style={card({ padding: 12, position: "sticky", top: 8 })}
          onDragOver={(e) => { if (dragGuest) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (dragGuest) seat(dragGuest, null); setDragGuest(null); }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700, marginBottom: 8 }}>Not seated ({unseated.length})</div>
          {loading ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading…</span> : unseated.length === 0 ? <span style={{ color: "#8a8a8a", fontSize: 12.5 }}>Everyone&apos;s seated 🎉</span> : (
            <div style={{ display: "grid", gap: 6, maxHeight: CANVAS_H - 40, overflow: "auto" }}>
              {unseated.map((g) => (
                <div key={g.id} draggable onDragStart={() => setDragGuest(g.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "var(--bone,#FFF6F0)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "5px 8px", cursor: "grab" }}>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.full_name}</span>
                  <select defaultValue="" onChange={(e) => { if (e.target.value) seat(g.id, Number(e.target.value)); }} title="Seat at…" style={{ fontSize: 10.5, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6, padding: "1px 2px", cursor: "pointer", maxWidth: 70 }}>
                    <option value="">Seat…</option>
                    {slots.map((s) => { const taken = guests.filter((x) => x.table_number === s.number).length; return <option key={s.number} value={s.number} disabled={taken >= s.seats}>{s.label}{taken >= s.seats ? " (full)" : ""}</option>; })}
                  </select>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: "#a0a0a0", marginTop: 10 }}>Tip: drag a name onto a table, or back here to unseat.</div>
        </div>
      </div>
    </div>
  );
}
