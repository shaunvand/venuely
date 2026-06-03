"use client";

import { useEffect, useState } from "react";

export type ListField = { key: string; label: string; type?: "text" | "select" | "checkbox"; options?: string[]; grow?: number; width?: number };
type Row = { id: string } & Record<string, unknown>;

// Generic couple-managed list (timeline / contacts / songs). Fetches + CRUD via
// /api/wedding/<slug>/list/<kind>; renders an add row + an editable list driven
// by the `fields` config.
export function ListManager({
  slug, kind, title, sub, fields, primary, accent, heading, cardRadius,
}: {
  slug: string; kind: string; title: string; sub?: string;
  fields: ListField[];
  primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? false : ""]));
  const [draft, setDraft] = useState<Record<string, unknown>>(blank());

  useEffect(() => {
    fetch(`/api/wedding/${slug}/list/${kind}`).then((r) => r.json()).then((j) => { setRows(j.rows ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, [slug, kind]);

  const nameKey = fields.find((f) => f.key === "title" || f.key === "name")?.key ?? fields[0].key;

  async function add() {
    if (!String(draft[nameKey] ?? "").trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/wedding/${slug}/list/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const j = await res.json();
      if (res.ok) { setRows((r) => [...r, j.row]); setDraft(blank()); }
    } finally { setBusy(false); }
  }
  async function patch(id: string, p: Record<string, unknown>) {
    setRows((r) => r.map((x) => x.id === id ? { ...x, ...p } : x));
    await fetch(`/api/wedding/${slug}/list/${kind}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...p }) });
  }
  async function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    await fetch(`/api/wedding/${slug}/list/${kind}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  }

  const input: React.CSSProperties = { border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "7px 10px", fontSize: 13 };
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, ...extra });

  function fieldInput(f: ListField, value: unknown, onChange: (v: unknown) => void) {
    const style = { ...input, flex: `${f.grow ?? 1} 1 ${f.width ?? 120}px`, width: f.width };
    if (f.type === "checkbox") return <label style={{ fontSize: 12, color: "#57534e", display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}</label>;
    if (f.type === "select") return <select style={style} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}><option value="">{f.label}…</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</select>;
    return <input style={style} placeholder={f.label} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div><h2 style={{ ...heading, fontSize: 26, margin: 0 }}>{title}</h2>{sub && <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>{sub}</div>}</div>

      <div style={card({ padding: 14 })}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {fields.map((f) => <span key={f.key} style={{ flex: `${f.grow ?? 1} 1 ${f.width ?? 120}px` }}>{fieldInput(f, draft[f.key], (v) => setDraft({ ...draft, [f.key]: v }))}</span>)}
          <button onClick={add} disabled={busy || !String(draft[nameKey] ?? "").trim()} style={{ background: primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: busy || !String(draft[nameKey] ?? "").trim() ? 0.5 : 1 }}>+ Add</button>
        </div>
      </div>

      {loading ? <div style={{ color: "#8a8a8a", padding: 16 }}>Loading…</div> : rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#8a8a8a", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12 }}>Nothing here yet — add your first above.</div>
      ) : (
        <div style={card({ overflow: "hidden" })}>
          {rows.map((row, i) => (
            <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderTop: i ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
              {fields.map((f) => <span key={f.key} style={{ flex: `${f.grow ?? 1} 1 ${f.width ?? 120}px` }}>{fieldInput(f, row[f.key], (v) => patch(row.id, { [f.key]: v }))}</span>)}
              <button onClick={() => remove(row.id)} title="Remove" style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#b42318", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
