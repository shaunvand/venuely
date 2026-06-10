"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useLoading } from "@/components/LoadingProvider";

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
  const loading = useLoading();
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
    loading.show("Uploading your media…", { messages: ["Uploading…", "Optimising…"] });
    try {
      const fd = new FormData();
      fd.append("venue_id", venueId);
      fd.append("category", cat);
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/venue/gallery", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { loading.hide(); return setErr(j.error || "Upload failed"); }
      if (ref.current) ref.current.value = "";
      loading.complete("Uploaded ✓");
      start(() => router.refresh());
    } catch (e) {
      loading.hide();
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function smartImport() {
    setErr(null);
    setBusy("Pulling & labelling images…");
    loading.show("Pulling images from your venue…", {
      messages: ["Pulling images from your venue…", "Labelling your best photos…"],
    });
    try {
      const res = await fetch("/api/venue/gallery/smart-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venue_id: venueId }),
      });
      const j = await res.json();
      if (!res.ok) { loading.hide(); return setErr(j.error || "Smart import failed"); }
      setErr(j.added ? null : j.message || "No new images found.");
      loading.complete(j.added ? "Done ✓" : "No new images");
      start(() => router.refresh());
    } catch (e) {
      loading.hide();
      setErr(e instanceof Error ? e.message : "Smart import failed");
    } finally {
      setBusy(null);
    }
  }

  // Manual Google import — fallback shown only when the gallery is EMPTY (the
  // automatic onboarding import didn't run or found nothing), so venues can retry.
  async function importGoogle() {
    setErr(null);
    setBusy("Importing your Google photos…");
    loading.show("Importing your Google photos…", {
      messages: ["Finding your venue on Google…", "Downloading your photos…", "Labelling each photo…", "Almost there…"],
    });
    try {
      const res = await fetch("/api/venue/places-photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venue_id: venueId }),
      });
      const j = await res.json();
      if (!res.ok) { loading.hide(); return setErr(j.error || "Google import failed"); }
      setErr(j.added ? null : j.message || "No Google photos found for your venue.");
      loading.complete(j.added ? `${j.added} photo${j.added === 1 ? "" : "s"} imported ✓` : "No photos found");
      start(() => router.refresh());
    } catch (e) {
      loading.hide();
      setErr(e instanceof Error ? e.message : "Google import failed");
    } finally {
      setBusy(null);
    }
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
      <div className="vy-card space-y-4">
        {/* Empty gallery → offer the Google import as a retry (the automatic
            onboarding pull either didn't run for this venue or found nothing). */}
        {items.length === 0 && (
          <div className="flex flex-col items-center text-center gap-1.5 py-2 border-b" style={{ borderColor: "var(--line)" }}>
            <button
              type="button"
              onClick={importGoogle}
              disabled={!!busy || pending}
              className="vy-btn vy-btn-primary text-base px-7 py-3"
              style={{ borderRadius: "999px" }}
              title="Pull your venue's own photos from Google Maps into the gallery"
            >
              📍 Import from Google
            </button>
            <span className="text-xs" style={{ color: "var(--ink-2)" }}>
              No photos yet — pull your venue&apos;s real photos straight from Google Maps.
            </span>
          </div>
        )}

        {/* Add more photos — Smart Import + manual upload. */}
        <div className="flex flex-wrap items-end justify-center gap-4">
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
        </div>
        {busy && <div className="text-sm text-center text-stone-500">{busy}</div>}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {g.media.map((m) => (
                <div
                  key={m.id}
                  className="group relative rounded-2xl bg-white p-2 transition hover:shadow-md"
                  style={{ border: "1px solid var(--line)" }}
                >
                  <div className="rounded-xl overflow-hidden" style={{ background: "var(--bone)" }}>
                    {m.kind === "video" ? (
                      <video src={m.url} controls className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.label || ""} className="aspect-[4/3] w-full object-cover" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <select
                      value={g.loc}
                      onChange={(e) => recategorise(m.id, e.target.value)}
                      className="text-xs rounded-lg px-2 py-1 flex-1 min-w-0 bg-white"
                      style={{ border: "1px solid var(--line)" }}
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--poppy)" }}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {floorPlans.map((m) => (
              <div
                key={m.id}
                className="group relative rounded-2xl bg-white p-2 transition hover:shadow-md"
                style={{ border: "1px solid var(--line)" }}
              >
                <div className="rounded-xl overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.label || "Floor plan"} className="aspect-[4/3] w-full object-contain" />
                </div>
                <div className="mt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--poppy)" }}
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
