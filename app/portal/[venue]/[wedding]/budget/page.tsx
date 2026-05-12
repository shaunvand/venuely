import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";
import { addBudgetItem, togglePaid, deleteBudgetItem } from "./actions";

export default async function Budget({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { wedding } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("budget_items")
    .select("id, category, label, estimated, actual, paid")
    .eq("wedding_id", wedding.id)
    .order("category");

  const total = (items ?? []).reduce((s, i) => s + Number(i.actual ?? i.estimated ?? 0), 0);
  const paid = (items ?? []).filter((i) => i.paid).reduce((s, i) => s + Number(i.actual ?? i.estimated ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Budget</h1>
        <div className="text-right text-sm">
          <div>Total: <b>R{total.toLocaleString()}</b></div>
          <div>Paid: <b>R{paid.toLocaleString()}</b></div>
          {wedding.total_budget && (
            <div className="text-gray-500">Budget: R{Number(wedding.total_budget).toLocaleString()}</div>
          )}
        </div>
      </div>

      <form action={addBudgetItem.bind(null, wedding.id)} className="flex gap-2 flex-wrap">
        <input name="category" required placeholder="Category" className="border rounded px-3 py-2" />
        <input name="label" required placeholder="Item" className="border rounded px-3 py-2 flex-1 min-w-40" />
        <input name="estimated" type="number" step="0.01" placeholder="Estimated R" className="border rounded px-3 py-2 w-32" />
        <button className="px-4 py-2 bg-black text-white rounded">Add</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th>Category</th><th>Item</th><th>Estimated</th><th>Actual</th><th>Paid?</th><th></th></tr>
        </thead>
        <tbody>
          {items?.map((i) => (
            <tr key={i.id} className="border-t">
              <td className="py-2">{i.category}</td>
              <td>{i.label}</td>
              <td>R{Number(i.estimated ?? 0).toLocaleString()}</td>
              <td>R{Number(i.actual ?? 0).toLocaleString()}</td>
              <td>
                <form action={togglePaid.bind(null, i.id, !i.paid)}>
                  <button className={i.paid ? "text-green-600" : "text-gray-400"}>{i.paid ? "✓" : "○"}</button>
                </form>
              </td>
              <td>
                <form action={deleteBudgetItem.bind(null, i.id)}>
                  <button className="text-red-600 text-xs hover:underline">delete</button>
                </form>
              </td>
            </tr>
          ))}
          {!items?.length && <tr><td colSpan={6} className="py-4 text-gray-500">No budget items yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
