"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireRole } from "@/lib/auth/require-role";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";

const RESEND_API = "https://api.resend.com/emails";

// Build the public origin (https://venuely.co.za) from x-forwarded-* so links
// never leak the internal Render dyno address.
async function publicOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "venuely.co.za";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteManagerResult = {
  ok: boolean;
  url: string;
  emailSent: boolean;
  reason?: string;
  error?: string;
};

// Invite a co-manager to the current venue.
//  - Insert a venue_invites row with a random token + 14-day expiry.
//  - Email a join link via the Resend fetch pattern (env-gated, non-fatal).
// The invitee signs up (or signs in) and the auth callback redeems the token
// into a venue_members row, joining them to this venue.
export async function inviteManager(formData: FormData): Promise<InviteManagerResult> {
  await requireRole(["venue_admin", "owner"]);
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, url: "", emailSent: false, error: "Please enter a valid email address." };
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("venue_invites").insert({
    venue_id: venue.id,
    email,
    role: "venue_admin",
    token,
    expires_at: expiresAt,
    status: "sent",
  });
  if (error) {
    return { ok: false, url: "", emailSent: false, error: error.message };
  }

  const origin = await publicOrigin();
  // Land at signup first (new manager creates an account), then the auth
  // callback redeems the venue_invite token and joins them to the venue.
  const url = `${origin}/signup?venue_invite=${token}`;

  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#FFF6F0;border-radius:16px;padding:36px">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#FA523C;font-weight:600">Venuely</div>
        <h1 style="font-family:Georgia,serif;font-size:26px;color:#1c1917;margin:8px 0 4px">You've been invited to manage ${esc(venue.name)}</h1>
        <p style="color:#57534e;margin:0 0 24px">You can now help manage ${esc(venue.name)} on Venuely — weddings, enquiries, catalogue, the lot.</p>
        <a href="${url}" style="display:inline-block;background:#FA523C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;margin:0 0 24px">Accept invitation →</a>
        <p style="color:#8a9a86;font-size:13px;margin:24px 0 0;border-top:1px solid #FFC6AD;padding-top:16px">
          Already have a Venuely account? Sign in first, then open this link again to join the team.<br>
          Or paste this into your browser:<br><span style="color:#57534e;word-break:break-all">${url}</span>
        </p>
      </div>`;
    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Venuely <hello@venuely.co.za>",
          to: email,
          subject: `You've been invited to manage ${venue.name} on Venuely`,
          html,
        }),
      });
      emailSent = res.ok;
    } catch {
      emailSent = false; // non-fatal — the link is still usable / shareable
    }
  }

  revalidatePath("/venue/team");
  return {
    ok: true,
    url,
    emailSent,
    reason: !process.env.RESEND_API_KEY ? "email_not_configured" : undefined,
  };
}

// Cancel an outstanding (not-yet-accepted) invite for this venue.
export async function revokeInvite(inviteId: string) {
  await requireRole(["venue_admin", "owner"]);
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_invites")
    .delete()
    .eq("id", inviteId)
    .eq("venue_id", venue.id);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/team");
}

// Remove a co-manager from the venue (revokes their venue_members access).
// The primary/billing member cannot be removed via this action.
export async function removeMember(userId: string) {
  await requireRole(["venue_admin", "owner"]);
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_members")
    .delete()
    .eq("venue_id", venue.id)
    .eq("user_id", userId)
    .eq("is_primary", false);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/team");
}

// -----------------------------------------------------------------------------
// Review moderation — publish / hide a pending or visible review.
// -----------------------------------------------------------------------------
type ReviewStatus = "pending" | "published" | "hidden";
const REVIEW_STATUSES: ReviewStatus[] = ["pending", "published", "hidden"];

export async function setReviewStatus(reviewId: string, status: string) {
  await requireRole(["venue_admin", "owner"]);
  const next = REVIEW_STATUSES.includes(status as ReviewStatus) ? (status as ReviewStatus) : null;
  if (!next) throw new Error("Invalid status");

  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ status: next })
    .eq("id", reviewId)
    .eq("venue_id", venue.id);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/team");
  revalidatePath(`/v/${venue.slug}`);
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
}
