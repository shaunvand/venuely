"use client";

// Site-entry intro splash for the public landing page.
// Liquid "gooey" droplet splash around the V mark → V stroke-draws →
// "venuely" wordmark staggers in → overlay fades/scales out and unmounts.
// Pure CSS/SVG animation (keyframes in globals.css); JS only gates
// mount/unmount + the once-per-session sessionStorage check.
import { useEffect, useLayoutEffect, useState } from "react";

const SESSION_KEY = "vy-intro-shown";

// Poppy droplets that splash outward from the liquid core and get
// re-absorbed (scale → 0). dx/dy = peak offset, dur/del vary per droplet.
const DROPLETS: { dx: number; dy: number; r: number; dur: number; del: number }[] = [
  { dx: 0, dy: -78, r: 11, dur: 1.45, del: 0 },
  { dx: 60, dy: -52, r: 9, dur: 1.3, del: 0.08 },
  { dx: 80, dy: 6, r: 12, dur: 1.55, del: 0.04 },
  { dx: 52, dy: 62, r: 8, dur: 1.25, del: 0.15 },
  { dx: -8, dy: 80, r: 10, dur: 1.5, del: 0.1 },
  { dx: -64, dy: 50, r: 9, dur: 1.35, del: 0.2 },
  { dx: -80, dy: -10, r: 13, dur: 1.6, del: 0.05 },
  { dx: -50, dy: -64, r: 8, dur: 1.2, del: 0.18 },
];

const WORD = "venuely";

export function IntroSplash() {
  // SSR + first client render both produce null → no hydration mismatch.
  // useLayoutEffect flips it on before first paint, so no page flash either.
  const [show, setShow] = useState(false);

  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      return; // storage unavailable → skip the intro entirely
    }
    // Reduced motion: skip the overlay completely (CSS guard backs this up).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    // CSS exit animation ends at ~2.7s; unmount just after.
    const t = setTimeout(() => setShow(false), 2750);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      className="vy-intro-overlay pointer-events-none fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6"
      style={{ background: "var(--cream)" }}
    >
      <svg viewBox="0 0 200 200" width="240" height="240">
        <defs>
          {/* Gooey filter: blur → alpha contrast → composite, so the poppy
              droplets visually merge/split like liquid as they splash. */}
          <filter id="vy-goo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>

        {/* Liquid layer: central core + splashing droplets, all gooed. */}
        <g filter="url(#vy-goo)">
          <circle className="vy-goo-core" cx="100" cy="100" r="40" fill="var(--poppy)" />
          {DROPLETS.map((d, i) => (
            <circle
              key={i}
              className="vy-drop"
              cx="100"
              cy="100"
              r={d.r}
              fill="var(--poppy)"
              style={
                {
                  "--dx": `${d.dx}px`,
                  "--dy": `${d.dy}px`,
                  "--dur": `${d.dur}s`,
                  "--del": `${d.del}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </g>

        {/* The V mark on top — same geometry as app/icon.svg / dashboard loading. */}
        <g transform="translate(68 68)">
          <rect className="vy-intro-tile" width="64" height="64" rx="14" fill="var(--poppy)" />
          <path
            className="vy-intro-v"
            d="M16 18 L30 46 L44 18"
            fill="none"
            stroke="#FFF6F0"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle className="vy-intro-vdot" cx="50" cy="42.5" r="3.6" fill="#FFF6F0" />
        </g>
      </svg>

      {/* Wordmark: lowercase letters stagger in, poppy dot pops last. */}
      <div
        className="font-serif text-5xl"
        style={{ color: "var(--ink)", fontWeight: 900, letterSpacing: "-0.03em" }}
      >
        {WORD.split("").map((ch, i) => (
          <span
            key={i}
            className="vy-intro-letter"
            style={{ animationDelay: `${(1.15 + i * 0.06).toFixed(2)}s` }}
          >
            {ch}
          </span>
        ))}
        <span
          className="vy-intro-letter vy-intro-worddot"
          style={{ color: "var(--poppy)", animationDelay: "1.62s" }}
        >
          .
        </span>
      </div>
    </div>
  );
}
