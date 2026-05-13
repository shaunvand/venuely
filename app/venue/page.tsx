import Link from "next/link";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";

type Step = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  count?: number | null;
  hint?: string;
};

export default async function VenueOverview() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const [
    { count: weddingsCount },
    { count: catalogueCount },
    { count: rentalsCount },
    { count: roomsCount },
    { count: paymentsCount },
    { count: suppliersCount },
  ] = await Promise.all([
    supabase.from("weddings").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("catalogue_items").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("rental_items").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("accommodation_rooms").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("payments").select("*, wedding:weddings!inner(venue_id)", { count: "exact", head: true }).eq("wedding.venue_id", venue.id),
    supabase.from("suppliers").select("*, wedding:weddings!inner(venue_id)", { count: "exact", head: true }).eq("wedding.venue_id", venue.id),
  ]);

  const venueDetailsDone = Boolean(venue.address || venue.region);

  const steps: Step[] = [
    {
      key: "venue",
      title: "Confirm your venue details",
      description: "Address (Google Places), branding colour, contact details. The address shows on every couple portal.",
      href: "/venue/settings",
      cta: venueDetailsDone ? "Edit details" : "Add details",
      done: venueDetailsDone,
      hint: venue.address ?? venue.region ?? undefined,
    },
    {
      key: "catalogue",
      title: "Add your catalogue items",
      description: "Everything included with the booking — décor, tableware, furniture. Couples tick which days they need each item.",
      href: "/venue/catalogue",
      cta: "Open catalogue",
      done: (catalogueCount ?? 0) > 0,
      count: catalogueCount,
    },
    {
      key: "rentals",
      title: "Add rentals (paid extras)",
      description: "Items with a price per day and a stock limit. Couples select quantity + days — totals tally automatically.",
      href: "/venue/rentals",
      cta: "Open rentals",
      done: (rentalsCount ?? 0) > 0,
      count: rentalsCount,
    },
    {
      key: "accommodation",
      title: "Add accommodation rooms",
      description: "Cottages, suites, tents — anything on-site. Couples can assign guests to rooms.",
      href: "/venue/accommodation",
      cta: "Open accommodation",
      done: (roomsCount ?? 0) > 0,
      count: roomsCount,
    },
    {
      key: "weddings",
      title: "Create your first wedding",
      description: "Add a booked couple. Their portal URL is auto-generated as e.g. AlexAndSamWedding.",
      href: "/venue/weddings",
      cta: "Add wedding",
      done: (weddingsCount ?? 0) > 0,
      count: weddingsCount,
    },
    {
      key: "suppliers",
      title: "Recommend suppliers",
      description: "Photographers, florists, caterers you trust. Couples browse your list instead of guessing.",
      href: "/venue/weddings",
      cta: "Per-wedding suppliers →",
      done: (suppliersCount ?? 0) > 0,
      count: suppliersCount,
      hint: "Add suppliers from a wedding's detail page.",
    },
    {
      key: "payments",
      title: "Track payments + invoices",
      description: "Deposits + final balances per wedding. Mark paid, see overdue, attach invoices.",
      href: "/venue/payments",
      cta: "Open payments",
      done: (paymentsCount ?? 0) > 0,
      count: paymentsCount,
    },
    {
      key: "photos",
      title: "Upload venue photos",
      description: "Hero gallery on the Our Venue tab of every couple portal. Coming soon — currently shown from seeded images.",
      href: "/venue/settings",
      cta: "Photo upload (soon)",
      done: false,
      hint: "Available in next update.",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="space-y-10">
      <header>
        <div className="vy-eyebrow">Welcome to Venuely</div>
        <h1 className="vy-h1 mt-1">{venue.name}</h1>
        {(venue.address || venue.region) && (
          <p className="text-stone-600 text-sm mt-1">
            {venue.address ?? venue.region}
            {venue.google_maps_url && (
              <a href={venue.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-[color:var(--forest)] hover:underline ml-2">↗ Google Maps</a>
            )}
          </p>
        )}
      </header>

      <section className="vy-card-hero">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="vy-eyebrow">Setup progress</div>
            <h2 className="vy-h2 mt-1">{doneCount} of {totalCount} steps complete</h2>
          </div>
          <div className="font-serif text-4xl tabular-nums text-[color:var(--forest)]">{pct}%</div>
        </div>
        <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
          <div className="h-full bg-[color:var(--forest)] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.key} className={`vy-card flex gap-4 ${s.done ? "border-[color:var(--sage)]/40 bg-[color:var(--cream)]/40" : ""}`}>
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-medium text-sm ${s.done ? "bg-[color:var(--forest)] text-white" : "bg-stone-100 text-stone-500"}`}>
              {s.done ? "✓" : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="font-semibold text-[15px]">{s.title}</h3>
                {typeof s.count === "number" && (
                  <span className="vy-tag vy-tag-soft">{s.count} item{s.count === 1 ? "" : "s"}</span>
                )}
              </div>
              <p className="text-sm text-stone-600 mt-1">{s.description}</p>
              {s.hint && <p className="text-xs text-stone-500 mt-1 italic">{s.hint}</p>}
            </div>
            <div className="flex-shrink-0 flex items-center">
              <Link href={s.href} className={`vy-btn ${s.done ? "vy-btn-secondary" : "vy-btn-primary"} whitespace-nowrap`}>
                {s.cta}
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-sm text-stone-600 pt-4 border-t border-[color:var(--line)]">
        Tip — each couple sees their portal at{" "}
        <code className="text-xs bg-stone-100 px-1.5 py-0.5 rounded">venuely.co.za/[wedding-slug]</code>
        . Anything you add here appears there immediately.
      </p>
    </div>
  );
}
