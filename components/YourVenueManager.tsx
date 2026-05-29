"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

const LOCATIONS = [
  "Outside",
  "Gardens",
  "Ceremony",
  "Reception",
  "Bar",
  "Interior",
  "Accommodation",
  "Other",
] as const;

// Floor-plan / layout images are stored as media_assets the couple-portal
// Floor Plans tab reads. The gallery upload route can't set kind='floorplan'
// yet, so we tag them with this category as an interim distinguisher.
const FLOORPLAN_CATEGORY = "floorplan";

type Media = {
  id: string;
  url: string;
  label: string | null;
  kind: string;
  category: string | null;
};

export function YourVenueManager({
  venueId,
  items,
  floorPlans = [],
}: {
  venueId: string;
  items: Media[];
  floorPlans?: Media[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("Outside");
  const fileRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLInputElement>(null);

  // Shared upload flow. `cat` overrides the selected location (used to tag
  // floor-plan uploads); `ref` is the input to reset on success.
  async function upload(
    files: FileList | null,
    cat: string = category,
    ref: typeof fileRef = fileRef,
  ) {
    if (!files || files.length === 0) return;
    setErr(null);
    setBusy("Uploading…");
    const fd = new FormData();
    fd.append("venue_id", venueId);
    fd.append("category", cat);
    Array.from(files).forEach((f) => fd.append("files", f));
    const res = await fetch("/api/venue/gallery", { method: "POST", body: fd });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(j.error || "Upload failed");
    if (ref.current) ref.current.value = "";
    start(() => router.refresh());
  }

  async function smartImport() {
    setErr(null);
    setBusy("Pulling & labelling images…");
    const res = await fetch("/api/venue/gallery/smart-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ venue_id: venueId }),
    });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(j.error || "Smart import failed");
    setErr(j.added ? null : j.message || "No new images found.");
    start(() => router.refresh());
  }

  async function recategorise(id: string, cat: string) {
    await fetch("/api/venue/gallery", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, venue_id: venueId, category: cat }),
    });
    start(() => router.refresh());
  }

  async function remove(id: string) {
    await fetch("/api/venue/gallery", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, venue_id: venueId }),
    });
    start(() => router.refresh());
  }

  const groups = LOCATIONS.map((loc) => ({
    loc,
    media: items.filter((m) => (m.category || "Other") === loc),
  })).filter((g) => g.media.length > 0);

  return (
    <div className="space-y-8">
      <div className="vy-card flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="vy-label">Location</label>
          <select className="vy-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="vy-label">Add photos / videos</label>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => upload(e.target.files)}
            className="vy-input"
          />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Add floor plan / layout</label>
          <input
            ref={planRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => upload(e.target.files, FLOORPLAN_CATEGORY, planRef)}
            className="vy-input"
          />
        </div>
        <button
          type="button"
          onClick={smartImport}
          disabled={!!busy || pending}
          className="vy-btn vy-btn-ghost"
        >
          ✨ Smart Import
        </button>
        {busy && <span className="text-sm text-stone-500">{busy}</span>}
      </div>

      {err && <div className="text-sm text-[color:var(--poppy)]">{err}</div>}

      {groups.length === 0 && floorPlans.length === 0 ? (
        <div className="vy-card text-sm text-stone-500">
          No venue media yet. Upload photos/videos above, or run Smart Import to
          pull and auto-label images already attached to your areas, accommodation
          and catalogue.
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.loc} className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {g.loc}
              <span className="vy-tag vy-tag-soft">{g.media.length}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {g.media.map((m) => (
                <div key={m.id} className="group relative rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
                  {m.kind === "video" ? (
                    <video src={m.url} controls className="h-36 w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.label || ""} className="h-36 w-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-white/90 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <select
                      value={g.loc}
                      onChange={(e) => recategorise(m.id, e.target.value)}
                      className="text-xs border border-stone-200 rounded px-1 py-0.5 flex-1 min-w-0"
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="text-xs text-[color:var(--poppy)] px-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {floorPlans.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Floor plans &amp; layouts
              <span className="vy-tag vy-tag-soft">{floorPlans.length}</span>
            </h2>
            <p className="text-sm text-stone-500">
              Layout images couples see on the Floor Plans tab of their portal.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {floorPlans.map((m) => (
              <div key={m.id} className="group relative rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.label || "Floor plan"} className="h-36 w-full object-contain bg-white" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-end bg-white/90 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="text-xs text-[color:var(--poppy)] px-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
