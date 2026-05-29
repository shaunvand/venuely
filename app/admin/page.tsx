import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type WeddingRow = {
  id: string;
  slug: string;
  couple_names: string;
  wedding_date: string | null;
  venue: { slug: string; name: string } | null;
};

export default async function OwnerDashboard() {
  const supabase = await createClient();

  const [{ count: venueCount }, { data: venues }, { data: weddingsRaw }] = await Promise.all([
    supabase.from("venues").select("*", { count: "exact", head: true }),
    supabase.from("venues").select("id, slug, name, region, subscription_status, listed").order("created_at"),
    supabase
      .from("weddings")
      .select("id, slug, couple_names, wedding_date, venue:venues(slug, name)")
      .order("wedding_date", { ascending: true }),
  ]);

  const weddings = (weddingsRaw ?? []) as unknown as WeddingRow[];

  // ---- Funnel analytics (additive, read-only) ----------------------------
  // Lead flow across this owner's venues. RLS exposes only enquiries on the
  // owner's venues; an empty / missing enquiries table simply yields zeros
  // (we read .data ?? [], never throw).
  const ownerVenueIds = (venues ?? []).map((v) => v.id);
  let totalEnquiries = 0;
  let bookedEnquiries = 0;
  if (ownerVenueIds.length) {
    const { data: enquiryRows } = await supabase
      .from("enquiries")
      .select("status, venue_id")
      .in("venue_id", ownerVenueIds);
    const rows = enquiryRows ?? [];
    totalEnquiries = rows.length;
    bookedEnquiries = rows.filter((e) => e.status === "booked").length;
  }
  const conversionRate = totalEnquiries > 0 ? (bookedEnquiries / totalEnquiries) * 100 : 0;
  const activeListedVenues = (venues ?? []).filter((v) => v.listed).length;

  // Fees collected month-to-date: sum of platform_fee_owed across this owner's
  // venues where the platform fee has been settled this calendar month.
  // Mirrors the per-venue tally on /admin/billing (booked = platform_fee_paid_at set).
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const venueIds = (venues ?? []).map((v) => v.id);
  let feesCollectedMtd = 0;
  if (venueIds.length) {
    const { data: paidFees } = await supabase
      .from("weddings")
      .select("platform_fee_owed, platform_fee_paid_at, venue_id")
      .in("venue_id", venueIds)
      .gte("platform_fee_paid_at", monthStart);
    feesCollectedMtd = (paidFees ?? []).reduce(
      (sum, w) => (w.platform_fee_paid_at ? sum + Number(w.platform_fee_owed ?? 0) : sum),
      0,
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Owner Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Venues" value={venueCount ?? 0} />
        <Stat label="Fees collected (MTD)" value={`R${feesCollectedMtd.toLocaleString()}`} />
        <Stat label="Trial venues" value={venues?.filter((v) => v.subscription_status === "trialing").length ?? 0} />
      </div>

      <section>
        <h2 className="font-semibold mb-3">Lead funnel</h2>
        <p className="text-sm text-gray-600 mb-4">
          Enquiries across all your venues, from first lead to booked wedding.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Total enquiries" value={totalEnquiries} />
          <Stat
            label="Enquiry → booked"
            value={totalEnquiries > 0 ? `${conversionRate.toFixed(1)}%` : "—"}
          />
          <Stat label="Active listed venues" value={activeListedVenues} />
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Jump in</h2>
        <p className="text-sm text-gray-600 mb-4">
          You are the owner, but Venuely has two other surfaces. Use these to switch contexts:
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            href="/venue"
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors block"
          >
            <div className="font-medium">Venue admin →</div>
            <div className="text-sm text-gray-600 mt-1">
              Manage Pat Busch&apos;s catalogue, rentals, accommodation, weddings and payments. Same pages your venue staff will use.
            </div>
          </Link>
          <Link
            href="/admin/billing"
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors block"
          >
            <div className="font-medium">Billing →</div>
            <div className="text-sm text-gray-600 mt-1">
              1% platform fee on wedding spend per venue. Live tally of collected vs outstanding.
            </div>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Open a couple portal</h2>
        <p className="text-sm text-gray-600 mb-4">
          Each wedding has its own branded portal at <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">venuely.co.za/portal/[venue]/[wedding]</code>. As owner you can open any of them.
        </p>
        <ul className="border rounded-lg divide-y">
          {weddings.map((w) => (
            <li key={w.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{w.couple_names}</div>
                <div className="text-xs text-gray-500">
                  {w.venue?.name} {w.wedding_date ? `· ${w.wedding_date}` : ""}
                </div>
              </div>
              {w.venue && (
                <Link
                  href={`/portal/${w.venue.slug}/${w.slug}`}
                  className="text-sm px-3 py-1.5 rounded bg-stone-900 text-white hover:bg-stone-800"
                >
                  Open portal →
                </Link>
              )}
            </li>
          ))}
          {!weddings.length && (
            <li className="p-4 text-sm text-gray-500">
              No weddings yet — create one from the{" "}
              <Link href="/venue/weddings" className="text-blue-600 hover:underline">
                venue admin
              </Link>
              .
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-semibold">{value}</div>
    </div>
  );
}
