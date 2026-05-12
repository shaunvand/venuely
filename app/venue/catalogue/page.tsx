import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { addCatalogue, deleteCatalogue, toggleCatalogueActive } from "./actions";

export default async function VenueCatalogue() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("catalogue_items")
    .select("id, category, name, description, price, price_unit, active")
    .eq("venue_id", venue.id)
    .order("category")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Catalogue · {venue.name}</h1>

      <form action={addCatalogue.bind(null, venue.id)} className="flex flex-wrap gap-2 border rounded p-4">
        <input name="category" required placeholder="Category" className="border rounded px-3 py-2" />
        <input name="name" required placeholder="Name" className="border rounded px-3 py-2 flex-1 min-w-40" />
        <input name="price" type="number" step="0.01" placeholder="Price" defaultValue="0" className="border rounded px-3 py-2 w-28" />
        <select name="price_unit" className="border rounded px-3 py-2">
          <option value="fixed">fixed</option>
          <option value="per_person">per person</option>
          <option value="per_hour">per hour</option>
        </select>
        <input name="description" placeholder="Description" className="border rounded px-3 py-2 w-full" />
        <button className="px-4 py-2 bg-black text-white rounded">Add item</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th>Category</th><th>Name</th><th>Price</th><th>Active</th><th></th></tr>
        </thead>
        <tbody>
          {items?.map((i) => (
            <tr key={i.id} className="border-t">
              <td className="py-2">{i.category}</td>
              <td>{i.name}</td>
              <td>R{Number(i.price).toLocaleString()} ({i.price_unit})</td>
              <td>
                <form action={toggleCatalogueActive.bind(null, i.id, !i.active)}>
                  <button className={i.active ? "text-green-600" : "text-gray-400"}>{i.active ? "✓" : "○"}</button>
                </form>
              </td>
              <td>
                <form action={deleteCatalogue.bind(null, i.id)}>
                  <button className="text-red-600 text-xs hover:underline">delete</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
