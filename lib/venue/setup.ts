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
    supabase.from("payments").select("*, wedding:weddings!inner(venue_id)", { count: "exact", head: true }).eq("wedding.venue_id", venue.id),
    supabase.from("suppliers").select("*, wedding:weddings!inner(venue_id)", { count: "exact", head: true }).eq("wedding.venue_id", venue.id),
    supabase.from("media_assets").select("*", { count: "exact", head: true }).eq("venue_id", venue.id).eq("owner_type", "venue"),
    supabase.from("venue_areas").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
  ]);

  const venueDetailsDone = Boolean(venue.address || venue.region);
  // "Has the owner imported any inventory yet?" — true if any catalogue / rental /
  // accommodation row exists. The wizard's review step and the dashboard welcome modal
  // use this to decide whether to keep nudging Smart Import.
  const hasImported = (catalogueCount ?? 0) > 0 || (rentalsCount ?? 0) > 0 || (roomsCount ?? 0) > 0;

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
      key: "areas",
      title: "Add your spaces (areas)",
      description: "The main areas couples can use across their day — ceremony lawn, reception hall, gardens. Price each per day type (M&G / Wedding / Farewell).",
      href: "/venue/areas",
      cta: (areasCount ?? 0) > 0 ? "Manage spaces" : "Add spaces",
      done: (areasCount ?? 0) > 0,
      count: areasCount,
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
      key: "photos",
      title: "Upload venue photos",
      description: "Gallery used on every couple portal's Our Venue tab. Categorise by location (Outside, Bar, Accommodation…).",
      href: "/venue/your-venue",
      cta: "Open Your Venue",
      done: (photosCount ?? 0) > 0,
      count: photosCount,
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
