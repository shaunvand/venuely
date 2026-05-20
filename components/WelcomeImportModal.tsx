"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BulkUploader } from "@/components/BulkUploader";
import { LogoMark } from "@/components/Logo";

export function WelcomeImportModal({ venueId, venueName }: { venueId: string; venueName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `vy_welcome_dismissed_${venueId}`;
    if (typeof window !== "undefined" && !window.localStorage.getItem(key)) {
      setOpen(true);
    }
  }, [venueId]);

  function dismiss(goToChecklist: boolean) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`vy_welcome_dismissed_${venueId}`, "1");
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
          <h2 className="font-serif text-3xl">Welcome to {venueName}</h2>
          <p className="mt-2 text-sm text-stone-600 max-w-2xl">
            Drop your existing catalogue, rentals, accommodation and supplier lists in any format — PDF, Excel, brochure, you name it.
            Smart Import will read them and pre-fill your venue in seconds. You can review before anything saves.
          </p>
        </header>

        <div className="p-6">
          <BulkUploader venueId={venueId} />
        </div>

        <footer className="px-8 py-5 border-t flex items-center justify-between gap-4" style={{ borderColor: "var(--line)" }}>
          <span className="text-xs text-stone-500">
            You can run Smart Import again anytime from the sidebar.
          </span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => dismiss(false)} className="vy-btn vy-btn-ghost">
              Skip for now
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
