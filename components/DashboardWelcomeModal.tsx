"use client";

// First-run welcome popup — ONLY the Claude Design animation (public/welcome-video
// .html), nothing else. Shows once, ~2s after the dashboard settles following the
// wizard hand-off (WelcomeCover sets the flag on the ?welcome=1 arrival), then
// never again. The animation plays once and holds its final frame.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Optional video override; otherwise the self-contained HTML animation is embedded.
const EXPLAINER_VIDEO = process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL || "";

export function DashboardWelcomeModal({ isWelcome = false }: { isWelcome?: boolean }) {
  const [open, setOpen] = useState(false);
  const [fading, setFading] = useState(false);

  // Run once on mount. The reliable trigger is the server-rendered `isWelcome`
  // (the ?welcome=1 arrival) — the legacy sessionStorage flag (set by WelcomeCover)
  // is kept as a fallback, but it raced this child effect vs the parent layout's,
  // so the steps explainer sometimes never ran. Empty deps = trigger off the
  // mount-time value; a later prop flip (WelcomeCover strips the URL) can't cancel it.
  useEffect(() => {
    let show = isWelcome;
    try {
      if (sessionStorage.getItem("vy-welcome-steps") === "1") show = true;
      if (show) sessionStorage.removeItem("vy-welcome-steps");
    } catch {}
    if (!show) return;
    const id = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    // Light up the sidebar step hints (1–4) so the venue is nudged through the
    // sequence. Each clears when its tab is visited; they never re-arm once done.
    try {
      const raw = localStorage.getItem("vy-step-hints");
      const done = raw ? (JSON.parse(raw).done ?? []) : [];
      if (!Array.isArray(done) || done.length < 5) {
        localStorage.setItem("vy-step-hints", JSON.stringify({ active: true, done: Array.isArray(done) ? done : [] }));
        window.dispatchEvent(new Event("venuely:step-hints"));
      }
    } catch {}
    setFading(true);
    setTimeout(() => setOpen(false), 350);
  }

  if (!open || typeof document === "undefined") return null;

  // Portal to <body> so the fixed overlay covers the FULL viewport — inside the
  // dashboard tree it was trapped by an ancestor's transform/animation containing
  // block, leaving the bottom of the screen un-dimmed.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Venuely"
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 150,
        background: "rgba(28,25,23,0.45)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        opacity: fading ? 0 : 1, transition: "opacity 0.35s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          // 16:9 frame, ~2× the compact size. The animation contain-scales inside
          // so it always fits whole — never cropped.
          width: "min(1120px, 94vw, calc(88vh * 16 / 9))",
          aspectRatio: "16 / 9",
          borderRadius: 20,
          overflow: "hidden",
          // Frosted translucency to match the loading overlay.
          background: "rgba(255, 250, 246, 0.78)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(250,82,60,0.18)",
          boxShadow: "0 24px 70px rgba(28,25,23,0.42)",
          animation: "vyPopIn 0.45s ease both",
        }}
      >
        <style>{`@keyframes vyPopIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}`}</style>

        {EXPLAINER_VIDEO ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={EXPLAINER_VIDEO} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <iframe
            src="/onboarding-steps.html?v=6"
            title="Welcome to Venuely — your first steps"
            loading="eager"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        )}

        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 999,
            background: "rgba(255,255,255,0.9)", border: "none", fontSize: 18, color: "#57534e",
            cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>
    </div>,
    document.body
  );
}
