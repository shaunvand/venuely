"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BulkUploader } from "@/components/BulkUploader";
import { LogoMark } from "@/components/Logo";

export function WelcomeImportModal({ venueId, venueName }: { venueId: string; venueName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `vy_welcome_dismissed_at_${venueId}`;
    const last = Number(window.localStorage.getItem(key) || 0);
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (!last || Date.now() - last > TWENTY_FOUR_HOURS) {
      setOpen(true);
    }
  }, [venueId]);

  function dismiss(goToChecklist: boolean) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`vy_welcome_dismissed_at_${venueId}`, String(Date.now()));
    }
    setOpen(false);
    if (goToChecklist) router.push("/venue/setup");
  }

  if (!open) return null;

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
          <BulkUploader venueId={venueId} />
        </div>

        <footer className="px-8 py-5 border-t flex items-center justify-between gap-4" style={{ borderColor: "var(--line)" }}>
          <span className="text-xs text-stone-500">
            We&apos;ll only nudge you about this once every 24 hours.
          </span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => dismiss(false)} className="vy-btn vy-btn-ghost">
              Remind me tomorrow
            </button>
            <button type="button" onClick={() => dismiss(true)} className="vy-btn vy-btn-primary">
              Continue to setup checklist →
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
