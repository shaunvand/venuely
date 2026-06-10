"use server";

import { revalidatePath } from "next/cache";
import { getCurrentVenue } from "@/lib/venue/current";
import { createAdminClient } from "@/lib/supabase/server";

// venue_tables is RLS-on with no policies → service role only. Every call scopes
// strictly to the caller's current venue (getCurrentVenue), so a venue admin can
// only touch their own seating.
function db() {
  const c = createAdminClient();
  if (!c) throw new Error("Service role not configured");
  return c;
}

export async function addTable(formData: FormData) {
  const venue = await getCurrentVenue();
  const label = (formData.get("label") as string)?.trim();
  if (!label) throw new Error("Label required");
  const { error } = await db().from("venue_tables").insert({
    venue_id: venue.id,
    label,
    shape: (formData.get("shape") as string) || "round",
    seats: Math.max(1, Number(formData.get("seats") || 8)),
    quantity: Math.max(1, Number(formData.get("quantity") || 1)),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/venue/seating");
}

export async function updateTable(id: string, formData: FormData) {
  const venue = await getCurrentVenue();
  const { error } = await db().from("venue_tables").update({
    label: (formData.get("label") as string)?.trim() || "Table",
    shape: (formData.get("shape") as string) || "round",
    seats: Math.max(1, Number(formData.get("seats") || 8)),
    quantity: Math.max(1, Number(formData.get("quantity") || 1)),
  }).eq("id", id).eq("venue_id", venue.id);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/seating");
}

export async function deleteTable(id: string) {
  const venue = await getCurrentVenue();
  const { error } = await db().from("venue_tables").delete().eq("id", id).eq("venue_id", venue.id);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/seating");
}
