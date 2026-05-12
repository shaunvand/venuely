import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";
import { addChecklist, toggleChecklist, deleteChecklist } from "./actions";

export default async function Checklist({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { wedding } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("checklist_items")
    .select("id, label, due_date, completed")
    .eq("wedding_id", wedding.id)
    .order("sort_order");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Checklist</h1>

      <form action={addChecklist.bind(null, wedding.id)} className="flex gap-2">
        <input name="label" required placeholder="What needs doing?" className="border rounded px-3 py-2 flex-1" />
        <input name="due_date" type="date" className="border rounded px-3 py-2" />
        <button className="px-4 py-2 bg-black text-white rounded">Add</button>
      </form>

      <ul className="space-y-1">
        {items?.map((i) => (
          <li key={i.id} className="flex items-center gap-3 text-sm">
            <form action={toggleChecklist.bind(null, i.id, !i.completed)}>
              <button className={`w-5 h-5 rounded border ${i.completed ? "bg-green-500 border-green-500 text-white" : ""}`}>
                {i.completed ? "✓" : ""}
              </button>
            </form>
            <span className={i.completed ? "line-through text-gray-400 flex-1" : "flex-1"}>{i.label}</span>
            {i.due_date && <span className="text-xs text-gray-500">{i.due_date}</span>}
            <form action={deleteChecklist.bind(null, i.id)}>
              <button className="text-red-600 text-xs hover:underline">×</button>
            </form>
          </li>
        ))}
        {!items?.length && <li className="text-gray-500">Nothing yet — add your first task.</li>}
      </ul>
    </div>
  );
}
