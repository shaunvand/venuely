import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { InventoryManager } from "@/components/InventoryManager";
import { INVENTORY_FIELDS } from "@/lib/inventory/schemas";

export default async function VenueRentals() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("rental_items")
    .select("id, category, name, description, price, stock_total, active, image_url, cost_treatment, commission_value, commission_type")
    .eq("venue_id", venue.id)
    .order("category")
    .order("sort_order");

  const all = (items ?? []) as Array<Record<string, unknown> & { id: string }>;
  const included = all.filter((i) => i.cost_treatment === "included");
  const extras = all.filter((i) => i.cost_treatment !== "included");

  const fields = INVENTORY_FIELDS.rentals.map((f) => ({
    key: f.key, label: f.label, type: f.type, options: f.options ?? null, required: !!f.required,
  }));

  return (
    <div className="space-y-10">
      <header>
        <div className="vy-eyebrow">Marketplace · rentals</div>
        <h1 className="vy-h1 mt-1">Rentals</h1>
        <p className="text-stone-600 text-sm mt-1">
          Split into what&apos;s included in the venue price vs. paid extras. Couples pick quantity + days; totals tally automatically.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Included in venue price</h2>
          <span className="vy-tag vy-tag-soft">{included.length}</span>
        </div>
        <InventoryManager
          type="rentals"
          venueId={venue.id}
          items={included}
          fields={fields}
          priceColumn="price"
          showExtraColumns
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Paid extras</h2>
          <span className="vy-tag vy-tag-soft">{extras.length}</span>
        </div>
        <InventoryManager
          type="rentals"
          venueId={venue.id}
          items={extras}
          fields={fields}
          priceColumn="price"
          showExtraColumns
        />
      </section>
    </div>
  );
}
