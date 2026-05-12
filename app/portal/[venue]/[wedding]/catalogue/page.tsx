import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";

export default async function Catalogue({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { venue } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("catalogue_items")
    .select("id, category, name, description")
    .eq("venue_id", venue.id)
    .eq("active", true)
    .order("category")
    .order("sort_order");

  const grouped = new Map<string, typeof items>();
  for (const it of items ?? []) {
    if (!grouped.has(it.category)) grouped.set(it.category, []);
    grouped.get(it.category)!.push(it);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Catalogue (included)</h1>
      <p className="text-gray-600">Décor, tableware, and venue items included in your booking — no extra charge.</p>

      {[...grouped.entries()].map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-lg font-semibold border-b pb-1">{cat}</h2>
          <ul className="space-y-1 text-sm">
            {list!.map((it) => (
              <li key={it.id}>
                <span className="font-medium">{it.name}</span>
                <span className="text-gray-600"> — {it.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
