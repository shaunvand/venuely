"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  // A single "Hire fee" applies to every day type; otherwise use any per-day-type values given.
  const hire = Number(formData.get("price_hire") || 0);
  const wedding = hire || Number(formData.get("price_wedding") || 0);
  const mg = hire || Number(formData.get("price_mg") || 0);
  const farewell = hire || Number(formData.get("price_farewell") || 0);
  if (data) {
    await supabase.from("area_pricing").insert([
      { area_id: data.id, day_type: "wedding", price: wedding },
      { area_id: data.id, day_type: "mg", price: mg },
      { area_id: data.id, day_type: "farewell", price: farewell },
    ]);
  }
  revalidatePath("/venue/areas");
}

export async function deleteArea(areaId: string) {
  const supabase = await createClient();
  await supabase.from("venue_areas").delete().eq("id", areaId);
  revalidatePath("/venue/areas");
}

export async function toggleAreaActive(areaId: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("venue_areas").update({ active }).eq("id", areaId);
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
  await supabase.from("area_pricing").upsert({ area_id: areaId, day_type: dayType, price }, { onConflict: "area_id,day_type" });
  revalidatePath("/venue/areas");
}
