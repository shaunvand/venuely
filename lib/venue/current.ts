import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type VenueRow = {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  branding_primary: string | null;
  branding_logo_url: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  platform_fee_rate: number | null;
  paystack_subaccount_code: string | null;
  payout_account_last4: string | null;
  payouts_verified_at: string | null;
};

const VENUE_COLUMNS =
  "id, slug, name, region, address, latitude, longitude, google_place_id, google_maps_url, contact_email, contact_phone, branding_primary, branding_logo_url, subscription_status, trial_ends_at, platform_fee_rate, paystack_subaccount_code, payout_account_last4, payouts_verified_at";

export type TrialPhase = "trialing" | "active" | "past_due" | "expired" | "unknown";

export type TrialState = {
  phase: TrialPhase;
  trialEndsAt: string | null;
  daysLeft: number | null; // null when there's no trial window
};

// Non-blocking readiness summary. Consumed by the billing page banner/CTA —
// never used to gate or redirect data entry.
export function trialState(venue: Pick<VenueRow, "subscription_status" | "trial_ends_at">): TrialState {
  const status = (venue.subscription_status ?? "").toLowerCase();
  const trialEndsAt = venue.trial_ends_at;

  let daysLeft: number | null = null;
  if (trialEndsAt) {
    const ms = new Date(trialEndsAt).getTime() - Date.now();
    daysLeft = Number.isFinite(ms) ? Math.ceil(ms / 86_400_000) : null;
  }

  let phase: TrialPhase = "unknown";
  if (status === "active") phase = "active";
  else if (status === "past_due") phase = "past_due";
  else if (status === "trialing" || status === "trial" || !status) {
    phase = daysLeft !== null && daysLeft <= 0 ? "expired" : "trialing";
  }

  return { phase, trialEndsAt, daysLeft };
}

// True once the venue has a verified Paystack subaccount and can take couple
// payments through the platform. Pure read — does NOT trigger any network call.
export function paymentsReady(
  venue: Pick<VenueRow, "paystack_subaccount_code" | "payouts_verified_at">
): boolean {
  return Boolean(venue.paystack_subaccount_code && venue.payouts_verified_at);
}

export async function getCurrentVenue(): Promise<VenueRow> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Owner: first venue by default. Multi-venue admin UI lands in a later phase.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role === "owner") {
    const { data: anyVenue } = await supabase
      .from("venues")
      .select(VENUE_COLUMNS)
      .order("created_at")
      .limit(1)
      .single();
    if (!anyVenue) redirect("/admin/venues");
    return anyVenue as unknown as VenueRow;
  }

  const { data: membership } = await supabase
    .from("venue_members")
    .select(`venue:venues(${VENUE_COLUMNS})`)
    .eq("user_id", user.id)
    .limit(1)
    .single<{ venue: VenueRow }>();

  if (!membership?.venue) redirect("/");
  return membership.venue;
}
