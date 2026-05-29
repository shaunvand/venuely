"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BulkUploader, type BulkUploaderHandle } from "@/components/BulkUploader";
import { LogoMark } from "@/components/Logo";

export function WelcomeImportModal({ venueId, venueName }: { venueId: string; venueName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [neverShow, setNeverShow] = useState(false);
  const uploaderRef = useRef<BulkUploaderHandle>(null);
  const [uploaderState, setUploaderState] = useState({ includedCount: 0, isImporting: false, imported: false, hasItems: false });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(`vy_welcome_never_${venueId}`) === "1") return;
    // Real "has the owner ever imported" signal — once they've imported (here or via the
    // dashboard BulkUploader), don't nag with the welcome import modal again.
    if (window.localStorage.getItem(`vy_imported_${venueId}`) === "1") return;
    const key = `vy_welcome_dismissed_at_${venueId}`;
    const last = Number(window.localStorage.getItem(key) || 0);
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (!last || Date.now() - last > TWENTY_FOUR_HOURS) {
      setOpen(true);
    }
  }, [venueId]);

  // Persist the "has imported" flag the moment an import succeeds, so the modal won't
  // re-open on the next dashboard visit right after a successful import.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (uploaderState.imported) {
      window.localStorage.setItem(`vy_imported_${venueId}`, "1");
    }
  }, [uploaderState.imported, venueId]);

  function dismiss(goToChecklist: boolean) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`vy_welcome_dismissed_at_${venueId}`, String(Date.now()));
      if (neverShow) window.localStorage.setItem(`vy_welcome_never_${venueId}`, "1");
    }
    setOpen(false);
    if (goToChecklist) router.push("/venue/setup");
  }

  function runImport() {
    uploaderRef.current?.commit();
  }

  if (!open) return null;

  const { includedCount, isImporting, imported, hasItems } = uploaderState;
  const canImport = hasItems && includedCount > 0 && !isImporting && !imported;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: "rgba(28,25,23,0.55)" }}
    >
      <div
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl my-auto"
        style={{ border: "1px solid var(--line)" }}
      >
        <button
          type="button"
          onClick={() => dismiss(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100"
          aria-label="Close"
        >
          ✕
        </button>
        <header className="px-8 pt-8 pb-5 border-b" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-3 mb-3">
            <LogoMark size={44} />
            <span className="font-serif text-2xl" style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}>
              Venuely.
            </span>
          </div>
          <h2 className="font-serif text-3xl">Get {venueName} set up in minutes</h2>
          <p className="mt-2 text-sm text-stone-600 max-w-2xl">
            Drop in the files you already send couples — quote PDFs, stock lists, brochures, rooming
            spreadsheets, supplier directories. Smart Import reads them and pre-fills your catalogue,
            rentals, accommodation and partner vendors. You review before anything saves.
          </p>
        </header>

        <div className="p-6">
          <BulkUploader
            ref={uploaderRef}
            venueId={venueId}
            embedded
            onStateChange={setUploaderState}
          />
        </div>

        <div className="px-8 py-4 border-t text-sm flex items-start gap-3" style={{ borderColor: "var(--line)", background: "var(--cream)", color: "var(--ink-2)" }}>
          <span className="text-base leading-none mt-0.5">👆</span>
          <span>
            <strong style={{ color: "var(--ink)" }}>Three quick steps:</strong> Upload your files · Read &amp; detect · Import. The big poppy button below stays disabled until your files are ready — you&apos;ll see a green confirmation banner when the import lands.
          </span>
        </div>

        <footer className="px-8 py-5 border-t flex flex-wrap items-center justify-between gap-4" style={{ borderColor: "var(--line)" }}>
          <span className="text-xs text-stone-500">
            We&apos;ll only nudge you about this once every 24 hours.
          </span>
          <div className="flex items-center gap-4 ml-auto">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "var(--ink-2)" }}>
              <input
                type="checkbox"
                checked={neverShow}
                onChange={(e) => setNeverShow(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: "var(--poppy)" }}
              />
              Don&apos;t show this again
            </label>
            <button type="button" onClick={() => dismiss(false)} className="vy-btn vy-btn-ghost">
              Remind me tomorrow
            </button>
            <button type="button" onClick={() => dismiss(imported)} className="vy-btn vy-btn-secondary">
              {imported ? "Continue to setup checklist →" : "Skip — go to checklist →"}
            </button>
          </div>
        </footer>

        {/* Prominent bottom CTA — the import action lives here, below Skip/Continue */}
        <div
          className="px-8 py-6 rounded-b-2xl"
          style={{ borderTop: "1px solid var(--line)", background: "var(--cream)" }}
        >
          {imported ? (
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="w-full py-4 rounded-xl text-white font-semibold text-base transition hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
              style={{ background: "var(--poppy)" }}
            >
              ✓ Import complete — open your setup checklist →
            </button>
          ) : (
            <button
              type="button"
              onClick={runImport}
              disabled={!canImport}
              className="w-full py-4 rounded-xl text-white font-semibold text-base transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "var(--poppy)" }}
            >
              {isImporting ? (
                <>
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Importing — don&apos;t close this window…
                </>
              ) : hasItems && includedCount > 0 ? (
                <>👉 Click to Import {includedCount} item{includedCount === 1 ? "" : "s"} →</>
              ) : (
                <>Click to Import (upload &amp; read your files first)</>
              )}
            </button>
          )}
          {!imported && (
            <p className="text-center text-[11px] mt-2" style={{ color: "var(--ink-2)" }}>
              The button activates once Smart Import has read your files. Review the cards above, then click to save them into your dashboard.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
