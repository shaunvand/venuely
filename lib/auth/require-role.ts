import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "owner" | "venue_admin" | "couple";

export async function requireRole(allowed: UserRole[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (error || !profile) redirect("/login?error=no_profile");
  if (!allowed.includes(profile.role as UserRole)) redirect("/");

  return { user, profile: profile as { role: UserRole; full_name: string | null } };
}
