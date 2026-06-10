import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeSetupSteps } from "@/lib/venue/setup";
import type { VenueRow } from "@/lib/venue/current";
import { setupVenue } from "@/app/onboarding/setup-venue/actions";
import { WizardClient } from "./WizardClient";

// Guided multi-step onboarding wizard — the canonical entry point for a venue_admin
// who is setting up their venue. Server component: gates auth exactly like the old
// setup-venue page, figures out whether a venue already exists, then hands a fully
// resolved snapshot to the client wizard.
//
// Flow notes:
// - No venue yet  → wizard starts on Step 1 (Basics) which embeds <SetupVenueForm/>.
//   On success the setupVenue server action redirects back here to
//   /onboarding/wizard?step=1&created=1 so the wizard flashes a confirmation and
//   auto-advances into Step 2 (Import). Expected failures are returned as { error }
//   and rendered inline by the form. We also honour ?step= directly.
// - Venue exists → Step 1 is already done; the wizard opens on Step 2 (Import) unless a
//   ?step= override is supplied, and uses live setup data to drive the review checklist.
export default async function OnboardingWizard({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; created?: string }>;
}) {
  const { step: stepParam, created } = await searchParams;
  const justCreated = created === "1";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/onboarding/wizard");

  // Does this user already belong to a venue? (Mirrors setup-venue's gate.) We pull the
  // few columns computeSetupSteps reads (address/region drive the "venue details" step)
  // alongside the id/slug/name the wizard UI needs.
  const { data: membership } = await supabase
    .from("venue_members")
    .select("venue:venues(id, slug, name, address, region)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<{ venue: { id: string; slug: string; name: string; address: string | null; region: string | null } | null }>();

  const venue = membership?.venue ?? null;
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  // No venue yet → the wizard can only show Step 1 (create the venue). Everything else
  // needs a venue_id, so we render the basics step and let creation advance the flow.
  if (!venue) {
    return (
      <WizardClient
        initialStep={1}
        venue={null}
        mapsKey={mapsKey}
        setupAction={setupVenue}
        setup={null}
        previewHref={null}
      />
    );
  }

  // Venue exists — compute the live setup snapshot for the review step + checklist.
  // computeSetupSteps only reads id/address/region; the partial row satisfies that.
  const setupData = await computeSetupSteps(supabase, venue as unknown as VenueRow);
  const { steps, doneCount, totalCount, pct, hasImported, counts } = setupData;

  // "Preview what couples see" — the public couple-facing portal is per-wedding, so link
  // to a real wedding portal if one exists, otherwise nudge them to create their first
  // wedding (which generates the portal URL).
  const { data: firstWedding } = await supabase
    .from("weddings")
    .select("slug")
    .eq("venue_id", venue.id)
    .order("wedding_date", { ascending: true })
    .limit(1)
    .maybeSingle<{ slug: string }>();
  const previewHref = firstWedding?.slug
    ? `/portal/${venue.slug}/${firstWedding.slug}`
    : "/venue/weddings";

  // Default landing step when a venue already exists: jump past Basics to Import (step 2).
  // Just after creation we land on step 1 with ?created=1 so the wizard can flash a
  // confirmation and auto-advance to Import.
  const parsed = Number(stepParam);
  const initialStep = parsed >= 1 && parsed <= 4 ? parsed : 2;

  return (
    <WizardClient
      initialStep={initialStep}
      venue={{ id: venue.id, slug: venue.slug, name: venue.name }}
      mapsKey={mapsKey}
      setupAction={setupVenue}
      justCreated={justCreated}
      setup={{
        steps,
        doneCount,
        totalCount,
        pct,
        hasImported,
        areasCount: counts.areas,
        weddingsCount: counts.weddings,
      }}
      previewHref={previewHref}
    />
  );
}
