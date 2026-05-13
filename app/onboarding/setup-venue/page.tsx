import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setupVenue } from "./actions";
import { SetupVenueForm } from "@/components/SetupVenueForm";

export default async function SetupVenue() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/onboarding/setup-venue");

  const { count: memberCount } = await supabase
    .from("venue_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (memberCount && memberCount > 0) redirect("/venue");

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
      <SetupVenueForm action={setupVenue} mapsKey={mapsKey} />
    </main>
  );
}
