"use client";

import { useEffect, useState } from "react";

type Guest = { id: string; full_name: string; seat_table_id: string | null; seat_index: number | null };
type Table = { id: string; name: string; shape: string; seats: number; include_ends: boolean; sort_order: number | null };
const serif: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif" };

// Seat slots per side, derived from shape/seats/ends. Indices are stable so each
// guest's seat_index maps to the same spot.
function layout(shape: string, seats: number, ends: boolean) {
  const idx = Array.from({ length: seats }, (_, i) => i);
  if (shape === "long") {
    const e = ends ? Math.min(2, seats) : 0;
    const side = seats - e;
    const top = Math.ceil(side / 2);
    return { top: idx.slice(0, top), bottom: idx.slice(top, side), left: e >= 1 ? [idx[side]] : [], right: e >= 2 ? [idx[side + 1]] : [] };
  }
  if (shape === "horseshoe") {
    const per = Math.ceil(seats / 3);
    return { top: idx.slice(0, per), bottom: [] as number[], left: idx.slice(per, per * 2), right: idx.slice(per * 2) };
  }
  const per = Math.floor(seats / 4); const rem = seats - per * 4;
  const sizes = [per, per, per, per]; for (let i = 0; i < rem; i++) sizes[i]++;
  let c = 0; const take = (n: number) => { const a = idx.slice(c, c + n); c += n; return a; };
  return { top: take(sizes[0]), right: take(sizes[1]), bottom: take(sizes[2]), left: take(sizes[3]) };
}

// Seat-level seating plan. The guest pool is the live guest list (shared with the
// Accommodation tab). Couples add their own tables (shape/seats/ends) or import the
// venue's. Click a guest, then an empty seat to place; click a filled seat to free it.
export function SeatingPlan({ slug, primary, accent, heading, cardRadius }: {
  slug: string; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [addingGuest, setAddingGuest] = useState(false);
  const [newGuest, setNewGuest] = useState("");
  const [showTableModal, setShowTableModal] = useState(false);
  const [tForm, setTForm] = useState({ name: "", shape: "long", seats: 8, include_ends: true });

  function loadGuests() { return fetch(`/api/wedding/${slug}/guests`).then((r) => r.json()).then((j) => setGuests(j.guests ?? [])); }
  function loadTables() { return fetch(`/api/wedding/${slug}/tables`).then((r) => r.json()).then((j) => setTables(j.tables ?? [])); }
  useEffect(() => { Promise.all([loadGuests(), loadTables()]).finally(() => setLoading(false)); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function seatPatch(guestId: string, tableId: string | null, index: number | null) {
    setGuests((gs) => gs.map((g) => g.id === guestId ? { ...g, seat_table_id: tableId, seat_index: index } : g));
    await fetch(`/api/wedding/${slug}/guests`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: guestId, seat_table_id: tableId, seat_index: index }) });
  }
  function clickSeat(tableId: string, index: number) {
    const occupant = guests.find((g) => g.seat_table_id === tableId && g.seat_index === index);
    if (occupant) { seatPatch(occupant.id, null, null); return; }
    if (selected) { seatPatch(selected, tableId, index); setSelected(null); }
  }
  async function addGuest() {
    const name = newGuest.trim(); if (!name) return;
    const r = await fetch(`/api/wedding/${slug}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ full_name: name }) });
    const j = await r.json(); if (j.ok) setGuests((g) => [...g, j.guest]);
    setNewGuest(""); setAddingGuest(false);
  }
  async function addTable() {
    if (!tForm.name.trim()) return;
    const r = await fetch(`/api/wedding/${slug}/tables`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(tForm) });
    const j = await r.json(); if (j.ok) setTables((t) => [...t, j.table]);
    setShowTableModal(false); setTForm({ name: "", shape: "long", seats: 8, include_ends: true });
  }
  async function removeTable(id: string) {
    setTables((t) => t.filter((x) => x.id !== id));
    setGuests((gs) => gs.map((g) => g.seat_table_id === id ? { ...g, seat_table_id: null, seat_index: null } : g));
    await fetch(`/api/wedding/${slug}/tables`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  }
  async function importVenue() {
    await fetch(`/api/wedding/${slug}/tables`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ importVenue: true }) });
    await loadTables();
  }

  const seated = guests.filter((g) => g.seat_table_id).length;
  const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius };
  const btnSolid: React.CSSProperties = { background: primary, color: "#fff", border: "none", borderRadius: 999, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 0.5 };
  const btnSoft: React.CSSProperties = { background: `${accent}33`, color: "#57534e", border: "none", borderRadius: 999, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 0.5 };

  // Plain render functions (not components) so seats don't remount on each render.
  const seat = (table: Table, index: number) => {
    const occ = guests.find((g) => g.seat_table_id === table.id && g.seat_index === index);
    const [first, ...rest] = (occ?.full_name || "").split(" ");
    return (
      <button key={index} onClick={() => clickSeat(table.id, index)} title={occ ? `${occ.full_name} — click or drag out to unassign` : "Click or drop a guest here"}
        draggable={!!occ} onDragStart={() => occ && setDragId(occ.id)}
        onDragOver={(e) => { if (dragId && !occ) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); if (dragId && !occ) seatPatch(dragId, table.id, index); setDragId(null); }}
        style={{ width: 70, minHeight: 46, borderRadius: 8, cursor: occ ? "grab" : "pointer", fontSize: 11, lineHeight: 1.15, padding: "4px 3px", textAlign: "center",
          border: occ ? `1px solid ${primary}` : "1px dashed rgba(0,0,0,0.22)", background: occ ? "#fff" : (selected || dragId ? `${accent}14` : "transparent"), color: "#1c1917" }}>
        {occ ? <><div style={{ fontWeight: 700 }}>{first}</div>{rest.length > 0 && <div style={{ color: "#57534e" }}>{rest.join(" ")}</div>}</> : ""}
      </button>
    );
  };

  const tableCard = (table: Table) => {
    const lay = layout(table.shape, table.seats, table.include_ends);
    const filled = guests.filter((g) => g.seat_table_id === table.id).length;
    const shapeLabel = table.shape === "long" ? "Long Table" : table.shape === "horseshoe" ? "Horseshoe" : "Individual Table";
    const row = (arr: number[]) => <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>{arr.map((i) => seat(table, i))}</div>;
    const col = (arr: number[]) => <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>{arr.map((i) => seat(table, i))}</div>;
    return (
      <div key={table.id} style={{ ...card, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ ...serif, fontSize: 18, color: primary }}>{table.name}</div>
            <div style={{ fontSize: 12, color: "#8a8a8a" }}>{shapeLabel} · {filled}/{table.seats} seats filled</div>
          </div>
          <button onClick={() => removeTable(table.id)} title="Remove table" style={{ border: "none", background: "transparent", color: "#c0b9b1", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: "rgba(0,0,0,0.07)", margin: "10px 0 16px" }}><div style={{ height: 4, borderRadius: 999, width: `${Math.round((filled / table.seats) * 100)}%`, background: primary }} /></div>
        <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
          {lay.top.length > 0 && row(lay.top)}
          <div style={{ display: "flex", gap: 8, alignItems: "stretch", width: "100%", justifyContent: "center" }}>
            {lay.left.length > 0 && col(lay.left)}
            <div style={{ flex: 1, maxWidth: 620, minHeight: 50, borderRadius: 10, background: `${accent}22`, border: `1px solid ${accent}66`, display: "flex", alignItems: "center", justifyContent: "center", ...serif, color: "#57534e" }}>{table.name}</div>
            {lay.right.length > 0 && col(lay.right)}
          </div>
          {lay.bottom.length > 0 && row(lay.bottom)}
        </div>
      </div>
    );
  }

  if (loading) return <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading your seating plan…</span>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Seating <span style={{ ...serif, fontStyle: "italic" }}>Plan</span></h2>
          <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Click a guest to select them, then click an empty seat to place them. Click an occupied seat to unassign.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setAddingGuest((v) => !v)} style={btnSoft}>+ ADD GUEST</button>
          <button onClick={() => setShowTableModal(true)} style={btnSolid}>+ ADD TABLE</button>
        </div>
      </div>

      {/* Guest pool */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#a8a29e", fontWeight: 700 }}>Guest pool</div>
            <div style={{ fontSize: 12, color: "#8a8a8a", marginTop: 2 }}>Select a guest, then click an empty seat · Strikethrough = already placed · Shared with Accommodation</div>
          </div>
          <span style={{ fontSize: 12.5, color: "#57534e" }}>{seated} of {guests.length} guests seated</span>
        </div>
        {addingGuest && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input autoFocus value={newGuest} onChange={(e) => setNewGuest(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addGuest(); }} placeholder="Guest full name" style={{ flex: 1, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
            <button onClick={addGuest} style={btnSolid}>Add</button>
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, minHeight: 36, borderRadius: 10, padding: dragId ? 6 : 0, border: dragId ? `1px dashed ${primary}` : "none" }}
          onDragOver={(e) => { if (dragId) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (dragId) seatPatch(dragId, null, null); setDragId(null); }}>
          {guests.length === 0 ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>No guests yet — add them here or in the Guest List.</span> : guests.map((g) => {
            const placed = !!g.seat_table_id;
            const isSel = selected === g.id;
            return (
              <button key={g.id} draggable onDragStart={() => setDragId(g.id)} onClick={() => setSelected(isSel ? null : g.id)}
                style={{ fontSize: 12.5, borderRadius: 10, padding: "7px 12px", cursor: "grab", textDecoration: placed ? "line-through" : "none",
                  border: isSel ? `2px solid ${primary}` : "1px solid rgba(0,0,0,0.12)", background: isSel ? `${primary}14` : "#fff", color: placed ? "#a8a29e" : "#1c1917", fontWeight: isSel ? 700 : 500 }}>
                {g.full_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tables */}
      {tables.length === 0 ? (
        <div style={{ ...card, padding: 28, textAlign: "center" }}>
          <div style={{ ...serif, fontSize: 18, color: "#1c1917" }}>No tables yet</div>
          <p style={{ color: "#57534e", fontSize: 13, margin: "6px 0 16px" }}>Add your own tables, or start from the tables your venue already offers.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => setShowTableModal(true)} style={btnSolid}>+ Add a table</button>
            <button onClick={importVenue} style={btnSoft}>Use my venue&apos;s tables</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>{tables.map((t) => tableCard(t))}</div>
      )}

      {/* Add Table modal */}
      {showTableModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowTableModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 26, width: "min(440px,100%)" }}>
            <h3 style={{ ...serif, fontSize: 22, margin: "0 0 16px" }}>Add Table</h3>
            <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#a8a29e", fontWeight: 700 }}>Table name</label>
            <input autoFocus value={tForm.name} onChange={(e) => setTForm({ ...tForm, name: e.target.value })} placeholder="e.g. Bridal Table, Table 1, Family Table" style={{ width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, margin: "6px 0 14px" }} />
            <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#a8a29e", fontWeight: 700 }}>Shape</label>
            <select value={tForm.shape} onChange={(e) => setTForm({ ...tForm, shape: e.target.value })} style={{ width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, margin: "6px 0 14px" }}>
              <option value="long">Long Table (seats both sides + optional ends)</option>
              <option value="horseshoe">Horseshoe / U-Shape (three sides, open end)</option>
              <option value="individual">Individual Table (seats all four sides)</option>
            </select>
            <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#a8a29e", fontWeight: 700 }}>Number of seats</label>
            <input type="number" min={1} max={40} value={tForm.seats} onChange={(e) => setTForm({ ...tForm, seats: Number(e.target.value) })} style={{ width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, margin: "6px 0 14px" }} />
            {tForm.shape === "long" && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#57534e", textTransform: "uppercase", letterSpacing: 0.5 }}>
                <input type="checkbox" checked={tForm.include_ends} onChange={(e) => setTForm({ ...tForm, include_ends: e.target.checked })} /> Include end seats (head &amp; foot positions)
              </label>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowTableModal(false)} style={{ ...btnSoft }}>Cancel</button>
              <button onClick={addTable} disabled={!tForm.name.trim()} style={{ ...btnSolid, opacity: tForm.name.trim() ? 1 : 0.5 }}>Add table</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
