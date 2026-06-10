"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

// Row actions matching the dashboard mock: [Open ↗] [⚙ Manage] [⋯ menu] —
// the overflow menu holds copy-URL, portal-password controls, mark-paid and delete.
export function WeddingRowActions({
  portalUrl,
  slug,
  passwordSet,
  invoicedAt,
  couplePaidAt,
  coupleNames,
  setPasswordAction,
  markCouplePaidAction,
  deleteAction,
}: {
  portalUrl: string;
  slug: string;
  passwordSet: boolean;
  invoicedAt: string | null;
  couplePaidAt: string | null;
  coupleNames?: string;
  setPasswordAction: (formData: FormData) => void;
  markCouplePaidAction: () => void;
  deleteAction?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) { setOpen(false); setPwOpen(false); }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function copy() {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  function savePw() {
    const fd = new FormData();
    fd.set("password", pw);
    startTransition(async () => { await setPasswordAction(fd); setPwOpen(false); setPw(""); setOpen(false); });
  }
  function clearPw() {
    const fd = new FormData();
    fd.set("password", "");
    startTransition(async () => { await setPasswordAction(fd); setOpen(false); });
  }
  function markPaid() {
    if (!confirm("Mark this couple as paid?")) return;
    startTransition(async () => { await markCouplePaidAction(); setOpen(false); });
  }
  function remove() {
    if (!deleteAction) return;
    if (!confirm(`Delete ${coupleNames ? `${coupleNames}'s` : "this"} wedding?\n\nThis permanently removes their portal and all planning data. This cannot be undone.`)) return;
    startTransition(async () => { await deleteAction(); });
  }

  const itemCls = "w-full text-left px-3 py-2 text-xs hover:bg-[color:var(--cream)] disabled:opacity-50";

  return (
    <div className="flex items-center justify-end gap-1.5 text-xs">
      <Link
        href={`/${slug}`}
        target="_blank"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium border transition hover:bg-[color:var(--cream)]"
        style={{ borderColor: "var(--poppy)", color: "var(--poppy)" }}
      >
        Open
        <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden><path d="M4 2h6v6M10 2L3 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>
      <Link
        href={`/venue/weddings/${slug}`}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium border border-stone-200 bg-white transition hover:bg-stone-50"
        style={{ color: "var(--ink)" }}
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6L11 5M5 11l-1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        Manage
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setPwOpen(false); }}
          aria-label="More actions"
          className="inline-flex items-center justify-center w-9 h-8 rounded-lg border border-stone-200 bg-white transition hover:bg-stone-50 font-semibold tracking-widest"
          style={{ color: "var(--ink-2)" }}
        >
          …
        </button>
        {open && (
          <div className="absolute right-0 top-9 z-20 w-52 rounded-xl bg-white shadow-lg overflow-hidden anim-fade-in" style={{ border: "1px solid var(--line)" }}>
            <button type="button" onClick={copy} className={itemCls}>{copied ? "✓ Copied" : "📋 Copy portal URL"}</button>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider border-t" style={{ color: "var(--ink-2)", borderColor: "var(--line)" }}>
              Portal access · {passwordSet ? "🔒 password set" : "🔓 open"}
            </div>
            {!pwOpen ? (
              <>
                <button type="button" onClick={() => setPwOpen(true)} className={itemCls}>{passwordSet ? "Change password" : "Set password"}</button>
                {passwordSet && <button type="button" onClick={clearPw} disabled={isPending} className={itemCls}>Remove password</button>}
              </>
            ) : (
              <div className="flex gap-1 px-3 py-2">
                <input autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className="border rounded-lg px-2 py-1 text-xs w-full" style={{ borderColor: "var(--line)" }} />
                <button disabled={isPending || !pw.trim()} onClick={savePw} className="px-2.5 py-1 rounded-lg text-white text-xs disabled:opacity-50" style={{ background: "var(--ink)" }}>Save</button>
              </div>
            )}
            {(invoicedAt && !couplePaidAt) || couplePaidAt || deleteAction ? (
              <div className="border-t" style={{ borderColor: "var(--line)" }}>
                {invoicedAt && !couplePaidAt && (
                  <button type="button" onClick={markPaid} disabled={isPending} className={itemCls} style={{ color: "#1f5d3e" }}>✓ Mark couple paid</button>
                )}
                {couplePaidAt && <div className="px-3 py-2 text-xs" style={{ color: "#1f5d3e" }}>✓ Couple paid</div>}
                {deleteAction && (
                  <button type="button" onClick={remove} disabled={isPending} className={itemCls} style={{ color: "#b03a2e" }}>Delete wedding…</button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
