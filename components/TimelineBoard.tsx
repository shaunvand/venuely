"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; start_time: string | null; title: string; notes: string | null; location: string | null; event_date: string | null; sort_order: number | null };
const serif: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif" };

// Build the inclusive list of YYYY-MM-DD strings from start..end.
function dayRange(start: string | null, end: string | null): string[] {
  if (!start) return [];
  const s = start.slice(0, 10);
  const e = (end || start).slice(0, 10);
  const out: string[] = [];
  const [sy, sm, sd] = s.split("-").map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const endT = new Date(`${e}T00:00:00Z`).getTime();
  let guard = 0;
  while (cur.getTime() <= endT && guard < 31) { out.push(cur.toISOString().slice(0, 10)); cur.setUTCDate(cur.getUTCDate() + 1); guard++; }
  return out.length ? out : [s];
}
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });

// Per-day wedding timeline. Days come from the wedding's booked dates (1..several).
// Seeds a day-of guide on first open; couples add / edit / remove freely.
export function TimelineBoard({ slug, weddingDate, weddingEndDate, primary, accent, heading, cardRadius }: {
  slug: string; weddingDate: string | null; weddingEndDate: string | null; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const days = dayRange(weddingDate, weddingEndDate);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(days[0] ?? "");
  const [draft, setDraft] = useState({ start_time: "", title: "", notes: "" });

  function load() { return fetch(`/api/wedding/${slug}/list/timeline`).then((r) => r.json()).then((j) => (j.rows ?? []) as Entry[]); }
  useEffect(() => {
    (async () => {
      let rows = await load();
      if (rows.length === 0) { await fetch(`/api/wedding/${slug}/timeline/seed`, { method: "POST" }); rows = await load(); }
      setEntries(rows); setLoading(false);
    })().catch(() => setLoading(false));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(id: string, p: Partial<Entry>) {
    setEntries((es) => es.map((x) => x.id === id ? { ...x, ...p } : x));
    await fetch(`/api/wedding/${slug}/list/timeline`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...p }) });
  }
  async function remove(id: string) {
    setEntries((es) => es.filter((x) => x.id !== id));
    await fetch(`/api/wedding/${slug}/list/timeline`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  }
  async function add() {
    if (!draft.title.trim()) return;
    const order = entries.reduce((m, e) => Math.max(m, e.sort_order ?? 0), 0) + 1;
    const r = await fetch(`/api/wedding/${slug}/list/timeline`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, event_date: activeDay || null, sort_order: order }) });
    const j = await r.json();
    if (j.ok) { setEntries((es) => [...es, j.row]); setDraft({ start_time: "", title: "", notes: "" }); }
  }

  // Entries for the active day (entries with no date land on the first day).
  const dayEntries = entries
    .filter((e) => (e.event_date ? e.event_date.slice(0, 10) : days[0]) === activeDay)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "") || (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 };
  const input: React.CSSProperties = { border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "7px 10px", fontSize: 13 };

  if (loading) return <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading your timeline…</span>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Wedding day <span style={{ ...serif, fontStyle: "italic" }}>Timeline</span></h2>
        <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>{days.length > 1 ? `Your celebration runs over ${days.length} days — plan each one.` : "Your run sheet for the day — add, edit and reorder by time."}</div>
      </div>

      {/* Day tabs (multi-day) */}
      {days.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {days.map((d, i) => {
            const active = d === activeDay;
            return <button key={d} onClick={() => setActiveDay(d)} style={{ border: `1px solid ${active ? primary : "rgba(0,0,0,0.15)"}`, background: active ? primary : "#fff", color: active ? "#fff" : "#57534e", borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Day {i + 1} · {dayLabel(d)}</button>;
          })}
        </div>
      )}
      {days.length === 1 && activeDay && <div style={{ ...serif, fontStyle: "italic", color: primary, fontSize: 14 }}>{dayLabel(activeDay)}</div>}
      {days.length === 0 && <div style={{ color: "#8a8a8a", fontSize: 13 }}>Your wedding date isn&apos;t set yet — once your venue confirms it, your day timeline appears here.</div>}

      {/* Timeline rail */}
      <div style={{ ...card, padding: "8px 16px" }}>
        {dayEntries.length === 0 ? <div style={{ color: "#8a8a8a", fontSize: 13, padding: "12px 0" }}>Nothing planned for this day yet — add your first moment below.</div> : dayEntries.map((e, i) => (
          <div key={e.id} style={{ display: "flex", gap: 14, padding: "12px 0", borderTop: i ? "1px solid rgba(0,0,0,0.06)" : "none", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${primary}`, background: "#fff" }} />
              {i < dayEntries.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 28, background: "rgba(0,0,0,0.1)", marginTop: 4 }} />}
            </div>
            {/* Commit on blur (one PATCH per edit), not per keystroke. */}
            <input defaultValue={e.start_time ?? ""} onBlur={(ev) => { if (ev.target.value !== (e.start_time ?? "")) patch(e.id, { start_time: ev.target.value }); }} placeholder="13:00" style={{ ...input, width: 72, fontWeight: 700, color: primary }} />
            <div style={{ flex: 1, display: "grid", gap: 4 }}>
              <input defaultValue={e.title} onBlur={(ev) => { if (ev.target.value !== e.title) patch(e.id, { title: ev.target.value }); }} placeholder="What's happening" style={{ ...input, border: "none", padding: "2px 0", ...serif, fontSize: 15, fontWeight: 600 }} />
              <input defaultValue={e.notes ?? ""} onBlur={(ev) => { if (ev.target.value !== (e.notes ?? "")) patch(e.id, { notes: ev.target.value }); }} placeholder="Add a detail (optional)" style={{ ...input, border: "none", padding: "2px 0", fontSize: 12.5, color: "#57534e" }} />
            </div>
            <button onClick={() => remove(e.id)} title="Remove" style={{ border: "none", background: "transparent", color: "#c0b9b1", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Add */}
      {days.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", border: "1px dashed rgba(0,0,0,0.18)", borderRadius: 12, padding: "8px 10px", flexWrap: "wrap" }}>
          <input value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} placeholder="Time" style={{ ...input, width: 80 }} />
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Add a moment…" style={{ ...input, flex: "2 1 180px" }} />
          <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Detail (optional)" style={{ ...input, flex: "1 1 140px" }} />
          <button onClick={add} disabled={!draft.title.trim()} style={{ background: primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: draft.title.trim() ? 1 : 0.5 }}>+ Add</button>
        </div>
      )}
    </div>
  );
}
