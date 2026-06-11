"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// group: the area's venue-named sub-category (Included or Extra; venue or
// offsite). Null when the venue hasn't grouped this area. seasonName: the name of
// the season whose wedding-day price is being shown (for a "Peak season price"
// note), null when the venue has no named seasons.
export type AreaGroup = { id: string; name: string; included: boolean; location: "venue" | "offsite" };
export type AreaItem = {
  id: string; name: string; description: string | null; kind: string; img: string | null;
  prices: Record<string, number>;
  group?: AreaGroup | null;
  seasonName?: string | null;
};
const DAY_LABEL: Record<string, string> = { wedding: "Wedding", mg: "M&G", farewell: "Farewell" };
const DAY_ORDER = ["mg", "wedding", "farewell"];
const rZA = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;
const DEFAULT_GROUP_KEY = "__ungrouped__";

// Couple-facing venue spaces, grouped by the venue's sub-categories. Each group
// is Included (shown for info) or Extra (selectable per day-type, flowing into
// the running total via weddings.area_selections); offsite groups are flagged
// "Outside the venue". Areas with no group fall under a default heading whose
// Included/Extra split mirrors the legacy area_kind === "main" behaviour.
export function SpacesSection({ slug, areas, initialSelections, primary, accent, heading, cardRadius }: {
  slug: string; areas: AreaItem[]; initialSelections: Array<{ area_id: string; day_type: string }>;
  primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set(initialSelections.map((s) => `${s.area_id}:${s.day_type}`)));
  const [busy, setBusy] = useState(false);
  if (areas.length === 0) return null;

  // Group areas by their venue-named sub-category. Areas with no group land in a
  // default group whose Included/Extra split mirrors the legacy area_kind.
  type RenderGroup = { key: string; name: string; included: boolean; offsite: boolean; areas: AreaItem[]; sort: number };
  const groupMap = new Map<string, RenderGroup>();
  areas.forEach((a, i) => {
    const g = a.group ?? null;
    const key = g?.id ?? DEFAULT_GROUP_KEY;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        name: g?.name ?? "Spaces",
        // Ungrouped areas keep the legacy rule: area_kind "main" = included.
        included: g ? g.included : a.kind === "main",
        offsite: g?.location === "offsite",
        areas: [],
        sort: g ? i : Number.MAX_SAFE_INTEGER, // default group renders last
      });
    }
    groupMap.get(key)!.areas.push(a);
  });
  const groups = Array.from(groupMap.values()).sort((x, y) => x.sort - y.sort);

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

  function areaCard(a: AreaItem, included: boolean) {
    const selectable = !included;
    const days = DAY_ORDER.filter((d) => (a.prices[d] ?? 0) > 0);
    // Note the season the wedding-day price belongs to, e.g. "Peak season price".
    const weddingSeasonNote = selectable && a.seasonName && (a.prices.wedding ?? 0) > 0
      ? `${a.seasonName} season price`
      : null;
    return (
      <div key={a.id} style={card}>
        {a.img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={a.img} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
          : <div style={{ height: 120, background: `${accent}22` }} />}
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...heading, fontWeight: 700 }}>{a.name}</span>
            {included && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#1a7f4b", background: "#e7f4ec", borderRadius: 999, padding: "2px 8px" }}>Included</span>}
          </div>
          {a.description && <div style={{ fontSize: 12.5, color: "#57534e", marginTop: 4 }}>{a.description}</div>}
          {selectable && (
            days.length === 0
              ? <div style={{ fontSize: 12, color: "#8a8a8a", marginTop: 8 }}>Ask {`your venue`} for pricing.</div>
              : <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {days.map((d) => {
                      const on = sel.has(`${a.id}:${d}`);
                      return (
                        <button key={d} onClick={() => toggle(a.id, d)} disabled={busy} style={{ border: `1px solid ${on ? primary : "rgba(0,0,0,0.15)"}`, background: on ? primary : "#fff", color: on ? "#fff" : "#44403c", borderRadius: 999, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {on ? "✓ " : "+ "}{DAY_LABEL[d]} · {rZA(a.prices[d])}
                        </button>
                      );
                    })}
                  </div>
                  {weddingSeasonNote && <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 6 }}>{weddingSeasonNote}</div>}
                </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 26 }}>
      <h2 style={{ ...heading, fontSize: 22, marginBottom: 4 }}>Spaces</h2>
      <p style={{ color: "#57534e", fontSize: 13, marginBottom: 14 }}>The areas you can use across your day — included spaces and optional paid extras.</p>
      {groups.map((g, gi) => (
        <div key={g.key} style={{ marginBottom: gi < groups.length - 1 ? 22 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#a8a29e", fontWeight: 700 }}>{g.name}</span>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: g.included ? "#1a7f4b" : "#9a6a00", background: g.included ? "#e7f4ec" : "#fdf1dc", borderRadius: 999, padding: "2px 8px" }}>{g.included ? "Included" : "Extra"}</span>
            {g.offsite && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#57534e", background: "#efeae4", borderRadius: 999, padding: "2px 8px" }}>Outside the venue</span>}
          </div>
          <div style={grid}>{g.areas.map((a) => areaCard(a, g.included))}</div>
        </div>
      ))}
    </div>
  );
}
