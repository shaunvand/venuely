import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { InventoryManager } from "@/components/InventoryManager";
import { INVENTORY_FIELDS } from "@/lib/inventory/schemas";
import { autoCategoriseCatalogue } from "./actions";

export default async function VenueCatalogue() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("catalogue_items")
    .select("id, category, name, description, cost_treatment, price, price_unit, commission_value, commission_type, item_code, active, image_url")
    .eq("venue_id", venue.id)
    .order("category")
    .order("sort_order");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="vy-eyebrow">Marketplace</div>
          <h1 className="vy-h1 mt-1">Catalogue</h1>
          <p className="text-stone-600 text-sm mt-1">
            Items included with your booking. Couples tick which days they need each.
          </p>
        </div>
        <form action={autoCategoriseCatalogue.bind(null, venue.id)}>
          <button className="vy-btn vy-btn-secondary text-sm" title="Use AI to group menu items into Breakfast / Lunch / Dinner / Drinks for the couple portal">
            ✨ Auto-group by course (AI)
          </button>
        </form>
      </header>

      <InventoryManager
        type="catalogue"
        venueId={venue.id}
        items={(items ?? []) as Array<Record<string, unknown> & { id: string }>}
        fields={INVENTORY_FIELDS.catalogue.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? null, required: !!f.required }))}
        priceColumn="price"
      />
    </div>
  );
}
