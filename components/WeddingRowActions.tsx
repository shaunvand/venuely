"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useLoading } from "@/components/LoadingProvider";

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
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const loading = useLoading();

  useEffect(() => {
    if (!open) return;
    // Don't close when clicking inside the (portalled) menu.
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false); setPwOpen(false);
    };
    const reposition = () => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
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
    loading.show("Setting portal password…");
    startTransition(async () => {
      try { await setPasswordAction(fd); setPwOpen(false); setPw(""); setOpen(false); loading.complete("Saved ✓"); }
      catch (e) { loading.hide(); throw e; }
    });
  }
  function clearPw() {
    const fd = new FormData();
    fd.set("password", "");
    loading.show("Removing portal password…");
    startTransition(async () => {
      try { await setPasswordAction(fd); setOpen(false); loading.complete("Removed ✓"); }
      catch (e) { loading.hide(); throw e; }
    });
  }
  function markPaid() {
    if (!confirm("Mark this couple as paid?")) return;
    loading.show("Marking couple paid…");
    startTransition(async () => {
      try { await markCouplePaidAction(); setOpen(false); loading.complete("Done ✓"); }
      catch (e) { loading.hide(); throw e; }
    });
  }
  function remove() {
    if (!deleteAction) return;
    if (!confirm(`Delete ${coupleNames ? `${coupleNames}'s` : "this"} wedding?\n\nThis permanently removes their portal and all planning data. This cannot be undone.`)) return;
    loading.show("Deleting wedding…");
    startTransition(async () => {
      try { await deleteAction(); loading.complete("Deleted ✓"); }
      catch (e) { loading.hide(); throw e; }
    });
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
          ref={btnRef}
          type="button"
          onClick={(e) => { const willOpen = !open; setOpen(willOpen); setPwOpen(false); if (willOpen) setRect(e.currentTarget.getBoundingClientRect()); }}
          aria-label="More actions"
          aria-expanded={open}
          className="inline-flex items-center justify-center w-9 h-8 rounded-lg border border-stone-200 bg-white transition hover:bg-stone-50 font-semibold tracking-widest"
          style={{ color: "var(--ink-2)" }}
        >
          …
        </button>
        {open && rect && typeof document !== "undefined" && createPortal((
          <div ref={dropRef} className="fixed z-[60] w-52 rounded-xl bg-white shadow-lg overflow-hidden" style={{ border: "1px solid var(--line)", top: rect.bottom + 4, left: Math.max(8, rect.right - 208) }}>
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
        ), document.body)}
      </div>
    </div>
  );
}
