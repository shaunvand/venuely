"use client";

// First-run welcome popup — ONLY the Claude Design animation (public/welcome-video
// .html), nothing else. Shows once, ~2s after the dashboard settles following the
// wizard hand-off (WelcomeCover sets the flag on the ?welcome=1 arrival), then
// never again. The animation plays once and holds its final frame.

import { useEffect, useState } from "react";

// Optional video override; otherwise the self-contained HTML animation is embedded.
const EXPLAINER_VIDEO = process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL || "";

export function DashboardWelcomeModal() {
  const [open, setOpen] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let show = false;
    try {
      show = sessionStorage.getItem("vy-welcome-steps") === "1";
      if (show) sessionStorage.removeItem("vy-welcome-steps");
    } catch {}
    if (!show) return;
    const id = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(id);
  }, []);

  function close() {
    setFading(true);
    setTimeout(() => setOpen(false), 350);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Venuely"
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 150,
        background: "rgba(28,25,23,0.28)", backdropFilter: "blur(2px)",
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
    </div>
  );
}
