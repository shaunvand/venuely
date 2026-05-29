"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNumOrNull(v: FormDataEntryValue | null): number | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s || null;
}

export async function updateVenue(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const venueId = formData.get("venue_id") as string;
  if (!venueId) throw new Error("Missing venue id.");

  // RLS will reject if this user is neither owner nor venue_member.
  const name              = (formData.get("name") as string)?.trim();
  const address           = strOrNull(formData.get("address"));
  const regionAuto        = strOrNull(formData.get("address_region"));
  const regionManual      = strOrNull(formData.get("region_override"));
  const lat               = toNumOrNull(formData.get("address_lat"));
  const lng               = toNumOrNull(formData.get("address_lng"));
  const placeId           = strOrNull(formData.get("address_place_id"));
  const mapsUrl           = strOrNull(formData.get("address_maps_url"));
  const contactEmail      = strOrNull(formData.get("contact_email"));
  const contactPhone      = strOrNull(formData.get("contact_phone"));
  const brandingPrimary   = strOrNull(formData.get("branding_primary"));
  const brandingLogoUrl   = strOrNull(formData.get("branding_logo_url"));
  const description       = strOrNull(formData.get("description"));
  const directions        = strOrNull(formData.get("directions"));
  const website           = strOrNull(formData.get("website"));

  // Manual override wins; otherwise use auto from Places.
  const region = regionManual ?? regionAuto;

  const { error } = await supabase
    .from("venues")
    .update({
      name,
      address,
      region,
      latitude: lat,
      longitude: lng,
      google_place_id: placeId,
      google_maps_url: mapsUrl,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      branding_primary: brandingPrimary,
      branding_logo_url: brandingLogoUrl,
      description,
      directions,
      website,
    })
    .eq("id", venueId);
  if (error) throw new Error(`Could not save venue: ${error.message}`);

  revalidatePath("/venue", "layout");
  redirect("/venue/settings?ok=1");
}
