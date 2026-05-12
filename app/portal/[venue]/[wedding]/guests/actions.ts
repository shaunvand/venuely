"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addGuest(weddingId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("guests").insert({
    wedding_id: weddingId,
    full_name: formData.get("full_name") as string,
    email: (formData.get("email") as string) || null,
  });
  if (error) throw new Error(`Could not add guest: ${error.message}`);
  revalidatePath("/portal", "layout");
}

export async function deleteGuest(guestId: string, _weddingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("guests").delete().eq("id", guestId);
  if (error) throw new Error(`Could not delete guest: ${error.message}`);
  revalidatePath("/portal", "layout");
}
