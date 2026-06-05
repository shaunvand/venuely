"use client";

import { useEffect, useRef, useState } from "react";

type Guest = { id: string; full_name: string; room_id: string | null; is_child?: boolean | null };
type Room = { id: string; name: string; sleeps: number; price?: number | null; description?: string | null; img?: string | null; type?: string | null };
const rZA = (n: number | null | undefined) => (n ? `R${Math.round(n).toLocaleString("en-ZA")}/night` : "");

// Allocate guests to accommodation rooms by drag-and-drop (or a "put in…" select on
// touch). Sets guests.room_id — the same record the venue sees. Capacity = sleeps.
// onAllocated reports which rooms now have guests so the parent can bill them.
export function RoomAllocator({ slug, rooms, onAllocated, primary, accent, heading, cardRadius }: {
  slug: string; rooms: Room[]; onAllocated?: (roomIds: string[]) => void; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const usedRef = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/wedding/${slug}/guests`).then((r) => r.json()).then((j) => { setGuests(j.guests ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, [slug]);

  // Tell the parent which rooms are in use (for billing) when that set changes.
  useEffect(() => {
    if (loading) return;
    const ids = Array.from(new Set(guests.filter((g) => g.room_id).map((g) => g.room_id as string))).sort();
    const key = ids.join(",");
    if (usedRef.current === null) { usedRef.current = key; return; }
    if (key !== usedRef.current) { usedRef.current = key; onAllocated?.(ids); }
  }, [guests, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function assign(guestId: string, roomId: string | null) {
    setGuests((g) => g.map((x) => x.id === guestId ? { ...x, room_id: roomId } : x));
    await fetch(`/api/wedding/${slug}/guests`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: guestId, room_id: roomId }) });
  }

  const unassigned = guests.filter((g) => !g.room_id);
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, ...extra });

  if (rooms.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <h3 style={{ ...heading, fontSize: 20, margin: 0 }}>Who&apos;s staying where</h3>
        <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Drag a guest onto a room (or use the picker) · {guests.length - unassigned.length}/{guests.length} allocated</div>
      </div>

      {/* Rooms on top — who's staying where */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
        {rooms.map((room) => {
          const inRoom = guests.filter((g) => g.room_id === room.id);
          const full = inRoom.length >= room.sleeps;
          const isOver = over === room.id;
          return (
            <div key={room.id}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(room.id); } }}
              onDragLeave={() => setOver((o) => (o === room.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (drag && !full) assign(drag, room.id); setDrag(null); }}
              style={{ background: "#fff", border: `1px solid ${isOver ? accent : full ? primary : "rgba(0,0,0,0.08)"}`, borderLeft: `3px solid ${primary}`, borderRadius: cardRadius, overflow: "hidden", boxShadow: "0 2px 8px rgba(28,25,23,0.08)" }}>
              {room.img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={room.img} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
              )}
              <div style={{ padding: 14 }}>
                {room.type && <span style={{ display: "inline-block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#57534e", background: `${accent}33`, borderRadius: 999, padding: "3px 9px" }}>{room.type}</span>}
                <div style={{ ...heading, fontSize: 16, fontWeight: 700, marginTop: 6 }}>{room.name}</div>
                <div style={{ fontSize: 12.5, color: "#57534e", marginTop: 3 }}>🛏 Sleeps {room.sleeps}{room.price ? <> · <span style={{ color: primary, fontWeight: 700 }}>{rZA(room.price)}</span></> : null}</div>
                {room.description && <div style={{ fontSize: 12.5, color: "#57534e", fontStyle: "italic", margin: "8px 0" }}>{room.description}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8 }}>
                  <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "#a8a29e", fontWeight: 700 }}>Who&apos;s staying</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: full ? primary : "#57534e" }}>{inRoom.length}/{room.sleeps}</span>
                </div>
                <div style={{ marginTop: 8, display: "grid", gap: 4, minHeight: 24 }}>
                  {inRoom.length === 0 ? <span style={{ fontSize: 11.5, color: "#b0b0b0" }}>Drag guests here</span> : inRoom.map((g) => (
                    <span key={g.id} draggable onDragStart={() => setDrag(g.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, background: `${accent}22`, borderRadius: 8, padding: "3px 8px", cursor: "grab" }}>
                      {g.full_name}{g.is_child ? " 🧒" : ""}
                      <button onClick={() => assign(g.id, null)} title="Remove" style={{ border: "none", background: "transparent", color: "#b42318", cursor: "pointer" }}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guest pool underneath — drag from here into a room above */}
      <div style={card({ padding: 14 })}
        onDragOver={(e) => { if (drag) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); if (drag) assign(drag, null); setDrag(null); }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700, marginBottom: 10 }}>Guests to allocate ({unassigned.length})</div>
        {loading ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading…</span> : unassigned.length === 0 ? <span style={{ color: "#8a8a8a", fontSize: 12.5 }}>Everyone has a room 🎉 — drag a name back here to move them.</span> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {unassigned.map((g) => (
              <span key={g.id} draggable onDragStart={() => setDrag(g.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "var(--bone,#FFF6F0)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 999, padding: "5px 6px 5px 12px", cursor: "grab" }}>
                {g.full_name}{g.is_child ? " 🧒" : ""}
                <select defaultValue="" onChange={(e) => { if (e.target.value) assign(g.id, e.target.value); }} title="Put in…" style={{ fontSize: 10.5, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 999, padding: "2px 4px", cursor: "pointer" }}>
                  <option value="">Room…</option>
                  {rooms.map((room) => { const n = guests.filter((x) => x.room_id === room.id).length; return <option key={room.id} value={room.id} disabled={n >= room.sleeps}>{room.name}{n >= room.sleeps ? " (full)" : ""}</option>; })}
                </select>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
