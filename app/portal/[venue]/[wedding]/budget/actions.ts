"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addBudgetItem(weddingId: string, formData: FormData) {
  const supabase = await createClient();
  const estStr = formData.get("estimated") as string;
  const { error } = await supabase.from("budget_items").insert({
    wedding_id: weddingId,
    category: formData.get("category") as string,
    label: formData.get("label") as string,
    estimated: estStr ? Number(estStr) : null,
  });
  if (error) throw new Error(`Could not add budget item: ${error.message}`);
  revalidatePath("/portal", "layout");
}

export async function togglePaid(itemId: string, paid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").update({ paid }).eq("id", itemId);
  if (error) throw new Error(`Could not update budget item: ${error.message}`);
  revalidatePath("/portal", "layout");
}

export async function deleteBudgetItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_items").delete().eq("id", itemId);
  if (error) throw new Error(`Could not delete budget item: ${error.message}`);
  revalidatePath("/portal", "layout");
}
