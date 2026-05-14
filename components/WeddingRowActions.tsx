"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

export function WeddingRowActions({
  portalUrl,
  slug,
  passwordSet,
  invoicedAt,
  couplePaidAt,
  setPasswordAction,
  markCouplePaidAction,
}: {
  portalUrl: string;
  slug: string;
  passwordSet: boolean;
  invoicedAt: string | null;
  couplePaidAt: string | null;
  setPasswordAction: (formData: FormData) => void;
  markCouplePaidAction: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [isPending, startTransition] = useTransition();

  function copy() {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  }
  function savePw() {
    const fd = new FormData();
    fd.set("password", pw);
    startTransition(async () => { await setPasswordAction(fd); setPwOpen(false); setPw(""); });
  }
  function clearPw() {
    const fd = new FormData();
    fd.set("password", "");
    startTransition(async () => { await setPasswordAction(fd); });
  }
  function markPaid() {
    if (!confirm("Mark this couple as paid?")) return;
    startTransition(async () => { await markCouplePaidAction(); });
  }

  return (
    <div className="flex flex-col gap-1.5 items-end text-xs">
      <div className="flex gap-1 items-center">
        <button onClick={copy} className="px-2 py-1 rounded-full border border-stone-300 bg-white hover:bg-stone-100 font-mono text-[11px]" title={portalUrl}>
          {copied ? "✓ Copied" : "📋 Copy URL"}
        </button>
        <span className={`px-2 py-1 rounded-full text-[10px] ${passwordSet ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-stone-50 text-stone-500 border border-stone-200"}`}>
          {passwordSet ? "🔒 password set" : "🔓 open"}
        </span>
      </div>

      {!pwOpen ? (
        <div className="flex gap-1">
          <button onClick={() => setPwOpen(true)} className="px-2 py-1 rounded-full border border-stone-300 bg-white hover:bg-stone-100">
            {passwordSet ? "Change password" : "Set password"}
          </button>
          {passwordSet && (
            <button onClick={clearPw} disabled={isPending} className="px-2 py-1 rounded-full border border-stone-300 bg-white hover:bg-stone-100">
              Remove
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-1">
          <input autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className="border rounded-full px-2 py-1 text-xs w-32" />
          <button disabled={isPending || !pw.trim()} onClick={savePw} className="px-2 py-1 rounded-full bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-50">Save</button>
          <button onClick={() => { setPwOpen(false); setPw(""); }} className="px-2 py-1 rounded-full border border-stone-300 bg-white">×</button>
        </div>
      )}

      <div className="flex gap-1">
        {invoicedAt && !couplePaidAt && (
          <button onClick={markPaid} disabled={isPending} className="px-2 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            ✓ Mark paid
          </button>
        )}
        {couplePaidAt && (
          <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Paid</span>
        )}
        <Link href={`/venue/weddings/${slug}`} className="px-2 py-1 rounded-full border border-stone-300 bg-white hover:bg-stone-100">Manage</Link>
        <Link href={`/${slug}`} target="_blank" className="px-2 py-1 rounded-full bg-stone-900 text-white hover:bg-stone-700">Open ↗</Link>
      </div>
    </div>
  );
}
