"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateArea, updateAreaPrice, toggleAreaActive, deleteArea,
  addAreaImages, deleteAreaImage,
} from "@/app/venue/areas/actions";

export type AreaImage = { id: string; url: string };
export type AreaRow = {
  id: string;
  name: string;
  area_kind: string;
  description: string | null;
  active: boolean;
  prices: Record<string, number>;
  images: AreaImage[];
};

const DAY_TYPES = [
  { key: "wedding", label: "Wedding" },
  { key: "mg", label: "M&G" },
  { key: "farewell", label: "Farewell" },
];

const KIND_LABEL: Record<string, string> = { main: "Main (included)", extra: "Extra (paid)", overflow: "Overflow" };

export function AreaManager({ venueId, areas, gallery }: { venueId: string; areas: AreaRow[]; gallery: { url: string }[] }) {
  if (areas.length === 0) {
    return <div className="vy-empty">No areas yet. Add Oak Tree, Hall/Lapa, Pool, etc. above.</div>;
  }
  return (
    <div className="space-y-4">
      {areas.map((a) => (
        <AreaCard key={a.id} venueId={venueId} area={a} gallery={gallery} />
      ))}
    </div>
  );
}

function AreaCard({ venueId, area, gallery }: { venueId: string; area: AreaRow; gallery: { url: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
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
    setBusy(`Uploading ${files.length} image${files.length === 1 ? "" : "s"}…`);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const fd = new FormData();
        fd.append("file", f);
        fd.append("venue_id", venueId);
        const res = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
        const j = await res.json();
        if (res.ok && j.ok) urls.push(j.url);
      }
      if (urls.length) await addAreaImages(area.id, urls);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
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

  // Gallery photos not already attached to this area (for the smart-import picker).
  const attached = new Set(area.images.map((i) => i.url));
  const pickable = gallery.filter((g) => !attached.has(g.url));

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
          <label className="vy-btn vy-btn-secondary text-xs cursor-pointer">
            ⬆ Upload images
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
          </label>
          <button type="button" onClick={() => setPickerOpen(true)} disabled={!pickable.length} className="vy-btn vy-btn-ghost text-xs disabled:opacity-40" title={pickable.length ? "Pick from your venue gallery" : "No gallery photos to import"}>
            ✨ Smart Import
          </button>
          {busy && <span className="text-xs" style={{ color: "var(--ink-2)" }}>{busy}</span>}
        </div>
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
        <div className="vy-label mb-2">Costing — hire fee per day type</div>
        <div className="grid gap-3 md:grid-cols-3">
          {DAY_TYPES.map((dt) => (
            <form key={dt.key} action={updateAreaPrice.bind(null, area.id, dt.key)} className="space-y-1">
              <label className="vy-label">{dt.label} (R)</label>
              <div className="flex gap-2">
                <input name="price" type="number" step="0.01" min="0" defaultValue={area.prices[dt.key] ?? 0} className="vy-input" />
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
              <p className="text-xs mb-3" style={{ color: "var(--ink-2)" }}>Pick venue gallery photos to attach to this area.</p>
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
