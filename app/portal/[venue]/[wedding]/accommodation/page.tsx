import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";
import { applyMarkup } from "@/lib/billing/compute";

export default async function Accommodation({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { venue } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();
  const { data: rawRooms } = await supabase
    .from("accommodation_rooms")
    .select("id, name, room_type, sleeps, description, price_per_night, commission_value, commission_type, cost_treatment")
    .eq("venue_id", venue.id)
    .eq("active", true)
    .order("sort_order");

  // Honour the owner's settings: an 'included' room comes with the booking (no charge),
  // everything else is priced per night at the marked-up rate the owner configured.
  const rooms = (rawRooms ?? []).map((r) => {
    const included = r.cost_treatment === "included";
    const pricePerNight = included
      ? 0
      : applyMarkup(Number(r.price_per_night ?? 0), r.commission_value as number | null, r.commission_type as string | null);
    return { ...r, included, pricePerNight };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accommodation</h1>
      <p className="text-gray-600">On-site cottages and lodging at {venue.name}.</p>

      <div className="grid md:grid-cols-2 gap-4">
        {rooms.map((r) => (
          <div key={r.id} className="border rounded p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold">{r.name}</h3>
              <span className="text-xs text-gray-500">{r.room_type}</span>
            </div>
            <div className="text-sm text-gray-500">Sleeps {r.sleeps}</div>
            <p className="text-sm whitespace-pre-line">{r.description}</p>
            <div className="text-sm pt-1">
              {r.included ? (
                <span className="text-xs font-medium text-green-700">Included</span>
              ) : (
                <span className="font-medium">R{Number(r.pricePerNight).toLocaleString()}<span className="text-gray-500 font-normal"> / night</span></span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
