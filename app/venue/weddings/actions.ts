"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWedding(venueId: string, venueSlug: string, formData: FormData) {
  const supabase = await createClient();
  const slug = (formData.get("slug") as string).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const guestStr = formData.get("guest_count") as string;
  const { data } = await supabase
    .from("weddings")
    .insert({
      venue_id: venueId,
      slug,
      couple_names: formData.get("couple_names") as string,
      wedding_date: (formData.get("wedding_date") as string) || null,
      guest_count: guestStr ? Number(guestStr) : null,
    })
    .select("slug")
    .single();
  revalidatePath("/venue/weddings");
  if (data) redirect(`/venue/weddings/${data.slug}`);
}
