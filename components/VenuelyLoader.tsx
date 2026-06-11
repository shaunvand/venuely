"use client";

// Venuely Loader (from the Claude Design "Venuely Loader.html" handoff): a
// charcoal "V." badge on off-white where coral liquid fills bottom→top once over
// ~2.8s (eased), a gooey splash bursts around the dot, the V flips charcoal→white
// as it submerges, a gloss shimmers across at the top, then it STOPS full — no
// loop, no retract. Used as the onboarding → dashboard send-off at standard speed.

import { useEffect, useRef, useState } from "react";

const C = {
  coral: "#FA523C",
  coralDeep: "#E5412B",
  charcoal: "#2A2622",
  white: "#FFFDFB",
};
const B = 240;
const R = 56;
const DOT = { x: 160, y: 159, r: 10 };

const FILL_DUR = 2.8;
const SHIMMER_AT = FILL_DUR - 0.2; // 2.6
const SHIMMER_DUR = 0.85;
const END = FILL_DUR + SHIMMER_DUR + 0.4; // ~4.05s

const DROPS = [
  { ang: -1.62, dist: 18, vy: 138, size: 15, g: 250, delay: 0.0 },
  { ang: -1.15, dist: 52, vy: 120, size: 11, g: 270, delay: 0.05 },
  { ang: -2.05, dist: 50, vy: 110, size: 12, g: 260, delay: 0.04 },
  { ang: -0.75, dist: 78, vy: 92, size: 8, g: 300, delay: 0.1 },
  { ang: -2.45, dist: 74, vy: 96, size: 9, g: 300, delay: 0.09 },
  { ang: -1.4, dist: 30, vy: 150, size: 10, g: 240, delay: 0.02 },
  { ang: -1.85, dist: 36, vy: 144, size: 10, g: 245, delay: 0.03 },
  { ang: -0.5, dist: 96, vy: 70, size: 6, g: 330, delay: 0.14 },
  { ang: -2.7, dist: 92, vy: 72, size: 6, g: 330, delay: 0.13 },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const SERIF = "'Fraunces', Georgia, 'Playfair Display', serif";

export function VenuelyLoader({
  message = "Setting up your dashboard…",
  onDone,
}: {
  message?: string;
  onDone?: () => void;
}) {
  const [t, setT] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    // Always play the full fill animation — this is a deliberate brand moment, so
    // we don't downgrade to a static frame under prefers-reduced-motion.
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const e = (now - start) / 1000;
      setT(e);
      if (e <= END) {
        raf = requestAnimationFrame(step);
      } else if (!doneRef.current) {
        // Navigate the instant the fill completes, while the full badge still
        // covers the wizard — no fade-out, so the wizard never flashes back.
        doneRef.current = true;
        onDone?.();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  // Liquid level: B (empty/bottom) → -10 (full/top), eased over FILL_DUR.
  const p = clamp(t / FILL_DUR, 0, 1);
  const level = B - eio(p) * (B - -10);
  const fillFrac = clamp((B - level) / (B + 10), 0, 1);

  // Wavy surface.
  const amp = 7 * (1 - fillFrac) + 2;
  const wob = t * 2.4;
  const surfacePath = () => {
    const steps = 10;
    let d = `M -12 ${B + 24} L -12 ${level.toFixed(1)}`;
    for (let i = 0; i <= steps; i++) {
      const x = -12 + (B + 24) * (i / steps);
      const y = level + Math.sin(wob + i * 0.9) * amp * Math.sin((i / steps) * Math.PI);
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L ${B + 12} ${B + 24} Z`;
    return d;
  };

  // Splash droplets — burst around the dot as the liquid reaches it.
  const sp = clamp((t - FILL_DUR * 0.3) / (FILL_DUR * 0.26), 0, 1);
  const drops = DROPS.map((d, i) => {
    const s = clamp((sp - d.delay) / (1 - d.delay), 0, 1);
    if (s <= 0 || s >= 1) return null;
    const x = DOT.x + Math.cos(d.ang) * d.dist * s;
    const y = DOT.y - d.vy * s + 0.5 * d.g * s * s;
    const r = d.size * (1 - s * 0.45);
    return <circle key={i} cx={x} cy={y} r={Math.max(0.5, r)} fill={C.coral} />;
  });

  // Gloss sweep at the top.
  const fl = clamp((t - SHIMMER_AT) / SHIMMER_DUR, 0, 1);
  const glossX = lerp(-120, B + 40, fl);
  const glossO = Math.sin(fl * Math.PI) * 0.18;
  const shadowO = fillFrac * 0.26;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, zIndex: 130,
        background: "#FFF6F0",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28,
      }}
    >
      <svg width="184" height="184" viewBox={`0 0 ${B} ${B}`} style={{ overflow: "visible" }}>
        <defs>
          <clipPath id="vlBadge"><rect x="0" y="0" width={B} height={B} rx={R} ry={R} /></clipPath>
          <clipPath id="vlSub"><rect x="-20" y={level} width={B + 40} height={B + 48 - level} /></clipPath>
          <filter id="vlGoo" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8" result="g" />
            <feComposite in="SourceGraphic" in2="g" operator="over" />
          </filter>
          <linearGradient id="vlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FB5841" />
            <stop offset="1" stopColor={C.coral} />
          </linearGradient>
        </defs>

        {/* soft shadow grows with fill */}
        <ellipse cx={B / 2} cy={B + 26} rx={B * 0.42} ry="16" fill={C.coralDeep} opacity={shadowO} style={{ filter: "blur(9px)" }} />

        {/* charcoal V + dot (resting state) */}
        <g>
          <text x="124" y="168" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="120" fill={C.charcoal}>V</text>
          <circle cx={DOT.x} cy={DOT.y} r={DOT.r} fill={C.charcoal} />
        </g>

        {/* coral liquid filling the badge (gooey) */}
        <g clipPath="url(#vlBadge)">
          <g filter="url(#vlGoo)">
            <path d={surfacePath()} fill="url(#vlGrad)" />
            {level < DOT.y + DOT.r + 30 && <circle cx={DOT.x} cy={DOT.y} r={DOT.r} fill={C.coral} />}
            {drops}
          </g>
        </g>

        {/* escaped splash droplets (can leave the badge) */}
        <g filter="url(#vlGoo)">{drops}</g>

        {/* white V + dot, revealed only where submerged */}
        <g clipPath="url(#vlSub)">
          <text x="124" y="168" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="120" fill={C.white}>V</text>
          <circle cx={DOT.x} cy={DOT.y} r={DOT.r} fill={C.white} />
        </g>

        {/* gloss sweep at the top */}
        <g clipPath="url(#vlBadge)">
          <rect x={glossX} y="0" width="60" height={B} fill="#fff" opacity={glossO} transform="skewX(-18)" />
        </g>
      </svg>

      {message && (
        <div style={{ fontFamily: SERIF, fontSize: 18, color: "var(--ink, #2A2622)", letterSpacing: "-0.01em" }}>{message}</div>
      )}
    </div>
  );
}
