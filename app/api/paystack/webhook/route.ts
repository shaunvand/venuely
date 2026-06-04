import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, isPaystackConfigured } from "@/lib/billing/paystack";

export const runtime = "nodejs";

// Service-role client (bypasses RLS for backend writes), mirrors the Yoco webhook.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Map a Paystack event name to our platform_payments.event_type.
function mapEventType(event: string): "charge_succeeded" | "refund" | "chargeback" | null {
  if (event === "charge.success") return "charge_succeeded";
  if (event === "refund.processed" || event === "refund.failed" || event === "refund.pending") return "refund";
  if (event === "charge.dispute.create" || event === "charge.dispute.remind") return "chargeback";
  return null;
}

export async function POST(request: NextRequest) {
  // Read the RAW body first — the signature is an HMAC of these exact bytes.
  const raw = await request.text();

  // Env gate: if Paystack isn't configured, acknowledge and no-op so retries stop
  // and nothing throws at runtime. We never write without a verified signature.
  if (!isPaystackConfigured()) {
    return NextResponse.json({ received: true, configured: false });
  }

  const signature = request.headers.get("x-paystack-signature");
  const ok = await verifyWebhook(raw, signature);
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let event: {
    event?: string;
    data?: {
      id?: number | string;
      reference?: string;
      amount?: number; // minor units (ZAR cents)
      currency?: string;
      fees?: number;
      metadata?: Record<string, unknown> | null;
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const eventType = mapEventType(event.event ?? "");
  if (!eventType) {
    // Unhandled event kind — acknowledge so Paystack doesn't retry.
    return NextResponse.json({ received: true, ignored: event.event ?? null });
  }

  const data = event.data ?? {};
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const venueId = (metadata.venue_id as string) || null;
  const weddingId = (metadata.wedding_id as string) || null;
  const platformFeeRate = Number(metadata.platform_fee_rate ?? 0); // fraction, e.g. 0.01

  // provider_ref: prefer the transaction reference, fall back to the event id.
  const providerRef = String(data.reference ?? data.id ?? "");
  if (!providerRef) {
    return NextResponse.json({ error: "missing reference" }, { status: 400 });
  }

  // Amounts: Paystack sends minor units (ZAR cents). Store major units to match
  // payment_ledger / compute.ts which work in Rands.
  const grossMajor = Number.isFinite(data.amount) ? Number(data.amount) / 100 : null;
  // Venuely fee = 0.5% of the couple's BASE payment (excludes the venue's commission).
  // The checkout route computes this and passes it in metadata.platform_fee_amount
  // (major units). Prefer that; only fall back to rate×gross if the metadata is
  // absent (older links) — never silently tax the commission.
  const feeFromMeta = Number(metadata.platform_fee_amount);
  const platformFee =
    Number.isFinite(feeFromMeta)
      ? Math.round(feeFromMeta * 100) / 100
      : grossMajor !== null && platformFeeRate > 0
        ? Math.round(grossMajor * platformFeeRate * 100) / 100
        : null;
  const venueNet = grossMajor !== null && platformFee !== null ? Math.round((grossMajor - platformFee) * 100) / 100 : null;

  const supabase = adminClient();

  // Verify-before-write + idempotency: the UNIQUE(provider, provider_ref)
  // constraint makes a replayed delivery a no-op. We use a per-event-type ref so
  // a refund/chargeback referencing the same charge still inserts its own row.
  const scopedRef = eventType === "charge_succeeded" ? providerRef : `${eventType}:${providerRef}`;

  const { error: insertErr } = await supabase
    .from("platform_payments")
    .insert({
      venue_id: venueId,
      wedding_id: weddingId,
      provider: "paystack",
      provider_ref: scopedRef,
      event_type: eventType,
      gross_amount: grossMajor,
      platform_fee: platformFee,
      venue_net: venueNet,
      currency: data.currency ?? "ZAR",
      raw_payload: event,
    });

  // 23505 = unique_violation → already processed; treat as success (idempotent).
  if (insertErr && insertErr.code !== "23505") {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  const duplicate = insertErr?.code === "23505";

  // Mirror the couple payment into the wedding's payment_ledger (same insert shape
  // as ledger-actions.ts::addPayment). Only on a fresh successful charge with a
  // wedding to attribute it to — refunds/chargebacks are recorded in
  // platform_payments only (the venue reconciles those manually).
  if (!duplicate && eventType === "charge_succeeded" && weddingId && grossMajor !== null) {
    await supabase.from("payment_ledger").insert({
      wedding_id: weddingId,
      amount: grossMajor,
      direction: "in",
      kind: (metadata.payment_kind as string) || "payment",
      method: "paystack",
      reference: providerRef,
      paid_at: new Date().toISOString(),
      notes: "Online payment via Paystack",
    });
  }

  return NextResponse.json({ received: true, duplicate });
}
