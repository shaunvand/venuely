import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { InventoryManager } from "@/components/InventoryManager";
import { INVENTORY_FIELDS } from "@/lib/inventory/schemas";

export default async function VenueRentals() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("rental_items")
    .select("id, category, name, description, price, stock_total, active, image_url")
    .eq("venue_id", venue.id)
    .order("category")
    .order("sort_order");

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Marketplace · paid extras</div>
        <h1 className="vy-h1 mt-1">Rentals</h1>
        <p className="text-stone-600 text-sm mt-1">
          Items couples pay extra for. Couples pick quantity + days; totals tally automatically.
        </p>
      </header>

      <InventoryManager
        type="rentals"
        venueId={venue.id}
        items={(items ?? []) as Array<Record<string, unknown> & { id: string }>}
        fields={INVENTORY_FIELDS.rentals.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? null }))}
        priceColumn="price"
      />
    </div>
  );
}
