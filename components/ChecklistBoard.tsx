"use client";

import { useEffect, useState } from "react";

type Task = { id: string; title: string; done: boolean | null; phase: string | null; sort_order: number | null };

// Phase order — tasks without a known phase fall into "Other".
const PHASES = ["12+ Months Before", "9–12 Months Before", "6–9 Months Before", "3–6 Months Before", "1–3 Months Before", "Final Week", "Other"];
const serif: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif" };

// Couple wedding checklist, grouped by time-to-go phase, in the Venuely look.
// Seeds the standard ~30 tasks on first open; couples tick, delete, and add per phase.
export function ChecklistBoard({ slug, primary, accent, heading, cardRadius }: {
  slug: string; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function load() { return fetch(`/api/wedding/${slug}/list/checklist`).then((r) => r.json()).then((j) => (j.rows ?? []) as Task[]); }
  useEffect(() => {
    (async () => {
      let rows = await load();
      if (rows.length === 0) { await fetch(`/api/wedding/${slug}/checklist/seed`, { method: "POST" }); rows = await load(); }
      setTasks(rows); setLoading(false);
    })().catch(() => setLoading(false));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(t: Task) {
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, done: !x.done } : x));
    await fetch(`/api/wedding/${slug}/list/checklist`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: t.id, done: !t.done }) });
  }
  async function remove(id: string) {
    setTasks((ts) => ts.filter((x) => x.id !== id));
    await fetch(`/api/wedding/${slug}/list/checklist`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  }
  async function add(phase: string) {
    const title = (drafts[phase] || "").trim(); if (!title) return;
    setDrafts((d) => ({ ...d, [phase]: "" }));
    const order = (tasks.reduce((m, t) => Math.max(m, t.sort_order ?? 0), 0)) + 1;
    const r = await fetch(`/api/wedding/${slug}/list/checklist`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, phase, done: false, sort_order: order }) });
    const j = await r.json();
    if (j.ok) setTasks((ts) => [...ts, j.row]);
  }

  const done = tasks.filter((t) => t.done).length;
  const byPhase = (p: string) => tasks.filter((t) => (t.phase || "Other") === p).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const phasesShown = PHASES.filter((p) => p === "Other" ? byPhase("Other").length > 0 : true);

  const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 };

  if (loading) return <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading your checklist…</span>;

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Wedding <span style={{ ...serif, fontStyle: "italic" }}>Checklist</span></h2>
        <span style={{ ...serif, fontStyle: "italic", fontSize: 13.5, color: "#8a8a8a" }}>{done} of {tasks.length} tasks complete</span>
      </div>

      {phasesShown.map((phase) => {
        const items = byPhase(phase);
        return (
          <div key={phase} style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, color: "#a8a29e", fontWeight: 700, whiteSpace: "nowrap" }}>{phase}</span>
              <span style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
            </div>

            {items.map((t) => (
              <div key={t.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "11px 14px" }}>
                <button onClick={() => toggle(t)} aria-label={t.done ? "Mark not done" : "Mark done"} style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 5, cursor: "pointer", border: `1.5px solid ${t.done ? primary : "rgba(0,0,0,0.25)"}`, background: t.done ? primary : "#fff", color: "#fff", fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.done ? "✓" : ""}</button>
                <span style={{ flex: 1, fontSize: 13.5, color: t.done ? "#a8a29e" : "#1c1917", textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
                <button onClick={() => remove(t.id)} title="Remove" style={{ border: "none", background: "transparent", color: "#c0b9b1", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, alignItems: "center", border: "1px dashed rgba(0,0,0,0.18)", borderRadius: 12, padding: "6px 8px 6px 14px" }}>
              <input value={drafts[phase] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [phase]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") add(phase); }} placeholder="Add a task…" style={{ flex: 1, border: "none", background: "transparent", fontSize: 13.5, outline: "none" }} />
              <button onClick={() => add(phase)} style={{ background: `${accent}33`, color: "#57534e", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 11.5, fontWeight: 700, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" }}>Add</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
