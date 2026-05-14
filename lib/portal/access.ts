// Shared portal-access gate.
// A request to wedding-scoped APIs/pages is authorised if:
//   (a) Supabase auth user is signed in and is a member of the wedding/venue, OR
//   (b) the portal password is set AND the vy_portal_<weddingId> cookie matches the hash.
// Returns { ok: true, wedding } when allowed; { ok: false, status } otherwise.

import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

type WeddingAccessInfo = {
  id: string;
  slug: string;
  venue_id: string;
  portal_password_hash: string | null;
};

export type AccessResult =
  | { ok: true; wedding: WeddingAccessInfo; via: "auth" | "password" }
  | { ok: false; status: 401 | 403 | 404; reason: string };

export async function portalAccess(slug: string, req?: NextRequest): Promise<AccessResult> {
  const supabase = await createClient();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, venue_id, portal_password_hash")
    .eq("slug", slug)
    .maybeSingle();
  if (!wedding) return { ok: false, status: 404, reason: "Wedding not found" };

  // Try password cookie first (cheapest check).
  if (wedding.portal_password_hash) {
    const cookieName = `vy_portal_${wedding.id}`;
    const cookieValue = req
      ? req.cookies.get(cookieName)?.value
      : (await cookies()).get(cookieName)?.value;
    if (cookieValue === wedding.portal_password_hash) {
      return { ok: true, wedding: wedding as WeddingAccessInfo, via: "password" };
    }
  }

  // Fall back to authenticated user — venue member, wedding member, or platform owner.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, reason: "Not signed in" };

  const [{ data: vm }, { data: wm }, { data: profile }] = await Promise.all([
    supabase.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", wedding.venue_id).maybeSingle(),
    supabase.from("wedding_members").select("wedding_id").eq("user_id", user.id).eq("wedding_id", wedding.id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  if (vm || wm || profile?.role === "owner") {
    return { ok: true, wedding: wedding as WeddingAccessInfo, via: "auth" };
  }
  return { ok: false, status: 403, reason: "No access to this wedding" };
}
