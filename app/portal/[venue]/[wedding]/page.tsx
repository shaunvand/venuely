import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { venue, wedding } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();

  const [{ count: guestCount }, { count: supplierCount }, { count: rentalCount }, { count: doneCount }, { count: totalCount }] = await Promise.all([
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("rental_holds").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("completed", true),
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
  ]);

  const daysOut = wedding.wedding_date
    ? Math.max(0, Math.ceil((new Date(wedding.wedding_date).getTime() - new Date().getTime()) / 86400000))
    : null;

  const cards = [
    { label: "Days to go", value: daysOut === null ? "—" : daysOut },
    { label: "Guests", value: `${guestCount ?? 0} / ${wedding.guest_count ?? "?"}` },
    { label: "Suppliers", value: supplierCount ?? 0 },
    { label: "Rentals selected", value: rentalCount ?? 0 },
    { label: "Checklist", value: `${doneCount ?? 0} / ${totalCount ?? 0}` },
    { label: "Budget", value: wedding.total_budget ? `R${wedding.total_budget.toLocaleString()}` : "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{wedding.couple_names}</h1>
        <p className="text-gray-600">
          {wedding.wedding_date} · at {venue.name}, {venue.region}
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="border rounded p-4">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
