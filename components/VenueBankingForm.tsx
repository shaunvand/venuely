"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVenueBanking } from "@/app/venue/billing/actions";

type Fields = {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_swift: string;
  bank_iban: string;
};

const FIELD_DEFS: { key: keyof Fields; label: string; placeholder?: string }[] = [
  { key: "bank_account_name", label: "Account holder name" },
  { key: "bank_name", label: "Bank" },
  { key: "bank_account_number", label: "Account number" },
  { key: "bank_branch_code", label: "Branch / universal code" },
  { key: "bank_swift", label: "SWIFT / BIC", placeholder: "e.g. SBZAZAJJ" },
  { key: "bank_iban", label: "IBAN (if applicable)" },
];

export function VenueBankingForm({
  venueId,
  initial,
  verifiedAt,
}: {
  venueId: string;
  initial: Fields;
  verifiedAt: string | null;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(initial);
  const [verified, setVerified] = useState(!!verifiedAt);
  const [reading, setReading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof Fields>(k: K, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  async function readStatement(file: File) {
    setMsg(null);
    setReading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/bank-extract", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error || "Couldn't read the statement."); return; }
      const f = (j.fields ?? {}) as { bank_name?: string; account_name?: string; account_number?: string; branch_code?: string; swift?: string; iban?: string };
      setFields((prev) => ({
        bank_account_name: f.account_name?.trim() || prev.bank_account_name,
        bank_name: f.bank_name?.trim() || prev.bank_name,
        bank_account_number: f.account_number?.trim() || prev.bank_account_number,
        bank_branch_code: f.branch_code?.trim() || prev.bank_branch_code,
        bank_swift: f.swift?.trim() || prev.bank_swift,
        bank_iban: f.iban?.trim() || prev.bank_iban,
      }));
      setVerified(true);
      setMsg("Details read from your statement — please check them, then save.");
    } catch {
      setMsg("Couldn't read the statement.");
    } finally {
      setReading(false);
    }
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await saveVenueBanking(venueId, fields, verified);
        setMsg("Banking details saved ✓");
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <section className="rounded-lg border border-[color:var(--line)] bg-white p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
            Banking details (EFT)
            {verifiedAt && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--leaf)", color: "#1f5d3e" }}>Verified ✓</span>}
          </h2>
          <p className="text-sm text-[color:var(--ink-2)] mt-1">
            These appear on the invoice couples receive, so they pay you directly by EFT. Upload a recent bank statement and we&apos;ll read the details for you to confirm.
          </p>
        </div>
        <label className="vy-btn vy-btn-secondary cursor-pointer whitespace-nowrap">
          {reading ? "Reading…" : "📄 Upload statement"}
          <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readStatement(f); e.target.value = ""; }} />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {FIELD_DEFS.map((d) => (
          <div key={d.key} className="space-y-1">
            <label className="vy-label">{d.label}</label>
            <input
              className="vy-input"
              value={fields[d.key]}
              placeholder={d.placeholder}
              onChange={(e) => { set(d.key, e.target.value); }}
            />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[color:var(--ink-2)]">
        🔒 Your statement is read once to fill these fields and is not stored. Only the details above are saved.
      </p>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={isPending} className="vy-btn vy-btn-primary">
          {isPending ? "Saving…" : "Save banking details"}
        </button>
        {msg && <span className="text-sm" style={{ color: msg.includes("✓") ? "#1f5d3e" : "var(--poppy)" }}>{msg}</span>}
      </div>
    </section>
  );
}
