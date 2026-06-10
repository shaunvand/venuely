"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addRental(venueId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("rental_items").insert({
    venue_id: venueId,
    category: formData.get("category") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    price: Number(formData.get("price")),
    stock_total: Number(formData.get("stock_total") || 1),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/venue/rentals");
}

export async function toggleRentalActive(itemId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("rental_items").update({ active }).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/rentals");
}

export async function deleteRental(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("rental_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/rentals");
}
