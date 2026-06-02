"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  resolveAccount as paystackResolveAccount,
  createSubaccount,
  isPaystackConfigured,
} from "@/lib/billing/paystack";

export type ResolveResult =
  | { ok: true; accountName: string }
  | { ok: false; error: string }
  | { configured: false };

// Live "is this the right person?" lookup — called as the operator types the
// account number (debounced on the client). Pure read, no DB write.
export async function resolveAccountName(accountNumber: string, bankCode: string): Promise<ResolveResult> {
  await requireRole(["venue_admin", "owner"]);
  if (!isPaystackConfigured()) return { configured: false };

  const an = (accountNumber ?? "").replace(/\s+/g, "");
  if (an.length < 6 || !bankCode) return { ok: false, error: "Enter a valid account number and bank." };

  const res = await paystackResolveAccount(an, bankCode);
  if (!("ok" in res)) return { configured: false };
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, accountName: res.data.account_name };
}

// Save the venue's EFT banking details (these print on the invoice couples
// receive, so the venue is paid directly). `verified` is set true when the
// details came from an AI-read bank statement the venue confirmed.
export async function saveVenueBanking(
  venueId: string,
  fields: {
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    bank_branch_code: string;
    bank_swift: string;
    bank_iban: string;
  },
  verified: boolean,
): Promise<{ ok: true }> {
  await requireRole(["venue_admin", "owner"]);
  const supabase = await createClient();
  const clean = (s: string) => (s ?? "").trim() || null;
  const { error } = await supabase
    .from("venues")
    .update({
      bank_name: clean(fields.bank_name),
      bank_account_name: clean(fields.bank_account_name),
      bank_account_number: clean(fields.bank_account_number),
      bank_branch_code: clean(fields.bank_branch_code),
      bank_swift: clean(fields.bank_swift),
      bank_iban: clean(fields.bank_iban),
      bank_verified_at: verified ? new Date().toISOString() : null,
    })
    .eq("id", venueId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/billing");
  return { ok: true };
}

// Create the venue's Paystack subaccount (percentage_charge = the venue's
// platform_fee_rate, expressed as a percent) and store the payout fields.
export async function connectPayouts(formData: FormData) {
  await requireRole(["venue_admin", "owner"]);
  const supabase = await createClient();

  const venueId = (formData.get("venue_id") as string)?.trim();
  const bankCode = (formData.get("bank_code") as string)?.trim();
  const accountNumber = ((formData.get("account_number") as string) ?? "").replace(/\s+/g, "");
  const confirmedName = ((formData.get("account_name") as string) ?? "").trim();

  if (!venueId) throw new Error("Missing venue id.");
  if (!isPaystackConfigured()) {
    redirect("/venue/billing?err=not_configured");
  }
  if (!bankCode || accountNumber.length < 6) {
    redirect("/venue/billing?err=invalid_account");
  }

  // Load the venue (RLS-scoped) to read its name + platform_fee_rate.
  const { data: venue, error: venueErr } = await supabase
    .from("venues")
    .select("id, name, platform_fee_rate")
    .eq("id", venueId)
    .single();
  if (venueErr || !venue) throw new Error("Could not load your venue.");

  // Re-resolve server-side before committing — never trust the posted name alone.
  const resolved = await paystackResolveAccount(accountNumber, bankCode);
  if (!("ok" in resolved)) redirect("/venue/billing?err=not_configured");
  if (!resolved.ok) redirect("/venue/billing?err=resolve_failed");

  // platform_fee_rate is a fraction (0.0100). Paystack wants a percent (1.0).
  const percentageCharge = Math.round(Number(venue.platform_fee_rate ?? 0.01) * 100 * 100) / 100;

  const created = await createSubaccount({
    businessName: venue.name,
    bankCode,
    accountNumber,
    percentageCharge,
  });
  if (!("ok" in created)) redirect("/venue/billing?err=not_configured");
  if (!created.ok) redirect(`/venue/billing?err=create_failed&detail=${encodeURIComponent(created.error)}`);

  const { error: saveErr } = await supabase
    .from("venues")
    .update({
      paystack_subaccount_code: created.data.subaccount_code,
      payout_bank_code: bankCode,
      payout_account_last4: accountNumber.slice(-4),
      payouts_verified_at: new Date().toISOString(),
    })
    .eq("id", venueId);
  if (saveErr) throw new Error(`Could not save payout details: ${saveErr.message}`);

  revalidatePath("/venue/billing");
  redirect("/venue/billing?ok=1");
}
