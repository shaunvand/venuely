"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { connectPayouts, resolveAccountName, type ResolveResult } from "./actions";

type Bank = { name: string; code: string };

export function ConnectPayoutsForm({
  venueId,
  banks,
  feePercent,
}: {
  venueId: string;
  banks: Bank[];
  feePercent: number;
}) {
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolved, setResolved] = useState<ResolveResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accountName = resolved && "ok" in resolved && resolved.ok ? resolved.accountName : "";
  const canSubmit = Boolean(bankCode && accountNumber.replace(/\s+/g, "").length >= 6 && accountName);

  // Confirm-as-you-type: debounce, then ask Paystack who owns this account.
  useEffect(() => {
    const an = accountNumber.replace(/\s+/g, "");
    setResolved(null);
    if (!bankCode || an.length < 6) return;
    if (debounce.current) clearTimeout(debounce.current);
    setResolving(true);
    debounce.current = setTimeout(() => {
      startTransition(async () => {
        const res = await resolveAccountName(an, bankCode);
        setResolved(res);
        setResolving(false);
      });
    }, 600);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNumber, bankCode]);

  return (
    <form action={connectPayouts} className="space-y-6 max-w-lg">
      <input type="hidden" name="venue_id" value={venueId} />
      <input type="hidden" name="account_name" value={accountName} />

      <div className="space-y-1">
        <label className="vy-label">Your bank</label>
        <select
          name="bank_code"
          required
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          className="vy-input"
        >
          <option value="">Choose your bank…</option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="vy-label">Account number</label>
        <input
          name="account_number"
          required
          inputMode="numeric"
          autoComplete="off"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="The account weddings get paid into"
          className="vy-input"
        />
        <p className="text-xs text-[color:var(--ink-2)]">
          We confirm the account holder name with your bank before saving — no test deposits needed.
        </p>
      </div>

      {/* Live confirmation, mirrors the address picker's confirm UX. */}
      <div aria-live="polite" className="min-h-[1.5rem] text-sm">
        {resolving && <span className="text-[color:var(--ink-2)]">Checking with your bank…</span>}
        {!resolving && resolved && "ok" in resolved && resolved.ok && (
          <span className="inline-flex items-center gap-2 rounded-md bg-[color:var(--sage-2)]/40 px-3 py-1.5 text-stone-800">
            <span aria-hidden>✓</span> Account holder: <b>{resolved.accountName}</b>
          </span>
        )}
        {!resolving && resolved && "ok" in resolved && !resolved.ok && (
          <span className="text-[color:var(--poppy-deep)]">{resolved.error}</span>
        )}
        {!resolving && resolved && "configured" in resolved && (
          <span className="text-[color:var(--ink-2)]">Payments setup is not enabled yet.</span>
        )}
      </div>

      <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-sm text-stone-700">
        Venuely takes <b>{feePercent}%</b> of money paid through the platform — taken automatically off the
        top of each payment. There is no monthly fee. The rest settles to this account the next day.
      </div>

      <button type="submit" disabled={!canSubmit} className="vy-btn vy-btn-primary disabled:opacity-50">
        Connect payouts
      </button>
    </form>
  );
}
