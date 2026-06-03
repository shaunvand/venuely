import { redirect, notFound } from "next/navigation";
import { portalAccess } from "@/lib/portal/access";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveTemplate, resolveTheme } from "@/lib/portal/templates";
import { applyMarkup } from "@/lib/billing/compute";
import { getWeddingTotals } from "@/app/venue/weddings/actions";
import { CouplePortal } from "@/components/CouplePortal";

export const dynamic = "force-dynamic";

// New couple portal, rendered in the venue's chosen design template (rebuild of
// the legacy /{slug} static portal). Phase 1: themed shell + hero (cover photo)
// + browsable Overview / Our Venue / Catalogue / Rentals / Accommodation /
// Suppliers. Selection + submit land in a later phase.
export default async function CouplePortalPage({ params }: { params: Promise<{ wedding: string }> }) {
  const { wedding: slug } = await params;
  const access = await portalAccess(slug);
  if (!access.ok) {
    if (access.status === 404) notFound();
    // Use the existing portal's password gate to unlock, then this route works.
    redirect(`/${slug}`);
  }

  const db = createAdminClient();
  if (!db) notFound();
  const wId = access.wedding.id;
  const vId = access.wedding.venue_id;

  const [wedRes, venRes, catRes, rentRes, roomRes, vendRes, galRes] = await Promise.all([
    db.from("weddings").select("id, slug, couple_names, wedding_date, wedding_end_date, wedding_state").eq("id", wId).single(),
    db.from("venues").select("name, region, address, portal_template, portal_theme, branding_logo_url, contact_email, contact_phone, google_maps_url, description").eq("id", vId).single(),
    db.from("catalogue_items").select("id, category, name, description, image_url, sort_order").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("rental_items").select("id, category, name, description, price, image_url, commission_value, commission_type, sort_order").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("accommodation_rooms").select("id, name, room_type, sleeps, description, price_per_night, hero_image_url, image_url, commission_value, commission_type, sort_order").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("vendor_partners").select("id, vendor_type, name, description, price_from, image_url, contact_email, contact_phone, website_url, commission_value, commission_type, sort_order").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("media_assets").select("url, category, kind, label, sort_order").eq("venue_id", vId).eq("owner_type", "venue").in("kind", ["photo", "video", "hero"]).order("sort_order"),
  ]);

  const wedding = wedRes.data;
  const venue = venRes.data;
  if (!wedding || !venue) notFound();

  const tokens = resolveTemplate(venue.portal_template);
  const theme = resolveTheme(venue.portal_theme);
  const isImg = (u: unknown) => /\.(jpe?g|png|webp|gif|avif|heic)(\?|$)/i.test(String(u));
  const gallery = (galRes.data ?? []).filter((g) => isImg(g.url)).map((g) => ({ url: String(g.url), category: (g.category as string) ?? "Other", label: (g.label as string) ?? "" }));
  const cover = theme.coverUrl || gallery[0]?.url || null;

  const num = (n: unknown) => Number(n ?? 0);
  const catalogue = (catRes.data ?? []).map((c) => ({ id: c.id, category: c.category, name: c.name, description: c.description ?? "", img: (c.image_url as string) ?? null }));
  const rentals = (rentRes.data ?? []).map((r) => ({ id: r.id, category: r.category, name: r.name, description: r.description ?? "", img: (r.image_url as string) ?? null, price: applyMarkup(num(r.price), r.commission_value, r.commission_type) }));
  const rooms = (roomRes.data ?? []).map((r) => ({ id: r.id, name: r.name, type: (r.room_type as string) ?? "Room", sleeps: num(r.sleeps), description: r.description ?? "", img: (r.hero_image_url as string) || (r.image_url as string) || null, price: applyMarkup(num(r.price_per_night), r.commission_value, r.commission_type) }));
  const vendors = (vendRes.data ?? []).map((v) => ({ id: v.id, type: (v.vendor_type as string) ?? "vendor", name: v.name, description: v.description ?? "", img: (v.image_url as string) ?? null, price: v.price_from == null ? null : applyMarkup(num(v.price_from), v.commission_value, v.commission_type), email: (v.contact_email as string) ?? null, phone: (v.contact_phone as string) ?? null, website: (v.website_url as string) ?? null }));

  // Countdown computed server-side (keeps the client component render pure).
  let daysToGo: number | null = null;
  let dateLabel = "Date TBC";
  if (wedding.wedding_date) {
    const wd = new Date(`${String(wedding.wedding_date).slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(wd.getTime())) {
      // eslint-disable-next-line react-hooks/purity
      daysToGo = Math.max(0, Math.ceil((wd.getTime() - Date.now()) / 86400000));
      dateLabel = wd.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
    }
  }

  const totals = await getWeddingTotals(wId);
  const state = (wedding.wedding_state ?? {}) as Record<string, unknown>;

  return (
    <CouplePortal
      slug={slug}
      tokens={tokens}
      theme={theme}
      cover={cover}
      logoUrl={theme.logoUrl || venue.branding_logo_url || null}
      venue={{ name: venue.name, region: (venue.region as string) ?? null, address: (venue.address as string) ?? null, description: (venue.description as string) ?? null, email: (venue.contact_email as string) ?? null, phone: (venue.contact_phone as string) ?? null, mapsUrl: (venue.google_maps_url as string) ?? null }}
      coupleNames={wedding.couple_names}
      daysToGo={daysToGo}
      dateLabel={dateLabel}
      totalDue={totals.grandTotal}
      initialState={state}
      catalogue={catalogue}
      rentals={rentals}
      rooms={rooms}
      vendors={vendors}
      gallery={gallery}
    />
  );
}
