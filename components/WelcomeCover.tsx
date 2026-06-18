"use client";

// Bridges the onboarding → dashboard hand-off. The wizard plays the VenuelyLoader
// fill animation, then navigates to /venue?welcome=1. Because /venue is dynamic,
// Next would normally flash the skeleton (app/venue/loading.tsx) before the
// dashboard paints. This cover — mounted in the venue LAYOUT so it sits above both
// the skeleton and the page — shows the loader's FINAL filled badge (seamless
// continuation of what the user just watched), holds briefly while the dashboard
// renders underneath, then fades to reveal it. Only ever runs once, on first
// arrival with ?welcome=1, then strips the flag so it never replays.

import { useEffect, useState } from "react";

const C = { coral: "#FA523C", coralDeep: "#E5412B", white: "#FFFDFB" };
const B = 240, R = 56;
const SERIF = "'Fraunces', Georgia, 'Playfair Display', serif";

export function WelcomeCover() {
  const [active, setActive] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let welcome = false;
    try { welcome = new URLSearchParams(window.location.search).get("welcome") === "1"; } catch {}
    if (!welcome) return;
    setActive(true);
    // Hand off to the dashboard welcome lightbox (it reads + clears this once the
    // cover fades), so the first-run steps appear right after the animation.
    try { sessionStorage.setItem("vy-welcome-steps", "1"); } catch {}
    // Strip ?welcome=1 immediately so a refresh / back never replays the cover.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {}
    // Hold over the dashboard's first paint, then fade out to reveal it.
    const fadeId = setTimeout(() => setFading(true), 900);
    const hideId = setTimeout(() => setActive(false), 1450);
    return () => { clearTimeout(fadeId); clearTimeout(hideId); };
  }, []);

  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#FFF6F0",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28,
        opacity: fading ? 0 : 1,
        transition: "opacity 0.55s ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* The loader's final frame: a fully coral-filled badge with a white V. */}
      <svg width="184" height="184" viewBox={`0 0 ${B} ${B}`}>
        <rect x="0" y="0" width={B} height={B} rx={R} ry={R} fill={C.coral} />
        <text x="124" y="168" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="120" fill={C.white}>V</text>
        <circle cx={160} cy={159} r={10} fill={C.white} />
      </svg>
      <div style={{ fontFamily: SERIF, fontSize: 18, color: "#2A2622", letterSpacing: "-0.01em" }}>Welcome to your dashboard</div>
    </div>
  );
}
