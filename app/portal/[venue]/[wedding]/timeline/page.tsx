import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";

export default async function Timeline({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { wedding } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("timeline_items")
    .select("id, starts_at, label, description")
    .eq("wedding_id", wedding.id)
    .order("sort_order");

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Day Timeline</h1>
      <ol className="space-y-3">
        {items?.map((i) => (
          <li key={i.id} className="border-l-2 border-gray-300 pl-4 py-1">
            <div className="text-sm text-gray-500 font-mono">{i.starts_at?.slice(0, 5)}</div>
            <div className="font-medium">{i.label}</div>
            {i.description && <div className="text-sm text-gray-600">{i.description}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
