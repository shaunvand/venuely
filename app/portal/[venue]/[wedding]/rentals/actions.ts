"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addSelection(weddingId: string, rentalItemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("wedding_selections").insert({
    wedding_id: weddingId,
    rental_item_id: rentalItemId,
    quantity: 1,
  });
  if (error) throw new Error(`Could not add rental selection: ${error.message}`);
  revalidatePath("/portal", "layout");
}

export async function removeSelection(selectionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("wedding_selections").delete().eq("id", selectionId);
  if (error) throw new Error(`Could not remove rental selection: ${error.message}`);
  revalidatePath("/portal", "layout");
}
