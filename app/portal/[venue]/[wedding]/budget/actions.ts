"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addBudgetItem(weddingId: string, formData: FormData) {
  const supabase = await createClient();
  const estStr = formData.get("estimated") as string;
  await supabase.from("budget_items").insert({
    wedding_id: weddingId,
    category: formData.get("category") as string,
    label: formData.get("label") as string,
    estimated: estStr ? Number(estStr) : null,
  });
  revalidatePath("/portal", "layout");
}

export async function togglePaid(itemId: string, paid: boolean) {
  const supabase = await createClient();
  await supabase.from("budget_items").update({ paid }).eq("id", itemId);
  revalidatePath("/portal", "layout");
}

export async function deleteBudgetItem(itemId: string) {
  const supabase = await createClient();
  await supabase.from("budget_items").delete().eq("id", itemId);
  revalidatePath("/portal", "layout");
}
