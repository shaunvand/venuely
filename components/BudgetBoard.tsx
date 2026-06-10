"use client";

import { useEffect, useState } from "react";

type Line = { id: string; category: string | null; description: string | null; estimated: number | null; actual: number | null; paid: number | null; due_date: string | null };
const serif: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif" };
const CATEGORIES = ["Venue", "Catering", "Beverages", "Flowers", "Photography", "Attire", "Music", "Décor", "Cake", "Stationery", "Beauty", "Transport", "Other"];
const rZA = (n: number | string | null | undefined) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;
const num = (v: string) => (v === "" ? null : Number(v.replace(/[^\d.]/g, "")) || 0);

// Couple budget dashboard: estimated vs spent vs paid, by category. Separate from
// the venue invoice (shown as a reference). Backed by /list/budget.
export function BudgetBoard({ slug, totalDue, primary, accent, heading, cardRadius }: {
  slug: string; totalDue: number; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ category: "Venue", description: "", estimated: "", actual: "", paid: "" });

  function load() { return fetch(`/api/wedding/${slug}/list/budget`).then((r) => r.json()).then((j) => setLines((j.rows ?? []) as Line[])); }
  useEffect(() => { load().finally(() => setLoading(false)); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(id: string, p: Partial<Line>) {
    setLines((ls) => ls.map((x) => x.id === id ? { ...x, ...p } : x));
    await fetch(`/api/wedding/${slug}/list/budget`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...p }) });
  }
  async function remove(id: string) {
    setLines((ls) => ls.filter((x) => x.id !== id));
    await fetch(`/api/wedding/${slug}/list/budget`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  }
  async function add() {
    if (!draft.description.trim() && !draft.estimated) return;
    const body = { category: draft.category, description: draft.description, estimated: num(draft.estimated), actual: num(draft.actual), paid: num(draft.paid) };
    const r = await fetch(`/api/wedding/${slug}/list/budget`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); if (j.ok) { setLines((ls) => [...ls, j.row]); setDraft({ category: draft.category, description: "", estimated: "", actual: "", paid: "" }); }
  }

  const sum = (k: "estimated" | "actual" | "paid") => lines.reduce((t, l) => t + Number(l[k] || 0), 0);
  const est = sum("estimated"), act = sum("actual"), paid = sum("paid");
  const outstanding = Math.max(0, (act || est) - paid);

  const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius };
  const input: React.CSSProperties = { border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "7px 9px", fontSize: 13 };
  const cats = Array.from(new Set(lines.map((l) => l.category || "Other")));
  const stat = (label: string, v: string, color?: string) => <div style={{ ...card, padding: "14px 16px" }}><div style={{ ...serif, fontSize: 23, color: color || "#1c1917" }}>{v}</div><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#8a8a8a" }}>{label}</div></div>;

  if (loading) return <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading your budget…</span>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Your <span style={{ ...serif, fontStyle: "italic" }}>Budget</span></h2>
        <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Track your own spend across everything — separate from the venue invoice.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        {stat("Estimated", rZA(est))}
        {stat("Spent", rZA(act))}
        {stat("Paid", rZA(paid), "#1a7f4b")}
        {stat("Outstanding", rZA(outstanding), primary)}
      </div>
      {totalDue > 0 && <div style={{ fontSize: 12, color: "#8a8a8a" }}>For reference, your current venue invoice is <b style={{ color: primary }}>{rZA(totalDue)}</b> — add it as a budget line if you&apos;d like it counted here.</div>}

      {/* Add line */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ ...serif, fontSize: 16, marginBottom: 8 }}>Add a budget line</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ ...input, minWidth: 130 }}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <input style={{ ...input, flex: "2 1 160px" }} placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <input style={{ ...input, width: 110 }} placeholder="Estimated R" value={draft.estimated} onChange={(e) => setDraft({ ...draft, estimated: e.target.value })} />
          <input style={{ ...input, width: 100 }} placeholder="Spent R" value={draft.actual} onChange={(e) => setDraft({ ...draft, actual: e.target.value })} />
          <input style={{ ...input, width: 100 }} placeholder="Paid R" value={draft.paid} onChange={(e) => setDraft({ ...draft, paid: e.target.value })} />
          <button onClick={add} style={{ background: primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>+ Add</button>
        </div>
      </div>

      {/* Lines by category */}
      {lines.length === 0 ? (
        <div style={{ ...card, padding: 24, textAlign: "center", color: "#8a8a8a", fontSize: 13 }}>No budget lines yet — add your first above.</div>
      ) : cats.map((cat) => {
        const items = lines.filter((l) => (l.category || "Other") === cat);
        const cEst = items.reduce((t, l) => t + Number(l.estimated || 0), 0);
        return (
          <div key={cat} style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, color: "#a8a29e", fontWeight: 700 }}>{cat}</span>
              <span style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
              <span style={{ fontSize: 12, color: "#8a8a8a" }}>{rZA(cEst)} est.</span>
            </div>
            {items.map((l) => {
              const settled = Number(l.paid || 0) >= Number(l.actual || l.estimated || 0) && Number(l.actual || l.estimated || 0) > 0;
              return (
                <div key={l.id} style={{ ...card, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "9px 12px" }}>
                  <input style={{ ...input, flex: "2 1 150px", border: "none", fontWeight: 600 }} defaultValue={l.description ?? ""} onBlur={(e) => { if (e.target.value !== (l.description ?? "")) patch(l.id, { description: e.target.value }); }} placeholder="Description" />
                  <label style={{ fontSize: 10.5, color: "#8a8a8a" }}>Est <input style={{ ...input, width: 90, padding: "5px 7px" }} defaultValue={l.estimated ?? ""} onBlur={(e) => patch(l.id, { estimated: num(e.target.value) })} /></label>
                  <label style={{ fontSize: 10.5, color: "#8a8a8a" }}>Spent <input style={{ ...input, width: 90, padding: "5px 7px" }} defaultValue={l.actual ?? ""} onBlur={(e) => patch(l.id, { actual: num(e.target.value) })} /></label>
                  <label style={{ fontSize: 10.5, color: "#8a8a8a" }}>Paid <input style={{ ...input, width: 90, padding: "5px 7px" }} defaultValue={l.paid ?? ""} onBlur={(e) => patch(l.id, { paid: num(e.target.value) })} /></label>
                  {settled ? <span style={{ fontSize: 10.5, color: "#1a7f4b", fontWeight: 700, textTransform: "uppercase" }}>✓ Paid</span> : <span style={{ width: 44 }} />}
                  <button onClick={() => remove(l.id)} title="Remove" style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#c0b9b1", cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
