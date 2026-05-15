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

type Media = {
  id: string;
  url: string;
  label: string | null;
  kind: string;
  category: string | null;
};

export function YourVenueManager({ venueId, items }: { venueId: string; items: Media[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("Outside");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setBusy("Uploading…");
    const fd = new FormData();
    fd.append("venue_id", venueId);
    fd.append("category", category);
    Array.from(files).forEach((f) => fd.append("files", f));
    const res = await fetch("/api/venue/gallery", { method: "POST", body: fd });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(j.error || "Upload failed");
    if (fileRef.current) fileRef.current.value = "";
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

      {groups.length === 0 ? (
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
    </div>
  );
}
