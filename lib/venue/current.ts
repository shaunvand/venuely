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
};

export async function getCurrentVenue(): Promise<VenueRow> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Owner: first venue by default. Multi-venue admin UI lands in a later phase.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role === "owner") {
    const { data: anyVenue } = await supabase
      .from("venues")
      .select("id, slug, name, region, address, latitude, longitude, google_place_id, google_maps_url, contact_email, contact_phone, branding_primary, branding_logo_url, subscription_status, trial_ends_at")
      .order("created_at")
      .limit(1)
      .single();
    if (!anyVenue) redirect("/admin/venues");
    return anyVenue as VenueRow;
  }

  const { data: membership } = await supabase
    .from("venue_members")
    .select("venue:venues(id, slug, name, region, address, latitude, longitude, google_place_id, google_maps_url, contact_email, contact_phone, branding_primary, branding_logo_url, subscription_status, trial_ends_at)")
    .eq("user_id", user.id)
    .limit(1)
    .single<{ venue: VenueRow }>();

  if (!membership?.venue) redirect("/");
  return membership.venue;
}
