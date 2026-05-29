import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { InventoryManager } from "@/components/InventoryManager";
import { INVENTORY_FIELDS } from "@/lib/inventory/schemas";

export default async function VenueAccommodation() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("accommodation_rooms")
    .select("id, name, room_type, tier, sleeps, ideal_sleeps, max_sleeps, bridal_suite, amenities, price_per_night, description, contact_name, contact_phone, contact_email, website_url, address, cost_treatment, commission_value, commission_type, hero_image_url, floor_plan_url, active, image_url")
    .eq("venue_id", venue.id)
    .order("sort_order");

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">On-site stays</div>
        <h1 className="vy-h1 mt-1">Accommodation</h1>
        <p className="text-stone-600 text-sm mt-1">
          Cottages, suites, tents — anything on the property. Couples assign their guests to rooms.
        </p>
      </header>

      <InventoryManager
        type="accommodation"
        venueId={venue.id}
        items={(rooms ?? []) as Array<Record<string, unknown> & { id: string }>}
        fields={INVENTORY_FIELDS.accommodation.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? null, required: !!f.required }))}
        priceColumn="price_per_night"
      />
    </div>
  );
}
