import { requireRole } from "@/lib/auth/require-role";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { VenueBankingForm } from "@/components/VenueBankingForm";
import { InvoiceDesigner } from "@/components/InvoiceDesigner";
import { ConnectPayoutsForm } from "./ConnectPayoutsForm";
import { isPaystackConfigured, listBanks } from "@/lib/billing/paystack";
import { resolveInvoiceTemplate, resolveInvoiceTheme } from "@/lib/invoice/templates";
import { resolveTheme } from "@/lib/portal/templates";
import { MoneyTabs } from "@/components/MoneyTabs";

export const metadata = {
  title: "Payouts & billing — Venuely",
};

export default async function VenueBillingPage() {
  await requireRole(["venue_admin", "owner"]);
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  // platform_fee_rate is a fraction; show it as a percent.
  const feePercent = Math.round(Number(venue.platform_fee_rate ?? 0.005) * 100 * 100) / 100;

  const { data: row } = await supabase
    .from("venues")
    .select("bank_name, bank_account_name, bank_account_number, bank_branch_code, bank_swift, bank_iban, bank_verified_at, invoice_template, invoice_theme, portal_theme, paystack_subaccount_code")
    .eq("id", venue.id)
    .single();

  // Paystack card-payments connect — only rendered when the platform has keys.
  const paystackOn = isPaystackConfigured();
  let banks: { name: string; code: string }[] = [];
  if (paystackOn) {
    const banksRes = await listBanks();
    if ("ok" in banksRes && banksRes.ok) banks = banksRes.data.map((b) => ({ name: b.name, code: b.code }));
  }
  const payoutsConnected = !!row?.paystack_subaccount_code;

  const bank = {
    bank_name: row?.bank_name ?? "",
    bank_account_name: row?.bank_account_name ?? "",
    bank_account_number: row?.bank_account_number ?? "",
    bank_branch_code: row?.bank_branch_code ?? "",
    bank_swift: row?.bank_swift ?? "",
    bank_iban: row?.bank_iban ?? "",
  };

  const invTheme = resolveInvoiceTheme(row?.invoice_theme);
  const portalTheme = resolveTheme(row?.portal_theme);
  const initialTemplate = resolveInvoiceTemplate(row?.invoice_template).id;
  const initialAccent = (row?.invoice_theme ? invTheme.accent : (venue.branding_primary || invTheme.accent));
  const initialLogo = invTheme.logoUrl ?? portalTheme.logoUrl ?? venue.branding_logo_url ?? null;

  return (
    <div className="space-y-8 max-w-3xl">
      <MoneyTabs active="payouts" />
      <header>
        <h1 className="vy-h1">Payouts &amp; billing</h1>
        <p className="text-sm text-[color:var(--ink-2)] mt-1">
          Couples pay you directly by EFT using the banking details below. Venuely takes {feePercent}% commission, invoiced to you separately — there is no monthly fee.
        </p>
      </header>

      <VenueBankingForm
        venueId={venue.id}
        verifiedAt={row?.bank_verified_at ?? null}
        initial={bank}
      />

      {paystackOn && (
        <section className="vy-card space-y-4">
          <div>
            <div className="vy-eyebrow">Card payments</div>
            <h2 className="vy-h2 mt-1">Connect payouts</h2>
            <p className="text-sm text-[color:var(--ink-2)] mt-1">
              {payoutsConnected
                ? "Payouts are connected — couples can pay by card and the money settles to your account the next day. Re-submit below to change the payout account."
                : "Connect a payout account so couples can pay by card. We verify the account holder with your bank before anything is saved."}
            </p>
          </div>
          <ConnectPayoutsForm venueId={venue.id} banks={banks} feePercent={feePercent} />
        </section>
      )}

      <InvoiceDesigner
        venueId={venue.id}
        venueName={venue.name}
        bank={bank}
        initialTemplate={initialTemplate}
        initialAccent={initialAccent}
        initialLogo={initialLogo}
        initiallySaved={!!row?.invoice_theme}
      />
    </div>
  );
}
