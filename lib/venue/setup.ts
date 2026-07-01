import type { SupabaseClient } from "@supabase/supabase-js";
import type { VenueRow } from "./current";

export type SetupStep = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  count?: number | null;
  hint?: string;
};

export async function computeSetupSteps(supabase: SupabaseClient, venue: VenueRow) {
  const [
    { count: weddingsCount },
    { count: catalogueCount },
    { count: rentalsCount },
    { count: roomsCount },
    { count: paymentsCount },
    { count: suppliersCount },
    { count: photosCount },
    { count: areasCount },
  ] = await Promise.all([
    supabase.from("weddings").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("catalogue_items").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("rental_items").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("accommodation_rooms").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    // Real receipts live in payment_ledger (the old `payments` table is dead —
    // nothing writes to it), so the "Track payments" step keys off that.
    supabase.from("payment_ledger").select("*, wedding:weddings!inner(venue_id)", { count: "exact", head: true }).eq("wedding.venue_id", venue.id),
    supabase.from("vendor_partners").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("media_assets").select("*", { count: "exact", head: true }).eq("venue_id", venue.id).eq("owner_type", "venue"),
    supabase.from("venue_areas").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
  ]);

  const venueDetailsDone = Boolean(venue.address || venue.region);
  // "Has the owner imported any inventory yet?" — true if any catalogue / rental /
  // accommodation row exists. The wizard's review step and the dashboard welcome modal
  // use this to decide whether to keep nudging Smart Import.
  const hasImported = (catalogueCount ?? 0) > 0 || (rentalsCount ?? 0) > 0 || (roomsCount ?? 0) > 0;

  // Inventory = spaces + catalogue + rentals + accommodation, all under the one
  // Inventory hub (Smart Import fills them together) — one step, not four.
  const inventoryCount = (areasCount ?? 0) + (catalogueCount ?? 0) + (rentalsCount ?? 0) + (roomsCount ?? 0);
  const inventoryDone = inventoryCount > 0;

  const steps: SetupStep[] = [
    {
      key: "venue",
      title: "Confirm your venue details",
      description: "Address, branding colour, contact details. The address shows on every couple portal.",
      href: "/venue/settings",
      cta: venueDetailsDone ? "Edit details" : "Add details",
      done: venueDetailsDone,
      hint: venue.address ?? venue.region ?? undefined,
    },
    {
      key: "inventory",
      title: "Set up your inventory",
      description: "Everything couples can choose — spaces, catalogue, rentals and accommodation. Smart Import fills it all in one go.",
      href: "/venue/inventory",
      cta: inventoryDone ? "Manage inventory" : "Set up inventory",
      done: inventoryDone,
      count: inventoryCount,
    },
    {
      key: "weddings",
      title: "Add your first wedding",
      description: "Add a booked couple — their private portal URL is generated automatically.",
      href: "/venue/weddings",
      cta: "Add wedding",
      done: (weddingsCount ?? 0) > 0,
      count: weddingsCount,
    },
    {
      key: "photos",
      title: "Upload venue photos",
      description: "Your gallery on every couple portal's Our Venue tab. Categorise by location.",
      href: "/venue/your-venue",
      cta: "Open Your Venue",
      done: (photosCount ?? 0) > 0,
      count: photosCount,
    },
    {
      key: "suppliers",
      title: "Recommend suppliers",
      description: "Photographers, florists, caterers you trust — couples browse your list instead of guessing.",
      href: "/venue/suppliers",
      cta: "Add suppliers",
      done: (suppliersCount ?? 0) > 0,
      count: suppliersCount,
      hint: "Couples see these in their portal.",
    },
    {
      key: "payments",
      title: "Track payments + invoices",
      description: "Deposits + final balances per wedding. Mark paid, see overdue, send invoices.",
      href: "/venue/payments",
      cta: "Open payments",
      done: (paymentsCount ?? 0) > 0,
      count: paymentsCount,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return {
    steps,
    doneCount,
    totalCount,
    pct,
    hasImported,
    counts: {
      weddings: weddingsCount ?? 0,
      catalogue: catalogueCount ?? 0,
      rentals: rentalsCount ?? 0,
      rooms: roomsCount ?? 0,
      payments: paymentsCount ?? 0,
      suppliers: suppliersCount ?? 0,
      photos: photosCount ?? 0,
      areas: areasCount ?? 0,
    },
  };
}
