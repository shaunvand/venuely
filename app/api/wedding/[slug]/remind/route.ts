import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import { sendEmail } from "@/lib/notifications";
import { whatsappUrl } from "@/lib/whatsapp";

// Manual "send now" for either reminder type, using the couple's saved subject +
// template. RSVP → guests invited but not responded; payment → attending guests
// who still owe a contribution. Stamps the matching reminder timestamp.
export const runtime = "nodejs";
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://venuely.co.za";
const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
const rands = (n: number) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;
const shell = (inner: string) => `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#FFF6F0;border-radius:16px;padding:32px">${inner}</div>`;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const { kind } = (await req.json().catch(() => ({}))) as { kind?: string };
  const isPayment = kind === "payment";

  const db = admin();
  const { data: w } = await db.from("weddings").select("couple_names, reminder_settings").eq("id", access.wedding.id).single();
  const s = (w?.reminder_settings ?? {}) as Record<string, string>;
  const couple = w?.couple_names || "the couple";
  const nowIso = new Date().toISOString();

  const { data: guests } = await db.from("guests")
    .select("id, full_name, email, phone, rsvp_token, invited_at, responded_at, rsvp_status, amount_due, amount_paid")
    .eq("wedding_id", access.wedding.id).not("email", "is", null);

  const targets = (guests ?? []).filter((g) => isPayment
    ? (g.rsvp_status === "attending" && Number(g.amount_due || 0) > Number(g.amount_paid || 0))
    : (g.invited_at && !g.responded_at));
  if (!targets.length) return NextResponse.json({ ok: true, sent: 0, results: [] });

  const subject = isPayment ? (s.paymentSubject || `Payment reminder — ${couple}'s wedding`) : (s.rsvpSubject || `Please RSVP — ${couple}`);
  const tmpl = isPayment ? (s.paymentTemplate || "Hi {name}, a friendly reminder for your contribution towards {couple}'s wedding. Outstanding: {amount}.") : (s.rsvpTemplate || "Hi {name}, we'd love to know if you can join {couple}. Please RSVP here: {link}");

  let sent = 0;
  const results: Array<{ id: string; emailed: boolean; whatsapp: string | null }> = [];
  for (const g of targets) {
    const first = g.full_name?.split(" ")[0] || "there";
    const link = `${SITE}/rsvp/${g.rsvp_token}`;
    const outstanding = Number(g.amount_due || 0) - Number(g.amount_paid || 0);
    const text = tmpl.replace(/\{name\}/g, first).replace(/\{couple\}/g, couple).replace(/\{amount\}/g, rands(outstanding)).replace(/\{link\}/g, link);
    const html = shell(
      `<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${esc(isPayment ? "A gentle reminder" : "A gentle RSVP reminder")}</h1>
       <p style="color:#57534e;white-space:pre-wrap">${esc(text)}</p>
       ${!isPayment ? `<p style="margin:20px 0"><a href="${link}" style="background:#FA523C;color:#fff;text-decoration:none;border-radius:999px;padding:12px 26px;font-weight:600;display:inline-block">RSVP now</a></p>` : ""}
       ${isPayment && s.paymentInstructions ? `<div style="margin-top:16px;padding:14px;background:#fff;border-radius:10px;white-space:pre-wrap;font-size:14px">${esc(s.paymentInstructions)}</div>` : ""}`
    );
    const r = await sendEmail(g.email, subject, html);
    if (r.sent) sent++;
    results.push({ id: g.id, emailed: r.sent, whatsapp: whatsappUrl(g.phone, `${text}${isPayment && s.paymentInstructions ? `\n\n${s.paymentInstructions}` : ""}`) });
  }
  await db.from("guests").update(isPayment ? { payment_reminder_at: nowIso } : { rsvp_reminder_at: nowIso }).in("id", targets.map((g) => g.id));
  return NextResponse.json({ ok: true, sent, results });
}
