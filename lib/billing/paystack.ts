// Paystack commission rail — scaffold.
// Becomes live when PAYSTACK_SECRET_KEY (+ PAYSTACK_PUBLIC_KEY for the client
// inline checkout, if ever used) are set. Until then EVERY call returns a typed
// "not configured" result instead of throwing, so the build and every page that
// imports this module stay healthy without keys.
//
// Model: 1% of money transacted, no monthly fee. Rail = Paystack Subaccounts —
// the couple pays the full amount, Paystack settles T+1 with the platform fee
// taken off the top (`bearer: "account"` => the fee comes from the platform's
// share, i.e. the subaccount's `percentage_charge` is what the platform keeps).
//
// Docs: https://paystack.com/docs/api/

const PAYSTACK_BASE = "https://api.paystack.co";

// ── Types ────────────────────────────────────────────────────────────────────
export type PaystackConfig =
  | { configured: true; secret: string; publicKey: string | null }
  | { configured: false };

export type NotConfigured = { configured: false };
export type Bank = { name: string; code: string; currency: string };
export type ResolvedAccount = { account_number: string; account_name: string; bank_code: string };
export type Subaccount = { subaccount_code: string; account_number: string; bank: string | number; percentage_charge: number };
export type InitTransaction = { authorization_url: string; access_code: string; reference: string };

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };
export type PaystackResult<T> = Ok<T> | Err | NotConfigured;

// ── Config ───────────────────────────────────────────────────────────────────
export function getPaystackConfig(): PaystackConfig {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY ?? null;
  if (!secret || secret.length < 10) return { configured: false };
  return { configured: true, secret, publicKey };
}

export function isPaystackConfigured(): boolean {
  return getPaystackConfig().configured;
}

// ── Webhook signature (HMAC-SHA512 of the raw body with the SECRET key) ────────
// Header: x-paystack-signature. Paystack signs the *raw* request body (not a
// composite string) with the live/test secret key. Returns false when unconfigured.
export async function verifyWebhook(rawBody: string, signature: string | null): Promise<boolean> {
  const cfg = getPaystackConfig();
  if (!cfg.configured) return false;
  if (!signature) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(cfg.secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time-ish compare (lengths equal → compare every char).
  const provided = signature.trim().toLowerCase();
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ── Internal fetch helper (always guarded) ─────────────────────────────────────
async function call<T>(
  path: string,
  init: RequestInit & { method: "GET" | "POST" }
): Promise<PaystackResult<T>> {
  const cfg = getPaystackConfig();
  if (!cfg.configured) return { configured: false };
  try {
    const res = await fetch(`${PAYSTACK_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.secret}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.status) {
      return { ok: false, error: json?.message ? `Paystack: ${json.message}` : `Paystack ${res.status}` };
    }
    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Banks ──────────────────────────────────────────────────────────────────────
// South African banks for the payout picker. Paystack scopes /bank by country.
export async function listBanks(country = "south africa"): Promise<PaystackResult<Bank[]>> {
  return call<Bank[]>(`/bank?country=${encodeURIComponent(country)}&currency=ZAR`, { method: "GET" });
}

// ── Account resolution (live "is this the right person?" confirm) ──────────────
export async function resolveAccount(
  accountNumber: string,
  bankCode: string
): Promise<PaystackResult<ResolvedAccount>> {
  const an = accountNumber.replace(/\s+/g, "");
  if (!an || !bankCode) return { ok: false, error: "Account number and bank are required." };
  return call<ResolvedAccount>(
    `/bank/resolve?account_number=${encodeURIComponent(an)}&bank_code=${encodeURIComponent(bankCode)}`,
    { method: "GET" }
  );
}

// ── Subaccount (the venue's payout split target) ───────────────────────────────
export async function createSubaccount(input: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  percentageCharge: number; // platform's % kept off the top (e.g. 1 for 1%)
}): Promise<PaystackResult<Subaccount>> {
  return call<Subaccount>(`/subaccount`, {
    method: "POST",
    body: JSON.stringify({
      business_name: input.businessName,
      settlement_bank: input.bankCode,
      account_number: input.accountNumber.replace(/\s+/g, ""),
      percentage_charge: input.percentageCharge,
    }),
  });
}

// ── Initialise a transaction (returns the hosted checkout URL) ─────────────────
// bearer="account" => the platform's subaccount percentage_charge comes off the
// top of this transaction (the platform keeps the fee, venue gets the net).
export async function initTransaction(input: {
  email: string;
  amountKobo: number; // amount in the smallest currency unit (ZAR cents)
  subaccountCode: string;
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackResult<InitTransaction>> {
  if (!input.email) return { ok: false, error: "A customer email is required." };
  if (!Number.isFinite(input.amountKobo) || input.amountKobo <= 0) {
    return { ok: false, error: "A positive amount is required." };
  }
  return call<InitTransaction>(`/transaction/initialize`, {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountKobo),
      currency: "ZAR",
      subaccount: input.subaccountCode,
      bearer: "account",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata ?? {},
    }),
  });
}
