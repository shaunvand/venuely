import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";

type Submission = {
  id: string;
  kind: string;
  totals: Record<string, unknown> | null;
  message: string | null;
  created_at: string;
  state: WeddingState;
};

type WeddingState = {
  rentalSelections?: Record<string, { sel?: boolean; qty?: number; mg?: boolean; wed?: boolean; fb?: boolean }>;
  catalogueSelections?: Record<string, { sel?: boolean; mg?: boolean; wed?: boolean; fb?: boolean }>;
  guests?: string[];
  roomAssignments?: Record<string, string[]>;
  totalBudget?: string;
};

export default async function WeddingDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, guest_count, status, total_budget, notes, wedding_state, wedding_state_updated_at")
    .eq("venue_id", venue.id)
    .eq("slug", slug)
    .single();
  if (!wedding) notFound();

  const state = (wedding.wedding_state ?? {}) as WeddingState;

  const [{ count: guestCount }, { count: supplierCount }, { data: submissionsRaw }] = await Promise.all([
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase
      .from("submissions")
      .select("id, kind, totals, message, created_at, state")
      .eq("wedding_id", wedding.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const submissions = (submissionsRaw ?? []) as Submission[];

  // Compute live picture from state.
  const portalGuests = state.guests ?? [];
  const rentalsSelected = Object.entries(state.rentalSelections ?? {}).filter(([, v]) => v.sel);
  const catalogueSelected = Object.entries(state.catalogueSelections ?? {}).filter(([, v]) => v.sel || v.mg || v.wed || v.fb);
  const rentalsBySlug = await loadRentalsMap(supabase, venue.id);
  const catalogueBySlug = await loadCatalogueMap(supabase, venue.id);

  let rentalsTotal = 0;
  const rentalLines = rentalsSelected.map(([code, v]) => {
    const item = rentalsBySlug.get(code);
    const days = [v.mg ? "M&G" : "", v.wed ? "Wed" : "", v.fb ? "FB" : ""].filter(Boolean);
    const dayCount = days.length || 1;
    const qty = v.qty ?? 1;
    const cost = item ? Number(item.price) * dayCount * qty : 0;
    rentalsTotal += cost;
    return { code, name: item?.name ?? code, days, qty, cost };
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">{wedding.couple_names}</h1>
          <p className="text-gray-600">{wedding.wedding_date} · {wedding.guest_count ?? "?"} guests · {wedding.status}</p>
          {wedding.wedding_state_updated_at && (
            <p className="text-xs text-gray-500 mt-1">
              Couple last updated their portal: {new Date(wedding.wedding_state_updated_at).toLocaleString()}
            </p>
          )}
        </div>
        <Link href={`/${wedding.slug}`} className="px-3 py-2 border rounded text-sm">
          Open couple portal →
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Guests in portal" value={portalGuests.length} />
        <Stat label="Guests (admin)" value={guestCount ?? 0} />
        <Stat label="Suppliers" value={supplierCount ?? 0} />
        <Stat label="Rentals total" value={`R${rentalsTotal.toLocaleString()}`} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Couple&apos;s rental selections (live)</h2>
        {rentalLines.length === 0 ? (
          <p className="text-sm text-gray-500">No rentals selected yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="text-left text-gray-500">
              <tr><th className="py-2">Item</th><th>Qty</th><th>Days</th><th className="text-right">Cost</th></tr>
            </thead>
            <tbody>
              {rentalLines.map((r) => (
                <tr key={r.code} className="border-t">
                  <td className="py-2">{r.name}</td>
                  <td>{r.qty}</td>
                  <td>{r.days.join(" · ") || "—"}</td>
                  <td className="text-right">R{r.cost.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold bg-stone-50">
                <td className="py-2" colSpan={3}>Total</td>
                <td className="text-right">R{rentalsTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Catalogue day-selections ({catalogueSelected.length})</h2>
        {catalogueSelected.length === 0 ? (
          <p className="text-sm text-gray-500">No catalogue items ticked.</p>
        ) : (
          <ul className="text-sm grid grid-cols-2 gap-x-6 gap-y-1">
            {catalogueSelected.map(([code, v]) => {
              const item = catalogueBySlug.get(code);
              const days = [v.mg ? "M&G" : "", v.wed ? "Wed" : "", v.fb ? "FB" : ""].filter(Boolean);
              return (
                <li key={code} className="flex justify-between gap-2">
                  <span>{item?.name ?? code}</span>
                  <span className="text-gray-500 text-xs">{days.join(" · ") || "—"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Guests in portal ({portalGuests.length})</h2>
        {portalGuests.length === 0 ? (
          <p className="text-sm text-gray-500">Couple hasn&apos;t added any guests yet.</p>
        ) : (
          <ul className="text-sm grid grid-cols-3 gap-x-6 gap-y-1">
            {portalGuests.map((name, i) => (<li key={i}>{name}</li>))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Submission history</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-gray-500">Couple hasn&apos;t submitted anything yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {submissions.map((s) => (
              <li key={s.id} className="border rounded p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{s.kind}</span>
                  <span className="text-xs text-gray-500">{new Date(s.created_at).toLocaleString()}</span>
                </div>
                {s.totals && (
                  <pre className="mt-1 text-xs text-gray-700 bg-stone-50 rounded p-2 overflow-auto">{JSON.stringify(s.totals, null, 2)}</pre>
                )}
                {s.message && <p className="mt-1 text-gray-600">{s.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function loadRentalsMap(supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) {
  const { data } = await supabase.from("rental_items").select("id, name, price").eq("venue_id", venueId);
  const m = new Map<string, { name: string; price: number }>();
  (data ?? []).forEach((r) => m.set(r.id, { name: r.name, price: Number(r.price) }));
  return m;
}
async function loadCatalogueMap(supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) {
  const { data } = await supabase.from("catalogue_items").select("id, name").eq("venue_id", venueId);
  const m = new Map<string, { name: string }>();
  (data ?? []).forEach((c) => m.set(c.id, { name: c.name }));
  return m;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-3">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
