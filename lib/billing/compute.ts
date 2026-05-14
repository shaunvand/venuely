// Pricing engine — single source of truth for the venue/couple proforma.
// Read by venue dashboard, couple portal, and platform-fee tallies.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentRules = {
  vat_inclusive: boolean;
  vat_rate: number;
  deposit_pct: number;
  balance_days_before: number;
  breakage_deposit: number;
  currency: string;
};

export type Charge = {
  id?: string;
  kind: "venue" | "area" | "catalogue" | "rental" | "accommodation" | "vendor" | "breakage" | "vat" | "discount" | "custom";
  label: string;
  qty: number;
  unit_price: number;
  amount: number;
  is_refundable: boolean;
  day_type?: string | null;
};

export type Payment = { id: string; amount: number; direction: "in" | "out"; kind: string; paid_at: string };

export type Computed = {
  rules: PaymentRules;
  charges: Charge[];
  subtotal: number;
  vat_amount: number;
  breakage: number;
  grand_total: number;
  payments_in: number;
  payments_out: number;
  refundable_held: number;
  balance_due: number;
  deposit_amount: number;
};

export function applyMarkup(price: number, value: number | null | undefined, type: string | null | undefined): number {
  const v = Number(value ?? 0);
  if (!v) return price;
  if (type === "percent") return Math.round((price * (1 + v / 100)) * 100) / 100;
  return Math.round((price + v) * 100) / 100;
}

export async function loadRules(supabase: SupabaseClient, venueId: string): Promise<PaymentRules> {
  const { data } = await supabase
    .from("payment_rules")
    .select("vat_inclusive, vat_rate, deposit_pct, balance_days_before, breakage_deposit, currency")
    .eq("venue_id", venueId)
    .maybeSingle();
  return {
    vat_inclusive: data?.vat_inclusive ?? true,
    vat_rate: Number(data?.vat_rate ?? 0.15),
    deposit_pct: Number(data?.deposit_pct ?? 0.5),
    balance_days_before: Number(data?.balance_days_before ?? 60),
    breakage_deposit: Number(data?.breakage_deposit ?? 0),
    currency: data?.currency ?? "ZAR",
  };
}

export function computeTotals(rules: PaymentRules, charges: Charge[], payments: Payment[]): Computed {
  // VAT model: when vat_inclusive == true, the listed prices already contain VAT.
  // We surface VAT as a memo line (informational), and subtotal == sum of charges minus refundables.
  const refundableCharges = charges.filter((c) => c.is_refundable);
  const nonRefundable = charges.filter((c) => !c.is_refundable);
  const breakage = refundableCharges.reduce((s, c) => s + c.amount, 0);
  const subtotal = nonRefundable.reduce((s, c) => s + c.amount, 0);

  const vat_amount = rules.vat_inclusive
    ? Math.round((subtotal - subtotal / (1 + rules.vat_rate)) * 100) / 100
    : Math.round(subtotal * rules.vat_rate * 100) / 100;

  const grand_total = rules.vat_inclusive ? subtotal + breakage : subtotal + vat_amount + breakage;

  const payments_in = payments.filter((p) => p.direction === "in").reduce((s, p) => s + p.amount, 0);
  const payments_out = payments.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount, 0);
  const balance_due = Math.max(0, grand_total - (payments_in - payments_out));
  const deposit_amount = Math.round(grand_total * rules.deposit_pct * 100) / 100;
  const refundable_held = Math.max(0, breakage - payments_out);

  return {
    rules, charges,
    subtotal, vat_amount, breakage, grand_total,
    payments_in, payments_out, refundable_held, balance_due, deposit_amount,
  };
}
