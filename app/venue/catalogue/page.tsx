import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { InventoryManager } from "@/components/InventoryManager";
import { INVENTORY_FIELDS } from "@/lib/inventory/schemas";
import { AutoGroupCatalogueButton } from "@/components/AutoGroupCatalogueButton";
import { SmartImportPanel } from "@/components/SmartImportPanel";

export default async function VenueCatalogue() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("catalogue_items")
    .select("id, category, event_part, name, description, cost_treatment, price, price_unit, commission_value, commission_type, item_code, active, image_url")
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
        <AutoGroupCatalogueButton venueId={venue.id} />
      </header>

      <SmartImportPanel venueId={venue.id} title="Smart Import your catalogue" blurb="Upload a PDF, Excel, Word or CSV menu/price list and Smart Import fills your catalogue — you review before it saves." />

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
