import Link from "next/link";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { computeSetupSteps } from "@/lib/venue/setup";
import { WelcomeImportModal } from "@/components/WelcomeImportModal";

export default async function VenueOverview() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { doneCount, totalCount, pct, counts } = await computeSetupSteps(supabase, venue);

  // Pull a few headline data points for the stats grid.
  const todayIso = new Date().toISOString().slice(0, 10);
  const [
    { data: upcoming },
    { data: recentWeddings },
    { data: paySum },
  ] = await Promise.all([
    supabase
      .from("weddings")
      .select("id, slug, couple_names, wedding_date")
      .eq("venue_id", venue.id)
      .gte("wedding_date", todayIso)
      .order("wedding_date")
      .limit(5),
    supabase
      .from("weddings")
      .select("id, slug, couple_names, wedding_date")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("payments")
      .select("amount, status, wedding:weddings!inner(venue_id)")
      .eq("wedding.venue_id", venue.id),
  ]);

  const payments = (paySum ?? []) as Array<{ amount: number | string; status: string | null }>;
  const collected = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const invoiced = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const venueEmpty =
    counts.catalogue === 0 && counts.rentals === 0 && counts.rooms === 0;

  const stats = [
    {
      label: "Upcoming weddings",
      value: (upcoming?.length ?? 0).toString(),
      sub: counts.weddings ? `${counts.weddings} total` : "No bookings yet",
      href: "/venue/weddings",
    },
    {
      label: "Accommodation rooms",
      value: counts.rooms.toString(),
      sub: counts.rooms ? "Active rooms" : "Add your first room",
      href: "/venue/accommodation",
    },
    {
      label: "Catalogue items",
      value: counts.catalogue.toString(),
      sub: counts.rentals ? `+ ${counts.rentals} rentals` : "Included extras",
      href: "/venue/catalogue",
    },
    {
      label: "Payments collected",
      value: collected ? `R${collected.toLocaleString("en-ZA")}` : "R0",
      sub: invoiced ? `of R${invoiced.toLocaleString("en-ZA")} invoiced` : "No invoices yet",
      href: "/venue/payments",
    },
  ];

  return (
    <div className="space-y-10">
      {venueEmpty && <WelcomeImportModal venueId={venue.id} venueName={venue.name} />}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="vy-eyebrow">Welcome to Venuely</div>
          <h1 className="vy-h1 mt-1">{venue.name}</h1>
          {(venue.address || venue.region) && (
            <p className="text-stone-600 text-sm mt-1">
              {venue.address ?? venue.region}
              {venue.google_maps_url && (
                <a href={venue.google_maps_url} target="_blank" rel="noopener noreferrer" className="ml-2 hover:underline" style={{ color: "var(--poppy)" }}>↗ Google Maps</a>
              )}
            </p>
          )}
        </div>

        <Link
          href="/venue/setup"
          className="vy-card flex items-center gap-3 hover:shadow-md transition-shadow"
          style={{ padding: "0.55rem 0.9rem" }}
        >
          <div className="relative w-9 h-9">
            <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="var(--poppy)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 2 * Math.PI * 15} ${2 * Math.PI * 15}`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">{pct}%</span>
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>Setup checklist</div>
            <div className="text-sm font-medium">{doneCount} of {totalCount} done →</div>
          </div>
        </Link>
      </header>

      {/* Stats grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="vy-stat hover:shadow-md transition-shadow">
            <div className="vy-stat-label">{s.label}</div>
            <div className="vy-stat-value">{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--ink-2)" }}>{s.sub}</div>
          </Link>
        ))}
      </div>

      {/* Upcoming weddings */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="vy-h2">Upcoming weddings</h2>
          <Link href="/venue/weddings" className="text-sm hover:underline" style={{ color: "var(--poppy)" }}>
            View all →
          </Link>
        </div>
        {upcoming && upcoming.length > 0 ? (
          <div className="vy-card divide-y" style={{ padding: 0 }}>
            {upcoming.map((w) => (
              <Link
                key={w.id}
                href={`/venue/weddings/${w.slug}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[color:var(--cream)] transition-colors"
              >
                <div>
                  <div className="font-medium text-[15px]">{w.couple_names}</div>
                  <div className="text-xs" style={{ color: "var(--ink-2)" }}>
                    {new Date(w.wedding_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
                <span style={{ color: "var(--poppy)" }}>→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="vy-empty">
            No upcoming weddings.{" "}
            <Link href="/venue/weddings" className="underline" style={{ color: "var(--poppy)" }}>Add one</Link>.
          </div>
        )}
      </section>

      {/* Recently added */}
      {recentWeddings && recentWeddings.length > 0 && counts.weddings > (upcoming?.length ?? 0) && (
        <section>
          <h2 className="vy-h2 mb-3">Recently added</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {recentWeddings.slice(0, 4).map((w) => (
              <Link
                key={w.id}
                href={`/venue/weddings/${w.slug}`}
                className="vy-card hover:shadow-md transition-shadow"
              >
                <div className="font-medium text-[15px]">{w.couple_names}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
                  {new Date(w.wedding_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-sm text-stone-600 pt-4 border-t border-[color:var(--line)]">
        Tip — each couple sees their portal at{" "}
        <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">venuely.co.za/[wedding-slug]</code>
        . Anything you add here appears there immediately.
      </p>
    </div>
  );
}
