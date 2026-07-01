import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { VenueAddressPicker } from "@/components/VenueAddressPicker";
import { LogoUploadField } from "@/components/SetupVenueForm";
import { updateVenue } from "./actions";
import { SaveButton } from "@/components/SaveButton";
import { BrandColourField } from "@/components/BrandColourField";

export default async function VenueSettings({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const venue = await getCurrentVenue();
  const sp = await searchParams;
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  // Public-profile fields aren't in getCurrentVenue()'s column list — read them here.
  const supabase = await createClient();
  const { data: profileFields } = await supabase
    .from("venues")
    .select("description, directions, website")
    .eq("id", venue.id)
    .maybeSingle();
  const profile = (profileFields ?? {}) as { description?: string | null; directions?: string | null; website?: string | null };

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold">Venue settings</h1>
        <p className="text-stone-600 text-sm mt-1">
          These appear on the marketing landing and on every couple portal.
        </p>
      </header>

      {sp.ok && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 text-sm">
          Saved.
        </div>
      )}

      <form action={updateVenue} className="space-y-6">
        <input type="hidden" name="venue_id" value={venue.id} />

        <section className="space-y-1">
          <label className="text-sm font-medium">Venue name</label>
          <input
            name="name"
            required
            defaultValue={venue.name}
            className="w-full border rounded px-3 py-2"
          />
        </section>

        <section className="space-y-1">
          <label className="text-sm font-medium">About your venue</label>
          <textarea
            name="description"
            rows={4}
            defaultValue={profile.description ?? ""}
            placeholder="The public about / our-story blurb couples see on your listing and portal."
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-stone-500">Shown on your public listing and at the top of every couple portal.</p>
        </section>

        <section>
          <VenueAddressPicker
            apiKey={mapsKey}
            name="address"
            initial={{
              address: venue.address ?? "",
              region: venue.region ?? "",
              latitude: venue.latitude ?? null,
              longitude: venue.longitude ?? null,
              google_place_id: venue.google_place_id ?? null,
              google_maps_url: venue.google_maps_url ?? null,
            }}
          />
        </section>

        <section className="space-y-1">
          <label className="text-sm font-medium">Region (manual override)</label>
          <input
            name="region_override"
            defaultValue={venue.region ?? ""}
            placeholder="Auto-filled from address picker — only set this if Google has it wrong"
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-stone-500">Used when the auto-detected region needs cleaning up.</p>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Contact email</label>
            <input
              name="contact_email"
              type="email"
              defaultValue={venue.contact_email ?? ""}
              placeholder="info@yourvenue.co.za"
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-stone-500">Where couple submissions are emailed.</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Contact phone</label>
            <input
              name="contact_phone"
              type="tel"
              defaultValue={venue.contact_phone ?? ""}
              placeholder="+27 82 123 4567"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">VAT number</label>
            <input name="vat_number" defaultValue={(venue as { vat_number?: string | null }).vat_number ?? ""} placeholder="e.g. 4900285224" className="w-full border rounded px-3 py-2" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Company registration</label>
            <input name="company_reg" defaultValue={(venue as { company_reg?: string | null }).company_reg ?? ""} placeholder="e.g. 2016/077215/07" className="w-full border rounded px-3 py-2" />
          </div>
        </section>
        <p className="text-xs text-stone-500 -mt-2">VAT &amp; registration numbers appear on the invoices couples receive (leave blank if not registered).</p>

        <section className="space-y-1">
          <label className="text-sm font-medium">Website</label>
          <input
            name="website"
            type="url"
            defaultValue={profile.website ?? ""}
            placeholder="https://yourvenue.co.za"
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-stone-500">Your own site — linked from your public listing.</p>
        </section>

        <section className="space-y-1">
          <label className="text-sm font-medium">Directions</label>
          <textarea
            name="directions"
            rows={3}
            defaultValue={profile.directions ?? ""}
            placeholder="How couples and guests get here — turn-offs, gate codes, GPS notes."
            className="w-full border rounded px-3 py-2"
          />
        </section>

        <section className="space-y-2">
          <label className="text-sm font-medium">Brand colour</label>
          <BrandColourField name="branding_primary" defaultValue={venue.branding_primary ?? "#0a4a3a"} />
        </section>

        <section>
          <LogoUploadField
            fieldName="branding_logo_url"
            venueId={venue.id}
            defaultUrl={venue.branding_logo_url ?? ""}
          />
        </section>

        <section className="space-y-1">
          <label className="text-sm font-medium">URL slug (read-only)</label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-stone-500">venuely.co.za/v/</span>
            <input
              value={venue.slug}
              readOnly
              className="flex-1 border rounded px-3 py-2 font-mono text-sm bg-stone-50 text-stone-600"
            />
          </div>
          <p className="text-xs text-stone-500">
            Changing this would break every existing couple portal URL. Contact support if you really need to.
          </p>
        </section>

        <SaveButton className="vy-btn vy-btn-primary" />
      </form>
    </div>
  );
}
