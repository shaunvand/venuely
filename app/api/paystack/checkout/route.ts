import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { buildWeddingCharges } from "@/lib/billing/charges";
import { getPaystackConfig, initTransaction, isPaystackConfigured } from "@/lib/billing/paystack";

export const runtime = "nodejs";

// Service-role client. Used for the proforma reads AFTER the access gate passes:
// password-only couples have no Supabase session, so the RLS-scoped client would
// see no wedding/venue/charges/payments rows for them (the wedding/charge/ledger
// RLS policies all key off auth.uid()). This mirrors the wedding/[slug] APIs,
// which gate with portalAccess and then read via the admin client.
function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type Body = {
  wedding_id?: string;
  // Which slice of the proforma to charge.
  amount_type?: "deposit" | "balance" | "custom";
  amount?: number; // major units (ZAR) — only used when amount_type === "custom"
  email?: string;  // couple's email (Paystack requires a customer email)
};

export async function POST(request: NextRequest) {
  // Env gate: no keys → typed "not configured" 200, never a thrown build/runtime error.
  if (!isPaystackConfigured()) {
    return NextResponse.json(
      { configured: false, error: "Payments are not enabled yet. Ask the Venuely team to switch this on." },
      { status: 200 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const weddingId = (body.wedding_id ?? "").trim();
  if (!weddingId) return NextResponse.json({ error: "Missing wedding_id." }, { status: 400 });

  // Resolve the wedding via the admin client so the access check below can run
  // for both signed-in members AND password-only couples (the latter have no
  // Supabase session, so an RLS-scoped lookup would 404 them before we ever get
  // to check their portal cookie). portal_password_hash drives the cookie gate.
  const ad = admin();
  const { data: wedding } = await ad
    .from("weddings")
    .select("id, slug, couple_names, venue_id, portal_password_hash")
    .eq("id", weddingId)
    .single();
  if (!wedding) return NextResponse.json({ error: "Wedding not found." }, { status: 404 });

  // Authorise the caller against THIS specific wedding. Mirrors lib/portal/access
  // (the same gate the /[wedding] route + /api/wedding/[slug]/* use): authorised if
  //   (a) the vy_portal_<weddingId> cookie matches this wedding's password hash, OR
  //   (b) a signed-in Supabase user who is a venue member, wedding member, or owner.
  // The cookie is keyed by the wedding id, so it can only ever grant access to the
  // wedding being paid for — it never authorises payment for a different wedding.
  let authorised = false;

  if (wedding.portal_password_hash) {
    const cookieValue = request.cookies.get(`vy_portal_${wedding.id}`)?.value;
    if (cookieValue === wedding.portal_password_hash) authorised = true;
  }

  if (!authorised) {
    // RLS-scoped client only to read the caller's own auth identity + memberships.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const [{ data: vm }, { data: wm }, { data: profile }] = await Promise.all([
      supabase.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", wedding.venue_id).maybeSingle(),
      supabase.from("wedding_members").select("wedding_id").eq("user_id", user.id).eq("wedding_id", wedding.id).maybeSingle(),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (!(vm || wm || profile?.role === "owner")) {
      return NextResponse.json({ error: "No access to this wedding." }, { status: 403 });
    }
  }

  const { data: venue } = await ad
    .from("venues")
    .select("id, name, slug, platform_fee_rate, paystack_subaccount_code, contact_email")
    .eq("id", wedding.venue_id)
    .single();
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });
  if (!venue.paystack_subaccount_code) {
    return NextResponse.json(
      { configured: false, error: "This venue hasn't connected payouts yet." },
      { status: 200 }
    );
  }

  // Full live proforma — auto-derived couple-selection charges (rentals,
  // catalogue, accommodation, vendors, areas) + manual wedding_charges +
  // breakage + payment_ledger. Shared with markInvoiced/approveSubmission via
  // lib/billing/charges.ts, so the couple is charged off the same totals (and
  // the same commission split) the venue's proforma shows.
  const { feeRate, feeActive, totals } = await buildWeddingCharges(ad, venue.id, wedding.id);

  const amountType = body.amount_type ?? "deposit";
  let amountMajor: number;
  if (amountType === "custom") {
    // Custom amounts are capped at the outstanding balance — a couple can never
    // overpay past what the proforma says is still due.
    amountMajor = Math.min(Number(body.amount), totals.balance_due);
  } else if (amountType === "balance") {
    amountMajor = totals.balance_due;
  } else {
    // Deposit, but never more than what's still outstanding.
    amountMajor = Math.min(totals.deposit_amount, totals.balance_due || totals.deposit_amount);
  }

  if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
    return NextResponse.json({ error: "Nothing to pay right now." }, { status: 400 });
  }

  const email = (body.email ?? "").trim() || (venue as { contact_email?: string }).contact_email || "";
  if (!email) {
    return NextResponse.json({ error: "A customer email is required to take a payment." }, { status: 400 });
  }

  // venue.platform_fee_rate is stored as a fraction (e.g. 0.005 for 0.5%).
  // Venuely's fee = rate × (grand_total − venue commission); the venue keeps 100%
  // of its commission. Paystack's subaccount percentage_charge would tax the
  // GROSS, so instead we pass a per-transaction FIXED `transaction_charge` that
  // overrides it, computed off the commission-excluding base. When the venue's
  // platform_fee_active is false the fee is waived — we still pass an explicit 0
  // so the subaccount's stored percentage_charge can't sneak back in.
  const effectiveFeeRate = feeActive ? feeRate : 0;

  // The couple pays the full amountMajor (gross) via Paystack, but we charge the
  // platform fee only on its commission-excluding share. Scale the proforma's
  // fee-base ratio (platform_fee_base / grand_total) onto whatever slice is being
  // paid now (deposit / balance / custom). Guard the divide for empty proformas.
  const feeBaseRatio = totals.grand_total > 0 ? totals.platform_fee_base / totals.grand_total : 1;
  const feeBaseMajor = amountMajor * feeBaseRatio;
  const feeAmountCents = Math.round(effectiveFeeRate * feeBaseMajor * 100);

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const callbackUrl = `${proto}://${host}/${wedding.slug}`;

  const result = await initTransaction({
    email,
    amountKobo: Math.round(amountMajor * 100),
    subaccountCode: venue.paystack_subaccount_code,
    // Fixed platform fee (in cents) for THIS transaction. bearer="account" => the
    // fee comes off the platform's share; the venue's subaccount receives
    // gross − feeAmount. Overrides the subaccount's stored percentage_charge.
    transactionChargeCents: feeAmountCents,
    bearer: "account",
    callbackUrl,
    metadata: {
      venue_id: venue.id,
      wedding_id: wedding.id,
      payment_kind: amountType === "balance" ? "balance" : amountType === "custom" ? "payment" : "deposit",
      platform_fee_rate: effectiveFeeRate,
      platform_fee_base: Math.round(feeBaseMajor * 100) / 100,
      platform_fee_amount: Math.round(feeAmountCents) / 100,
      couple_names: wedding.couple_names,
    },
  });

  if (!("ok" in result)) {
    return NextResponse.json({ configured: false, error: "Payments are not enabled yet." }, { status: 200 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // getPaystackConfig() also exposes the public key for an optional inline checkout.
  const cfg = getPaystackConfig();
  return NextResponse.json({
    authorization_url: result.data.authorization_url,
    reference: result.data.reference,
    public_key: cfg.configured ? cfg.publicKey : null,
    amount: amountMajor,
  });
}
