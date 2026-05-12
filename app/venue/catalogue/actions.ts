"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addCatalogue(venueId: string, formData: FormData) {
  const supabase = await createClient();
  await supabase.from("catalogue_items").insert({
    venue_id: venueId,
    category: formData.get("category") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    price: Number(formData.get("price") || 0),
    price_unit: formData.get("price_unit") as string,
  });
  revalidatePath("/venue/catalogue");
}

export async function toggleCatalogueActive(itemId: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("catalogue_items").update({ active }).eq("id", itemId);
  revalidatePath("/venue/catalogue");
}

export async function deleteCatalogue(itemId: string) {
  const supabase = await createClient();
  await supabase.from("catalogue_items").delete().eq("id", itemId);
  revalidatePath("/venue/catalogue");
}
