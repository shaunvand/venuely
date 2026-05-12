import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";

export default async function Accommodation({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { venue } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("accommodation_rooms")
    .select("id, name, room_type, sleeps, description")
    .eq("venue_id", venue.id)
    .eq("active", true)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accommodation</h1>
      <p className="text-gray-600">On-site cottages and lodging at {venue.name}.</p>

      <div className="grid md:grid-cols-2 gap-4">
        {rooms?.map((r) => (
          <div key={r.id} className="border rounded p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold">{r.name}</h3>
              <span className="text-xs text-gray-500">{r.room_type}</span>
            </div>
            <div className="text-sm text-gray-500">Sleeps {r.sleeps}</div>
            <p className="text-sm whitespace-pre-line">{r.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
