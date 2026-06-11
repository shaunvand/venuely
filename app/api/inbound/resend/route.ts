import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import crypto from "crypto";
import { redactContacts } from "@/lib/messaging/redact";
import { tokenFromRecipients, stripQuotedReply, htmlToText } from "@/lib/messaging/emailReply";

export const runtime = "nodejs";

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Svix webhook signature check (Resend signs all webhooks with svix). The signed
// content is "{svix-id}.{svix-timestamp}.{raw body}" HMAC-SHA256'd with the
// base64 secret after the whsec_ prefix; the header carries space-separated
// "v1,<base64sig>" candidates.
function verifySvix(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false; // never accept unsigned ingestion — spoofed supplier messages otherwise
  const id = req.headers.get("svix-id");
  const ts = req.headers.get("svix-timestamp");
  const sig = req.headers.get("svix-signature");
  if (!id || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // 5-min replay window
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest("base64");
  return sig.split(/\s+/).some((part) => {
    const [version, candidate] = part.split(",");
    if (version !== "v1" || !candidate) return false;
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

// Resend "email.received" → route the supplier's emailed reply into its thread.
// The thread is identified ONLY by the token in the reply+<token>@… recipient,
// so the reply always lands with the couple who wrote, never broadcast.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifySvix(req, rawBody)) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let evt: { type?: string; data?: Record<string, unknown> };
  try { evt = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (evt.type !== "email.received") return NextResponse.json({ ok: true, skipped: "event type" });

  const data = (evt.data ?? {}) as { id?: string; email_id?: string; to?: unknown; from?: string; subject?: string; message_id?: string };
  const recipients = Array.isArray(data.to) ? (data.to as string[]) : [String(data.to ?? "")];
  const token = tokenFromRecipients(recipients);
  // Not a thread reply address (e.g. mail to the bare inbound domain) — ack and drop.
  if (!token) return NextResponse.json({ ok: true, skipped: "no thread token" });

  const db = admin();
  const { data: thread } = await db
    .from("message_threads")
    .select("id, venue_id, status, supplier_name, email_subject")
    .eq("reply_token", token)
    .maybeSingle();
  if (!thread) return NextResponse.json({ ok: true, skipped: "unknown token" });

  // Webhook payloads carry metadata only — fetch the full body from Resend.
  const receivedId = data.email_id || data.id;
  if (!receivedId) return NextResponse.json({ ok: true, skipped: "no email id" });
  let text = "";
  let messageId = data.message_id || null;
  try {
    const r = await fetch(`https://api.resend.com/emails/receiving/${receivedId}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!r.ok) return NextResponse.json({ error: `fetch received email: ${r.status}` }, { status: 502 });
    const full = (await r.json()) as { text?: string; html?: string; message_id?: string; subject?: string };
    text = stripQuotedReply(full.text || htmlToText(full.html || ""));
    messageId = full.message_id || messageId;
    if (!thread.email_subject && full.subject) {
      await db.from("message_threads").update({ email_subject: full.subject.replace(/^re:\s*/i, "") }).eq("id", thread.id);
    }
  } catch {
    return NextResponse.json({ error: "fetch received email failed" }, { status: 502 });
  }
  if (!text) return NextResponse.json({ ok: true, skipped: "empty body" });

  // Redelivered webhooks must not duplicate the message.
  if (messageId) {
    const { data: dup } = await db.from("thread_messages")
      .select("id").eq("thread_id", thread.id).eq("email_message_id", messageId).maybeSingle();
    if (dup) return NextResponse.json({ ok: true, skipped: "duplicate" });
  }

  const booked = thread.status === "booked";
  const red = booked ? { body: text, flagged: false, reason: null } : redactContacts(text);

  const { data: msg, error: msgErr } = await db.from("thread_messages").insert({
    thread_id: thread.id,
    venue_id: thread.venue_id,
    sender: "supplier",
    body: red.body,
    raw_body: red.flagged ? text : null,
    flagged: red.flagged,
    flag_reason: red.reason,
    email_message_id: messageId,
  }).select("id, created_at").single();
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  const { data: cur } = await db.from("message_threads").select("couple_unread").eq("id", thread.id).single();
  await db.from("message_threads").update({
    last_message_at: msg.created_at,
    last_email_message_id: messageId,
    couple_unread: (cur?.couple_unread ?? 0) + 1,
  }).eq("id", thread.id);

  return NextResponse.json({ ok: true, messageId: msg.id });
}
