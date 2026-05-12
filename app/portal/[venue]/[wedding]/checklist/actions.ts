"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addChecklist(weddingId: string, formData: FormData) {
  const supabase = await createClient();
  const due = formData.get("due_date") as string;
  await supabase.from("checklist_items").insert({
    wedding_id: weddingId,
    label: formData.get("label") as string,
    due_date: due || null,
  });
  revalidatePath("/portal", "layout");
}

export async function toggleChecklist(itemId: string, completed: boolean) {
  const supabase = await createClient();
  await supabase.from("checklist_items").update({ completed }).eq("id", itemId);
  revalidatePath("/portal", "layout");
}

export async function deleteChecklist(itemId: string) {
  const supabase = await createClient();
  await supabase.from("checklist_items").delete().eq("id", itemId);
  revalidatePath("/portal", "layout");
}
