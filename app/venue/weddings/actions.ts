"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Turn "Alex & Sam Smith" → "AlexAndSamSmithWedding".
// Strips non-alphanumerics, joins words, appends "Wedding" suffix.
function pascalSlug(couples: string): string {
  const cleaned = couples
    .replace(/&/g, " And ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const camel = cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return `${camel}Wedding`;
}

async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  while (true) {
    const { data } = await supabase.from("weddings").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}${n++}`;
  }
}

export async function createWedding(venueId: string, _venueSlug: string, formData: FormData) {
  const supabase = await createClient();
  const couples = (formData.get("couple_names") as string).trim();
  const explicit = (formData.get("slug") as string || "").trim();

  const base = explicit ? explicit.replace(/[^a-zA-Z0-9]/g, "") : pascalSlug(couples);
  const slug = await uniqueSlug(supabase, base);

  const guestStr = formData.get("guest_count") as string;
  const { data, error } = await supabase
    .from("weddings")
    .insert({
      venue_id: venueId,
      slug,
      couple_names: couples,
      wedding_date: (formData.get("wedding_date") as string) || null,
      guest_count: guestStr ? Number(guestStr) : null,
    })
    .select("slug")
    .single();

  if (error) throw new Error(`Could not create wedding: ${error.message}`);
  revalidatePath("/venue/weddings");
  if (data) redirect(`/venue/weddings/${data.slug}`);
}
