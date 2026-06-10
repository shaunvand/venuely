"use client";

// The single Venuely loading visual, generalised from the Smart Import overlay:
// a centred glass panel where the Venuely lockup IS the progress bar — a muted
// base logo fills with brand coral left→right, a cycling message underneath, and
// a shimmer sweep on completion. Used app-wide via LoadingProvider/useLoading so
// EVERY loading state looks identical.

import { useEffect, useState } from "react";

const CORAL = "#FA523C";
const CORAL_DEEP = "#E5412B";
const MUTED = "#E8DDD5";
const INK2 = "#57514C";

function Lockup({ tone }: { tone: "muted" | "coral" }) {
  const badge = tone === "coral" ? CORAL : MUTED;
  const text = tone === "coral" ? CORAL : MUTED;
  const dot = tone === "coral" ? CORAL_DEEP : MUTED;
  const inner = tone === "coral" ? "#FFFDFB" : "#FFFFFF";
  return (
    <div className="flex items-center gap-4 select-none" aria-hidden>
      <svg width="64" height="64" viewBox="0 0 240 240" className="shrink-0">
        <rect x="0" y="0" width="240" height="240" rx="56" fill={badge} />
        <text x="124" y="168" textAnchor="middle" fontFamily="'Fraunces', Georgia, serif" fontWeight="700" fontSize="120" fill={inner}>V</text>
        <circle cx="160" cy="159" r="10" fill={inner} />
      </svg>
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 56, lineHeight: 0.9, whiteSpace: "nowrap", color: text, letterSpacing: "-0.01em" }}>
        Venuely<span style={{ color: dot }}>.</span>
      </div>
    </div>
  );
}

export function BrandedLoader({
  active,
  progress,
  message,
  subMessage,
  done,
  doneMessage = "Done ✓",
  showPercent = true,
  onCancel,
  cancelLabel = "Cancel",
}: {
  active: boolean;
  progress: number; // 0–100
  message: string;
  subMessage?: string;
  done: boolean;
  doneMessage?: string;
  showPercent?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [closing, setClosing] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Completion: hold the shimmer beat, then fade the panel out.
  useEffect(() => {
    if (!done) { setClosing(false); setHidden(false); return; }
    const fadeId = setTimeout(() => setClosing(true), 1400);
    const hideId = setTimeout(() => setHidden(true), 2000);
    return () => { clearTimeout(fadeId); clearTimeout(hideId); };
  }, [done]);

  if (!active || hidden) return null;

  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none" aria-live="polite" role="status">
      <style>{`
        @keyframes vyLoadShimmer { from { transform: translateX(-120%) skewX(-18deg); } to { transform: translateX(260%) skewX(-18deg); } }
        @media (prefers-reduced-motion: reduce) { .vy-load-shimmer { display: none !important; } }
      `}</style>
      <div
        className="pointer-events-auto rounded-3xl shadow-xl px-10 py-9 text-center transition-opacity duration-500"
        style={{
          width: "min(50vw, 640px)",
          minWidth: "min(92vw, 460px)",
          background: "rgba(255, 250, 246, 0.75)", // 25% transparency, frosted
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(250, 82, 60, 0.18)",
          opacity: closing ? 0 : 1,
        }}
      >
        {/* The logo as the loading bar: muted base + coral layer clipped to progress */}
        <div className="relative inline-block">
          <Lockup tone="muted" />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)`, transition: "clip-path 0.45s ease" }}>
            <Lockup tone="coral" />
          </div>
          {done && (
            <div className="absolute inset-0 overflow-hidden rounded-xl">
              <div
                className="vy-load-shimmer absolute top-0 bottom-0 w-1/4"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)", animation: "vyLoadShimmer 1.1s ease-in-out 0.1s 1 both" }}
              />
            </div>
          )}
        </div>

        <div className="mt-6">
          {done ? (
            <p className="text-base font-semibold" style={{ color: "#1f5d3e" }}>{doneMessage}</p>
          ) : (
            <>
              <p className="text-base font-medium" style={{ color: "var(--ink, #1c1917)" }}>{message || "Working…"}</p>
              <p className="text-sm mt-1.5" style={{ color: INK2 }}>
                {subMessage ?? "Please wait"}{showPercent && <> — <span className="tabular-nums font-semibold">{Math.round(pct)}%</span></>}
              </p>
              {onCancel && (
                <button type="button" onClick={onCancel} className="text-xs mt-3 underline press" style={{ color: INK2 }}>
                  {cancelLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
