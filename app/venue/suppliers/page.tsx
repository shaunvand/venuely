import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { VendorPartnersManager } from "@/components/VendorPartnersManager";

export const dynamic = "force-dynamic";

export default async function VenueSuppliers() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("vendor_partners")
    .select("id, vendor_type, name, description, price_from, image_url, contact_name, contact_phone, contact_email, website_url, active, commission_value, commission_type, cost_treatment, sort_order")
    .eq("venue_id", venue.id)
    .order("vendor_type")
    .order("sort_order");

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Marketplace</div>
        <h1 className="vy-h1 mt-1">Suppliers</h1>
        <p className="text-stone-600 text-sm mt-1">
          Your trusted, recommended suppliers — filter by category, add your own, and pull their photos from their websites. Couples browse these in their portal.
        </p>
      </header>

      <div className="vy-card">
        <VendorPartnersManager venueId={venue.id} items={(rows ?? []) as Array<Record<string, unknown> & { id: string }>} />
      </div>
    </div>
  );
}
