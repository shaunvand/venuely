import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Build the public origin from x-forwarded-* so we don't leak the internal
// Render dyno address (localhost:10000) into redirect Locations.
function publicOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "") ||
    "https";
  return `${proto}://${host}`;
}

function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null;
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// When the callback carries a wedding-invite token, redeem it: link the now
// signed-in user to the wedding (wedding_members → activates can_access_wedding
// RLS) and mark the invite accepted. Returns the wedding slug to redirect to, or
// null if there's nothing to redeem / it couldn't be redeemed.
async function redeemInvite(token: string, userId: string): Promise<string | null> {
  const ad = admin();
  if (!ad) return null;

  const { data: invite } = await ad
    .from("wedding_invites")
    .select("id, wedding_id, expires_at, accepted_at, status")
    .eq("token", token)
    .maybeSingle();
  if (!invite || !invite.wedding_id) return null;
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return null;

  // Idempotent: ignore-duplicate on the composite PK (wedding_id, user_id).
  await ad
    .from("wedding_members")
    .upsert({ wedding_id: invite.wedding_id, user_id: userId }, { onConflict: "wedding_id,user_id", ignoreDuplicates: true });

  if (!invite.accepted_at) {
    await ad
      .from("wedding_invites")
      .update({ accepted_at: new Date().toISOString(), status: "accepted" })
      .eq("id", invite.id);
  }

  const { data: wedding } = await ad
    .from("weddings")
    .select("slug")
    .eq("id", invite.wedding_id)
    .maybeSingle();
  return (wedding?.slug as string | undefined) ?? null;
}

// When the callback carries a venue-invite token (a manager being added to a
// venue team), redeem it: add the signed-in user to venue_members (which
// activates the is_venue_member RLS for that venue) and mark the invite
// accepted. Returns true if the user was joined to the venue, else false.
async function redeemVenueInvite(token: string, userId: string): Promise<boolean> {
  const ad = admin();
  if (!ad) return false;

  const { data: invite } = await ad
    .from("venue_invites")
    .select("id, venue_id, expires_at, accepted_at, status")
    .eq("token", token)
    .maybeSingle();
  if (!invite || !invite.venue_id) return false;
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return false;

  // Idempotent: ignore-duplicate on the composite PK (venue_id, user_id).
  await ad
    .from("venue_members")
    .upsert(
      { venue_id: invite.venue_id, user_id: userId, is_primary: false },
      { onConflict: "venue_id,user_id", ignoreDuplicates: true }
    );

  // Co-managers join with the venue_admin role; never demote an owner.
  await ad
    .from("profiles")
    .update({ role: "venue_admin" })
    .eq("id", userId)
    .neq("role", "owner");

  if (!invite.accepted_at) {
    await ad
      .from("venue_invites")
      .update({ accepted_at: new Date().toISOString(), status: "accepted" })
      .eq("id", invite.id);
  }

  return true;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const invite = searchParams.get("invite");
  const venueInvite = searchParams.get("venue_invite");
  const redirect = searchParams.get("redirect") || searchParams.get("next") || "/dashboard";

  const supabase = await createClient();

  let authed = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) authed = true;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) authed = true;
  }

  if (authed) {
    const { data: { user } } = await supabase.auth.getUser();

    // Redeem a venue (manager) invite if one rode along on the callback URL —
    // joins the now signed-in user to the venue team, then lands on /venue.
    if (venueInvite && user) {
      const joined = await redeemVenueInvite(venueInvite, user.id);
      if (joined) return NextResponse.redirect(`${origin}/venue`);
    }

    // Redeem a wedding invite if one rode along on the callback URL.
    if (invite && user) {
      const slug = await redeemInvite(invite, user.id);
      if (slug) return NextResponse.redirect(`${origin}/${slug}`);
    }
    return NextResponse.redirect(`${origin}${redirect}`);
  }

  // No auth code/OTP — but a venue invite link may have been opened by an
  // already signed-in manager. Redeem it against the existing session.
  if (venueInvite) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const joined = await redeemVenueInvite(venueInvite, user.id);
      if (joined) return NextResponse.redirect(`${origin}/venue`);
    }
    // Not signed in yet — send them to sign up / in, carrying the token so it
    // is redeemed once they authenticate.
    return NextResponse.redirect(`${origin}/signup?venue_invite=${encodeURIComponent(venueInvite)}`);
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}
