import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addCatalogue } from "./actions";
import { InventoryManager } from "@/components/InventoryManager";
import { INVENTORY_FIELDS } from "@/lib/inventory/schemas";

export default async function VenueCatalogue() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("catalogue_items")
    .select("id, category, name, description, price, price_unit, active, image_url")
    .eq("venue_id", venue.id)
    .order("category")
    .order("sort_order");

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Marketplace</div>
        <h1 className="vy-h1 mt-1">Catalogue</h1>
        <p className="text-stone-600 text-sm mt-1">
          Items included with your booking. Couples tick which days they need each.
        </p>
      </header>

      <form action={addCatalogue.bind(null, venue.id)} className="vy-card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Category</label>
          <input name="category" required placeholder="Glassware" className="vy-input" />
        </div>
        <div className="md:col-span-3 space-y-1">
          <label className="vy-label">Name</label>
          <input name="name" required placeholder="Champagne flutes" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Price</label>
          <input name="price" type="number" step="0.01" defaultValue="0" className="vy-input" />
        </div>
        <div className="md:col-span-5 space-y-1">
          <label className="vy-label">Description</label>
          <input name="description" placeholder="What's included?" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Price unit</label>
          <select name="price_unit" className="vy-select">
            <option value="fixed">fixed</option>
            <option value="per_person">per person</option>
            <option value="per_hour">per hour</option>
          </select>
        </div>
        <div className="md:col-span-6">
          <button className="vy-btn vy-btn-primary">+ Add item</button>
        </div>
      </form>

      <InventoryManager
        type="catalogue"
        venueId={venue.id}
        items={(items ?? []) as Array<Record<string, unknown> & { id: string }>}
        fields={INVENTORY_FIELDS.catalogue.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? null }))}
        priceColumn="price"
      />
    </div>
  );
}
