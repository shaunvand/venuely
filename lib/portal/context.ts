import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PortalContext = {
  venue: { id: string; slug: string; name: string; region: string | null; branding_primary: string | null };
  wedding: { id: string; slug: string; couple_names: string; wedding_date: string | null; guest_count: number | null; total_budget: number | null };
};

export async function getPortalContext(venueSlug: string, weddingSlug: string): Promise<PortalContext> {
  const supabase = await createClient();
  const { data: venue } = await supabase
    .from("venues")
    .select("id, slug, name, region, branding_primary")
    .eq("slug", venueSlug)
    .single();
  if (!venue) notFound();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, guest_count, total_budget")
    .eq("venue_id", venue.id)
    .eq("slug", weddingSlug)
    .single();
  if (!wedding) notFound();

  return { venue, wedding };
}
