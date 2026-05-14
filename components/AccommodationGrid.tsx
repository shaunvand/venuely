"use client";

import { useMemo, useState, useTransition } from "react";

type Room = {
  id: string;
  name: string;
  tier: string | null;
  room_type: string | null;
  sleeps: number;
  ideal_sleeps: number | null;
  max_sleeps: number | null;
  price_per_night: number;
  description: string | null;
  image_url: string | null;
  hero_image_url: string | null;
  floor_plan_url: string | null;
  amenities: string[] | null;
  bridal_suite: boolean | null;
  gallery: Array<{ url: string; kind: string; label: string | null }>;
};

const TIER_LABEL: Record<string, string> = {
  standard: "Standard",
  exclusive: "Exclusive",
  family: "Family Lodge",
  africamps: "Africamps",
  farmhouse: "Farmhouse",
  custom: "Other",
};

export function AccommodationGrid({
  rooms,
  guests,
  initialAssignments,
  weddingSlug,
}: {
  rooms: Room[];
  guests: string[];
  initialAssignments: Record<string, string[]>;
  weddingSlug: string;
}) {
  const [tier, setTier] = useState<string>("all");
  const [minSleeps, setMinSleeps] = useState(0);
  const [selected, setSelected] = useState<Room | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string[]>>(initialAssignments);
  const [saving, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const tiers = useMemo(() => Array.from(new Set(rooms.map((r) => r.tier).filter(Boolean))) as string[], [rooms]);
  const filtered = useMemo(() => rooms.filter((r) => {
    if (tier !== "all" && r.tier !== tier) return false;
    if (minSleeps && (r.max_sleeps ?? r.sleeps) < minSleeps) return false;
    return true;
  }), [rooms, tier, minSleeps]);

  const occupied = useMemo(() => {
    const out: Record<string, number> = {};
    Object.entries(assignments).forEach(([rid, names]) => { out[rid] = names.length; });
    return out;
  }, [assignments]);

  const assignedGuestSet = useMemo(() => {
    const s = new Set<string>();
    Object.values(assignments).forEach((names) => names.forEach((n) => s.add(n)));
    return s;
  }, [assignments]);
  const unassignedGuests = guests.filter((g) => !assignedGuestSet.has(g));

  const totalCost = useMemo(() =>
    Object.entries(assignments).reduce((sum, [rid, names]) => {
      const r = rooms.find((x) => x.id === rid);
      return sum + (r && names.length ? Number(r.price_per_night) : 0);
    }, 0), [assignments, rooms]);

  function persist(next: Record<string, string[]>) {
    setAssignments(next);
    startSave(async () => {
      try {
        const res = await fetch(`/api/wedding/${weddingSlug}/state`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ patch: { roomAssignments: next } }),
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(`Save failed: ${j.error ?? res.status}`); return; }
        setMsg("✓ Saved");
        setTimeout(() => setMsg(null), 1500);
      } catch (e) {
        setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }

  function assignGuest(roomId: string, guest: string) {
    const next = { ...assignments };
    Object.keys(next).forEach((rid) => { next[rid] = next[rid].filter((g) => g !== guest); });
    next[roomId] = [...(next[roomId] ?? []), guest];
    persist(next);
  }
  function removeGuest(roomId: string, guest: string) {
    const next = { ...assignments, [roomId]: (assignments[roomId] ?? []).filter((g) => g !== guest) };
    persist(next);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setTier("all")} className={`px-3 py-1.5 rounded-full text-sm ${tier === "all" ? "bg-stone-900 text-white" : "bg-white border border-stone-300"}`}>All tiers</button>
          {tiers.map((t) => (
            <button key={t} onClick={() => setTier(t)} className={`px-3 py-1.5 rounded-full text-sm ${tier === t ? "bg-stone-900 text-white" : "bg-white border border-stone-300"}`}>
              {TIER_LABEL[t] ?? t}
            </button>
          ))}
          <select value={minSleeps} onChange={(e) => setMinSleeps(Number(e.target.value))} className="ml-2 border rounded-full px-3 py-1.5 text-sm bg-white">
            <option value={0}>Any size</option>
            <option value={2}>Sleeps 2+</option>
            <option value={4}>Sleeps 4+</option>
            <option value={6}>Sleeps 6+</option>
            <option value={10}>Sleeps 10+</option>
          </select>
          {msg && <span className="text-xs text-stone-600 ml-auto">{msg}</span>}
        </div>

        {!filtered.length ? (
          <div className="rounded-lg border border-stone-200 bg-white p-10 text-center text-stone-500">No rooms match those filters.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((r) => {
              const cover = r.hero_image_url || r.image_url || r.gallery[0]?.url;
              const guests = assignments[r.id] ?? [];
              const cap = r.max_sleeps ?? r.sleeps;
              const overCap = guests.length > cap;
              return (
                <button key={r.id} onClick={() => setSelected(r)}
                  className="text-left bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg transition group">
                  <div className="aspect-[4/3] bg-stone-100 relative overflow-hidden">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">No photo</div>
                    )}
                    {r.bridal_suite && (
                      <div className="absolute top-2 left-2 bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">★ Bridal suite</div>
                    )}
                    {r.tier && (
                      <div className="absolute top-2 right-2 bg-white/95 text-stone-700 text-xs px-2 py-0.5 rounded-full">{TIER_LABEL[r.tier] ?? r.tier}</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-stone-500">Sleeps {r.ideal_sleeps ?? r.sleeps}{r.max_sleeps && r.max_sleeps !== r.ideal_sleeps ? ` (up to ${r.max_sleeps})` : ""}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">R{Number(r.price_per_night).toLocaleString()}</div>
                        <div className="text-xs text-stone-500">/ night</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex gap-1 flex-wrap">
                        {(r.amenities ?? []).slice(0, 3).map((a) => (
                          <span key={a} className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full">{a}</span>
                        ))}
                      </div>
                      <span className={`text-xs ${overCap ? "text-red-600" : "text-stone-500"}`}>
                        {guests.length}/{cap}{overCap ? " over" : ""}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Rooming sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-6 self-start">
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="text-xs uppercase tracking-widest text-stone-500">Rooming summary</div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-stone-500 text-xs">Assigned</div><div className="font-medium">{assignedGuestSet.size} / {guests.length}</div></div>
            <div><div className="text-stone-500 text-xs">Estimated cost</div><div className="font-medium">R{totalCost.toLocaleString()}</div></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">Unassigned guests ({unassignedGuests.length})</div>
          {!unassignedGuests.length ? (
            <p className="text-xs text-stone-500">Everyone has a bed.</p>
          ) : (
            <ul className="space-y-1 text-sm max-h-64 overflow-auto">
              {unassignedGuests.map((g) => (
                <li key={g} className="flex justify-between items-center py-1 border-b border-stone-100 last:border-0">
                  <span>{g}</span>
                  {selected ? (
                    <button onClick={() => assignGuest(selected.id, g)}
                      className="text-xs text-emerald-700 hover:underline">→ {selected.name.split(" ")[0]}</button>
                  ) : (
                    <span className="text-xs text-stone-400">pick a room ↑</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="aspect-[16/9] bg-stone-100 relative">
              {(selected.hero_image_url || selected.image_url || selected.gallery[0]?.url) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={selected.hero_image_url || selected.image_url || selected.gallery[0]?.url} alt="" className="w-full h-full object-cover" />
              ) : <div className="w-full h-full flex items-center justify-center text-stone-300">No photo</div>}
              <button onClick={() => setSelected(null)} className="absolute top-3 right-3 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <h2 className="font-serif text-2xl">{selected.name}</h2>
                  <div className="text-sm text-stone-600 mt-1">
                    {selected.tier && <span className="mr-3">{TIER_LABEL[selected.tier] ?? selected.tier}</span>}
                    Sleeps {selected.ideal_sleeps ?? selected.sleeps}{selected.max_sleeps && selected.max_sleeps !== selected.ideal_sleeps ? ` (up to ${selected.max_sleeps})` : ""}
                    {selected.bridal_suite && <span className="ml-3 text-amber-700">★ Bridal suite</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-2xl">R{Number(selected.price_per_night).toLocaleString()}</div>
                  <div className="text-xs text-stone-500">/ night</div>
                </div>
              </div>

              {selected.description && <p className="text-sm text-stone-700">{selected.description}</p>}

              {selected.amenities && selected.amenities.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Amenities</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {selected.amenities.map((a) => (
                      <span key={a} className="text-xs bg-stone-100 text-stone-700 px-2 py-1 rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.floor_plan_url && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Floor plan</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.floor_plan_url} alt="" className="w-full rounded-lg border border-stone-200" />
                </div>
              )}

              {selected.gallery.length > 1 && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Gallery</div>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.gallery.map((g, i) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img key={i} src={g.url} alt="" className="aspect-[4/3] object-cover rounded-lg" />
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-stone-200 pt-4">
                <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">Assigned guests in this room ({(assignments[selected.id] ?? []).length})</div>
                {(assignments[selected.id] ?? []).length === 0 ? (
                  <p className="text-sm text-stone-500">No guests assigned yet.</p>
                ) : (
                  <ul className="space-y-1 mb-3">
                    {(assignments[selected.id] ?? []).map((g) => (
                      <li key={g} className="flex justify-between items-center text-sm">
                        <span>{g}</span>
                        <button onClick={() => removeGuest(selected.id, g)} className="text-xs text-stone-500 hover:text-red-700">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                {unassignedGuests.length > 0 && (
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Add a guest:</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {unassignedGuests.slice(0, 12).map((g) => (
                        <button key={g} onClick={() => assignGuest(selected.id, g)}
                          className="text-xs bg-white border border-stone-300 rounded-full px-3 py-1 hover:bg-stone-100">+ {g}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {saving && <div className="fixed bottom-4 right-4 bg-stone-900 text-white text-xs px-3 py-2 rounded-full shadow">Saving…</div>}
    </div>
  );
}
