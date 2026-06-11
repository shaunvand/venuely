import { redirect, notFound } from "next/navigation";
import { portalAccess } from "@/lib/portal/access";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveTemplate, resolveTheme } from "@/lib/portal/templates";
import { applyMarkup } from "@/lib/billing/compute";
import { seasonForDate, resolveAreaPrice, type Season, type AreaPriceRow } from "@/lib/venue/seasons";
import { getWeddingTotals } from "@/app/venue/weddings/actions";
import { CouplePortal } from "@/components/CouplePortal";
import type { MessageThread, ThreadMessage } from "@/components/CoupleMessages";

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

  const [wedRes, venRes, catRes, rentRes, roomRes, vendRes, galRes, tableRes, areaRes, areaPriceRes, areaImgRes, areaGroupRes, seasonRes] = await Promise.all([
    db.from("weddings").select("id, slug, couple_names, wedding_date, wedding_end_date, wedding_state, area_selections").eq("id", wId).single(),
    db.from("venues").select("name, region, address, portal_template, portal_theme, branding_logo_url, contact_email, contact_phone, google_maps_url, description").eq("id", vId).single(),
    db.from("catalogue_items").select("id, category, name, description, price, image_url, cost_treatment, commission_value, commission_type, event_part, sort_order").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("rental_items").select("id, category, name, description, price, image_url, cost_treatment, commission_value, commission_type, sort_order").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("accommodation_rooms").select("id, name, room_type, sleeps, description, price_per_night, hero_image_url, image_url, commission_value, commission_type, sort_order").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("vendor_partners").select("id, vendor_type, name, description, price_from, image_url, contact_email, contact_phone, website_url, commission_value, commission_type, sort_order").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("media_assets").select("url, category, kind, label, sort_order").eq("venue_id", vId).eq("owner_type", "venue").in("kind", ["photo", "video", "hero"]).order("sort_order"),
    db.from("venue_tables").select("id, label, shape, seats, quantity").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("venue_areas").select("id, name, description, area_kind, group_id, sort_order").eq("venue_id", vId).eq("active", true).order("sort_order"),
    db.from("area_pricing").select("area_id, day_type, price, season_id"),
    db.from("media_assets").select("owner_id, url, sort_order").eq("venue_id", vId).eq("owner_type", "area").order("sort_order"),
    db.from("venue_area_groups").select("id, name, included, location, sort_order").eq("venue_id", vId).order("sort_order"),
    db.from("venue_seasons").select("id, name, start_month, start_day, end_month, end_day, sort_order").eq("venue_id", vId),
  ]);

  const wedding = wedRes.data;
  const venue = venRes.data;
  if (!wedding || !venue) notFound();

  const tokens = resolveTemplate(venue.portal_template);
  const theme = resolveTheme(venue.portal_theme);
  const isImg = (u: unknown) => /\.(jpe?g|png|webp|gif|avif|heic)(\?|$)/i.test(String(u));
  const gallery = (galRes.data ?? []).filter((g) => isImg(g.url)).map((g) => ({ url: String(g.url), category: (g.category as string) ?? "Other", label: (g.label as string) ?? "" }));
  // Auto-cover skips floor-plan/layout images (Smart Import page-rasters arrive
  // labelled but untagged) so a kitchen diagram never becomes the couple's hero.
  const floorplanish = (g: { category: string; label: string }) =>
    /floor\s*-?\s*plan|venue\s+layout|site\s*map|floorplan/i.test(`${g.category} ${g.label}`);
  const cover = theme.coverUrl || gallery.find((g) => !floorplanish(g))?.url || gallery[0]?.url || null;

  // Venue spaces (areas) → couple portal "Our Venue" tab. Prices are resolved for
  // THIS wedding's season: the wedding-day price uses the season containing the
  // wedding date (mg/farewell keep their single null-season price). Areas carry
  // their venue-named sub-category group (Included/Extra; venue/offsite).
  const seasons = (seasonRes.data ?? []) as Season[];
  const weddingSeason = seasonForDate(seasons, wedding.wedding_date as string | null);
  const seasonId = weddingSeason?.id ?? null;
  const priceRows = (areaPriceRes.data ?? []) as AreaPriceRow[];
  const areaImgMap: Record<string, string> = {};
  (areaImgRes.data ?? []).forEach((m) => { const k = String(m.owner_id); if (!areaImgMap[k] && isImg(m.url)) areaImgMap[k] = String(m.url); });
  const groupMap = new Map<string, { id: string; name: string; included: boolean; location: "venue" | "offsite" }>();
  (areaGroupRes.data ?? []).forEach((g) => groupMap.set(String(g.id), {
    id: String(g.id), name: String(g.name), included: !!g.included,
    location: (g.location as "venue" | "offsite") ?? "venue",
  }));
  const areas = (areaRes.data ?? []).map((a) => {
    const aid = a.id as string;
    const prices: Record<string, number> = {
      mg: resolveAreaPrice(priceRows, aid, "mg", seasonId),
      wedding: resolveAreaPrice(priceRows, aid, "wedding", seasonId),
      farewell: resolveAreaPrice(priceRows, aid, "farewell", seasonId),
    };
    const group = a.group_id ? groupMap.get(String(a.group_id)) ?? null : null;
    return {
      id: aid, name: a.name as string, description: (a.description as string) ?? null,
      kind: (a.area_kind as string) ?? "extra", img: areaImgMap[aid] ?? null,
      prices, group, seasonName: weddingSeason?.name ?? null,
    };
  });
  const initialAreaSelections = (wedding.area_selections ?? []) as Array<{ area_id: string; day_type: string }>;

  const num = (n: unknown) => Number(n ?? 0);
  const catalogue = (catRes.data ?? []).map((c) => ({ id: c.id, category: c.category, name: c.name, description: c.description ?? "", img: (c.image_url as string) ?? null, price: applyMarkup(num(c.price), c.commission_value, c.commission_type), included: (c.cost_treatment as string) === "included", eventPart: (c.event_part as string) ?? null }));
  const rentals = (rentRes.data ?? []).map((r) => ({ id: r.id, category: r.category, name: r.name, description: r.description ?? "", img: (r.image_url as string) ?? null, price: applyMarkup(num(r.price), r.commission_value, r.commission_type), included: (r.cost_treatment as string) === "included" }));
  const rooms = (roomRes.data ?? []).map((r) => ({ id: r.id, name: r.name, type: (r.room_type as string) ?? "Room", sleeps: num(r.sleeps), description: r.description ?? "", img: (r.hero_image_url as string) || (r.image_url as string) || null, price: applyMarkup(num(r.price_per_night), r.commission_value, r.commission_type) }));
  const vendors = (vendRes.data ?? []).map((v) => ({ id: v.id, type: (v.vendor_type as string) ?? "vendor", name: v.name, description: v.description ?? "", img: (v.image_url as string) ?? null, price: v.price_from == null ? null : applyMarkup(num(v.price_from), v.commission_value, v.commission_type), email: (v.contact_email as string) ?? null, phone: (v.contact_phone as string) ?? null, website: (v.website_url as string) ?? null, commissionValue: v.commission_value == null ? null : Number(v.commission_value), commissionType: (v.commission_type as string) ?? null }));

  // Suppliers the couple has already requested an intro for — drives the gated
  // contact reveal so it persists across reloads.
  const { data: introRows } = await db
    .from("supplier_intros")
    .select("vendor_id")
    .eq("wedding_id", wId);
  const introducedVendorIds = (introRows ?? []).map((r) => String(r.vendor_id)).filter(Boolean);

  // Mediated supplier-messaging threads for instant first paint of the Messages
  // tab. COUPLE-EYES rules enforced here: never select raw_body (the unredacted
  // original is venue-only), and supplier contact stays null until booked.
  const { data: msgThreadRows } = await db
    .from("message_threads")
    .select("id, vendor_id, supplier_name, supplier_type, supplier_email, supplier_phone, status, couple_unread, last_message_at")
    .eq("wedding_id", wId)
    .order("last_message_at", { ascending: false });
  const threadIds = (msgThreadRows ?? []).map((t) => String(t.id));
  let msgRows: Array<Record<string, unknown>> = [];
  if (threadIds.length) {
    const { data } = await db
      .from("thread_messages")
      .select("id, thread_id, sender, body, flagged, flag_reason, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true });
    msgRows = data ?? [];
  }
  const msgsByThread = new Map<string, ThreadMessage[]>();
  for (const m of msgRows) {
    const tid = String(m.thread_id);
    const list = msgsByThread.get(tid) ?? [];
    list.push({
      id: String(m.id),
      sender: (m.sender as ThreadMessage["sender"]) ?? "system",
      body: String(m.body ?? ""),
      flagged: !!m.flagged,
      flagReason: m.flag_reason ? String(m.flag_reason) : null,
      createdAt: String(m.created_at ?? ""),
    });
    msgsByThread.set(tid, list);
  }
  const messageThreads: MessageThread[] = (msgThreadRows ?? []).map((t) => {
    const status = (["active", "booked", "closed"].includes(String(t.status)) ? String(t.status) : "active") as MessageThread["status"];
    const booked = status === "booked";
    return {
      id: String(t.id),
      vendorId: t.vendor_id ? String(t.vendor_id) : null,
      supplierName: String(t.supplier_name ?? ""),
      supplierType: t.supplier_type ? String(t.supplier_type) : null,
      status,
      lastMessageAt: t.last_message_at ? String(t.last_message_at) : null,
      coupleUnread: Number(t.couple_unread ?? 0),
      supplierEmail: booked && t.supplier_email ? String(t.supplier_email) : null,
      supplierPhone: booked && t.supplier_phone ? String(t.supplier_phone) : null,
      messages: msgsByThread.get(String(t.id)) ?? [],
    };
  });

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
      weddingDate={wedding.wedding_date ? String(wedding.wedding_date).slice(0, 10) : null}
      weddingEndDate={wedding.wedding_end_date ? String(wedding.wedding_end_date).slice(0, 10) : null}
      totalDue={totals?.grandTotal ?? 0}
      initialState={state}
      catalogue={catalogue}
      rentals={rentals}
      rooms={rooms}
      vendors={vendors}
      introducedVendorIds={introducedVendorIds}
      messageThreads={messageThreads}
      gallery={gallery}
      tables={(tableRes.data ?? []).map((t) => ({ id: t.id as string, label: t.label as string, shape: t.shape as string, seats: Number(t.seats), quantity: Number(t.quantity) }))}
      areas={areas}
      initialAreaSelections={initialAreaSelections}
    />
  );
}
