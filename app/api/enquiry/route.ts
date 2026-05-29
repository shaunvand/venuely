import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// Public lead-capture endpoint for the venue directory ( /v/[slug] ).
// Inserts an `enquiries` row and emails the venue's contact_email (if Resend
// is configured). Uses the service-role client so the insert is reliable, but
// re-validates the venue is real + listed before writing — never trust the
// client-supplied venue_id blindly.

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const RESEND_API = "https://api.resend.com/emails";

type EnquiryBody = {
  venue_id?: string;
  couple_name?: string;
  email?: string;
  phone?: string | null;
  event_date?: string | null;
  guest_count?: number | null;
  message?: string | null;
  consent?: boolean;
  source?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: EnquiryBody;
  try {
    body = (await request.json()) as EnquiryBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const venueId = (body.venue_id || "").trim();
  const coupleName = (body.couple_name || "").trim();
  const email = (body.email || "").trim();

  // Rate-guard: reject anything missing the bare minimum to be a real lead.
  if (!venueId || !coupleName || !email) {
    return NextResponse.json(
      { ok: false, error: "name, email and venue are required" },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });
  }

  const supabase = admin();

  // Confirm the venue exists and is publicly listed before accepting the lead.
  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, contact_email, listed")
    .eq("id", venueId)
    .maybeSingle();

  if (!venue || (venue as { listed?: boolean }).listed !== true) {
    return NextResponse.json({ ok: false, error: "venue not found" }, { status: 404 });
  }

  const guestCount =
    body.guest_count != null && Number.isFinite(Number(body.guest_count))
      ? Number(body.guest_count)
      : null;

  const { data: enquiry, error } = await supabase
    .from("enquiries")
    .insert({
      venue_id: venueId,
      couple_name: coupleName,
      email,
      phone: (body.phone || "")?.toString().trim() || null,
      event_date: body.event_date || null,
      guest_count: guestCount,
      message: (body.message || "")?.toString().trim() || null,
      consent: body.consent === true,
      source: (body.source || "listing")?.toString().slice(0, 60),
      status: "new",
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Notify the venue, if Resend is configured. Email failure is non-fatal —
  // the enquiries row is the source of truth.
  const to = (venue as { contact_email: string | null }).contact_email;
  if (process.env.RESEND_API_KEY && to) {
    const subject = `New enquiry from ${coupleName}`;
    const html = renderEmail(
      coupleName,
      email,
      body.phone || null,
      body.event_date || null,
      guestCount,
      body.message || null,
      (venue as { name: string }).name
    );
    try {
      await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Venuely <hello@venuely.co.za>",
          to,
          reply_to: email,
          subject,
          html,
        }),
      });
    } catch {
      // ignore — non-fatal
    }
  }

  return NextResponse.json({ ok: true, enquiry });
}

function esc(v: unknown): string {
  return String(v ?? "—").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
}

function renderEmail(
  couple: string,
  email: string,
  phone: string | null,
  date: string | null,
  guests: number | null,
  message: string | null,
  venueName: string
): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px">
      <h2 style="color:#FA523C">New enquiry for ${esc(venueName)}</h2>
      <p><b>${esc(couple)}</b> would like a quote.</p>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#888">Email</td><td>${esc(email)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888">Phone</td><td>${esc(phone)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888">Preferred date</td><td>${esc(date)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#888">Guests</td><td>${esc(guests)}</td></tr>
      </table>
      ${message ? `<p style="background:#FFF6F0;padding:12px;border-left:3px solid #FA523C;margin-top:12px">${esc(message)}</p>` : ""}
      <p style="color:#888;font-size:12px;margin-top:18px">Open Venuely → Enquiries to reply or convert this lead into a couple portal.</p>
    </div>
  `;
}
