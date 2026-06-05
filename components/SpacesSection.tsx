"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type AreaItem = { id: string; name: string; description: string | null; kind: string; img: string | null; prices: Record<string, number> };
const DAY_LABEL: Record<string, string> = { wedding: "Wedding", mg: "M&G", farewell: "Farewell" };
const DAY_ORDER = ["mg", "wedding", "farewell"];
const rZA = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

// Couple-facing venue spaces. Main areas are included (shown for info); extra/
// overflow areas are selectable per day-type and flow into the running total via
// weddings.area_selections.
export function SpacesSection({ slug, areas, initialSelections, primary, accent, heading, cardRadius }: {
  slug: string; areas: AreaItem[]; initialSelections: Array<{ area_id: string; day_type: string }>;
  primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set(initialSelections.map((s) => `${s.area_id}:${s.day_type}`)));
  const [busy, setBusy] = useState(false);
  if (areas.length === 0) return null;

  const included = areas.filter((a) => a.kind === "main");
  const extras = areas.filter((a) => a.kind !== "main");

  function persist(next: Set<string>) {
    setSel(next);
    setBusy(true);
    const selections = Array.from(next).map((k) => { const [area_id, day_type] = k.split(":"); return { area_id, day_type }; });
    fetch(`/api/wedding/${slug}/areas`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ selections }) })
      .finally(() => { startTransition(() => router.refresh()); setBusy(false); });
  }
  function toggle(areaId: string, day: string) {
    const k = `${areaId}:${day}`;
    const next = new Set(sel);
    if (next.has(k)) next.delete(k); else next.add(k);
    persist(next);
  }

  const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, overflow: "hidden" };
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 };

  function areaCard(a: AreaItem, selectable: boolean) {
    const days = DAY_ORDER.filter((d) => (a.prices[d] ?? 0) > 0);
    return (
      <div key={a.id} style={card}>
        {a.img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={a.img} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
          : <div style={{ height: 120, background: `${accent}22` }} />}
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...heading, fontWeight: 700 }}>{a.name}</span>
            {!selectable && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#1a7f4b", background: "#e7f4ec", borderRadius: 999, padding: "2px 8px" }}>Included</span>}
          </div>
          {a.description && <div style={{ fontSize: 12.5, color: "#57534e", marginTop: 4 }}>{a.description}</div>}
          {selectable && (
            days.length === 0
              ? <div style={{ fontSize: 12, color: "#8a8a8a", marginTop: 8 }}>Ask {`your venue`} for pricing.</div>
              : <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {days.map((d) => {
                    const on = sel.has(`${a.id}:${d}`);
                    return (
                      <button key={d} onClick={() => toggle(a.id, d)} disabled={busy} style={{ border: `1px solid ${on ? primary : "rgba(0,0,0,0.15)"}`, background: on ? primary : "#fff", color: on ? "#fff" : "#44403c", borderRadius: 999, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {on ? "✓ " : "+ "}{DAY_LABEL[d]} · {rZA(a.prices[d])}
                      </button>
                    );
                  })}
                </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 26 }}>
      <h2 style={{ ...heading, fontSize: 22, marginBottom: 4 }}>Spaces</h2>
      <p style={{ color: "#57534e", fontSize: 13, marginBottom: 14 }}>The areas you can use across your day — included spaces and optional paid extras.</p>
      {included.length > 0 && <div style={{ ...grid, marginBottom: extras.length ? 18 : 0 }}>{included.map((a) => areaCard(a, false))}</div>}
      {extras.length > 0 && (
        <>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#a8a29e", fontWeight: 700, marginBottom: 8 }}>Optional extras — pick the days you want</div>
          <div style={grid}>{extras.map((a) => areaCard(a, true))}</div>
        </>
      )}
    </div>
  );
}
