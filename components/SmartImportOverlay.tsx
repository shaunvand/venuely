"use client";

// Smart Import loading overlay — a centred glass panel (~half the viewport,
// 25% transparent, tabs/sidebar stay visible and clickable around it) where the
// Venuely lockup IS the progress bar: a muted base logo fills with brand coral
// left→right as the import progresses. Cycling status lines ("Adding areas…")
// ride underneath with a please-wait note; on completion the logo finishes with
// a shimmer sweep, then the panel fades away.

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

export function SmartImportOverlay({
  active,
  progress,
  message,
  done,
  onCancel,
}: {
  active: boolean;
  progress: number; // 0–100
  message: string;
  done: boolean;
  onCancel?: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [hidden, setHidden] = useState(false);
  // On big imports the bar reaches its tail (~95%+) and sits there while the
  // server finishes matching everything. After a short grace beat we surface a
  // prominent "be patient, don't refresh" notice so the user doesn't bail.
  const [tailLong, setTailLong] = useState(false);

  // Completion: hold the shimmer beat, then fade the panel out.
  useEffect(() => {
    if (!done) { setClosing(false); setHidden(false); return; }
    const fadeId = setTimeout(() => setClosing(true), 1700);
    const hideId = setTimeout(() => setHidden(true), 2350);
    return () => { clearTimeout(fadeId); clearTimeout(hideId); };
  }, [done]);

  const pct = Math.max(0, Math.min(100, progress));

  // Arm the long-tail notice once we're parked in the high 90s and not done.
  useEffect(() => {
    if (done || pct < 95) { setTailLong(false); return; }
    const id = setTimeout(() => setTailLong(true), 4000);
    return () => clearTimeout(id);
  }, [done, pct]);

  if (!active || hidden) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none" aria-live="polite">
      <style>{`
        @keyframes vyImpShimmer { from { transform: translateX(-120%) skewX(-18deg); } to { transform: translateX(260%) skewX(-18deg); } }
        @keyframes vyImpNoticeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vyImpPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(250,82,60,0.30); } 50% { box-shadow: 0 0 0 7px rgba(250,82,60,0); } }
        @keyframes vyImpGlow { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        .vy-imp-notice { animation: vyImpNoticeIn 0.4s ease both, vyImpPulse 2.1s ease-in-out 0.4s infinite; }
        .vy-imp-hourglass { display: inline-block; animation: vyImpGlow 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .vy-imp-shimmer { display: none !important; } .vy-imp-notice, .vy-imp-hourglass { animation: vyImpNoticeIn 0.4s ease both !important; } }
      `}</style>
      <div
        className="pointer-events-auto rounded-3xl shadow-xl px-10 py-9 text-center transition-opacity duration-500"
        style={{
          width: "min(50vw, 640px)",
          minWidth: "min(92vw, 480px)",
          background: "rgba(255, 250, 246, 0.75)", // 25% transparency
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
          {/* Shimmer sweep when the import lands */}
          {done && (
            <div className="absolute inset-0 overflow-hidden rounded-xl">
              <div
                className="vy-imp-shimmer absolute top-0 bottom-0 w-1/4"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)",
                  animation: "vyImpShimmer 1.1s ease-in-out 0.15s 1 both",
                }}
              />
            </div>
          )}
        </div>

        <div className="mt-6">
          {done ? (
            <p className="text-base font-semibold" style={{ color: "#1f5d3e" }}>Import complete ✓</p>
          ) : (
            <>
              <p className="text-base font-medium" style={{ color: "var(--ink, #1c1917)" }}>{message || "Working on your import…"}</p>
              <p className="text-sm mt-1.5" style={{ color: INK2 }}>
                Please wait while we load everything in — <span className="tabular-nums font-semibold">{Math.round(pct)}%</span>
              </p>
              {tailLong && (
                <div
                  className="vy-imp-notice mt-4 mx-auto rounded-2xl text-left px-4 py-3"
                  style={{
                    maxWidth: 440,
                    background: "rgba(250, 82, 60, 0.09)",
                    border: "1px solid rgba(250, 82, 60, 0.35)",
                  }}
                  role="alert"
                >
                  <p className="text-sm font-semibold" style={{ color: CORAL_DEEP }}>
                    <span className="vy-imp-hourglass mr-1.5">⏳</span>
                    Almost there — this is a big import
                  </p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: INK2 }}>
                    You uploaded a lot of files, so this is taking a little longer than usual. Please hang tight and
                    <span className="font-semibold" style={{ color: CORAL_DEEP }}> don&apos;t refresh or close this tab</span> —
                    we&apos;ll finish loading everything in for you.
                  </p>
                </div>
              )}
              {onCancel && (
                <button type="button" onClick={onCancel} className="text-xs mt-3 underline press" style={{ color: INK2 }}>
                  Cancel import
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
