// Notification lifecycle helpers — a thin, env-gated layer over Resend plus
// reusable message builders for the couple-facing emails the venue sends by hand
// (deposit / balance reminders, enquiry acknowledgements). No scheduler here:
// every send is owner-triggered. An automated cron is a follow-up.
//
// sendEmail wraps the same Resend fetch pattern used in
// app/api/wedding/[slug]/submit/route.ts and app/venue/weddings/actions.ts —
// when RESEND_API_KEY is absent it is a no-op that returns {sent:false} so the
// build (and dev runs without keys) never throw.

import {
  whatsappUrl,
  depositReminderMessage,
  balanceReminderMessage,
} from "@/lib/whatsapp";

const RESEND_API = "https://api.resend.com/emails";
const FROM = "Venuely <hello@venuely.co.za>";

export type SendEmailResult = {
  sent: boolean;
  reason?: "no_api_key" | "no_recipient" | "send_failed";
};

// Env-gated email send. Returns {sent:false} (never throws) when the API key or
// recipient is missing, mirroring the non-fatal email behaviour elsewhere.
export async function sendEmail(
  to: string | null | undefined,
  subject: string,
  html: string,
  opts?: { replyTo?: string | null },
): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "no_api_key" };
  const recipient = (to ?? "").trim();
  if (!recipient) return { sent: false, reason: "no_recipient" };

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: recipient,
        ...(opts?.replyTo ? { reply_to: opts.replyTo } : {}),
        subject,
        html,
      }),
    });
    return res.ok ? { sent: true } : { sent: false, reason: "send_failed" };
  } catch {
    // Non-fatal — the caller treats email as best-effort.
    return { sent: false, reason: "send_failed" };
  }
}

// -----------------------------------------------------------------------------
// Message builders. Each returns the email subject + html and a plain-text
// WhatsApp variant, so a caller can email AND/OR open a wa.me deep link off the
// same content. whatsappText reuses the lib/whatsapp templates verbatim.
// -----------------------------------------------------------------------------

export type CoupleMessage = { subject: string; html: string; whatsappText: string };

export type WeddingLike = {
  couple_names: string;
  wedding_date?: string | null;
  venue?: { name?: string | null } | null;
  venueName?: string | null;
};

function esc(v: unknown): string {
  return String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
}

function rands(amount: number): string {
  return `R${Math.round(Number(amount) || 0).toLocaleString("en-ZA")}`;
}

function dueLabel(dueDate: string | null | undefined): string {
  if (!dueDate) return "soon";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "soon";
  return d.toLocaleDateString("en-ZA", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function venueNameOf(wedding: WeddingLike): string {
  return (wedding.venue?.name ?? wedding.venueName ?? "your venue") || "your venue";
}

// Brand-matched email shell (Poppy #FA523C / Peach / Cream) reused by reminders.
function shell(opts: { eyebrow: string; heading: string; bodyHtml: string }): string {
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#FFF6F0;border-radius:16px;padding:36px">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#FA523C;font-weight:600">${esc(opts.eyebrow)}</div>
      <h1 style="font-family:Georgia,serif;font-size:26px;color:#1c1917;margin:8px 0 16px">${esc(opts.heading)}</h1>
      ${opts.bodyHtml}
      <p style="color:#8a9a86;font-size:13px;margin:24px 0 0;border-top:1px solid #FFC6AD;padding-top:16px">
        Reply to this email if you have any questions — we're here to help.
      </p>
    </div>`;
}

export function depositReminder(
  wedding: WeddingLike,
  amount: number,
  dueDate?: string | null,
): CoupleMessage {
  const venueName = venueNameOf(wedding);
  const subject = `Deposit reminder — your wedding at ${venueName}`;
  const html = shell({
    eyebrow: "Venuely",
    heading: "A friendly deposit reminder",
    bodyHtml: `
      <p style="color:#57534e;margin:0 0 16px">Hi ${esc(wedding.couple_names)}, to secure your date with ${esc(venueName)} your deposit is due.</p>
      <p style="margin:0 0 4px;color:#57534e">Deposit due:</p>
      <p style="font-size:24px;font-weight:600;margin:0 0 4px;color:#FA523C">${rands(amount)}</p>
      <p style="margin:0 0 20px;color:#57534e">Due ${dueDate ? `by <b>${esc(dueLabel(dueDate))}</b>` : "soon"}.</p>
      <p style="color:#57534e;margin:0">Pay by EFT or card — reply here for banking details or a payment link.</p>`,
  });
  const whatsappText = depositReminderMessage({ venueName, coupleNames: wedding.couple_names, amount, dueDate });
  return { subject, html, whatsappText };
}

export function balanceReminder(
  wedding: WeddingLike,
  amount: number,
  dueDate?: string | null,
): CoupleMessage {
  const venueName = venueNameOf(wedding);
  const subject = `Balance reminder — your wedding at ${venueName}`;
  const html = shell({
    eyebrow: "Venuely",
    heading: "Your balance is coming due",
    bodyHtml: `
      <p style="color:#57534e;margin:0 0 16px">Hi ${esc(wedding.couple_names)}, the remaining balance on your wedding with ${esc(venueName)} is due.</p>
      <p style="margin:0 0 4px;color:#57534e">Balance due:</p>
      <p style="font-size:24px;font-weight:600;margin:0 0 4px;color:#FA523C">${rands(amount)}</p>
      <p style="margin:0 0 20px;color:#57534e">Due ${dueDate ? `by <b>${esc(dueLabel(dueDate))}</b>` : "soon"}.</p>
      <p style="color:#57534e;margin:0">Reply here for banking details, a payment link, or to arrange anything else.</p>`,
  });
  const whatsappText = balanceReminderMessage({ venueName, coupleNames: wedding.couple_names, amount, dueDate });
  return { subject, html, whatsappText };
}

export type EnquiryLike = {
  couple_name?: string | null;
  email?: string | null;
  phone?: string | null;
  event_date?: string | null;
  venueName?: string | null;
};

// Acknowledgement back to a couple who just enquired via the public listing.
export function enquiryAck(enquiry: EnquiryLike): CoupleMessage {
  const venueName = (enquiry.venueName ?? "the venue") || "the venue";
  const name = (enquiry.couple_name ?? "there") || "there";
  const dateLine = enquiry.event_date
    ? `We've noted your preferred date of <b>${esc(dueLabel(enquiry.event_date))}</b> and will check availability.`
    : `Let us know your preferred date and we'll check availability.`;
  const subject = `Thanks for your enquiry — ${venueName}`;
  const html = shell({
    eyebrow: venueName,
    heading: "Thank you for your enquiry",
    bodyHtml: `
      <p style="color:#57534e;margin:0 0 16px">Hi ${esc(name)}, thank you for reaching out about your wedding at ${esc(venueName)}.</p>
      <p style="color:#57534e;margin:0 0 16px">${dateLine}</p>
      <p style="color:#57534e;margin:0">We'll be in touch shortly with availability and a tailored quote.</p>`,
  });
  const dateText = enquiry.event_date
    ? `We've noted your preferred date of ${dueLabel(enquiry.event_date)} and will check availability.`
    : `Let us know your preferred date and we'll check availability.`;
  const whatsappText = `Hi ${name},

Thank you for your enquiry about your wedding at ${venueName} 💍

${dateText}

We'll be in touch shortly with availability and a tailored quote.`;
  return { subject, html, whatsappText };
}

// Convenience: a wa.me deep link for a CoupleMessage given the couple's phone.
// Returns null when the phone is missing/invalid (whatsappUrl decides).
export function whatsappLinkFor(phone: string | null | undefined, msg: CoupleMessage): string | null {
  return whatsappUrl(phone, msg.whatsappText);
}
