// Yoco subscription billing — scaffold.
// Becomes live when YOCO_SECRET_KEY + YOCO_WEBHOOK_SECRET are set.
// Docs: https://developer.yoco.com/online/api-reference/

const YOCO_BASE = "https://payments.yoco.com/api";

type CheckoutRequest = {
  amount: number;         // ZAR cents
  currency?: "ZAR";
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
};

export type YocoConfigured = { live: true; secret: string } | { live: false };

export function getYocoConfig(): YocoConfigured {
  const secret = process.env.YOCO_SECRET_KEY;
  if (!secret || secret.length < 10) return { live: false };
  return { live: true, secret };
}

export async function createCheckout(req: CheckoutRequest): Promise<{ checkoutUrl: string } | { error: string }> {
  const cfg = getYocoConfig();
  if (!cfg.live) {
    return { error: "Yoco not configured. Set YOCO_SECRET_KEY in env." };
  }
  const res = await fetch(`${YOCO_BASE}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cfg.secret}`,
    },
    body: JSON.stringify({
      amount: req.amount,
      currency: req.currency ?? "ZAR",
      successUrl: req.successUrl,
      cancelUrl: req.cancelUrl,
      metadata: req.metadata,
    }),
  });
  if (!res.ok) {
    return { error: `Yoco ${res.status}: ${await res.text()}` };
  }
  const json = await res.json();
  return { checkoutUrl: json.redirectUrl as string };
}

// Webhook signature verification per Yoco docs (HMAC-SHA256 of `id.timestamp.body` with webhook secret)
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret) return false;
  const webhookId = headers.get("webhook-id");
  const webhookTs = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!webhookId || !webhookTs || !sigHeader) return false;

  const signedContent = `${webhookId}.${webhookTs}.${rawBody}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // Header may contain multiple `v1,signature` pairs space-separated.
  return sigHeader.split(" ").some((p) => p.split(",")[1] === expected);
}
