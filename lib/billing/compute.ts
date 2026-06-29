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
  // Pre-markup amount for this line (the supplier/base cost before the venue's
  // commission/markup). Optional: when set, computeTotals uses (amount - base_amount)
  // as this line's commission contribution. When absent, the line is treated as
  // pure pass-through (no venue commission), e.g. area hire, breakage deposit,
  // and manual charges that carry no commission inputs.
  base_amount?: number;
};

export type Payment = { id: string; amount: number; direction: "in" | "out"; kind: string; paid_at: string; method?: string | null; reference?: string | null; notes?: string | null };

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
  // Sum across all charged lines of (marked-up amount − base amount): the venue's
  // own commission/markup. The venue keeps 100% of this — Venuely never taxes it.
  commission_total: number;
  // The slice of grand_total that Venuely's platform fee is charged on:
  // grand_total − commission_total. (The couple's BASE payment to the venue.)
  platform_fee_base: number;
};

export function applyMarkup(price: number, value: number | null | undefined, type: string | null | undefined): number {
  const v = Number(value ?? 0);
  if (!v) return price;
  if (type === "percent") return Math.round((price * (1 + v / 100)) * 100) / 100;
  return Math.round((price + v) * 100) / 100;
}

// Inverse of applyMarkup: given an already-marked-up unit price and the same
// commission inputs, recover the pre-markup base unit price. Used by callers
// that only retained the final (marked-up) unit_price on a Charge but still know
// the commission_value/commission_type, so commission_total can be derived.
export function deriveBase(marked: number, value: number | null | undefined, type: string | null | undefined): number {
  const v = Number(value ?? 0);
  if (!v) return marked;
  if (type === "percent") return Math.round((marked / (1 + v / 100)) * 100) / 100;
  return Math.round((marked - v) * 100) / 100;
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

  // Venue commission/markup: per charged line, (marked-up amount − base_amount).
  // Lines without a base_amount carry no commission (pure pass-through). We only
  // count it on charged amounts (included/zero lines contribute nothing).
  const commission_total = Math.round(
    charges.reduce((s, c) => {
      if (c.amount <= 0 || c.base_amount == null) return s;
      const markup = c.amount - c.base_amount;
      return markup > 0 ? s + markup : s;
    }, 0) * 100
  ) / 100;

  // Venuely fee = rate × (grand_total − venue commission − refundable breakage).
  // The venue keeps 100% of its commission, and the platform fee is charged on
  // revenue only — never on the refundable breakage deposit (which is returned).
  const platform_fee_base = Math.round(Math.max(0, grand_total - commission_total - breakage) * 100) / 100;

  return {
    rules, charges,
    subtotal, vat_amount, breakage, grand_total,
    payments_in, payments_out, refundable_held, balance_due, deposit_amount,
    commission_total, platform_fee_base,
  };
}

// Venuely's platform fee for a computed proforma: rate × platform_fee_base,
// i.e. rate × (grand_total − venue commission). The venue keeps 100% of its
// commission/markup — Venuely NEVER taxes the commission.
export function platformFee(totals: Computed, rate: number): number {
  return Math.round(totals.platform_fee_base * rate * 100) / 100;
}
