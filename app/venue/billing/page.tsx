import { requireRole } from "@/lib/auth/require-role";
import { getCurrentVenue, paymentsReady, trialState } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { isPaystackConfigured, listBanks } from "@/lib/billing/paystack";
import { ConnectPayoutsForm } from "./ConnectPayoutsForm";
import { VenueBankingForm } from "@/components/VenueBankingForm";

export const metadata = {
  title: "Payouts & billing — Venuely",
};

const ERR_COPY: Record<string, string> = {
  not_configured: "Payments aren't switched on yet. Ask the Venuely team to enable this.",
  invalid_account: "That account number doesn't look right — please check and try again.",
  resolve_failed: "We couldn't verify that account with your bank. Double-check the number and bank.",
  create_failed: "Something went wrong connecting your payouts. Please try again or contact support.",
};

export default async function VenueBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; detail?: string }>;
}) {
  await requireRole(["venue_admin", "owner"]);
  const venue = await getCurrentVenue();
  const sp = await searchParams;

  const configured = isPaystackConfigured();
  const ready = paymentsReady(venue);
  const trial = trialState(venue);

  // platform_fee_rate is a fraction; show it as a percent.
  const feePercent = Math.round(Number(venue.platform_fee_rate ?? 0.01) * 100 * 100) / 100;

  // EFT banking details (shown on the couple's invoice).
  const supabase = await createClient();
  const { data: bank } = await supabase
    .from("venues")
    .select("bank_name, bank_account_name, bank_account_number, bank_branch_code, bank_swift, bank_iban, bank_verified_at")
    .eq("id", venue.id)
    .single();

  // Only call Paystack when we'll actually render the form.
  let banks: { name: string; code: string }[] = [];
  if (configured && !ready) {
    const res = await listBanks();
    if ("ok" in res && res.ok) {
      banks = res.data.map((b) => ({ name: b.name, code: b.code }));
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="vy-h1">Payouts &amp; billing</h1>
        <p className="text-sm text-[color:var(--ink-2)] mt-1">
          Couples pay you directly by EFT using the banking details below. Venuely takes {feePercent}% commission, invoiced to you separately.
        </p>
      </header>

      <VenueBankingForm
        venueId={venue.id}
        verifiedAt={bank?.bank_verified_at ?? null}
        initial={{
          bank_name: bank?.bank_name ?? "",
          bank_account_name: bank?.bank_account_name ?? "",
          bank_account_number: bank?.bank_account_number ?? "",
          bank_branch_code: bank?.bank_branch_code ?? "",
          bank_swift: bank?.bank_swift ?? "",
          bank_iban: bank?.bank_iban ?? "",
        }}
      />

      {/* Trial / status banner — informational only, never blocks data entry. */}
      {trial.phase === "trialing" && (
        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-sm text-stone-700">
          {trial.daysLeft !== null && trial.daysLeft > 0
            ? `You're on the free trial — ${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"} left. `
            : "You're on the free trial. "}
          Connect your bank below to start taking payments.
        </div>
      )}
      {trial.phase === "expired" && (
        <div className="rounded-md border border-[color:var(--peach)] bg-[color:var(--peach)]/30 px-4 py-3 text-sm text-stone-800">
          Your trial has ended. Connect your bank to start taking payments and keep things running.
        </div>
      )}
      {trial.phase === "past_due" && (
        <div className="rounded-md border border-[color:var(--peach)] bg-[color:var(--peach)]/30 px-4 py-3 text-sm text-stone-800">
          A recent payment didn&apos;t go through. Please reconnect your payout account below.
        </div>
      )}

      {sp.ok && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 text-sm">
          Payouts connected — you&apos;re ready to take payments.
        </div>
      )}
      {sp.err && (
        <div className="rounded-md bg-[color:var(--cream)] border border-[color:var(--poppy)]/40 text-[color:var(--poppy-deep)] px-4 py-2 text-sm">
          {ERR_COPY[sp.err] ?? "Something went wrong."}
          {sp.err === "create_failed" && sp.detail ? ` (${sp.detail})` : ""}
        </div>
      )}

      {/* State 1: Paystack not configured yet → friendly "coming soon". */}
      {!configured && (
        <section className="rounded-lg border border-[color:var(--line)] bg-white p-6 space-y-2">
          <h2 className="text-lg font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            Payments setup coming soon
          </h2>
          <p className="text-sm text-[color:var(--ink-2)]">
            Taking payments through Venuely isn&apos;t switched on for your account yet. Ask the Venuely team to
            enable this and you&apos;ll be able to connect your bank here in a couple of clicks.
          </p>
          <p className="text-xs text-[color:var(--ink-2)]">
            Venuely takes {feePercent}% of money transacted through the platform — there is no monthly fee.
          </p>
        </section>
      )}

      {/* State 2: configured + already connected → show the connected summary. */}
      {configured && ready && (
        <section className="rounded-lg border border-[color:var(--line)] bg-white p-6 space-y-3">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <span aria-hidden>✓</span> Payouts connected
          </div>
          <dl className="text-sm text-stone-700 space-y-1">
            <div className="flex gap-2">
              <dt className="text-[color:var(--ink-2)] w-40">Settlement account</dt>
              <dd>•••• {venue.payout_account_last4 ?? "----"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-[color:var(--ink-2)] w-40">Platform fee</dt>
              <dd>{feePercent}% off the top, no monthly fee</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-[color:var(--ink-2)] w-40">Connected</dt>
              <dd>
                {venue.payouts_verified_at
                  ? new Date(venue.payouts_verified_at).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-[color:var(--ink-2)]">
            Need to change the account money lands in? Contact the Venuely team.
          </p>
        </section>
      )}

      {/* State 3: configured but not yet connected → the connect flow. */}
      {configured && !ready && (
        <section className="rounded-lg border border-[color:var(--line)] bg-white p-6">
          <ConnectPayoutsForm venueId={venue.id} banks={banks} feePercent={feePercent} />
        </section>
      )}
    </div>
  );
}
