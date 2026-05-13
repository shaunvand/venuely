import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addRental, deleteRental, toggleRentalActive } from "./actions";
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

      <form action={addRental.bind(null, venue.id)} className="vy-card grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Category</label>
          <input name="category" required placeholder="Lighting" className="vy-input" />
        </div>
        <div className="md:col-span-3 space-y-1">
          <label className="vy-label">Name</label>
          <input name="name" required placeholder="Fairy light curtain" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Price (R)</label>
          <input name="price" type="number" step="0.01" required className="vy-input" />
        </div>
        <div className="md:col-span-4 space-y-1">
          <label className="vy-label">Description</label>
          <input name="description" placeholder="Short description" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Stock total</label>
          <input name="stock_total" type="number" min="1" defaultValue="1" className="vy-input" />
        </div>
        <div className="space-y-1 md:col-span-1">
          <label className="vy-label">&nbsp;</label>
          <button className="vy-btn vy-btn-primary w-full">+ Add</button>
        </div>
      </form>

      {!items?.length ? (
        <div className="vy-empty">No rentals yet. Add your first above.</div>
      ) : (
        <div className="vy-card p-0 overflow-hidden">
          <table className="vy-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><span className="vy-tag vy-tag-soft">{i.category}</span></td>
                  <td>
                    <div className="font-medium">{i.name}</div>
                    {i.description && <div className="text-xs text-stone-500 mt-0.5">{i.description}</div>}
                  </td>
                  <td>R{Number(i.price).toLocaleString()}</td>
                  <td>{i.stock_total}</td>
                  <td>
                    <form action={toggleRentalActive.bind(null, i.id, !i.active)}>
                      <button className={i.active ? "text-emerald-700" : "text-stone-400"}>{i.active ? "● Active" : "○ Hidden"}</button>
                    </form>
                  </td>
                  <td className="text-right">
                    <form action={deleteRental.bind(null, i.id)}>
                      <button className="vy-btn-danger vy-btn">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
