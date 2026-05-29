import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The guided onboarding wizard at /onboarding/wizard is now the canonical entry point.
// This route stays as a permanent redirect so any old links / bookmarks still land
// somewhere sensible: the wizard if they still need to create a venue, or /venue if
// they already have one. The auth/membership gate mirrors the wizard's own gate.
export default async function SetupVenue() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/onboarding/setup-venue");

  const { count: memberCount } = await supabase
    .from("venue_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (memberCount && memberCount > 0) redirect("/venue");

  redirect("/onboarding/wizard");
}
