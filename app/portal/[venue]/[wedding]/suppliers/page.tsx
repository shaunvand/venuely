import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";

export default async function Suppliers({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { wedding } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, category, name, contact, cost, paid, notes")
    .eq("wedding_id", wedding.id)
    .order("category");

  const grouped = new Map<string, typeof suppliers>();
  for (const s of suppliers ?? []) {
    if (!grouped.has(s.category)) grouped.set(s.category, []);
    grouped.get(s.category)!.push(s);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Suppliers</h1>
      <p className="text-gray-600">Recommended and booked suppliers for your wedding.</p>

      {[...grouped.entries()].map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-lg font-semibold border-b pb-1">{cat}</h2>
          <ul className="space-y-2">
            {list!.map((s) => (
              <li key={s.id} className="text-sm">
                <div className="font-medium">{s.name}</div>
                <div className="text-gray-500">{s.contact}</div>
                {s.notes && <div className="text-gray-600 text-xs">{s.notes}</div>}
                {s.cost && <div className="text-xs">R{Number(s.cost).toLocaleString()} {s.paid ? "(paid)" : "(unpaid)"}</div>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
