import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import { sendEmail } from "@/lib/notifications";
import { redactContacts } from "@/lib/messaging/redact";
import { replyAddressFor } from "@/lib/messaging/emailReply";

export const runtime = "nodejs";

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://venuely.co.za";
const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));

// "Sarah & Tom Smith" → "Sarah & Tom" — suppliers only ever see first names.
function firstNames(coupleNames: string | null | undefined): string {
  const parts = String(coupleNames || "").split(/\s*(?:&|\+|\band\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  const firsts = parts.map((p) => p.split(/\s+/)[0]).filter(Boolean);
  return firsts.join(" & ") || "the couple";
}

type MsgRow = { id: string; thread_id?: string; sender: string; body: string; flagged: boolean; flag_reason: string | null; created_at: string };
const msgOut = (m: MsgRow) => ({ id: m.id, sender: m.sender, body: m.body, flagged: m.flagged, flagReason: m.flag_reason, createdAt: m.created_at });

// Mediated supplier chat, couple side. Suppliers never see the couple's contact
// info and vice versa — contact details in message text are redacted until the
// thread is booked, and supplier email/phone are only revealed once booked.
// raw_body (the unredacted original) is venue-only and NEVER returned here.

// GET → all threads for this wedding (newest first), messages oldest-first.
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const db = admin();
  const { data: threads, error } = await db
    .from("message_threads")
    .select("id, vendor_id, supplier_name, supplier_type, supplier_email, supplier_phone, status, couple_unread, last_message_at, created_at")
    .eq("wedding_id", access.wedding.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (threads ?? []).map((t) => t.id);
  const { data: messages } = ids.length
    ? await db.from("thread_messages")
        .select("id, thread_id, sender, body, flagged, flag_reason, created_at")
        .in("thread_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] as MsgRow[] };

  const byThread = new Map<string, MsgRow[]>();
  for (const m of (messages ?? []) as MsgRow[]) {
    const list = byThread.get(m.thread_id!) ?? [];
    list.push(m);
    byThread.set(m.thread_id!, list);
  }

  const out = (threads ?? []).map((t) => ({
    id: t.id,
    vendorId: t.vendor_id,
    supplierName: t.supplier_name,
    supplierType: t.supplier_type,
    status: t.status,
    lastMessageAt: t.last_message_at,
    coupleUnread: t.couple_unread,
    // Contact reveal only after booking.
    supplierEmail: t.status === "booked" ? t.supplier_email : null,
    supplierPhone: t.status === "booked" ? t.supplier_phone : null,
    messages: (byThread.get(t.id) ?? []).map(msgOut),
  }));

  // The couple has now seen everything returned.
  if (ids.length) await db.from("message_threads").update({ couple_unread: 0 }).in("id", ids).gt("couple_unread", 0);

  return NextResponse.json({ threads: out });
}

// POST { threadId?, vendorId?, supplier?: {name,type,email,phone}, text }
// Finds-or-creates the supplier_intro + thread, redacts the message unless the
// thread is booked, stores it, and emails the supplier their tokenised reply link.
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  let b: {
    threadId?: string | null;
    vendorId?: string | null;
    supplier?: { name?: string; type?: string | null; email?: string | null; phone?: string | null } | null;
    text?: string;
  };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const text = (b?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const db = admin();
  const weddingId = access.wedding.id;
  const venueId = access.wedding.venue_id;

  type ThreadRow = {
    id: string; venue_id: string; status: string; reply_token: string;
    supplier_name: string; supplier_email: string | null;
    email_subject: string | null; last_email_message_id: string | null;
  };
  const THREAD_COLS = "id, venue_id, status, reply_token, supplier_name, supplier_email, email_subject, last_email_message_id";
  let thread: ThreadRow | null = null;

  if (b.threadId) {
    const { data } = await db.from("message_threads").select(THREAD_COLS)
      .eq("id", b.threadId).eq("wedding_id", weddingId).maybeSingle();
    if (!data) return NextResponse.json({ error: "thread not found" }, { status: 404 });
    thread = data as ThreadRow;
  } else {
    const vendorId = b.vendorId || null;

    // Snapshot supplier details from vendor_partners (recommended supplier) or
    // the payload (couple's own supplier).
    let snap: { name: string; type: string | null; email: string | null; phone: string | null };
    let commission: { type: string; value: number } = { type: "percent", value: 0 };
    if (vendorId) {
      const { data: existing } = await db.from("message_threads").select(THREAD_COLS)
        .eq("wedding_id", weddingId).eq("vendor_id", vendorId).maybeSingle();
      if (existing) {
        thread = existing as ThreadRow;
      }
      const { data: vendor } = await db.from("vendor_partners")
        .select("name, vendor_type, contact_email, contact_phone, commission_type, commission_value")
        .eq("id", vendorId).eq("venue_id", venueId).maybeSingle();
      if (!thread && !vendor) return NextResponse.json({ error: "supplier not found" }, { status: 404 });
      snap = {
        name: vendor?.name ?? "Supplier",
        type: vendor?.vendor_type ?? null,
        email: vendor?.contact_email ?? null,
        phone: vendor?.contact_phone ?? null,
      };
      commission = { type: vendor?.commission_type === "fixed" ? "fixed" : "percent", value: Number(vendor?.commission_value) || 0 };
    } else {
      const name = (b.supplier?.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "supplier.name required" }, { status: 400 });
      snap = { name, type: b.supplier?.type || null, email: b.supplier?.email || null, phone: b.supplier?.phone || null };
    }

    if (!thread) {
      // Find-or-create the supplier_intro paper trail (idempotent per wedding+vendor,
      // same as the supplier-intro route).
      let introId: string | null = null;
      if (vendorId) {
        const { data: intro } = await db.from("supplier_intros").select("id")
          .eq("wedding_id", weddingId).eq("vendor_id", vendorId).maybeSingle();
        introId = intro?.id ?? null;
      }
      if (!introId) {
        const { data: intro } = await db.from("supplier_intros").insert({
          venue_id: venueId,
          wedding_id: weddingId,
          vendor_id: vendorId,
          supplier_name: snap.name,
          supplier_type: snap.type,
          supplier_email: snap.email,
          supplier_phone: snap.phone,
          commission_type: commission.type,
          commission_value: commission.value,
          status: "intro_requested",
          intro_sent_at: new Date().toISOString(),
        }).select("id").single();
        introId = intro?.id ?? null;
      }

      const { data: created, error: createErr } = await db.from("message_threads").insert({
        venue_id: venueId,
        wedding_id: weddingId,
        intro_id: introId,
        vendor_id: vendorId,
        supplier_name: snap.name,
        supplier_type: snap.type,
        supplier_email: snap.email,
        supplier_phone: snap.phone,
      }).select(THREAD_COLS).single();
      if (createErr) {
        // Unique (wedding, vendor) race: another request created it first — reuse.
        if (vendorId) {
          const { data: again } = await db.from("message_threads").select(THREAD_COLS)
            .eq("wedding_id", weddingId).eq("vendor_id", vendorId).maybeSingle();
          if (again) thread = again as ThreadRow;
        }
        if (!thread) return NextResponse.json({ error: createErr.message }, { status: 500 });
      } else {
        thread = created as ThreadRow;
      }
    }
  }

  // Redact unless booked; keep the original (venue-only) only when something was hidden.
  const booked = thread.status === "booked";
  const red = booked ? { body: text, flagged: false, reason: null } : redactContacts(text);

  const { data: msg, error: msgErr } = await db.from("thread_messages").insert({
    thread_id: thread.id,
    venue_id: thread.venue_id,
    sender: "couple",
    body: red.body,
    raw_body: red.flagged ? text : null,
    flagged: red.flagged,
    flag_reason: red.reason,
  }).select("id, sender, body, flagged, flag_reason, created_at").single();
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  await db.from("message_threads").update({ last_message_at: msg.created_at }).eq("id", thread.id);

  // Notify the supplier (best-effort; no contact info of the couple, redacted text).
  if (thread.supplier_email) {
    const [{ data: venue }, { data: wedding }] = await Promise.all([
      db.from("venues").select("name").eq("id", thread.venue_id).single(),
      db.from("weddings").select("couple_names").eq("id", weddingId).single(),
    ]);
    const venueName = venue?.name || "a Venuely venue";
    const firsts = firstNames(wedding?.couple_names);
    const link = `${SITE}/s/${thread.reply_token}`;
    // Reply-by-email: per-thread reply_to routes the supplier's reply back into
    // this exact thread; In-Reply-To keeps it in their mail client's conversation.
    const replyTo = replyAddressFor(thread.reply_token);
    const footer = replyTo
      ? "Reply to this email or use the button — either way your message reaches the couple on Venuely. Contact details stay private until the couple books."
      : "Replies happen on that page — please don't reply to this email. Contact details stay private until the couple books.";
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#FFF6F0;border-radius:16px;padding:36px">
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1c1917;margin-bottom:16px">Venuely<span style="color:#FA523C">.</span></div>
        <h1 style="font-family:Georgia,serif;font-size:24px;color:#1c1917;margin:0 0 12px">New message from ${esc(firsts)}</h1>
        <p style="color:#57534e;margin:0 0 16px">${esc(firsts)} sent you a message about their wedding at ${esc(venueName)}:</p>
        <div style="background:#fff;border-radius:12px;padding:16px 18px;color:#1c1917;white-space:pre-wrap;border:1px solid rgba(0,0,0,0.06)">${esc(red.body)}</div>
        <p style="margin:24px 0 0"><a href="${link}" style="background:#FA523C;color:#fff;text-decoration:none;border-radius:999px;padding:13px 28px;font-weight:600;display:inline-block">Read &amp; reply on Venuely</a></p>
        <p style="color:#8a9a86;font-size:13px;margin:24px 0 0;border-top:1px solid #FFC6AD;padding-top:16px">${footer}</p>
      </div>`;
    const subject = thread.email_subject || `New message about a wedding at ${venueName}`;
    await sendEmail(thread.supplier_email, thread.email_subject ? `Re: ${subject.replace(/^re:\s*/i, "")}` : subject, html, {
      replyTo,
      headers: thread.last_email_message_id
        ? { "In-Reply-To": thread.last_email_message_id, References: thread.last_email_message_id }
        : undefined,
    });
    if (!thread.email_subject) await db.from("message_threads").update({ email_subject: subject }).eq("id", thread.id);
  }

  return NextResponse.json({
    ok: true,
    threadId: thread.id,
    message: { id: msg.id, sender: msg.sender, body: msg.body, flagged: msg.flagged, flagReason: msg.flag_reason, createdAt: msg.created_at },
  });
}
