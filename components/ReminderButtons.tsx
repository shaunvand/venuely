"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendDepositReminder, sendBalanceReminder, type ReminderResult } from "@/app/venue/weddings/reminder-actions";

// Owner-triggered deposit/balance reminders. Each send emails the couple the
// reminder WITH the proforma invoice + banking details, then surfaces a clear
// result: a "sent ✓" confirmation, or — if the venue's banking isn't set up — a
// prompt to configure invoice & banking details before the invoice can go out.

type Props = {
  weddingId: string;
  slug: string;
  depositAmount: number;
  balanceDue: number;
  coupleEmail: string | null;
  depositWa: string;
  balanceWa: string;
};

type Banner = { tone: "success" | "error" | "info"; node: React.ReactNode } | null;

export function ReminderButtons({ weddingId, slug, depositAmount, balanceDue, coupleEmail, depositWa, balanceWa }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<Banner>(null);
  const [which, setWhich] = useState<"deposit" | "balance" | null>(null);

  function describe(res: ReminderResult, kind: "deposit" | "balance"): Banner {
    const label = kind === "deposit" ? "Deposit" : "Balance";
    if (res.sent) return { tone: "success", node: <>{label} reminder &amp; invoice sent ✓{coupleEmail ? <> to <b>{coupleEmail}</b></> : null}.</> };
    switch (res.reason) {
      case "no_bank_details":
        return {
          tone: "error",
          node: <>Set up your <b>invoice &amp; banking details</b> for this wedding before sending — open this wedding&apos;s management area (Venue → Weddings) and add your banking details so the invoice can be issued. <Link href="/venue/billing" className="underline font-medium">Set up banking →</Link></>,
        };
      case "no_email":
        return { tone: "info", node: <>Add the couple&apos;s email first — send them the portal invite, then resend.</> };
      case "email_not_configured":
        return { tone: "info", node: <>Email isn&apos;t switched on yet. Add a Resend API key to start sending.</> };
      case "nothing_due":
        return { tone: "info", node: <>Nothing is currently due for this wedding.</> };
      case "not_found":
        return { tone: "error", node: <>Couldn&apos;t load this wedding — please refresh.</> };
      default:
        return { tone: "error", node: <>Couldn&apos;t send the {label.toLowerCase()} reminder — please try again.</> };
    }
  }

  function send(kind: "deposit" | "balance") {
    if (pending) return;
    setWhich(kind);
    setBanner(null);
    startTransition(async () => {
      try {
        const res = kind === "deposit"
          ? await sendDepositReminder(weddingId, slug)
          : await sendBalanceReminder(weddingId, slug);
        setBanner(describe(res, kind));
        if (res.sent) router.refresh();
      } catch {
        setBanner({ tone: "error", node: <>Something went wrong — please try again.</> });
      } finally {
        setWhich(null);
      }
    });
  }

  const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
  const bannerStyle: Record<string, React.CSSProperties> = {
    success: { background: "var(--leaf)", color: "#1f5d3e", border: "1px solid #c2dbcf" },
    error: { background: "#fde2dd", color: "#a3210e", border: "1px solid #f3c0b8" },
    info: { background: "var(--peach)", color: "var(--poppy-deep)", border: "1px solid var(--line)" },
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        {depositAmount > 0 && (
          <>
            <button onClick={() => send("deposit")} disabled={pending || !coupleEmail} className="vy-btn vy-btn-secondary text-sm" title={coupleEmail ? "" : "Set the couple's email by sending the portal invite first"}>
              {pending && which === "deposit" ? "Sending…" : `Send deposit reminder · R${depositAmount.toLocaleString()}`}
            </button>
            <a href={waLink(depositWa)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-emerald-700 whitespace-nowrap">↗ Deposit via WhatsApp</a>
          </>
        )}
        {balanceDue > 0 && (
          <>
            <button onClick={() => send("balance")} disabled={pending || !coupleEmail} className="vy-btn vy-btn-secondary text-sm" title={coupleEmail ? "" : "Set the couple's email by sending the portal invite first"}>
              {pending && which === "balance" ? "Sending…" : `Send balance reminder · R${balanceDue.toLocaleString()}`}
            </button>
            <a href={waLink(balanceWa)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-emerald-700 whitespace-nowrap">↗ Balance via WhatsApp</a>
          </>
        )}
        {depositAmount <= 0 && balanceDue <= 0 && (
          <span className="text-xs text-stone-500">Nothing currently due — reminders appear once a deposit or balance is outstanding.</span>
        )}
      </div>
      {banner && (
        <div className="rounded-lg px-3 py-2 text-sm leading-relaxed" style={bannerStyle[banner.tone]}>{banner.node}</div>
      )}
    </div>
  );
}
