"use client";

import { useEffect, useRef, useState } from "react";

export type Guest = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  rsvp_status: string | null;
  table_number: number | null;
  room_id: string | null;
  dietary: string | null;
  accessibility_needs: string | null;
  plus_one: boolean | null;
  is_child: boolean | null;
  side: string | null;
  notes: string | null;
};

type Room = { id: string; name: string };

const RSVP = [
  { v: "pending", label: "Pending", color: "#8a8a8a" },
  { v: "attending", label: "Attending", color: "#1f5d3e" },
  { v: "declined", label: "Declined", color: "#b42318" },
];

export function GuestManager({ slug, primary, accent, heading, cardRadius, rooms = [] }: {
  slug: string; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string; rooms?: Room[];
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [draft, setDraft] = useState({ full_name: "", dietary: "", table_number: "", accessibility_needs: "", is_child: false });
  const fileRef = useRef<HTMLInputElement>(null);

  function load() { return fetch(`/api/wedding/${slug}/guests`).then((r) => r.json()).then((j) => setGuests(j.guests ?? [])); }
  useEffect(() => { load().finally(() => setLoading(false)); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function importFile(f: File | null) {
    if (!f) return;
    setImporting(true); setImportMsg("");
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch(`/api/wedding/${slug}/guests/import`, { method: "POST", body: fd });
    const j = await r.json();
    setImporting(false);
    if (j.ok) { setImportMsg(`✓ Imported ${j.imported} guests`); await load(); } else setImportMsg(j.error || "Import failed");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function addGuest() {
    if (!draft.full_name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/wedding/${slug}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const j = await res.json();
      if (res.ok) { setGuests((g) => [...g, j.guest]); setDraft({ full_name: "", dietary: "", table_number: "", accessibility_needs: "", is_child: false }); }
    } finally { setBusy(false); }
  }
  async function patch(id: string, patchObj: Partial<Guest>) {
    setGuests((g) => g.map((x) => x.id === id ? { ...x, ...patchObj } : x));
    await fetch(`/api/wedding/${slug}/guests`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...patchObj }) });
  }
  async function remove(id: string) {
    setGuests((g) => g.filter((x) => x.id !== id));
    await fetch(`/api/wedding/${slug}/guests`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  }

  const counts = {
    total: guests.length,
    attending: guests.filter((g) => g.rsvp_status === "attending").length,
    pending: guests.filter((g) => (g.rsvp_status ?? "pending") === "pending").length,
    declined: guests.filter((g) => g.rsvp_status === "declined").length,
    dietary: guests.filter((g) => (g.dietary ?? "").trim()).length,
    access: guests.filter((g) => (g.accessibility_needs ?? "").trim()).length,
  };
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, ...extra });
  const input: React.CSSProperties = { border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "7px 10px", fontSize: 13 };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Guest list</h2>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        {[["Total", counts.total], ["Attending", counts.attending], ["Pending", counts.pending], ["Declined", counts.declined], ["Dietary", counts.dietary], ["Accessibility", counts.access]].map(([l, n]) => (
          <div key={l as string} style={{ background: `${accent}2e`, borderRadius: 12, padding: 12, textAlign: "center" }}>
            <div style={{ ...heading, fontSize: 22, color: primary }}>{n as number}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#57534e" }}>{l as string}</div>
          </div>
        ))}
      </div>

      {/* Add */}
      <div style={card({ padding: 14 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ ...heading, fontSize: 16 }}>Add guests</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => importFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={importing} style={{ border: `1px solid ${primary}`, background: "#fff", color: primary, borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{importing ? "Importing…" : "⬆ Bulk add (Excel/CSV)"}</button>
            {importMsg && <span style={{ fontSize: 12, color: importMsg.startsWith("✓") ? "#1a7f4b" : "#b42318" }}>{importMsg}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...input, flex: "2 1 180px" }} placeholder="Full name" value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addGuest(); }} />
          <input style={{ ...input, flex: "1 1 120px" }} placeholder="Dietary (e.g. vegan, halal)" value={draft.dietary} onChange={(e) => setDraft({ ...draft, dietary: e.target.value })} />
          <input style={{ ...input, width: 90 }} placeholder="Table #" value={draft.table_number} onChange={(e) => setDraft({ ...draft, table_number: e.target.value })} />
          <label style={{ fontSize: 12, color: "#57534e", display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={draft.is_child} onChange={(e) => setDraft({ ...draft, is_child: e.target.checked })} /> Child
          </label>
          <button onClick={addGuest} disabled={busy || !draft.full_name.trim()} style={{ background: primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: busy || !draft.full_name.trim() ? 0.5 : 1 }}>+ Add</button>
        </div>
      </div>

      {/* List */}
      {loading ? <div style={{ color: "#8a8a8a", padding: 16 }}>Loading…</div> : guests.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#8a8a8a", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12 }}>No guests yet — add your first above.</div>
      ) : (
        <div style={card({ overflow: "hidden" })}>
          {guests.map((g, i) => (
            <div key={g.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderTop: i ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
              <input style={{ ...input, flex: "2 1 160px", border: "none", fontWeight: 600 }} value={g.full_name} onChange={(e) => patch(g.id, { full_name: e.target.value })} />
              <select value={g.rsvp_status ?? "pending"} onChange={(e) => patch(g.id, { rsvp_status: e.target.value })} style={{ ...input, color: RSVP.find((r) => r.v === (g.rsvp_status ?? "pending"))?.color }}>
                {RSVP.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
              </select>
              <input style={{ ...input, flex: "1 1 110px" }} placeholder="Dietary" value={g.dietary ?? ""} onChange={(e) => patch(g.id, { dietary: e.target.value })} />
              <input style={{ ...input, width: 70 }} placeholder="Table" value={g.table_number ?? ""} onChange={(e) => patch(g.id, { table_number: e.target.value === "" ? null : Number(e.target.value) })} />
              {rooms.length > 0 && (
                <select value={g.room_id ?? ""} onChange={(e) => patch(g.id, { room_id: e.target.value || null })} title="Accommodation" style={{ ...input, maxWidth: 130 }}>
                  <option value="">No room</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
              <input style={{ ...input, flex: "1 1 120px" }} placeholder="Accessibility" value={g.accessibility_needs ?? ""} onChange={(e) => patch(g.id, { accessibility_needs: e.target.value })} />
              {g.is_child && <span style={{ fontSize: 10, background: `${accent}40`, color: "#5a4", padding: "2px 8px", borderRadius: 999 }}>Child</span>}
              <button onClick={() => remove(g.id)} title="Remove" style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#b42318", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: "#8a8a8a" }}>🔒 You control your guests&apos; details (POPIA). Only your venue sees them, for catering &amp; seating.</p>
    </div>
  );
}
