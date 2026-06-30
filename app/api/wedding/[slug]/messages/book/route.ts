import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import { sendEmail } from "@/lib/notifications";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const rZA = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

export const runtime = "nodejs";

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Same commission math as markSupplierIntroBooked in app/venue/weddings/[slug]/actions.ts.
function computeCommission(commissionType: string | null, commissionValue: number, bookingValue: number): number {
  const val = Number(commissionValue) || 0;
  if (commissionType === "fixed") return Math.round(val * 100) / 100;
  const bv = Number(bookingValue) || 0;
  return Math.round((val / 100) * bv * 100) / 100;
}

// POST { threadId, bookingValue? } — couple marks the supplier booked. From here
// redaction stops, contact details unlock on both sides, and the linked
// supplier_intro records the booking + commission owed to the venue.
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  let b: { threadId?: string; bookingValue?: number | string | null };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!b?.threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });

  const db = admin();
  const { data: thread } = await db.from("message_threads")
    .select("id, venue_id, intro_id, status")
    .eq("id", b.threadId).eq("wedding_id", access.wedding.id).maybeSingle();
  if (!thread) return NextResponse.json({ error: "thread not found" }, { status: 404 });

  const nowIso = new Date().toISOString();
  const { error: threadErr } = await db.from("message_threads").update({ status: "booked" }).eq("id", thread.id);
  if (threadErr) return NextResponse.json({ error: threadErr.message }, { status: 500 });

  const bookingValue = Number(b.bookingValue) || 0;
  let supplierEmail: string | null = null;
  let supplierName = "there";
  let commissionAmount = 0;

  if (thread.intro_id) {
    const { data: intro } = await db.from("supplier_intros")
      .select("id, commission_type, commission_value, supplier_email, supplier_name")
      .eq("id", thread.intro_id).maybeSingle();
    if (intro) {
      commissionAmount = computeCommission(intro.commission_type, Number(intro.commission_value), bookingValue);
      supplierEmail = (intro.supplier_email as string | null) || null;
      supplierName = (intro.supplier_name as string | null) || supplierName;
      await db.from("supplier_intros").update({
        status: "booked",
        booking_value: bookingValue > 0 ? bookingValue : null,
        commission_amount: commissionAmount,
        booked_at: nowIso,
      }).eq("id", intro.id);
    }
  }

  if (thread.status !== "booked") {
    await db.from("thread_messages").insert({
      thread_id: thread.id,
      venue_id: thread.venue_id,
      sender: "system",
      body: "🎉 Marked as booked — contact details are now visible to both sides.",
    });
    await db.from("message_threads").update({ last_message_at: nowIso }).eq("id", thread.id);
  }

  // Notify the supplier they've been booked — with the couple's contact (so they
  // can invoice the couple directly) and a heads-up that the venue will invoice
  // them the commission. No-op if Resend isn't configured or no supplier email.
  if (supplierEmail) {
    const { data: w } = await db.from("weddings").select("couple_names, couple_email").eq("id", access.wedding.id).single();
    const { data: v } = await db.from("venues").select("name").eq("id", thread.venue_id).single();
    const couple = (w?.couple_names as string) || "the couple";
    const coupleEmail = (w?.couple_email as string | null) || null;
    const venueName = (v?.name as string) || "the venue";
    const valueLine = bookingValue > 0 ? ` for an agreed value of <strong>${rZA(bookingValue)}</strong>` : "";
    const commissionLine = commissionAmount > 0
      ? `<p style="margin:16px 0 0">Please note: ${esc(venueName)} will invoice you a commission of <strong>${rZA(commissionAmount)}</strong> on this booking, per your agreed terms.</p>`
      : "";
    const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1c1917;line-height:1.6">
      <p>Hi ${esc(supplierName)},</p>
      <p>Good news — <strong>${esc(couple)}</strong> has booked you${valueLine} for their wedding at ${esc(venueName)}.</p>
      <p>You can now contact the couple directly to confirm details and send them your invoice:</p>
      <p style="margin:8px 0">${coupleEmail ? `✉️ <a href="mailto:${esc(coupleEmail)}">${esc(coupleEmail)}</a>` : "The couple will be in touch via the contact details they shared."}</p>
      ${commissionLine}
      <p style="margin:20px 0 0;color:#78716c;font-size:12px">Sent via Venuely on behalf of ${esc(venueName)}.</p>
    </div>`;
    await sendEmail(supplierEmail, `You've been booked by ${couple} — ${venueName}`, html, { replyTo: coupleEmail });
  }

  return NextResponse.json({ ok: true });
}
