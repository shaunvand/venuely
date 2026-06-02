import { requireRole } from "@/lib/auth/require-role";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { VenueBankingForm } from "@/components/VenueBankingForm";
import { InvoiceDesigner } from "@/components/InvoiceDesigner";
import { resolveInvoiceTemplate, resolveInvoiceTheme } from "@/lib/invoice/templates";
import { resolveTheme } from "@/lib/portal/templates";

export const metadata = {
  title: "Payouts & billing — Venuely",
};

export default async function VenueBillingPage() {
  await requireRole(["venue_admin", "owner"]);
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  // platform_fee_rate is a fraction; show it as a percent.
  const feePercent = Math.round(Number(venue.platform_fee_rate ?? 0.01) * 100 * 100) / 100;

  const { data: row } = await supabase
    .from("venues")
    .select("bank_name, bank_account_name, bank_account_number, bank_branch_code, bank_swift, bank_iban, bank_verified_at, invoice_template, invoice_theme, portal_theme")
    .eq("id", venue.id)
    .single();

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

      <InvoiceDesigner
        venueId={venue.id}
        venueName={venue.name}
        bank={bank}
        initialTemplate={initialTemplate}
        initialAccent={initialAccent}
        initialLogo={initialLogo}
      />
    </div>
  );
}
