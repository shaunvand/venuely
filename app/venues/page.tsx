import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Wedding venues in South Africa — Venuely",
  description:
    "Browse beautiful South African wedding venues. Filter by region and guest capacity, then request a quote in a couple of clicks.",
  openGraph: {
    title: "Wedding venues in South Africa — Venuely",
    description:
      "Browse beautiful South African wedding venues. Filter by region and guest capacity, then request a quote.",
    url: "https://venuely.co.za/venues",
    siteName: "Venuely",
    locale: "en_ZA",
    type: "website",
  },
};

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  description: string | null;
  capacity_min: number | null;
  capacity_max: number | null;
};

type Hero = { venue_id: string; url: string; kind: string; sort_order: number };

export default async function VenuesDirectory({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; capacity?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Public read: RLS exposes only listed = true venues to anon (see
  // 20260529120000_enquiries.sql "venue public listing read").
  const { data: venuesRaw } = await supabase
    .from("venues")
    .select("id, slug, name, region, description, capacity_min, capacity_max")
    .eq("listed", true)
    .order("name");

  const venues = (venuesRaw ?? []) as VenueRow[];

  // Hero / first photo per venue for the card thumbnail.
  const ids = venues.map((v) => v.id);
  let heroByVenue: Record<string, string> = {};
  if (ids.length) {
    const { data: media } = await supabase
      .from("media_assets")
      .select("venue_id, url, kind, sort_order")
      .in("venue_id", ids)
      .eq("owner_type", "venue")
      .in("kind", ["hero", "photo"])
      .order("sort_order");
    // Prefer a hero; otherwise the first photo. Keep the first seen per venue
    // for each kind (rows already ordered by sort_order).
    const heroes: Record<string, string> = {};
    const photos: Record<string, string> = {};
    ((media ?? []) as Hero[]).forEach((m) => {
      if (m.kind === "hero" && !heroes[m.venue_id]) heroes[m.venue_id] = m.url;
      if (m.kind === "photo" && !photos[m.venue_id]) photos[m.venue_id] = m.url;
    });
    heroByVenue = Object.fromEntries(
      ids.map((id) => [id, heroes[id] ?? photos[id] ?? ""])
    );
  }

  // Build region filter options from the listed set.
  const regions = Array.from(
    new Set(venues.map((v) => v.region).filter(Boolean) as string[])
  ).sort();

  // Apply filters (searchParams).
  const regionFilter = (sp.region || "").trim();
  const capacityFilter = sp.capacity ? Number(sp.capacity) : null;

  const filtered = venues.filter((v) => {
    if (regionFilter && v.region !== regionFilter) return false;
    if (capacityFilter && capacityFilter > 0) {
      const max = v.capacity_max ?? v.capacity_min ?? 0;
      if (max && max < capacityFilter) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: "var(--line)", background: "rgba(255,246,240,0.9)" }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl" style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}>
            Venuely.
          </Link>
          <Link href="/signup" className="text-sm hover:opacity-60 transition-opacity" style={{ color: "var(--ink-2)" }}>
            List your venue
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-12 pb-6">
        <p className="text-xs uppercase tracking-[0.32em] mb-3" style={{ color: "var(--sage)" }}>
          Find your venue
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight" style={{ fontWeight: 900 }}>
          Wedding venues across <span style={{ color: "var(--poppy)", fontStyle: "italic" }}>South Africa</span>
        </h1>
        <p className="mt-4 text-base max-w-xl" style={{ color: "var(--ink-2)" }}>
          Hand-picked venues, real availability. Filter by region and guest count, then request a quote in a couple of clicks.
        </p>

        {/* Filters — GET form, no JS needed (searchParams). */}
        <form method="GET" className="mt-8 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium block" style={{ color: "var(--ink-2)" }}>Region</label>
            <select
              name="region"
              defaultValue={regionFilter}
              className="rounded-lg px-3 py-2.5 text-sm bg-white"
              style={{ border: "1px solid var(--line)", minWidth: 180 }}
            >
              <option value="">All regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium block" style={{ color: "var(--ink-2)" }}>Min. guests</label>
            <input
              name="capacity"
              type="number"
              min={0}
              defaultValue={sp.capacity ?? ""}
              placeholder="e.g. 120"
              className="rounded-lg px-3 py-2.5 text-sm bg-white"
              style={{ border: "1px solid var(--line)", width: 140 }}
            />
          </div>
          <button
            type="submit"
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all hover:scale-[1.02]"
            style={{ background: "var(--poppy)" }}
          >
            Filter
          </button>
          {(regionFilter || sp.capacity) && (
            <Link href="/venues" className="text-sm self-center hover:opacity-60" style={{ color: "var(--ink-2)" }}>
              Clear
            </Link>
          )}
        </form>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center mt-4"
            style={{ background: "#fff", border: "1px dashed var(--line)", color: "var(--ink-2)" }}
          >
            <p className="font-serif text-2xl mb-2" style={{ color: "var(--ink)" }}>
              No venues match just yet
            </p>
            <p className="text-sm">
              {venues.length === 0
                ? "We're adding venues all the time — check back soon."
                : "Try widening your region or lowering the guest count."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-2">
            {filtered.map((v) => {
              const hero = heroByVenue[v.id];
              const cap =
                v.capacity_max && v.capacity_min
                  ? `${v.capacity_min}–${v.capacity_max} guests`
                  : v.capacity_max
                  ? `Up to ${v.capacity_max} guests`
                  : v.capacity_min
                  ? `From ${v.capacity_min} guests`
                  : null;
              const blurb = v.description
                ? v.description.length > 120
                  ? v.description.slice(0, 117).trimEnd() + "…"
                  : v.description
                : null;
              return (
                <Link
                  key={v.id}
                  href={`/v/${v.slug}`}
                  className="group rounded-2xl overflow-hidden bg-white transition-all hover:-translate-y-1 hover:shadow-[0_16px_40px_-16px_rgba(28,25,23,0.25)]"
                  style={{ border: "1px solid var(--line)" }}
                >
                  <div className="aspect-[4/3] overflow-hidden" style={{ background: "var(--sage-2)" }}>
                    {hero ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero}
                        alt={v.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-serif text-3xl" style={{ color: "#fff" }}>
                        {v.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {v.region && (
                      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--sage)" }}>
                        {v.region}
                      </div>
                    )}
                    <h2 className="font-serif text-xl leading-snug" style={{ color: "var(--ink)" }}>
                      {v.name}
                    </h2>
                    {cap && (
                      <div className="text-sm mt-1" style={{ color: "var(--ink-2)" }}>
                        {cap}
                      </div>
                    )}
                    {blurb && (
                      <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--ink-2)" }}>
                        {blurb}
                      </p>
                    )}
                    <span
                      className="inline-block mt-4 text-sm font-medium"
                      style={{ color: "var(--poppy)" }}
                    >
                      View venue →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t" style={{ borderColor: "var(--line)", background: "var(--cream)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 text-xs flex flex-wrap items-center justify-between gap-3" style={{ color: "var(--ink-2)" }}>
          <span>© {new Date().getFullYear()} Venuely · Built for wedding venues.</span>
          <Link href="/" className="hover:opacity-60">Home</Link>
        </div>
      </footer>
    </div>
  );
}
