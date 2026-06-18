"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { platformFee } from "@/lib/billing/compute";
import { buildWeddingCharges } from "@/lib/billing/charges";
import { renderInvoiceEmailHtml, formatDateZA, type InvoiceLineItem, type InvoiceScheduleRow } from "@/lib/invoice/render";
import { resolveInvoiceTheme } from "@/lib/invoice/templates";
import { whatsappUrl } from "@/lib/whatsapp";

// Normalise a (start, end) date-range form pair into the columns we store.
// - blank start  → both null (date TBD)
// - blank end    → single-day event (end stays null)
// - end < start  → swap, so the earlier date is always the start
// - end === start → collapse to single-day (end null) to keep data tidy
function normaliseDateRange(
  startRaw: string | null | undefined,
  endRaw: string | null | undefined,
): { startDate: string | null; endDate: string | null } {
  let start = (startRaw || "").trim() || null;
  let end = (endRaw || "").trim() || null;
  if (!start) return { startDate: null, endDate: null };
  if (end && end < start) [start, end] = [end, start];
  if (end && end === start) end = null;
  return { startDate: start, endDate: end };
}

// Lightweight salted hash. The base salt comes from a server-only env var
// (falls back to a fixed string in dev). When a per-wedding `portalSalt` is
// supplied it is folded in too, so rotating a wedding's salt invalidates every
// old vy_portal_<id> cookie (which stored the previous hash). Must stay in
// lock-step with the same helper in app/[wedding]/route.ts and lib/portal/access.ts.
function hashPassword(plain: string, portalSalt?: string | null): string {
  const base = process.env.PORTAL_PASSWORD_SALT ?? "venuely-portal-v1";
  const salt = portalSalt ? `${base}::${portalSalt}` : base;
  return createHash("sha256").update(`${salt}::${plain}`).digest("hex");
}

// A short, friendly, unambiguous password (no 0/O/1/l/I) for couples who don't
// already have one set. e.g. "petal-7421".
function friendlyPassword(): string {
  const words = ["petal", "ivory", "amber", "olive", "coral", "willow", "fern", "dahlia", "marble", "linen"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = 1000 + Math.floor(Math.random() * 9000);
  return `${word}-${num}`;
}

// Turn "Alex & Sam Smith" → "AlexAndSamSmithWedding".
// Strips non-alphanumerics, joins words, appends "Wedding" suffix.
function pascalSlug(couples: string): string {
  const cleaned = couples
    .replace(/&/g, " And ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const camel = cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return `${camel}Wedding`;
}

async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, base: string): Promise<string> {
  let candidate = base || "Wedding";
  let n = 2;
  while (true) {
    // limit(1) (not maybeSingle) so a pre-existing slug COLLISION doesn't error
    // and wrongly report the slug as free — that's how dupes crept in.
    const { data } = await supabase.from("weddings").select("id").eq("slug", candidate).limit(1);
    if (!data || data.length === 0) return candidate;
    candidate = `${base}${n++}`;
  }
}

// Insert the weddings row and return its identity directly (no redirect).
// Used by createWedding below and by enquiries/actions.ts::convertEnquiry, which
// needs the new wedding id to link enquiry.wedding_id without guessing.
// RLS on weddings (venue membership) is the authorisation gate here.
export async function createWeddingRecord(
  venueId: string,
  formData: FormData,
): Promise<{ id: string; slug: string }> {
  const supabase = await createClient();
  const couples = (formData.get("couple_names") as string).trim();
  const explicit = (formData.get("slug") as string || "").trim();

  const base = explicit ? explicit.replace(/[^a-zA-Z0-9]/g, "") : pascalSlug(couples);
  const slug = await uniqueSlug(supabase, base);

  const guestStr = formData.get("guest_count") as string;
  const statusStr = (formData.get("status") as string)?.trim() || "inquiry";
  const passwordStr = (formData.get("portal_password") as string)?.trim() || "";
  const { startDate, endDate } = normaliseDateRange(
    formData.get("wedding_date") as string,
    formData.get("wedding_end_date") as string,
  );
  const { data, error } = await supabase
    .from("weddings")
    .insert({
      venue_id: venueId,
      slug,
      couple_names: couples,
      wedding_date: startDate,
      wedding_end_date: endDate,
      guest_count: guestStr ? Number(guestStr) : null,
      status: statusStr,
      portal_password_hash: passwordStr ? hashPassword(passwordStr) : null,
    })
    .select("id, slug")
    .single();

  if (error || !data) throw new Error(`Could not create wedding: ${error?.message ?? "no row returned"}`);
  return { id: data.id as string, slug: data.slug as string };
}

export async function createWedding(venueId: string, _venueSlug: string, formData: FormData) {
  const { slug } = await createWeddingRecord(venueId, formData);
  revalidatePath("/venue/weddings");
  redirect(`/venue/weddings/${slug}`);
}

// Permanently delete a wedding (e.g. cancelled). FK cascades remove the couple's
// portal state, charges, payments, members, invites, etc. Irreversible.
export async function deleteWedding(weddingId: string, _slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").delete().eq("id", weddingId);
  if (error) throw new Error(`Could not delete wedding: ${error.message}`);
  revalidatePath("/venue/weddings");
}

export async function updateWeddingBasics(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const guestStr = formData.get("guest_count") as string;
  const budgetStr = formData.get("total_budget") as string;
  const { startDate, endDate } = normaliseDateRange(
    formData.get("wedding_date") as string,
    formData.get("wedding_end_date") as string,
  );
  // Set-up / breakdown days are venue-editable and independent of the wedding
  // range — store the raw date or null (blank). Powers the calendar timeline.
  const setupDate = (formData.get("setup_date") as string || "").trim() || null;
  const breakdownDate = (formData.get("breakdown_date") as string || "").trim() || null;
  const patch: Record<string, unknown> = {
    couple_names: (formData.get("couple_names") as string)?.trim(),
    wedding_date: startDate,
    wedding_end_date: endDate,
    setup_date: setupDate,
    breakdown_date: breakdownDate,
    guest_count: guestStr ? Number(guestStr) : null,
    total_budget: budgetStr ? Number(budgetStr) : null,
    status: (formData.get("status") as string) || "inquiry",
    notes: (formData.get("notes") as string) || null,
  };
  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
  revalidatePath("/venue/calendar");
}

export async function setPortalPassword(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const pw = (formData.get("password") as string || "").trim();
  // Hash with the wedding's current per-wedding salt (if it has one from a prior
  // rotation) so the gate — which prefers portal_salt — keeps matching.
  const { data: wed } = await supabase.from("weddings").select("portal_salt").eq("id", weddingId).single();
  const portalSalt = (wed as { portal_salt?: string | null } | null)?.portal_salt ?? null;
  const patch = { portal_password_hash: pw ? hashPassword(pw, portalSalt) : null };
  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// -----------------------------------------------------------------------------
// Couple invite & delivery + link lifecycle.
// -----------------------------------------------------------------------------

const RESEND_API = "https://api.resend.com/emails";

// Build the public origin (https://venuely.co.za) from x-forwarded-* so links
// never leak the internal Render dyno address.
async function publicOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "venuely.co.za";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export type SendPortalInviteResult = {
  ok: boolean;
  url: string;
  whatsappUrl: string | null;
  passwordSet: boolean;
  password?: string;          // only returned when freshly auto-generated
  emailSent: boolean;
  reason?: string;
};

// Ensure the couple has a way in, record the invite, and (best-effort) email them.
//  - If no portal password is set, auto-generate a friendly one and store its hash.
//  - Insert a wedding_invites row with a random token, 30-day expiry.
//  - Email the portal link + access code via the Resend fetch pattern (env-gated).
//  - Persist couple_email on the wedding.
export async function sendPortalInvite(
  weddingId: string,
  slug: string,
  opts: { email?: string; whatsapp?: string },
): Promise<SendPortalInviteResult> {
  const supabase = await createClient();
  const email = (opts.email ?? "").trim();
  const whatsapp = (opts.whatsapp ?? "").trim();

  const { data: wed, error: wErr } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, portal_password_hash, portal_salt, venue:venues(name)")
    .eq("id", weddingId)
    .single();
  if (wErr || !wed) throw new Error(wErr?.message ?? "Wedding not found");

  const venueName = (wed as unknown as { venue: { name: string } | null }).venue?.name ?? "your venue";
  const portalSalt = (wed as { portal_salt?: string | null }).portal_salt ?? null;

  // 1) Ensure an access code exists.
  let generatedPassword: string | undefined;
  let passwordSet = !!(wed as { portal_password_hash?: string | null }).portal_password_hash;
  if (!passwordSet) {
    generatedPassword = friendlyPassword();
    const { error: pErr } = await supabase
      .from("weddings")
      .update({ portal_password_hash: hashPassword(generatedPassword, portalSalt) })
      .eq("id", weddingId);
    if (pErr) throw new Error(pErr.message);
    passwordSet = true;
  }

  // 2) Record the invite (random token, 30-day expiry).
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("wedding_invites").insert({
    wedding_id: weddingId,
    email: email || null,
    role: "couple",
    token,
    expires_at: expiresAt,
    status: "sent",
  });

  // 3) Persist the couple email when supplied.
  if (email) {
    await supabase.from("weddings").update({ couple_email: email }).eq("id", weddingId);
  }

  const origin = await publicOrigin();
  const url = `${origin}/${slug}`;

  // 4) Compose the WhatsApp share link (returned to the client for one-tap share).
  const waMessage = generatedPassword
    ? `Hi! Your ${venueName} wedding planning portal is ready 💍\n\n${url}\nAccess code: ${generatedPassword}`
    : `Hi! Your ${venueName} wedding planning portal is ready 💍\n\n${url}`;
  const wa = whatsapp ? whatsappUrl(whatsapp, waMessage) : null;

  // 5) Email the couple (env-gated — never throws at build/import time).
  let emailSent = false;
  if (process.env.RESEND_API_KEY && email) {
    const codeBlock = generatedPassword
      ? `<p style="margin:0 0 8px;color:#57534e">Your access code:</p>
         <p style="font-size:22px;font-weight:600;letter-spacing:1px;margin:0 0 20px;color:#FA523C">${generatedPassword}</p>`
      : `<p style="margin:0 0 20px;color:#57534e">Use the access code your venue gave you to sign in.</p>`;
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#FFF6F0;border-radius:16px;padding:36px">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#FA523C;font-weight:600">Venuely</div>
        <h1 style="font-family:Georgia,serif;font-size:26px;color:#1c1917;margin:8px 0 4px">Your wedding portal is ready</h1>
        <p style="color:#57534e;margin:0 0 24px">Hi ${(wed as { couple_names: string }).couple_names}, ${venueName} has set up your personal planning portal.</p>
        <a href="${url}" style="display:inline-block;background:#FA523C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;margin:0 0 24px">Open your portal →</a>
        ${codeBlock}
        <p style="color:#8a9a86;font-size:13px;margin:24px 0 0;border-top:1px solid #FFC6AD;padding-top:16px">
          Or paste this link into your browser:<br><span style="color:#57534e;word-break:break-all">${url}</span>
        </p>
      </div>`;
    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Venuely <hello@venuely.co.za>",
          to: email,
          subject: `Your ${venueName} wedding portal is ready`,
          html,
        }),
      });
      emailSent = res.ok;
    } catch {
      emailSent = false; // non-fatal — the link + code are still usable
    }
  }

  revalidatePath(`/venue/weddings/${slug}`);
  return {
    ok: true,
    url,
    whatsappUrl: wa,
    passwordSet,
    password: generatedPassword,
    emailSent,
    reason: !process.env.RESEND_API_KEY ? "email_not_configured" : (!email ? "no_email" : undefined),
  };
}

// Rotate portal access: assign a NEW per-wedding portal_salt so every previously
// issued vy_portal_<id> cookie stops matching. If an explicit new password is
// supplied we re-hash it under the new salt; otherwise we clear the password so
// the next sendPortalInvite generates (and surfaces) a fresh access code — the
// only way to reveal a new code to the venue, since a bare form action can't
// return one to the UI.
export async function rotatePortalAccess(weddingId: string, slug: string, formData?: FormData) {
  const supabase = await createClient();
  const newSalt = randomBytes(12).toString("hex");

  const supplied = (formData?.get("password") as string | null)?.trim() || "";
  const nextHash: string | null = supplied ? hashPassword(supplied, newSalt) : null;

  const { error } = await supabase
    .from("weddings")
    .update({ portal_salt: newSalt, portal_password_hash: nextHash })
    .eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// Remove a couple member from the wedding (revokes auth-based access; the
// can_access_wedding RLS no longer matches that user).
export async function revokeCoupleAccess(weddingId: string, userId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("wedding_members")
    .delete()
    .eq("wedding_id", weddingId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// NOTE: total/feeRate are still in the signature so the [slug] page's bound
// call keeps compiling, but they are NOT trusted — the invoice total and the
// platform fee are recomputed server-side from the wedding's live charges and
// the venue's authoritative platform_fee_rate. This prevents a tampered client
// form from understating (or inflating) the fee owed.
export async function markInvoiced(weddingId: string, slug: string, _total?: number, _feeRate?: number) {
  const supabase = await createClient();

  const { data: wed } = await supabase.from("weddings").select("venue_id").eq("id", weddingId).single();
  if (!wed?.venue_id) throw new Error("Wedding not found");

  const { grandTotal, feeRate, feeActive, totals } = await buildWeddingCharges(supabase, wed.venue_id as string, weddingId);
  // invoice_total snapshots what the couple pays (the gross grand_total), but the
  // platform fee is venue.platform_fee_rate × platform_fee_base (= grand_total −
  // venue commission). Venuely never taxes the venue's commission; the venue keeps
  // 100% of it. When venue.platform_fee_active is false the fee is waived (0) but
  // the invoice is still recorded.
  const fee = feeActive ? platformFee(totals, feeRate) : 0;

  const { error } = await supabase.from("weddings").update({
    invoiced_at: new Date().toISOString(),
    invoice_total: grandTotal,
    platform_fee_owed: fee,
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function markCouplePaid(weddingId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({
    couple_paid_at: new Date().toISOString(),
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function markPlatformFeePaid(weddingId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({
    platform_fee_paid_at: new Date().toISOString(),
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// ---------------------------------------------------------------------------
// Couple submission → venue review → EFT invoices.
// ---------------------------------------------------------------------------

function adminClient() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const rZA = (n: number) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;

type VenueBank = {
  name: string; contact_email: string | null; bank_name: string | null; bank_account_name: string | null;
  bank_account_number: string | null; bank_branch_code: string | null;
  bank_swift: string | null; bank_iban: string | null; invoice_theme: { accent?: string; logoUrl?: string } | null;
  invoice_template: string | null; branding_logo_url: string | null;
  platform_fee_rate: number | null;
};

function bankRows(b: {
  account_name?: string | null; bank?: string | null; account_number?: string | null;
  branch?: string | null; swift?: string | null; iban?: string | null; reference: string;
}): string {
  const row = (k: string, v: string | null | undefined) =>
    v ? `<tr><td style="color:#57534e;padding:2px 12px 2px 0">${k}</td><td style="text-align:right;font-weight:600">${v}</td></tr>` : "";
  return `<table style="width:100%;font-size:13px;border-collapse:collapse">
    ${row("Account name", b.account_name)}${row("Bank", b.bank)}${row("Account no.", b.account_number)}
    ${row("Branch code", b.branch)}${row("SWIFT", b.swift)}${row("IBAN", b.iban)}
    <tr><td style="color:#57534e;padding:2px 12px 2px 0">Reference</td><td style="text-align:right;font-weight:600">${b.reference}</td></tr>
  </table>`;
}

async function sendResend(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || !to) return;
  try {
    await fetch(RESEND_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Venuely <hello@venuely.co.za>", to, subject, html }),
    });
  } catch { /* non-fatal */ }
}

// Approve a couple's submission: compute + persist the invoice (and the platform
// fee at venue.platform_fee_rate), email the couple their EFT invoice (paid to
// the VENUE), and email the venue their commission invoice (paid to VENUELY).
export async function approveSubmission(submissionId: string, weddingId: string, slug: string) {
  const supabase = await createClient();

  // RLS read confirms the venue admin owns this wedding + gives us the venue bank.
  const { data: wed } = await supabase
    .from("weddings")
    .select("id, slug, venue_id, couple_names, wedding_date, couple_email, venue:venues(name, contact_email, bank_name, bank_account_name, bank_account_number, bank_branch_code, bank_swift, bank_iban, invoice_template, invoice_theme, branding_logo_url, platform_fee_rate)")
    .eq("id", weddingId)
    .single();
  if (!wed) throw new Error("Wedding not found");
  const venue = (wed as unknown as { venue: VenueBank | null }).venue;

  // Compute + persist invoice_total + platform_fee_owed (venue.platform_fee_rate;
  // 0 when the venue's platform_fee_active is off — see markInvoiced).
  await markInvoiced(weddingId, slug);
  const { data: fresh } = await supabase.from("weddings").select("invoice_total, platform_fee_owed").eq("id", weddingId).single();
  const grandTotal = Number(fresh?.invoice_total ?? 0);
  const commission = Number(fresh?.platform_fee_owed ?? 0);

  // Service-role write is tenant-scoped to the ownership-verified wedding above:
  // a forged submissionId belonging to another venue's wedding will match 0 rows.
  const admin = adminClient();
  await admin
    .from("submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("wedding_id", weddingId);

  const origin = await publicOrigin();
  const accent = resolveInvoiceTheme(venue?.invoice_theme).accent;
  const couple = (wed as { couple_names: string }).couple_names;
  const weddingDate = (wed as { wedding_date: string | null }).wedding_date;
  const ref = `INV-${String(weddingId).slice(0, 8).toUpperCase()}`;

  // 1) Couple invoice — paid to the venue by EFT, rendered with the venue's
  // chosen invoice template + theme (the design previewed on the billing page).
  const coupleEmail = (wed as { couple_email: string | null }).couple_email;
  if (coupleEmail) {
    // Rebuild the live charge lines (same builder markInvoiced just used for the
    // totals) so the invoice shows what the total is made of. Falls back to a
    // totals-only invoice if the rebuild fails.
    let items: InvoiceLineItem[] = [];
    let subtotal: number | null = null;
    let deposit: InvoiceScheduleRow | null = null;
    let balance: InvoiceScheduleRow | null = null;
    let paidToDate: number | null = null;
    try {
      const { totals } = await buildWeddingCharges(supabase, (wed as { venue_id: string }).venue_id, weddingId);
      items = totals.charges.map((c) => ({ description: c.label, qty: c.qty > 1 ? c.qty : null, amount: c.amount }));
      subtotal = totals.subtotal;
      const balanceDue = weddingDate
        ? new Date(new Date(weddingDate).getTime() - totals.rules.balance_days_before * 86400000)
        : null;
      const balanceLabel = balanceDue ? `Due by ${formatDateZA(balanceDue)}` : null;
      if (totals.payments_in > 0) {
        paidToDate = totals.payments_in;
        if (totals.balance_due > 0) balance = { amount: totals.balance_due, dueLabel: balanceLabel };
      } else if (totals.deposit_amount > 0 && totals.deposit_amount < grandTotal) {
        const pct = Math.round(totals.rules.deposit_pct * 100);
        deposit = { label: `Deposit (${pct}%)`, amount: totals.deposit_amount, dueLabel: "Due on confirmation" };
        balance = { amount: Math.max(0, grandTotal - totals.deposit_amount), dueLabel: balanceLabel };
      }
    } catch { /* totals-only invoice */ }

    const html = renderInvoiceEmailHtml({
      templateId: venue?.invoice_template,
      theme: venue?.invoice_theme,
      logoFallbackUrl: venue?.branding_logo_url,
      venueName: venue?.name ?? "Your venue",
      coupleNames: couple,
      weddingDateLabel: weddingDate ? formatDateZA(weddingDate) : null,
      invoiceRef: ref,
      issueDateLabel: formatDateZA(new Date()),
      items, subtotal, total: grandTotal, paidToDate, deposit, balance,
      bank: {
        accountName: venue?.bank_account_name, bankName: venue?.bank_name,
        accountNumber: venue?.bank_account_number, branchCode: venue?.bank_branch_code,
        swift: venue?.bank_swift, iban: venue?.bank_iban,
      },
      portalUrl: `${origin}/${slug}`,
    });
    await sendResend(coupleEmail, `Your invoice from ${venue?.name ?? "your venue"}`, html);
  }

  // 2) Commission invoice — venue pays Venuely its platform_fee_rate by EFT.
  const venueEmail = venue?.contact_email;
  const feePct = +((Number(venue?.platform_fee_rate ?? 0.005)) * 100).toFixed(2);
  if (venueEmail && commission > 0) {
    const { data: ps } = await admin.from("platform_settings").select("*").eq("id", 1).single();
    const p = (ps ?? {}) as Record<string, string | null>;
    const cref = `VY-${String(weddingId).slice(0, 8).toUpperCase()}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
        <div style="background:#1c1917;color:#fff;padding:20px 24px"><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.8">${p.invoice_from || "Venuely"}</div><div style="font-size:24px;font-weight:700">Commission invoice</div></div>
        <div style="height:3px;background:${accent};font-size:0;line-height:3px">&nbsp;</div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;color:#57534e">Commission on the confirmed booking for <strong>${couple}</strong> (invoiced ${rZA(grandTotal)}). This is deducted as your Venuely platform fee.</p>
          <div style="display:flex;justify-content:space-between;background:#FFF6F0;border-radius:8px;padding:14px 16px;margin-bottom:16px">
            <span style="font-weight:600">Commission due (${feePct}%)</span><span style="font-weight:700">${rZA(commission)}</span>
          </div>
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#FA523C;font-weight:700;margin-bottom:6px">Pay Venuely by EFT</div>
          ${bankRows({ account_name: p.account_name, bank: p.bank_name, account_number: p.account_number, branch: p.branch_code, swift: p.swift, iban: p.iban, reference: cref })}
        </div>
      </div>`;
    await sendResend(venueEmail, `Venuely commission — ${couple}`, html);
  }

  revalidatePath(`/venue/weddings/${slug}`);
}

// Authoritative current total for a wedding's saved selections — same calc the
// venue proforma uses. Admin client so the (anonymous) couple portal can read it,
// but ONLY after the caller passes the same gate the Paystack checkout route uses:
//   (a) the vy_portal_<weddingId> cookie matches this wedding's password hash, OR
//   (b) a signed-in Supabase user who is a venue member, wedding member, or owner.
// Unauthorized callers get null — this is an exported "use server" action, so it
// is directly invokable and must never leak totals for arbitrary wedding ids.
export async function getWeddingTotals(weddingId: string): Promise<{ grandTotal: number } | null> {
  const sb = adminClient();
  const { data: wed } = await sb
    .from("weddings")
    .select("id, venue_id, portal_password_hash")
    .eq("id", weddingId)
    .single();
  if (!wed?.venue_id) return null;

  let authorised = false;
  if (wed.portal_password_hash) {
    const cookieValue = (await cookies()).get(`vy_portal_${wed.id}`)?.value;
    if (cookieValue === wed.portal_password_hash) authorised = true;
  }
  if (!authorised) {
    // RLS-scoped client only to read the caller's own auth identity + memberships.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const [{ data: vm }, { data: wm }, { data: profile }] = await Promise.all([
      supabase.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", wed.venue_id).maybeSingle(),
      supabase.from("wedding_members").select("wedding_id").eq("user_id", user.id).eq("wedding_id", wed.id).maybeSingle(),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (!(vm || wm || profile?.role === "owner")) return null;
  }

  try {
    const { grandTotal } = await buildWeddingCharges(sb, wed.venue_id as string, weddingId);
    return { grandTotal };
  } catch {
    return null;
  }
}
