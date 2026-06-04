"use client";

import { useEffect, useState } from "react";

type Guest = { id: string; full_name: string; room_id: string | null; is_child?: boolean | null };
type Room = { id: string; name: string; sleeps: number };

// Allocate guests to accommodation rooms by drag-and-drop (or a "put in…" select on
// touch). Sets guests.room_id — the same record the venue sees. Capacity = sleeps.
export function RoomAllocator({ slug, rooms, primary, accent, heading, cardRadius }: {
  slug: string; rooms: Room[]; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/wedding/${slug}/guests`).then((r) => r.json()).then((j) => { setGuests(j.guests ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, [slug]);

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

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 220px", gap: 14, alignItems: "start" }}>
        {/* Rooms */}
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
                style={card({ padding: 12, borderColor: isOver ? accent : full ? primary : "rgba(0,0,0,0.08)" })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ ...heading, fontWeight: 700 }}>🛏 {room.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: full ? primary : "#57534e" }}>{inRoom.length}/{room.sleeps}</span>
                </div>
                <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                  {inRoom.length === 0 ? <span style={{ fontSize: 11.5, color: "#b0b0b0" }}>Drop guests here</span> : inRoom.map((g) => (
                    <span key={g.id} draggable onDragStart={() => setDrag(g.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, background: `${accent}22`, borderRadius: 8, padding: "3px 8px", cursor: "grab" }}>
                      {g.full_name}{g.is_child ? " 🧒" : ""}
                      <button onClick={() => assign(g.id, null)} title="Remove" style={{ border: "none", background: "transparent", color: "#b42318", cursor: "pointer" }}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Unassigned */}
        <div style={card({ padding: 12, position: "sticky", top: 8 })}
          onDragOver={(e) => { if (drag) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (drag) assign(drag, null); setDrag(null); }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700, marginBottom: 8 }}>Not allocated ({unassigned.length})</div>
          {loading ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading…</span> : unassigned.length === 0 ? <span style={{ color: "#8a8a8a", fontSize: 12.5 }}>Everyone has a room 🎉</span> : (
            <div style={{ display: "grid", gap: 6, maxHeight: 480, overflow: "auto" }}>
              {unassigned.map((g) => (
                <div key={g.id} draggable onDragStart={() => setDrag(g.id)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "var(--bone,#FFF6F0)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "5px 8px", cursor: "grab" }}>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.full_name}</span>
                  <select defaultValue="" onChange={(e) => { if (e.target.value) assign(g.id, e.target.value); }} title="Put in…" style={{ fontSize: 10.5, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6, padding: "1px 2px", cursor: "pointer", maxWidth: 70 }}>
                    <option value="">Room…</option>
                    {rooms.map((room) => { const n = guests.filter((x) => x.room_id === room.id).length; return <option key={room.id} value={room.id} disabled={n >= room.sleeps}>{room.name}{n >= room.sleeps ? " (full)" : ""}</option>; })}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
