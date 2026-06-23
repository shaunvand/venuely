import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { VendorPartnersManager } from "@/components/VendorPartnersManager";
import { BulkUploader } from "@/components/BulkUploader";

export const dynamic = "force-dynamic";

export default async function VenueSuppliers() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  // NB: vendor_partners has no contact_name column (that's accommodation_rooms) —
  // selecting it made this whole query 400 and the page silently showed "No suppliers".
  const { data: rows, error } = await supabase
    .from("vendor_partners")
    .select("id, vendor_type, name, description, price_from, image_url, contact_phone, contact_email, website_url, active, commission_value, commission_type, cost_treatment, sort_order")
    .eq("venue_id", venue.id)
    .order("vendor_type")
    .order("sort_order");
  if (error) throw new Error(`Couldn't load suppliers: ${error.message}`);

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Marketplace</div>
        <h1 className="vy-h1 mt-1">Suppliers</h1>
        <p className="text-stone-600 text-sm mt-1">
          Your trusted, recommended suppliers — filter by category, add your own, and pull their photos from their websites. Couples browse these in their portal.
        </p>
      </header>

      {/* Missed the supplier step in setup? Re-open Smart Import here. Collapsed
          by default so it doesn't crowd the list once suppliers exist. */}
      <details className="rounded-2xl group" style={{ border: "1px solid var(--line)", background: "var(--cream)" }}>
        <summary className="cursor-pointer select-none list-none px-5 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: "var(--peach)" }}>📄</span>
          <span className="flex-1 min-w-0">
            <span className="font-serif text-lg block leading-tight" style={{ fontWeight: 700 }}>Import a list of preferred suppliers</span>
            <span className="text-sm" style={{ color: "var(--ink-2)" }}>Missed this in setup? Upload a PDF, Excel, Word or CSV of your suppliers and we&apos;ll add them for you.</span>
          </span>
          <span className="text-xs flex-shrink-0" style={{ color: "var(--poppy)" }}>
            <span className="group-open:hidden">Open ▾</span>
            <span className="hidden group-open:inline">Close ▴</span>
          </span>
        </summary>
        <div className="px-5 pb-5 pt-1">
          <BulkUploader venueId={venue.id} />
        </div>
      </details>

      <div className="vy-card">
        <VendorPartnersManager venueId={venue.id} items={(rows ?? []) as Array<Record<string, unknown> & { id: string }>} />
      </div>
    </div>
  );
}
