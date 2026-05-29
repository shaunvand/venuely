import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

// SINGLE SOURCE OF TRUTH: the canonical couple portal is the static app served at
// /{weddingSlug} (the app/[wedding]/route.ts handler), hydrated from
// weddings.wedding_state — the JSON blob couples actually edit. This relational
// /portal/[venue]/[wedding] subtree is near-dead (couples never populate its
// tables), so we retire it WITHOUT deleting files by short-circuiting here at the
// layout: every child page renders through this layout, so redirecting out of it
// redirects the whole subtree. Auth is preserved (the static route runs its own
// password/member gate, but we still keep the role check for defence in depth).
export default async function PortalLayout({
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venue: string; wedding: string }>;
}) {
  await requireRole(["couple", "venue_admin", "owner"]);
  const { venue: venueSlug, wedding: weddingSlug } = await params;
  const supabase = await createClient();

  // Look up the wedding by venue + slug so we can redirect to its canonical
  // /{slug} portal. The static route keys purely on the wedding slug.
  const { data: venue } = await supabase
    .from("venues")
    .select("id")
    .eq("slug", venueSlug)
    .single();

  if (!venue) notFound();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("slug")
    .eq("venue_id", venue.id)
    .eq("slug", weddingSlug)
    .single();

  if (!wedding) notFound();

  redirect(`/${wedding.slug}`);
}
