"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addChecklist(weddingId: string, formData: FormData) {
  const supabase = await createClient();
  const due = formData.get("due_date") as string;
  const { error } = await supabase.from("checklist_items").insert({
    wedding_id: weddingId,
    label: formData.get("label") as string,
    due_date: due || null,
  });
  if (error) throw new Error(`Could not add checklist item: ${error.message}`);
  revalidatePath("/portal", "layout");
}

export async function toggleChecklist(itemId: string, completed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").update({ completed }).eq("id", itemId);
  if (error) throw new Error(`Could not update checklist item: ${error.message}`);
  revalidatePath("/portal", "layout");
}

export async function deleteChecklist(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
  if (error) throw new Error(`Could not delete checklist item: ${error.message}`);
  revalidatePath("/portal", "layout");
}
