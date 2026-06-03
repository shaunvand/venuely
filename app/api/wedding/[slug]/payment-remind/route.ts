import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import { sendEmail } from "@/lib/notifications";
import { whatsappUrl } from "@/lib/whatsapp";

// Remind guests who owe a contribution (attending, amount_paid < amount_due) by
// email, using the couple's custom template + payment instructions. Returns wa.me
// links for guests with a phone. Stamps payment_reminder_at. Portal-gated.
export const runtime = "nodejs";
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
const rands = (n: number) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as { guestIds?: string[] };

  const db = admin();
  const { data: w } = await db.from("weddings").select("couple_names, reminder_settings").eq("id", access.wedding.id).single();
  const settings = (w?.reminder_settings ?? {}) as { paymentTemplate?: string; paymentInstructions?: string };
  const couple = w?.couple_names || "the couple";

  let q = db.from("guests").select("id, full_name, email, phone, amount_due, amount_paid").eq("wedding_id", access.wedding.id);
  if (body.guestIds?.length) q = q.in("id", body.guestIds);
  const { data: guests } = await q;
  const owing = (guests ?? []).filter((g) => Number(g.amount_due || 0) > Number(g.amount_paid || 0));
  if (!owing.length) return NextResponse.json({ ok: true, sent: 0, results: [] });

  let sent = 0;
  const results: Array<{ id: string; emailed: boolean; whatsapp: string | null }> = [];
  for (const g of owing) {
    const outstanding = Number(g.amount_due) - Number(g.amount_paid);
    const first = g.full_name.split(" ")[0];
    const bodyText = (settings.paymentTemplate || `Hi {name}, a friendly reminder for your contribution towards {couple}'s wedding. Outstanding: {amount}.`)
      .replace(/\{name\}/g, first).replace(/\{couple\}/g, couple).replace(/\{amount\}/g, rands(outstanding));
    let emailed = false;
    if (g.email) {
      const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#FFF6F0;border-radius:16px;padding:32px">
        <h1 style="font-family:Georgia,serif;font-size:22px;color:#1c1917;margin:0 0 12px">A gentle reminder</h1>
        <p style="color:#57534e;white-space:pre-wrap">${esc(bodyText)}</p>
        ${settings.paymentInstructions ? `<div style="margin-top:16px;padding:14px;background:#fff;border-radius:10px;color:#44403c;white-space:pre-wrap;font-size:14px">${esc(settings.paymentInstructions)}</div>` : ""}
      </div>`;
      const r = await sendEmail(g.email, `Payment reminder — ${couple}'s wedding`, html);
      emailed = r.sent; if (r.sent) sent++;
    }
    results.push({ id: g.id, emailed, whatsapp: whatsappUrl(g.phone, `${bodyText}${settings.paymentInstructions ? `\n\n${settings.paymentInstructions}` : ""}`) });
  }
  await db.from("guests").update({ payment_reminder_at: new Date().toISOString() }).in("id", owing.map((g) => g.id));
  return NextResponse.json({ ok: true, sent, results });
}
