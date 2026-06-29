// Shared portal-access gate.
// A request to wedding-scoped APIs/pages is authorised if:
//   (a) Supabase auth user is signed in and is a member of the wedding/venue, OR
//   (b) the portal password is set AND the vy_portal_<weddingId> cookie matches the hash.
// Returns { ok: true, wedding } when allowed; { ok: false, status } otherwise.

import { type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Constant-time string compare (length-guarded so timingSafeEqual never throws).
function safeEqual(a: string | undefined | null, b: string): boolean {
  if (!a) return false;
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
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
  // The wedding lookup MUST bypass RLS: an anonymous couple (password-cookie only)
  // has no session, and weddings RLS only exposes owner/venue-member/wedding-member
  // rows. The password/membership gate below is what actually authorises access.
  const db = createAdminClient() ?? (await createClient());

  // Resolve by slug. Slugs are meant to be unique, but legacy/seed data can carry
  // a collision — `.maybeSingle()` ERRORS on >1 row and would 404 a real portal.
  // Take the newest match deterministically so the portal always loads.
  const { data: matches } = await db
    .from("weddings")
    .select("id, slug, venue_id, portal_password_hash")
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(1);
  const wedding = matches?.[0];
  if (!wedding) return { ok: false, status: 404, reason: "Wedding not found" };

  // Try password cookie first (cheapest check).
  if (wedding.portal_password_hash) {
    const cookieName = `vy_portal_${wedding.id}`;
    const cookieValue = req
      ? req.cookies.get(cookieName)?.value
      : (await cookies()).get(cookieName)?.value;
    if (safeEqual(cookieValue, wedding.portal_password_hash)) {
      return { ok: true, wedding: wedding as WeddingAccessInfo, via: "password" };
    }
  }

  // Fall back to authenticated user — venue member, wedding member, or platform owner.
  // getUser() needs the cookie-aware SSR client to read the session; membership
  // lookups use the admin client (explicitly filtered by user.id) so RLS recursion
  // on the membership tables can't hide a legitimate grant.
  const ssr = await createClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return { ok: false, status: 401, reason: "Not signed in" };

  const [{ data: vm }, { data: wm }, { data: profile }] = await Promise.all([
    db.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", wedding.venue_id).maybeSingle(),
    db.from("wedding_members").select("wedding_id").eq("user_id", user.id).eq("wedding_id", wedding.id).maybeSingle(),
    db.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  if (vm || wm || profile?.role === "owner") {
    return { ok: true, wedding: wedding as WeddingAccessInfo, via: "auth" };
  }
  return { ok: false, status: 403, reason: "No access to this wedding" };
}
