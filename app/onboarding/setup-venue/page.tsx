import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setupVenue } from "./actions";

export default async function SetupVenue() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/onboarding/setup-venue");

  // If they already have a venue, skip ahead.
  const { count: memberCount } = await supabase
    .from("venue_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (memberCount && memberCount > 0) redirect("/venue");

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
      <form action={setupVenue} className="w-full max-w-md space-y-5">
        <div>
          <h1 className="font-serif text-3xl">Set up your venue</h1>
          <p className="text-stone-600 text-sm mt-2">
            Tell us about your venue. You can change anything later from your admin dashboard.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Venue name</label>
          <input
            name="name"
            required
            placeholder="Pat Busch Mountain Reserve"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Region</label>
          <input
            name="region"
            placeholder="Robertson, Western Cape"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">URL slug</label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-stone-500">venuely.co.za/portal/</span>
            <input
              name="slug"
              required
              pattern="[a-z0-9-]+"
              placeholder="pat-busch"
              className="flex-1 border rounded px-3 py-2 font-mono text-sm"
            />
          </div>
          <p className="text-xs text-stone-500">Lowercase letters, numbers and hyphens only.</p>
        </div>

        <button className="w-full bg-stone-900 text-white rounded py-2.5 font-medium">
          Create my venue
        </button>
      </form>
    </main>
  );
}
