"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function promoteToOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Atomic check-and-update under service role to bypass RLS.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { count } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "owner");
  if (count && count > 0) redirect("/onboarding/become-owner");

  await admin.from("profiles").update({ role: "owner" }).eq("id", user.id);

  // Also attach the existing Pat Busch venue (so /venue works for the owner).
  const { data: venue } = await admin.from("venues").select("id").eq("slug", "pat-busch").single();
  if (venue) {
    await admin.from("venue_members").upsert({ venue_id: venue.id, user_id: user.id, is_primary: true });
  }

  redirect("/owner");
}
