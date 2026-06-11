"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentVenue } from "@/lib/venue/current";
import { sendEmail } from "@/lib/notifications";
import { replyAddressFor } from "@/lib/messaging/emailReply";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://venuely.co.za";
const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));

// The venue writes into a couple↔supplier thread (e.g. to nudge a slow supplier
// or answer a question). Venue messages are NOT redacted — the venue is the
// mediator and may share whatever it likes. Bumps the couple's unread counter so
// the message surfaces in their portal badge.
export async function sendVenueMessage(threadId: string, text: string) {
  const body = text.trim();
  if (!body) throw new Error("Message is empty");

  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: thread, error: fetchErr } = await supabase
    .from("message_threads")
    .select("id, venue_id, couple_unread, supplier_email, reply_token, email_subject, last_email_message_id")
    .eq("id", threadId)
    .single();
  if (fetchErr || !thread) throw new Error("Thread not found");
  if (thread.venue_id !== venue.id) throw new Error("Not your venue");

  const { error: insertErr } = await supabase.from("thread_messages").insert({
    thread_id: threadId,
    venue_id: venue.id,
    sender: "venue",
    body,
    flagged: false,
  });
  if (insertErr) throw new Error(insertErr.message);

  const { error: updateErr } = await supabase
    .from("message_threads")
    .update({
      couple_unread: (Number(thread.couple_unread) || 0) + 1,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .eq("venue_id", venue.id);
  if (updateErr) throw new Error(updateErr.message);

  // Notify the supplier by email too (best-effort), threaded into the same
  // conversation; their reply routes back into this thread via reply_to.
  if (thread.supplier_email) {
    const replyTo = replyAddressFor(thread.reply_token);
    const link = `${SITE}/s/${thread.reply_token}`;
    const subject = thread.email_subject ? `Re: ${String(thread.email_subject).replace(/^re:\s*/i, "")}` : `Message from ${venue.name} on Venuely`;
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#FFF6F0;border-radius:16px;padding:36px">
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1c1917;margin-bottom:16px">Venuely<span style="color:#FA523C">.</span></div>
        <h1 style="font-family:Georgia,serif;font-size:24px;color:#1c1917;margin:0 0 12px">Message from ${esc(venue.name)}</h1>
        <div style="background:#fff;border-radius:12px;padding:16px 18px;color:#1c1917;white-space:pre-wrap;border:1px solid rgba(0,0,0,0.06)">${esc(body)}</div>
        <p style="margin:24px 0 0"><a href="${link}" style="background:#FA523C;color:#fff;text-decoration:none;border-radius:999px;padding:13px 28px;font-weight:600;display:inline-block">Read &amp; reply on Venuely</a></p>
        <p style="color:#8a9a86;font-size:13px;margin:24px 0 0;border-top:1px solid #FFC6AD;padding-top:16px">${replyTo ? "Reply to this email or use the button — either way your message reaches the conversation on Venuely." : "Replies happen on that page — please don't reply to this email."}</p>
      </div>`;
    await sendEmail(thread.supplier_email, subject, html, {
      replyTo,
      headers: thread.last_email_message_id
        ? { "In-Reply-To": thread.last_email_message_id, References: thread.last_email_message_id }
        : undefined,
    });
  }

  revalidatePath("/venue/messages");
}
