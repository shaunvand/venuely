import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type WeddingMembership = {
  wedding: { slug: string } | null;
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

  if (profile?.role === "owner") redirect("/admin");

  if (profile?.role === "venue_admin") {
    // Has a venue? straight to admin. Otherwise force setup-venue.
    const { count } = await supabase
      .from("venue_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (count && count > 0) redirect("/venue");
    redirect("/onboarding/wizard");
  }

  // Couples: look up their first wedding membership and send them to their
  // canonical static portal at /{slug} — the single source of truth they edit
  // (weddings.wedding_state). The old relational /portal/... tree is retired.
  const { data: membershipRaw } = await supabase
    .from("wedding_members")
    .select("wedding:weddings(slug)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const membership = membershipRaw as unknown as WeddingMembership | null;
  if (membership?.wedding?.slug) {
    redirect(`/${membership.wedding.slug}`);
  }

  redirect("/onboarding/awaiting-invite");
}
