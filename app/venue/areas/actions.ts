"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// Service-role client for media_assets writes (RLS-restricted table). Every call
// below first confirms the target area is visible to the user via RLS, so this
// stays scoped to areas the venue admin actually owns.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function addAreaImages(areaId: string, urls: string[]) {
  const supabase = await createClient();
  const { data: area } = await supabase.from("venue_areas").select("id, venue_id").eq("id", areaId).single();
  if (!area) throw new Error("Area not found");
  const rows = (urls || []).filter(Boolean).map((url) => ({
    venue_id: area.venue_id as string,
    owner_type: "area",
    owner_id: areaId,
    kind: "photo",
    url,
  }));
  if (rows.length) {
    const { error } = await admin().from("media_assets").insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/venue/areas");
}

export async function deleteAreaImage(mediaId: string) {
  const supabase = await createClient();
  const sb = admin();
  const { data: m } = await sb.from("media_assets").select("id, owner_id, owner_type").eq("id", mediaId).single();
  if (!m || m.owner_type !== "area") throw new Error("Image not found");
  // Confirm the owning area is visible to this user before deleting.
  const { data: area } = await supabase.from("venue_areas").select("id").eq("id", m.owner_id as string).single();
  if (!area) throw new Error("Forbidden");
  const { error } = await sb.from("media_assets").delete().eq("id", mediaId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function addArea(venueId: string, formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name required");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const { data, error } = await supabase
    .from("venue_areas")
    .insert({
      venue_id: venueId,
      name,
      slug,
      area_kind: (formData.get("area_kind") as string) || "extra",
      description: (formData.get("description") as string) || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  // An explicit per-day-type price wins; the single "Hire fee" fills in any day types left blank.
  const hire = Number(formData.get("price_hire") || 0);
  const wedding = Number(formData.get("price_wedding") || 0) || hire;
  const mg = Number(formData.get("price_mg") || 0) || hire;
  const farewell = Number(formData.get("price_farewell") || 0) || hire;
  if (data) {
    const { error: priceError } = await supabase.from("area_pricing").insert([
      { area_id: data.id, day_type: "wedding", price: wedding },
      { area_id: data.id, day_type: "mg", price: mg },
      { area_id: data.id, day_type: "farewell", price: farewell },
    ]);
    if (priceError) throw new Error(priceError.message);
  }
  revalidatePath("/venue/areas");
}

export async function deleteArea(areaId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("venue_areas").delete().eq("id", areaId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function toggleAreaActive(areaId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("venue_areas").update({ active }).eq("id", areaId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function updateArea(areaId: string, formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name required");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const { error } = await supabase
    .from("venue_areas")
    .update({
      name,
      slug,
      area_kind: (formData.get("area_kind") as string) || "extra",
      description: (formData.get("description") as string) || null,
    })
    .eq("id", areaId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function updateAreaPrice(areaId: string, dayType: string, formData: FormData) {
  const supabase = await createClient();
  const price = Number(formData.get("price") || 0);
  const { error } = await supabase.from("area_pricing").upsert({ area_id: areaId, day_type: dayType, price }, { onConflict: "area_id,day_type" });
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}
