"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function toNumOrNull(v: FormDataEntryValue | null): number | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function setupVenue(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!name || !slug) throw new Error("Venue name and slug are required.");

  const address  = (formData.get("address") as string || "").trim() || null;
  const region   = (formData.get("address_region") as string || "").trim() || null;
  const lat      = toNumOrNull(formData.get("address_lat"));
  const lng      = toNumOrNull(formData.get("address_lng"));
  const placeId  = (formData.get("address_place_id") as string || "").trim() || null;
  const mapsUrl  = (formData.get("address_maps_url") as string || "").trim() || null;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: venue, error: vErr } = await admin
    .from("venues")
    .insert({
      slug,
      name,
      region,
      address,
      latitude: lat,
      longitude: lng,
      google_place_id: placeId,
      google_maps_url: mapsUrl,
      subscription_status: "trialing",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id, slug")
    .single();
  if (vErr || !venue) throw new Error(`Could not create venue: ${vErr?.message ?? "unknown"}`);

  const { error: mErr } = await admin
    .from("venue_members")
    .insert({ venue_id: venue.id, user_id: user.id, is_primary: true });
  if (mErr) throw new Error(`Could not link membership: ${mErr.message}`);

  redirect("/venue");
}
