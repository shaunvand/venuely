"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { VenueAddressPicker } from "@/components/VenueAddressPicker";
import type { SetupVenueState } from "@/app/onboarding/setup-venue/actions";

type SeedItem = { name: string; description: string | null; price_zar: number | null; category: string | null };
type SeedRoom = { name: string; description: string | null; sleeps: number | null; price_per_night_zar: number | null; room_type: string | null };

type Imported = {
  name: string | null;
  description: string | null;
  region: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  catalogue: SeedItem[];
  rentals: SeedItem[];
  accommodation: SeedRoom[];
};

function slugify(s: string) {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Inner submit button so useFormStatus sees the surrounding <form>'s pending state —
// disables through the server-action round-trip to block double submits.
function SubmitButton({ slugTaken }: { slugTaken: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || slugTaken}
      className="w-full bg-stone-900 text-white rounded py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Creating…" : slugTaken ? "Pick an available URL first" : "Create my venue"}
    </button>
  );
}

export function SetupVenueForm({
  action,
  mapsKey,
}: {
  action: (prevState: SetupVenueState, formData: FormData) => Promise<SetupVenueState>;
  mapsKey: string | null;
}) {
  // Expected failures come back as { error } (success redirects server-side), so the
  // form re-renders with its state intact instead of dumping to an error page.
  const [actionState, formAction] = useActionState(action, null);

  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [data, setData] = useState<Imported | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [addressSeed, setAddressSeed] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [slugTaken, setSlugTaken] = useState(false);
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [slugChecking, setSlugChecking] = useState(false);

  useEffect(() => {
    if (!slug) { setSlugTaken(false); setSlugSuggestions([]); return; }
    setSlugChecking(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/venue/slug-check?slug=${encodeURIComponent(slug)}`);
        const j = await r.json();
        setSlugTaken(!!j.taken);
        setSlugSuggestions(Array.isArray(j.suggestions) ? j.suggestions : []);
      } catch {
        setSlugTaken(false);
        setSlugSuggestions([]);
      } finally {
        setSlugChecking(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  async function runImport() {
    if (!url.trim()) return;
    setImporting(true);
    setImportMsg("Reading site…");
    try {
      const res = await fetch("/api/venue/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setImportMsg(`Import failed: ${json.error ?? "unknown"}`);
        return;
      }
      const d: Imported = json.data;
      setData(d);
      if (d.name && !name) { setName(d.name); if (!slug) setSlug(slugify(d.name)); }
      if (d.description && !description) setDescription(d.description);
      if (d.region && !region) setRegion(d.region);
      if (d.contact_email && !contactEmail) setContactEmail(d.contact_email);
      if (d.contact_phone && !contactPhone) setContactPhone(d.contact_phone);
      if (d.logo_url && !logoUrl) setLogoUrl(d.logo_url);
      if (d.address) { setAddressSeed(d.address); setPickerKey((k) => k + 1); }

      const seeded = [
        d.catalogue?.length ? `${d.catalogue.length} catalogue` : null,
        d.rentals?.length ? `${d.rentals.length} rentals` : null,
        d.accommodation?.length ? `${d.accommodation.length} rooms` : null,
      ].filter(Boolean).join(", ");
      setImportMsg(`Imported${seeded ? `: ${seeded}` : " — no inventory detected, basics only"}.`);
    } catch (e) {
      setImportMsg(`Import error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <form action={formAction} className="w-full max-w-xl space-y-6 py-12">
      <div>
        <h1 className="font-serif text-3xl">Set up your venue</h1>
        <p className="text-stone-600 text-sm mt-2">
          Just the basics. Everything else — catalogue, rentals, accommodation, weddings — you&apos;ll add from your dashboard.
        </p>
      </div>

      <div className="rounded-md border-2 border-stone-400 bg-stone-50 p-5 space-y-3">
        <label className="text-base font-semibold">Already have a website? Import it</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://patbusch.co.za"
            className="flex-1 border rounded px-3 py-3 text-base"
          />
          <button
            type="button"
            onClick={runImport}
            disabled={importing || !url.trim()}
            className="px-6 py-3 rounded bg-stone-900 text-white text-base font-medium disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
        {importing && (
          <div className="h-1.5 w-full overflow-hidden rounded bg-stone-200">
            <div className="h-full w-1/3 animate-[vyImportBar_1.1s_ease-in-out_infinite] rounded bg-stone-900" />
          </div>
        )}
        {importMsg && <p className="text-xs text-stone-600">{importMsg}</p>}
        <p className="text-xs text-stone-500">We&apos;ll auto-fill what we&apos;re confident about. Review everything below before saving.</p>
      </div>

      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo preview" className="h-24 w-24 rounded border border-stone-200 bg-white object-contain p-2 mx-auto block" />
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium">Venue name</label>
        <input name="name" required value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }}
          placeholder="Pat Busch Mountain Reserve" className="w-full border rounded px-3 py-2" />
      </div>

      <div>
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <span aria-hidden className="text-base leading-none">📍</span>
          <span>
            {addressSeed
              ? "We've auto-located your venue from your website — check the pin below is in the right spot. If it's off, start typing and pick the correct Google result."
              : "Start typing your address and pick the matching Google result so we can drop an exact pin."}
          </span>
        </div>
        <VenueAddressPicker key={pickerKey} apiKey={mapsKey} name="address" initial={{ region, address: addressSeed }} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Contact email</label>
          <input name="contact_email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
            placeholder="hello@venue.co.za" className="w-full border rounded px-3 py-2" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Contact phone</label>
          <input name="contact_phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+27 …" className="w-full border rounded px-3 py-2" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">About your venue (optional)</label>
        <textarea
          name="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short story / about blurb couples see on your listing and portal."
          className="w-full border rounded px-3 py-2"
        />
        <p className="text-xs text-stone-500">We pre-fill this from your website when we can — tidy it up before saving.</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Logo (optional)</label>
        {/* No file upload here: the gallery uploader needs an existing venue, which
            onboarding doesn't have yet — a hosted URL (often pre-filled by Import) is
            the only option pre-venue. */}
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo preview" className="h-12 w-12 shrink-0 rounded border border-stone-200 bg-white object-contain p-1" />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded border border-dashed border-stone-300 bg-stone-50" aria-hidden />
          )}
          <input name="logo_url" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="Paste a hosted logo URL (https://…/logo.png)" className="flex-1 border rounded px-3 py-2 text-sm" />
        </div>
        <p className="text-xs text-stone-500">You can upload a logo after your venue is created.</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">URL slug</label>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-stone-500">venuely.co.za/portal/</span>
          <input
            name="slug"
            required
            pattern="[a-z0-9-]+"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="pat-busch"
            className={`flex-1 border rounded px-3 py-2 font-mono text-sm ${slugTaken ? "border-red-500" : ""}`}
          />
        </div>
        {slugTaken ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 mt-1 space-y-2">
            <p className="text-xs text-red-700 font-medium">Already taken — pick another:</p>
            <div className="flex flex-wrap gap-1.5">
              {slugSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlug(s)}
                  className="px-2.5 py-1 rounded border border-stone-300 bg-white text-xs font-mono hover:bg-stone-900 hover:text-white transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : slug && !slugChecking ? (
          <p className="text-xs text-green-700">✓ Available</p>
        ) : (
          <p className="text-xs text-stone-500">Lowercase letters, numbers and hyphens only.</p>
        )}
      </div>

      {data && (data.catalogue?.length || data.rentals?.length || data.accommodation?.length) ? (
        <div className="rounded-md border border-stone-200 bg-white p-4 text-xs text-stone-600 space-y-1">
          <div className="font-medium text-stone-800 text-sm">Will be seeded into your dashboard:</div>
          {data.catalogue?.length ? <div>• {data.catalogue.length} catalogue items</div> : null}
          {data.rentals?.length ? <div>• {data.rentals.length} rental items</div> : null}
          {data.accommodation?.length ? <div>• {data.accommodation.length} rooms</div> : null}
          <div className="text-stone-500 pt-1">You can edit / remove these from the dashboard after.</div>
        </div>
      ) : null}

      <input type="hidden" name="seed_payload" value={data ? JSON.stringify({ catalogue: data.catalogue ?? [], rentals: data.rentals ?? [], accommodation: data.accommodation ?? [] }) : ""} />

      {actionState?.error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" aria-live="polite">
          {actionState.error}
        </p>
      )}

      <SubmitButton slugTaken={slugTaken} />
    </form>
  );
}

// Reusable logo upload control (used post-onboarding, e.g. venue settings, where a
// venue already exists) — posts to the shared /api/venue/gallery uploader (same call
// shape as YourVenueManager.upload()) and writes the returned public URL into a
// field so it persists through a native server-action form submit. Falls back to a
// paste-a-URL input. Renders fine inside a server component.
export function LogoUploadField({
  fieldName,
  venueId,
  defaultUrl = "",
}: {
  fieldName: string;
  venueId?: string;
  defaultUrl?: string;
}) {
  const [logoUrl, setLogoUrl] = useState(defaultUrl);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      if (venueId) fd.append("venue_id", venueId);
      fd.append("category", "Other");
      fd.append("files", f);
      const res = await fetch("/api/venue/gallery", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(j.error || "Upload failed — paste a hosted URL below instead.");
        return;
      }
      const uploaded = j.inserted?.[0]?.url;
      if (uploaded) setLogoUrl(uploaded);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Logo (optional)</label>
      <p className="text-xs text-stone-500">For the crispest logo, upload an <strong>SVG</strong> or a large <strong>PNG</strong> (≈500px+, transparent background). Logos auto-pulled from your website are often small favicons and can look pixelated when enlarged.</p>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo preview" className="h-12 w-12 shrink-0 rounded border border-stone-200 bg-white object-contain p-1" />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded border border-dashed border-stone-300 bg-stone-50" aria-hidden />
        )}
        <label className="px-4 py-2 rounded bg-white border border-stone-300 text-sm font-medium cursor-pointer hover:bg-stone-100">
          {uploading ? "Uploading…" : "Upload logo"}
          <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      {err && <p className="text-xs text-amber-700">{err}</p>}
      <input
        name={fieldName}
        type="url"
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
        placeholder="…or paste a hosted logo URL (https://…/logo.png)"
        className="w-full border rounded px-3 py-2 text-sm"
      />
    </div>
  );
}
