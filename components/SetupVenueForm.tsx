"use client";

import { useState } from "react";
import { VenueAddressPicker } from "@/components/VenueAddressPicker";

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

export function SetupVenueForm({
  action,
  mapsKey,
}: {
  action: (formData: FormData) => void;
  mapsKey: string | null;
}) {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [data, setData] = useState<Imported | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [region, setRegion] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [addressSeed, setAddressSeed] = useState("");
  const [pickerKey, setPickerKey] = useState(0);

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
    <form action={action} className="w-full max-w-xl space-y-6 py-12">
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

      <div className="space-y-1">
        <label className="text-sm font-medium">Venue name</label>
        <input name="name" required value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }}
          placeholder="Pat Busch Mountain Reserve" className="w-full border rounded px-3 py-2" />
      </div>

      <VenueAddressPicker key={pickerKey} apiKey={mapsKey} name="address" initial={{ region, address: addressSeed }} />
      {addressSeed && (
        <p className="-mt-3 text-xs text-amber-700">
          We prefilled the address from your website — click into the field and pick the matching Google result to lock in the exact location.
        </p>
      )}

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
        <label className="text-sm font-medium">Logo URL (optional)</label>
        <div className="flex flex-col items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo preview" className="h-24 w-24 rounded border border-stone-200 bg-white object-contain p-2" />
          ) : (
            <div className="h-24 w-24 rounded border border-dashed border-stone-300 bg-stone-50" aria-hidden />
          )}
          <input name="logo_url" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.png" className="w-full border rounded px-3 py-2" />
        </div>
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
            className="flex-1 border rounded px-3 py-2 font-mono text-sm"
          />
        </div>
        <p className="text-xs text-stone-500">Lowercase letters, numbers and hyphens only.</p>
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

      <button className="w-full bg-stone-900 text-white rounded py-2.5 font-medium">
        Create my venue
      </button>
    </form>
  );
}
