import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";
import { applyMarkup } from "@/lib/billing/compute";

export default async function Catalogue({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { venue } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();
  const { data: rawItems } = await supabase
    .from("catalogue_items")
    .select("id, category, name, description, price, commission_value, commission_type, cost_treatment")
    .eq("venue_id", venue.id)
    .eq("active", true)
    .order("category")
    .order("sort_order");

  // Honour the owner's settings: an 'included' item ships with the booking (no charge),
  // everything else is a paid extra priced at the marked-up rate the owner configured.
  const items = (rawItems ?? []).map((it) => {
    const included = it.cost_treatment === "included";
    const price = included
      ? 0
      : applyMarkup(Number(it.price ?? 0), it.commission_value as number | null, it.commission_type as string | null);
    return { ...it, included, price };
  });

  const grouped = new Map<string, typeof items>();
  for (const it of items) {
    if (!grouped.has(it.category)) grouped.set(it.category, []);
    grouped.get(it.category)!.push(it);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Catalogue</h1>
      <p className="text-gray-600">Décor, tableware, and venue items. Included items come with your booking — no extra charge.</p>

      {[...grouped.entries()].map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-lg font-semibold border-b pb-1">{cat}</h2>
          <ul className="space-y-1 text-sm">
            {list!.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <span className="font-medium">{it.name}</span>
                  {it.description && <span className="text-gray-600"> — {it.description}</span>}
                </div>
                <div className="text-right whitespace-nowrap">
                  {it.included ? (
                    <span className="text-xs font-medium text-green-700">Included</span>
                  ) : (
                    <span>R{Number(it.price).toLocaleString()}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
