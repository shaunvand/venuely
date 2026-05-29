import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EnquiryForm } from "@/components/EnquiryForm";
import { ReviewForm } from "@/components/ReviewForm";

// Public, SEO-friendly venue listing. Only renders venues with listed = true
// (RLS already hides the rest from the anon client; we also re-check + notFound).
//
// Route note: this static "/v/[slug]" segment sits ALONGSIDE the dynamic
// couple-portal catch-all at app/[wedding]/route.ts. In Next's App Router a
// concrete path segment ("v") always wins over a sibling dynamic segment
// ("[wedding]"), so /v/* is matched here and never reaches the portal handler —
// no RESERVED entry is required for correctness. (Adding "v"/"venues" to that
// handler's RESERVED set would be belt-and-braces but is outside this file set.)

type VenueRow = {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  description: string | null;
  directions: string | null;
  website: string | null;
  included_items: unknown;
  capacity_min: number | null;
  capacity_max: number | null;
  setting_type: string | null;
  ceremony_types: string[] | null;
  amenities: string[] | null;
  google_maps_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  listed: boolean;
};

const SELECT =
  "id, slug, name, region, description, directions, website, included_items, capacity_min, capacity_max, setting_type, ceremony_types, amenities, google_maps_url, contact_email, contact_phone, listed";

async function getVenue(slug: string): Promise<VenueRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venues")
    .select(SELECT)
    .eq("slug", slug)
    .eq("listed", true)
    .maybeSingle();
  return (data as VenueRow | null) ?? null;
}

async function getHero(venueId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("media_assets")
    .select("url, kind, sort_order")
    .eq("venue_id", venueId)
    .eq("owner_type", "venue")
    .in("kind", ["hero", "photo"])
    .order("sort_order")
    .limit(20);
  const rows = (data ?? []) as { url: string; kind: string }[];
  const hero = rows.find((r) => r.kind === "hero");
  return hero?.url ?? rows[0]?.url ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenue(slug);
  if (!venue) {
    return { title: "Venue not found — Venuely" };
  }
  const hero = await getHero(venue.id);
  const title = `${venue.name}${venue.region ? ` · ${venue.region}` : ""} — Wedding venue | Venuely`;
  const description =
    venue.description?.slice(0, 160) ??
    `Enquire about ${venue.name}${venue.region ? ` in ${venue.region}` : ""}, a wedding venue on Venuely. Request a quote and check availability.`;
  return {
    title,
    description,
    alternates: { canonical: `https://venuely.co.za/v/${venue.slug}` },
    openGraph: {
      title,
      description,
      url: `https://venuely.co.za/v/${venue.slug}`,
      siteName: "Venuely",
      locale: "en_ZA",
      type: "website",
      ...(hero ? { images: [{ url: hero }] } : {}),
    },
  };
}

export default async function VenueListing({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const venue = await getVenue(slug);
  if (!venue) notFound();

  const supabase = await createClient();

  const [galleryRes, areasRes, cataRes, accomRes, reviewsRes] = await Promise.all([
    supabase
      .from("media_assets")
      .select("url, kind, label, sort_order")
      .eq("venue_id", venue.id)
      .eq("owner_type", "venue")
      .in("kind", ["hero", "photo"])
      .order("sort_order")
      .limit(24),
    supabase
      .from("venue_areas")
      .select("name, description, image_url, sort_order")
      .eq("venue_id", venue.id)
      .eq("active", true)
      .order("sort_order")
      .limit(12),
    supabase
      .from("catalogue_items")
      .select("name, description, price, price_unit, category, sort_order")
      .eq("venue_id", venue.id)
      .eq("active", true)
      .order("sort_order")
      .limit(6),
    supabase
      .from("accommodation_rooms")
      .select("name, room_type, sleeps, price_per_night, description, sort_order")
      .eq("venue_id", venue.id)
      .eq("active", true)
      .order("sort_order")
      .limit(4),
    supabase
      .from("reviews")
      .select("author_name, rating, body, created_at")
      .eq("venue_id", venue.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const gallery = ((galleryRes.data ?? []) as { url: string; kind: string; label: string | null }[]).filter(
    (g) => /\.(jpe?g|png|webp|gif|avif|heic)(\?|$)/i.test(g.url)
  );
  const hero = gallery.find((g) => g.kind === "hero")?.url ?? gallery[0]?.url ?? null;
  const rest = gallery.filter((g) => g.url !== hero).slice(0, 6);

  const areas = (areasRes.data ?? []) as { name: string; description: string | null; image_url: string | null }[];
  const catalogue = (cataRes.data ?? []) as {
    name: string; description: string | null; price: number; price_unit: string | null; category: string | null;
  }[];
  const rooms = (accomRes.data ?? []) as {
    name: string; room_type: string | null; sleeps: number; price_per_night: number; description: string | null;
  }[];
  const reviews = (reviewsRes.data ?? []) as {
    author_name: string | null; rating: number | null; body: string | null; created_at: string;
  }[];
  const ratedReviews = reviews.filter((r) => typeof r.rating === "number" && r.rating! >= 1);
  const avgRating =
    ratedReviews.length > 0
      ? ratedReviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratedReviews.length
      : null;

  const included = Array.isArray(venue.included_items)
    ? (venue.included_items as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];
  const ceremonyTypes = (venue.ceremony_types ?? []).filter(Boolean);
  const amenities = (venue.amenities ?? []).filter(Boolean);

  const capacity =
    venue.capacity_max && venue.capacity_min
      ? `${venue.capacity_min}–${venue.capacity_max} guests`
      : venue.capacity_max
      ? `Up to ${venue.capacity_max} guests`
      : venue.capacity_min
      ? `From ${venue.capacity_min} guests`
      : null;

  const priceUnit = (u: string | null) =>
    u === "per_person" ? "per person" : u === "per_hour" ? "per hour" : "";

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b backdrop-blur-sm" style={{ borderColor: "var(--line)", background: "rgba(255,246,240,0.9)" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/venues" className="text-sm hover:opacity-60 transition-opacity" style={{ color: "var(--ink-2)" }}>
            ← All venues
          </Link>
          <Link href="/" className="font-serif text-xl" style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}>
            Venuely.
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-8">
        <div className="rounded-3xl overflow-hidden" style={{ border: "1px solid var(--line)", background: "var(--sage-2)" }}>
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt={venue.name} className="w-full h-[42vh] sm:h-[56vh] object-cover" />
          ) : (
            <div className="w-full h-[40vh] flex items-center justify-center font-serif text-6xl" style={{ color: "#fff" }}>
              {venue.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="mt-6">
          {venue.region && (
            <p className="text-xs uppercase tracking-[0.32em]" style={{ color: "var(--sage)" }}>
              {venue.region}
            </p>
          )}
          <h1 className="font-serif text-4xl sm:text-5xl leading-tight mt-2" style={{ fontWeight: 900 }}>
            {venue.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {avgRating !== null && (
              <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--ink)" }}>
                <Stars value={avgRating} />
                <span style={{ fontWeight: 600 }}>{avgRating.toFixed(1)}</span>
                <span style={{ color: "var(--ink-2)" }}>
                  ({ratedReviews.length} review{ratedReviews.length === 1 ? "" : "s"})
                </span>
              </span>
            )}
            {capacity && <Pill>{capacity}</Pill>}
            {venue.setting_type && <Pill>{titleCase(venue.setting_type)}</Pill>}
            {ceremonyTypes.slice(0, 3).map((c) => (
              <Pill key={c}>{c}</Pill>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-[1fr_360px] gap-10 items-start">
        {/* LEFT — content */}
        <div className="space-y-10 min-w-0">
          {/* About */}
          {venue.description && (
            <Section title="About">
              <p className="text-base leading-relaxed whitespace-pre-line" style={{ color: "var(--ink-2)" }}>
                {venue.description}
              </p>
              {venue.website && (
                <a
                  href={venue.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-sm font-medium hover:opacity-70"
                  style={{ color: "var(--poppy)" }}
                >
                  Visit website →
                </a>
              )}
            </Section>
          )}

          {/* Gallery */}
          {rest.length > 0 && (
            <Section title="Gallery">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {rest.map((g, i) => (
                  <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt={g.label ?? venue.name} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* What's included */}
          {included.length > 0 && (
            <Section title="What's included">
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
                {included.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--ink)" }}>
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] flex-shrink-0"
                      style={{ background: "var(--sage-2)", color: "var(--ink)" }}
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Areas */}
          {areas.length > 0 && (
            <Section title="Spaces">
              <div className="grid sm:grid-cols-2 gap-4">
                {areas.map((a, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden bg-white" style={{ border: "1px solid var(--line)" }}>
                    {a.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_url} alt={a.name} className="w-full h-36 object-cover" loading="lazy" />
                    ) : null}
                    <div className="p-4">
                      <h3 className="font-serif text-lg" style={{ color: "var(--ink)" }}>{a.name}</h3>
                      {a.description && (
                        <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--ink-2)" }}>{a.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Indicative offerings */}
          {(catalogue.length > 0 || rooms.length > 0) && (
            <Section title="A taste of what's on offer">
              <div className="space-y-3">
                {catalogue.map((c, i) => (
                  <OfferRow
                    key={`c${i}`}
                    name={c.name}
                    tag={c.category}
                    desc={c.description}
                    price={c.price}
                    unit={priceUnit(c.price_unit)}
                  />
                ))}
                {rooms.map((r, i) => (
                  <OfferRow
                    key={`r${i}`}
                    name={r.name}
                    tag={r.room_type ?? "Accommodation"}
                    desc={r.description ?? `Sleeps ${r.sleeps}`}
                    price={r.price_per_night}
                    unit="per night"
                  />
                ))}
              </div>
              <p className="text-xs mt-3" style={{ color: "var(--ink-2)" }}>
                Indicative pricing — request a quote for your full, tailored proposal.
              </p>
            </Section>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <Section title="Amenities">
              <div className="flex flex-wrap gap-2">
                {amenities.map((a) => (
                  <Pill key={a}>{a}</Pill>
                ))}
              </div>
            </Section>
          )}

          {/* Directions */}
          {(venue.directions || venue.google_maps_url) && (
            <Section title="Getting there">
              {venue.directions && (
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--ink-2)" }}>
                  {venue.directions}
                </p>
              )}
              {venue.google_maps_url && (
                <a
                  href={venue.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-sm font-medium hover:opacity-70"
                  style={{ color: "var(--poppy)" }}
                >
                  Open in Google Maps →
                </a>
              )}
            </Section>
          )}

          {/* Reviews */}
          <Section title="Reviews">
            {avgRating !== null && (
              <div className="flex items-center gap-2.5 mb-5">
                <span className="font-serif text-3xl" style={{ color: "var(--ink)", fontWeight: 900 }}>
                  {avgRating.toFixed(1)}
                </span>
                <span className="flex flex-col">
                  <Stars value={avgRating} />
                  <span className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
                    {ratedReviews.length} review{ratedReviews.length === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
            )}

            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-white p-5"
                    style={{ border: "1px solid var(--line)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-serif text-base" style={{ color: "var(--ink)", fontWeight: 700 }}>
                        {r.author_name || "A happy couple"}
                      </span>
                      {typeof r.rating === "number" && <Stars value={r.rating} />}
                    </div>
                    {r.body && (
                      <p className="text-sm mt-2 leading-relaxed whitespace-pre-line" style={{ color: "var(--ink-2)" }}>
                        {r.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm mb-1" style={{ color: "var(--ink-2)" }}>
                No reviews yet — be the first to share your experience.
              </p>
            )}

            <div className="mt-5">
              <ReviewForm venueId={venue.id} venueName={venue.name} />
            </div>
          </Section>
        </div>

        {/* RIGHT — enquiry CTA (sticky on desktop) */}
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-2xl bg-white p-6" style={{ border: "1px solid var(--line)" }}>
            <h2 className="font-serif text-2xl leading-tight" style={{ color: "var(--ink)" }}>
              Request a quote
            </h2>
            <p className="text-sm mt-1 mb-5" style={{ color: "var(--ink-2)" }}>
              Check availability and get a tailored quote from {venue.name}.
            </p>
            <EnquiryForm venueId={venue.id} venueName={venue.name} source={`listing:${venue.slug}`} />
          </div>
        </aside>
      </div>

      <footer className="border-t" style={{ borderColor: "var(--line)", background: "var(--cream)" }}>
        <div className="max-w-5xl mx-auto px-6 py-8 text-xs flex flex-wrap items-center justify-between gap-3" style={{ color: "var(--ink-2)" }}>
          <span>© {new Date().getFullYear()} Venuely · Built for wedding venues.</span>
          <Link href="/venues" className="hover:opacity-60">Browse more venues</Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl mb-4" style={{ color: "var(--ink)", fontWeight: 900 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
      style={{ background: "var(--peach)", color: "var(--poppy-deep)" }}
    >
      {children}
    </span>
  );
}

function OfferRow({
  name,
  tag,
  desc,
  price,
  unit,
}: {
  name: string;
  tag: string | null;
  desc: string | null;
  price: number;
  unit: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl bg-white p-4"
      style={{ border: "1px solid var(--line)" }}
    >
      <div className="min-w-0">
        {tag && (
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--sage)" }}>
            {tag}
          </span>
        )}
        <div className="font-serif text-base" style={{ color: "var(--ink)" }}>{name}</div>
        {desc && (
          <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--ink-2)" }}>{desc}</div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-serif text-lg" style={{ color: "var(--poppy)", fontWeight: 700 }}>
          R{Number(price).toLocaleString("en-ZA")}
        </div>
        {unit && <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>{unit}</div>}
      </div>
    </div>
  );
}

function titleCase(s: string): string {
  if (s === "both") return "Indoor & outdoor";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Read-only star row. Rounds to the nearest whole star for the filled count.
function Stars({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span aria-label={`${value.toFixed(1)} out of 5`} className="inline-flex leading-none">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden
          style={{ color: n <= filled ? "var(--poppy)" : "var(--line)", fontSize: "1rem" }}
        >
          ★
        </span>
      ))}
    </span>
  );
}
