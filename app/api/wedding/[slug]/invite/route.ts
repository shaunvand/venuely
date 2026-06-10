import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import { sendEmail } from "@/lib/notifications";
import { whatsappUrl } from "@/lib/whatsapp";

// Send RSVP invites. Emails go via Resend (env-gated); for guests with a phone we
// return a wa.me deep link the couple taps to send over WhatsApp (until the
// WhatsApp Business API is wired). Each invite carries the guest's white-label
// RSVP link (/rsvp/<token>). Stamps invited_at. Portal-gated.
export const runtime = "nodejs";
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
const fmtDate = (s: string | null) => { if (!s) return ""; const d = new Date(`${s.slice(0, 10)}T00:00:00`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as { guestIds?: string[]; all?: boolean; onlyUninvited?: boolean };

  const db = admin();
  const { data: w } = await db.from("weddings").select("id, couple_names, wedding_date, rsvp_settings, venue_id").eq("id", access.wedding.id).single();
  if (!w) return NextResponse.json({ error: "wedding not found" }, { status: 404 });
  const { data: venue } = await db.from("venues").select("name").eq("id", w.venue_id).single();

  let q = db.from("guests").select("id, full_name, email, phone, rsvp_token, invited_at").eq("wedding_id", w.id);
  if (body.guestIds?.length) q = q.in("id", body.guestIds);
  if (body.onlyUninvited) q = q.is("invited_at", null);
  const { data: guests } = await q;
  if (!guests?.length) return NextResponse.json({ ok: true, sent: 0, results: [] });

  const origin = (req.headers.get("x-forwarded-host") ? `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host")}` : req.nextUrl.origin);
  const couple = w.couple_names || "the couple";
  const venueName = venue?.name || "their wedding";
  const dateLabel = fmtDate(w.wedding_date);
  const settings = (w.rsvp_settings ?? {}) as { message?: string };

  let sent = 0;
  const results: Array<{ id: string; name: string; emailed: boolean; whatsapp: string | null; link: string }> = [];
  const invitedIds: string[] = [];

  for (const g of guests) {
    const link = `${origin}/rsvp/${g.rsvp_token}`;
    let emailed = false;
    if (g.email) {
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#FFF6F0;border-radius:16px;padding:32px">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#FA523C;font-weight:600">You're invited</div>
          <h1 style="font-family:Georgia,serif;font-size:26px;color:#1c1917;margin:8px 0 12px">${esc(couple)}</h1>
          ${dateLabel ? `<p style="color:#57534e;margin:0 0 4px"><b>${esc(dateLabel)}</b>${venue?.name ? ` · ${esc(venueName)}` : ""}</p>` : ""}
          ${settings.message ? `<p style="color:#57534e;margin:12px 0">${esc(settings.message)}</p>` : `<p style="color:#57534e;margin:12px 0">Hi ${esc(g.full_name.split(" ")[0])}, we'd love for you to celebrate with us. Please let us know if you can make it.</p>`}
          <p style="margin:24px 0"><a href="${link}" style="background:#FA523C;color:#fff;text-decoration:none;border-radius:999px;padding:13px 28px;font-weight:600;display:inline-block">RSVP now</a></p>
          <p style="color:#8a9a86;font-size:12px;margin:16px 0 0">Or paste this link: ${link}</p>
        </div>`;
      const r = await sendEmail(g.email, `You're invited — ${couple}`, html);
      emailed = r.sent;
      if (r.sent) sent++;
    }
    const waText = `Hi ${g.full_name.split(" ")[0]}! You're invited to ${couple}'s wedding${dateLabel ? ` on ${dateLabel}` : ""}. Please RSVP here: ${link}`;
    const whatsapp = whatsappUrl(g.phone, waText);
    if (emailed || whatsapp) invitedIds.push(g.id);
    results.push({ id: g.id, name: g.full_name, emailed, whatsapp, link });
  }

  // Stamp invited_at only for guests actually reached: an email was sent or a
  // WhatsApp link was generated. Guests with no email/phone stay uninvited.
  if (invitedIds.length) {
    await db.from("guests").update({ invited_at: new Date().toISOString() }).in("id", invitedIds).is("invited_at", null);
  }

  return NextResponse.json({ ok: true, sent, results });
}
