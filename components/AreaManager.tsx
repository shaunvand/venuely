"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateArea, updateAreaPrice, toggleAreaActive, deleteArea,
  addAreaImages, deleteAreaImage, assignAreaGroup, saveAllAreaPrices,
} from "@/app/venue/areas/actions";
import { type SeasonRow, type GroupRow, seasonRangeLabel, GroupBadges } from "@/components/SeasonsManager";

export type AreaImage = { id: string; url: string };
export type GalleryPhoto = { url: string; label?: string | null; category?: string | null };
export type AreaPriceRowLite = { day_type: string; price: number; season_id: string | null };
export type AreaRow = {
  id: string;
  name: string;
  area_kind: string;
  description: string | null;
  active: boolean;
  group_id: string | null;
  priceRows: AreaPriceRowLite[];
  images: AreaImage[];
};

const KIND_LABEL: Record<string, string> = { main: "Main (included)", extra: "Extra (paid)", overflow: "Overflow" };

// Resolve a stored price for a day type + optional season from the flat rows.
function priceFor(rows: AreaPriceRowLite[], dayType: string, seasonId: string | null): number {
  if (dayType === "wedding" && seasonId) {
    const seasonal = rows.find((r) => r.day_type === "wedding" && r.season_id === seasonId);
    if (seasonal) return seasonal.price;
  }
  const fallback = rows.find((r) => r.day_type === dayType && r.season_id == null);
  if (fallback) return fallback.price;
  const any = rows.find((r) => r.day_type === dayType);
  return any?.price ?? 0;
}

export function AreaManager({
  venueId,
  areas,
  gallery,
  seasons,
  groups,
}: {
  venueId: string;
  areas: AreaRow[];
  gallery: GalleryPhoto[];
  seasons: SeasonRow[];
  groups: GroupRow[];
}) {
  if (areas.length === 0) {
    return <div className="vy-empty">No areas yet. Add Oak Tree, Hall/Lapa, Pool, etc. above.</div>;
  }
  // Group areas by sub-category; "No group" areas land in a trailing bucket.
  const byGroup: { group: GroupRow | null; areas: AreaRow[] }[] = [];
  for (const g of groups) {
    const inGroup = areas.filter((a) => a.group_id === g.id);
    if (inGroup.length) byGroup.push({ group: g, areas: inGroup });
  }
  const ungrouped = areas.filter((a) => !a.group_id || !groups.some((g) => g.id === a.group_id));
  if (ungrouped.length) byGroup.push({ group: null, areas: ungrouped });

  return (
    <div className="space-y-8">
      {byGroup.map(({ group, areas: groupAreas }) => (
        <section key={group?.id ?? "__ungrouped"} className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-serif text-xl" style={{ fontWeight: 700 }}>{group ? group.name : "Ungrouped"}</h2>
            {group ? <GroupBadges group={group} /> : (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: "var(--bone)", color: "var(--ink-2)" }}>No sub-category</span>
            )}
          </div>
          {groupAreas.map((a) => (
            <AreaCard key={a.id} venueId={venueId} area={a} gallery={gallery} seasons={seasons} groups={groups} />
          ))}
        </section>
      ))}
    </div>
  );
}

// Sticky bottom bar that commits every price field on the page in one click,
// so the venue doesn't have to press each per-field "Save", then lets them move
// on to the next setup step.
export function AreaSaveBar({ nextHref = "/venue/seating", nextLabel = "Seating & tables" }: { nextHref?: string; nextLabel?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function saveAll() {
    setErr(null);
    setSaved(false);
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-area-price]"));
    const items = inputs.map((el) => ({
      areaId: el.dataset.areaId || "",
      dayType: el.dataset.dayType || "",
      seasonId: el.dataset.seasonId ? el.dataset.seasonId : null,
      price: Number(el.value || 0),
    })).filter((i) => i.areaId && i.dayType);
    startTransition(async () => {
      try {
        await saveAllAreaPrices(items);
        setSaved(true);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <div
      className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 mt-4 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap"
      style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", borderTop: "1px solid var(--line)" }}
    >
      <div className="text-xs" style={{ color: "var(--ink-2)" }}>
        {err ? <span style={{ color: "#b42318" }}>{err}</span>
          : saved ? <span style={{ color: "#15803d" }}>✓ All area prices saved</span>
          : "Saves every area price on this page at once."}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={saveAll} disabled={isPending} className="vy-btn vy-btn-primary disabled:opacity-60">
          {isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push(nextHref)}
          className="vy-btn vy-btn-secondary whitespace-nowrap"
          title={`Continue to ${nextLabel}`}
        >
          {nextLabel} →
        </button>
      </div>
    </div>
  );
}

function AreaCard({
  venueId,
  area,
  gallery,
  seasons,
  groups,
}: {
  venueId: string;
  area: AreaRow;
  gallery: GalleryPhoto[];
  seasons: SeasonRow[];
  groups: GroupRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: number) {
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setErr(null);
    setBusy(`Uploading ${files.length} image${files.length === 1 ? "" : "s"}…`);
    try {
      const urls: string[] = [];
      const failed: string[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) { failed.push(`${f.name}: not an image`); continue; }
        if (f.size > 20 * 1024 * 1024) { failed.push(`${f.name}: over 20MB`); continue; }
        const fd = new FormData();
        fd.append("file", f);
        fd.append("venue_id", venueId);
        const res = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.ok && j.url) urls.push(j.url);
        else failed.push(`${f.name}: ${j.error || `upload failed (${res.status})`}`);
      }
      if (urls.length) await addAreaImages(area.id, urls);
      if (fileRef.current) fileRef.current.value = "";
      if (failed.length) setErr(failed.join(" · "));
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  function attachPicked() {
    const urls = Array.from(picked);
    if (!urls.length) { setPickerOpen(false); return; }
    setBusy("Importing…");
    startTransition(async () => {
      await addAreaImages(area.id, urls);
      setPicked(new Set());
      setPickerOpen(false);
      setBusy(null);
      router.refresh();
    });
  }

  function removeImage(id: string) {
    startTransition(async () => { await deleteAreaImage(id); router.refresh(); });
  }

  // Gallery photos not already attached, ranked by how well their label/category/
  // filename matches this area's name + description (so e.g. "Dam" photos surface
  // first). Matches are flagged "Suggested".
  const attached = new Set(area.images.map((i) => i.url));
  const tokens = `${area.name} ${area.description ?? ""}`.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const pickable = gallery
    .filter((g) => !attached.has(g.url))
    .map((g) => {
      const hay = `${g.label ?? ""} ${g.category ?? ""} ${g.url}`.toLowerCase();
      const score = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
      return { ...g, score };
    })
    .sort((a, b) => b.score - a.score);
  const suggestedCount = pickable.filter((p) => p.score > 0).length;

  return (
    <div className="vy-card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg" style={{ fontWeight: 700 }}>{area.name}</h3>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: "var(--cream)", color: "var(--poppy-deep)" }}>{KIND_LABEL[area.area_kind] ?? area.area_kind}</span>
          </div>
          {area.description && <p className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>{area.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEditing((v) => !v)} className="vy-btn vy-btn-secondary text-xs">
            {editing ? "Close" : "✎ Edit"}
          </button>
        </div>
      </div>

      {/* Image carousel */}
      <div>
        {area.images.length === 0 ? (
          <div className="rounded-xl flex items-center justify-center text-xs h-28" style={{ border: "1px dashed var(--line)", background: "var(--bone)", color: "var(--ink-2)" }}>
            No images yet — upload or import below.
          </div>
        ) : (
          <div className="relative group">
            <div ref={scrollRef} className="flex gap-2 overflow-x-auto scroll-smooth snap-x pb-1" style={{ scrollbarWidth: "thin" }}>
              {area.images.map((img) => (
                <div key={img.id} className="relative flex-shrink-0 snap-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-32 w-44 object-cover rounded-lg" style={{ border: "1px solid var(--line)" }} />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                    title="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {area.images.length > 2 && (
              <>
                <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll left" className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition" style={{ border: "1px solid var(--line)" }}>‹</button>
                <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll right" className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition" style={{ border: "1px solid var(--line)" }}>›</button>
              </>
            )}
          </div>
        )}

        {/* Image actions */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
          <button type="button" onClick={() => fileRef.current?.click()} className="vy-btn vy-btn-secondary text-xs">⬆ Upload images</button>
          <button type="button" onClick={() => setPickerOpen(true)} disabled={!pickable.length} className="vy-btn vy-btn-ghost text-xs disabled:opacity-40" title={pickable.length ? "Pick from your venue gallery" : "No gallery photos to import"}>
            ✨ Smart Import{suggestedCount > 0 ? ` (${suggestedCount} match)` : ""}
          </button>
          {busy && <span className="text-xs" style={{ color: "var(--ink-2)" }}>{busy}</span>}
        </div>
        {err && <p className="text-xs mt-1" style={{ color: "#b42318" }}>{err}</p>}
      </div>

      {/* Edit details (toggle) */}
      {editing && (
        <form action={updateArea.bind(null, area.id)} className="grid gap-3 md:grid-cols-6 items-end pt-2 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="md:col-span-2 space-y-1">
            <label className="vy-label">Area name</label>
            <input name="name" required defaultValue={area.name} className="vy-input" />
          </div>
          <div className="space-y-1">
            <label className="vy-label">Kind</label>
            <select name="area_kind" className="vy-select" defaultValue={area.area_kind}>
              <option value="main">Main (included)</option>
              <option value="extra">Extra (paid)</option>
              <option value="overflow">Overflow</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="vy-label">Sub-category</label>
            <select name="__group_select" className="vy-select" defaultValue={area.group_id ?? "none"} onChange={(e) => { const v = e.target.value; startTransition(async () => { await assignAreaGroup(area.id, v === "none" ? null : v); router.refresh(); }); }}>
              <option value="none">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="vy-label">Description</label>
            <input name="description" defaultValue={area.description ?? ""} placeholder="Short description" className="vy-input" />
          </div>
          <div className="flex">
            <button className="vy-btn vy-btn-secondary text-xs w-full">Save details</button>
          </div>
        </form>
      )}

      {/* Costing */}
      <div className="pt-2 border-t" style={{ borderColor: "var(--line)" }}>
        {/* Wedding-day price — one input per season when seasons exist. */}
        <div className="vy-label mb-2">Wedding-day price{seasons.length ? " · per season" : ""}</div>
        {seasons.length === 0 ? (
          <form action={updateAreaPrice.bind(null, area.id, "wedding", null)} className="space-y-1 max-w-xs">
            <label className="vy-label">Wedding (R)</label>
            <div className="flex gap-2">
              <input name="price" type="number" step="0.01" min="0" defaultValue={priceFor(area.priceRows, "wedding", null)} className="vy-input" data-area-price data-area-id={area.id} data-day-type="wedding" data-season-id="" />
              <button className="vy-btn vy-btn-secondary text-xs whitespace-nowrap">Save</button>
            </div>
          </form>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {seasons.map((s) => (
              <form key={s.id} action={updateAreaPrice.bind(null, area.id, "wedding", s.id)} className="space-y-1">
                <label className="vy-label">{s.name} <span style={{ color: "var(--ink-2)", fontWeight: 400 }}>· {seasonRangeLabel(s)}</span></label>
                <div className="flex gap-2">
                  <input name="price" type="number" step="0.01" min="0" defaultValue={priceFor(area.priceRows, "wedding", s.id)} className="vy-input" data-area-price data-area-id={area.id} data-day-type="wedding" data-season-id={s.id} />
                  <button className="vy-btn vy-btn-secondary text-xs whitespace-nowrap">Save</button>
                </div>
              </form>
            ))}
          </div>
        )}

        {/* Meet & Greet + Farewell — single price each (not seasonal). */}
        <div className="vy-label mt-4 mb-2">Meet &amp; Greet / Farewell — single price</div>
        <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
          {[{ key: "mg", label: "Meet & Greet" }, { key: "farewell", label: "Farewell" }].map((dt) => (
            <form key={dt.key} action={updateAreaPrice.bind(null, area.id, dt.key, null)} className="space-y-1">
              <label className="vy-label">{dt.label} (R)</label>
              <div className="flex gap-2">
                <input name="price" type="number" step="0.01" min="0" defaultValue={priceFor(area.priceRows, dt.key, null)} className="vy-input" data-area-price data-area-id={area.id} data-day-type={dt.key} data-season-id="" />
                <button className="vy-btn vy-btn-secondary text-xs whitespace-nowrap">Save</button>
              </div>
            </form>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--line)" }}>
        <form action={toggleAreaActive.bind(null, area.id, !area.active)}>
          <button className={area.active ? "text-emerald-700 text-xs" : "text-stone-400 text-xs"}>
            {area.active ? "● Active" : "○ Hidden"}
          </button>
        </form>
        <form action={deleteArea.bind(null, area.id)}>
          <button className="vy-btn vy-btn-danger text-xs">Remove area</button>
        </form>
      </div>

      {/* Smart Import picker */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white" style={{ borderColor: "var(--line)" }}>
              <h3 className="font-medium">Import photos to {area.name}</h3>
              <button onClick={() => setPickerOpen(false)} className="text-stone-500 hover:text-stone-900 rounded-full h-8 w-8 flex items-center justify-center hover:bg-stone-100">✕</button>
            </div>
            <div className="p-5">
              <p className="text-xs mb-3" style={{ color: "var(--ink-2)" }}>{suggestedCount > 0 ? `${suggestedCount} photo${suggestedCount === 1 ? "" : "s"} match "${area.name}" — shown first.` : `Pick venue gallery photos to attach to ${area.name}.`}</p>
              {pickable.length === 0 ? (
                <div className="vy-empty text-sm">No gallery photos available.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {pickable.map((g) => {
                    const sel = picked.has(g.url);
                    return (
                      <button
                        key={g.url}
                        type="button"
                        onClick={() => setPicked((prev) => { const n = new Set(prev); if (n.has(g.url)) n.delete(g.url); else n.add(g.url); return n; })}
                        className="relative rounded-lg overflow-hidden"
                        style={{ outline: sel ? "3px solid var(--poppy)" : "1px solid var(--line)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.url} alt="" className="h-24 w-full object-cover" />
                        {g.score > 0 && !sel && <span className="absolute bottom-1 left-1 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "var(--poppy)", color: "#fff" }}>Suggested</span>}
                        {sel && <span className="absolute top-1 right-1 w-5 h-5 rounded-full text-[11px] flex items-center justify-center" style={{ background: "var(--poppy)", color: "#fff" }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
                <button onClick={() => setPickerOpen(false)} className="vy-btn vy-btn-ghost">Cancel</button>
                <button onClick={attachPicked} disabled={!picked.size || isPending} className="vy-btn vy-btn-primary">Import {picked.size || ""}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
