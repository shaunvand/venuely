import type { SupabaseClient } from "@supabase/supabase-js";

// Per-wedding planning progress + health, computed from data the platform
// already holds. Six equally-weighted signals; checklist contributes its
// done-fraction rather than all-or-nothing.
//   1. Guest list started          (guests > 0)
//   2. Accommodation assigned      (any guest has a room_id)
//   3. Timeline started            (wedding_timeline rows > 0)
//   4. Menu / selections made      (wedding_selections rows > 0 or area_selections)
//   5. Checklist progress          (done / total)
//   6. Payment received            (any payment_ledger 'in' row)

export type WeddingHealth = "healthy" | "attention" | "risk";

export type WeddingProgress = {
  pct: number; // 0–100
  health: WeddingHealth;
  missing: string[]; // human labels for unmet signals
};

export const HEALTH_LABEL: Record<WeddingHealth, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  risk: "At risk",
};

export const HEALTH_COLOR: Record<WeddingHealth, { bg: string; text: string }> = {
  healthy: { bg: "#dcefe2", text: "#1f5d3e" },
  attention: { bg: "#fdf0d4", text: "#8a6116" },
  risk: { bg: "#fde2dd", text: "#a3210e" },
};

type WeddingLite = { id: string; area_selections?: unknown };

export async function computeWeddingsProgress(
  supabase: SupabaseClient,
  weddings: WeddingLite[],
): Promise<Map<string, WeddingProgress>> {
  const out = new Map<string, WeddingProgress>();
  const ids = weddings.map((w) => w.id);
  if (!ids.length) return out;

  const [guestsRes, timelineRes, selectionsRes, checklistRes, ledgerRes] = await Promise.all([
    supabase.from("guests").select("wedding_id, room_id").in("wedding_id", ids),
    supabase.from("wedding_timeline").select("wedding_id").in("wedding_id", ids),
    supabase.from("wedding_selections").select("wedding_id").in("wedding_id", ids),
    supabase.from("wedding_checklist").select("wedding_id, done").in("wedding_id", ids),
    supabase.from("payment_ledger").select("wedding_id, direction").in("wedding_id", ids),
  ]);

  const guests = new Map<string, { total: number; roomed: number }>();
  for (const g of guestsRes.data ?? []) {
    const k = g.wedding_id as string;
    const e = guests.get(k) ?? { total: 0, roomed: 0 };
    e.total += 1;
    if (g.room_id) e.roomed += 1;
    guests.set(k, e);
  }
  const count = (rows: Array<{ wedding_id: unknown }> | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.wedding_id as string, (m.get(r.wedding_id as string) ?? 0) + 1);
    return m;
  };
  const timeline = count(timelineRes.data);
  const selections = count(selectionsRes.data);
  const checklist = new Map<string, { total: number; done: number }>();
  for (const c of checklistRes.data ?? []) {
    const k = c.wedding_id as string;
    const e = checklist.get(k) ?? { total: 0, done: 0 };
    e.total += 1;
    if (c.done) e.done += 1;
    checklist.set(k, e);
  }
  const paid = new Map<string, boolean>();
  for (const p of ledgerRes.data ?? []) {
    if ((p.direction as string) !== "out") paid.set(p.wedding_id as string, true);
  }

  for (const w of weddings) {
    const g = guests.get(w.id);
    const cl = checklist.get(w.id);
    const areaSel = Array.isArray(w.area_selections) && (w.area_selections as unknown[]).length > 0;

    const signals: Array<{ score: number; label: string }> = [
      { score: g && g.total > 0 ? 1 : 0, label: "Guest list" },
      { score: g && g.roomed > 0 ? 1 : 0, label: "Accommodation" },
      { score: (timeline.get(w.id) ?? 0) > 0 ? 1 : 0, label: "Timeline" },
      { score: (selections.get(w.id) ?? 0) > 0 || areaSel ? 1 : 0, label: "Menu & selections" },
      { score: cl && cl.total > 0 ? cl.done / cl.total : 0, label: "Checklist" },
      { score: paid.get(w.id) ? 1 : 0, label: "Payment" },
    ];

    const pct = Math.round((signals.reduce((s, x) => s + x.score, 0) / signals.length) * 100);
    const missing = signals.filter((s) => s.score < 1).map((s) => s.label);
    const health: WeddingHealth = pct >= 75 ? "healthy" : pct >= 35 ? "attention" : "risk";
    out.set(w.id, { pct, health, missing });
  }
  return out;
}
