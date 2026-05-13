import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type WeddingMembership = {
  wedding: { slug: string; venue: { slug: string } } | null;
};

// Single dashboard entry point — figures out where the user actually belongs
// based on role + memberships, and redirects there. Eliminates the broken-link
// problem where signed-in users could click "Dashboard" and land on a 404.
export default async function DashboardRouter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "owner") redirect("/owner");
  if (profile?.role === "venue_admin") redirect("/venue");

  // Couples: look up their first wedding membership.
  const { data: membershipRaw } = await supabase
    .from("wedding_members")
    .select("wedding:weddings(slug, venue:venues(slug))")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const membership = membershipRaw as unknown as WeddingMembership | null;
  if (membership?.wedding?.venue) {
    redirect(`/portal/${membership.wedding.venue.slug}/${membership.wedding.slug}`);
  }

  // No wedding yet. If no owner exists, route to claim-owner. Otherwise to a waiting page.
  const { count: ownerCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "owner");

  if (!ownerCount) redirect("/onboarding/become-owner");
  redirect("/onboarding/awaiting-invite");
}
