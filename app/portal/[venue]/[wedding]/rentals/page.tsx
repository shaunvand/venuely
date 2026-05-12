import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";
import { addSelection, removeSelection } from "./actions";

export default async function Rentals({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { venue, wedding } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();

  const [{ data: items }, { data: picks }] = await Promise.all([
    supabase
      .from("rental_items")
      .select("id, category, name, description, price, stock_total")
      .eq("venue_id", venue.id)
      .eq("active", true)
      .order("category")
      .order("sort_order"),
    supabase
      .from("wedding_selections")
      .select("id, rental_item_id, quantity")
      .eq("wedding_id", wedding.id)
      .not("rental_item_id", "is", null),
  ]);

  const pickMap = new Map((picks ?? []).map((p) => [p.rental_item_id!, p]));
  const total = (picks ?? []).reduce((sum, p) => {
    const item = items?.find((i) => i.id === p.rental_item_id);
    return sum + (item ? Number(item.price) * p.quantity : 0);
  }, 0);

  const grouped = new Map<string, typeof items>();
  for (const it of items ?? []) {
    if (!grouped.has(it.category)) grouped.set(it.category, []);
    grouped.get(it.category)!.push(it);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">Rentals</h1>
          <p className="text-gray-600">Optional extras you can hire on top of your booking.</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Selected total</div>
          <div className="text-2xl font-semibold">R{total.toLocaleString()}</div>
        </div>
      </div>

      {[...grouped.entries()].map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-lg font-semibold border-b pb-1">{cat}</h2>
          <ul className="space-y-2">
            {list!.map((it) => {
              const pick = pickMap.get(it.id);
              return (
                <li key={it.id} className="flex items-start justify-between gap-4 text-sm">
                  <div className="flex-1">
                    <div className="font-medium">{it.name}</div>
                    <div className="text-gray-600 text-xs">{it.description}</div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div>R{Number(it.price).toLocaleString()}</div>
                    {pick ? (
                      <form action={removeSelection.bind(null, pick.id)}>
                        <button className="text-xs text-red-600 hover:underline">remove (qty {pick.quantity})</button>
                      </form>
                    ) : (
                      <form action={addSelection.bind(null, wedding.id, it.id)}>
                        <button className="text-xs text-blue-600 hover:underline">add</button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
