import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRules, computeTotals, type Charge, type Payment } from "@/lib/billing/compute";
import { getPaystackConfig, initTransaction, isPaystackConfigured } from "@/lib/billing/paystack";

export const runtime = "nodejs";

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

  // Authenticated, RLS-scoped client: the caller can only reach weddings at
  // venues they belong to (or, for a couple, their own wedding — handled by RLS).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, venue_id")
    .eq("id", weddingId)
    .single();
  if (!wedding) return NextResponse.json({ error: "Wedding not found." }, { status: 404 });

  const { data: venue } = await supabase
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

  // Build the proforma from persisted line items + ledger, then computeTotals.
  const [rules, chargesRes, paymentsRes] = await Promise.all([
    loadRules(supabase, venue.id),
    supabase
      .from("wedding_charges")
      .select("id, kind, label, qty, unit_price, amount, is_refundable, day_type")
      .eq("wedding_id", wedding.id),
    supabase
      .from("payment_ledger")
      .select("id, amount, direction, kind, paid_at")
      .eq("wedding_id", wedding.id),
  ]);

  const charges = (chargesRes.data ?? []) as unknown as Charge[];
  const payments = (paymentsRes.data ?? []) as unknown as Payment[];
  const totals = computeTotals(rules, charges, payments);

  const amountType = body.amount_type ?? "deposit";
  let amountMajor: number;
  if (amountType === "custom") {
    amountMajor = Number(body.amount);
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

  // platform_fee_rate is stored as a fraction (e.g. 0.0100 for 1%). Paystack's
  // subaccount percentage_charge was set at connect-time; we pass the fraction
  // through metadata so the webhook can record the fee on the platform_payments row.
  const feeRate = Number(venue.platform_fee_rate ?? 0.01);

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const callbackUrl = `${proto}://${host}/${wedding.slug}`;

  const result = await initTransaction({
    email,
    amountKobo: Math.round(amountMajor * 100),
    subaccountCode: venue.paystack_subaccount_code,
    callbackUrl,
    metadata: {
      venue_id: venue.id,
      wedding_id: wedding.id,
      payment_kind: amountType === "balance" ? "balance" : amountType === "custom" ? "payment" : "deposit",
      platform_fee_rate: feeRate,
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
