import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";

export default async function WeddingDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, guest_count, status, total_budget, notes")
    .eq("venue_id", venue.id)
    .eq("slug", slug)
    .single();
  if (!wedding) notFound();

  const [{ count: guestCount }, { count: supplierCount }, { count: paymentsPending }, { data: selections }] = await Promise.all([
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("payments").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("status", "pending"),
    supabase
      .from("wedding_selections")
      .select("id, quantity, rental:rental_items(name, price), catalogue:catalogue_items(name)")
      .eq("wedding_id", wedding.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">{wedding.couple_names}</h1>
          <p className="text-gray-600">{wedding.wedding_date} · {wedding.guest_count} guests · {wedding.status}</p>
        </div>
        <Link href={`/portal/${venue.slug}/${wedding.slug}`} className="px-3 py-2 border rounded text-sm">Open couple portal →</Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Guests" value={guestCount ?? 0} />
        <Stat label="Suppliers" value={supplierCount ?? 0} />
        <Stat label="Payments pending" value={paymentsPending ?? 0} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Couple's rental selections</h2>
        <ul className="text-sm space-y-1">
          {selections?.map((s) => (
            // @ts-expect-error joined row
            <li key={s.id}>{s.quantity}× {s.rental?.name || s.catalogue?.name}</li>
          ))}
          {!selections?.length && <li className="text-gray-500">No selections yet.</li>}
        </ul>
      </section>

      {wedding.notes && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Notes</h2>
          <p className="text-sm whitespace-pre-line">{wedding.notes}</p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded p-3">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
