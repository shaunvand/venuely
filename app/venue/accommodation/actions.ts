"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addRoom(venueId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("accommodation_rooms").insert({
    venue_id: venueId,
    name: formData.get("name") as string,
    room_type: (formData.get("room_type") as string) || null,
    sleeps: Number(formData.get("sleeps") || 2),
    price_per_night: Number(formData.get("price_per_night") || 0),
    description: (formData.get("description") as string) || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/venue/accommodation");
}

export async function toggleRoomActive(roomId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("accommodation_rooms").update({ active }).eq("id", roomId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/accommodation");
}

export async function deleteRoom(roomId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("accommodation_rooms").delete().eq("id", roomId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/accommodation");
}
