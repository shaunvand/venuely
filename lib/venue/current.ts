import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentVenue() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Owner sees first venue by default for now (multi-venue admin UI in Phase 4).
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role === "owner") {
    const { data: anyVenue } = await supabase.from("venues").select("*").order("created_at").limit(1).single();
    if (!anyVenue) redirect("/admin/venues");
    return anyVenue;
  }

  const { data: membership } = await supabase
    .from("venue_members")
    .select("venue:venues(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single<{ venue: { id: string; slug: string; name: string; region: string | null } }>();

  if (!membership?.venue) redirect("/");
  return membership.venue;
}
