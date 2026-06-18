"use client";

// First-run welcome lightbox. Shown once, right after the post-onboarding loader
// fades into the dashboard (WelcomeCover sets a sessionStorage flag on the
// ?welcome=1 arrival; this reads + clears it so it never repeats on refresh or on
// normal day-to-day visits). Three quick setup nudges with icons, then a fourth
// highlighted step — create your first wedding — illustrated with a short looping
// animation in lieu of a video.

import { useEffect, useState } from "react";
import Link from "next/link";

const SERIF = "'Fraunces', Georgia, serif";

type Step = { n: number; icon: React.ReactNode; title: string; blurb: string; href: string; cta: string };

const STEPS: Step[] = [
  {
    n: 1,
    icon: "✨",
    title: "Set up the Couple Experience",
    blurb: "Build the page couples actually see — your spaces, photos and venue story.",
    href: "/venue/your-venue",
    cta: "Open Couple Experience",
  },
  {
    n: 2,
    icon: "🏦",
    title: "Choose an invoice & add bank details",
    blurb: "Pick your invoice style and add your banking details so couples can pay you.",
    href: "/venue/billing",
    cta: "Set up invoicing",
  },
  {
    n: 3,
    icon: "✅",
    title: "Check your marketplace",
    blurb: "Review your catalogue, rentals and suppliers so everything reads correctly.",
    href: "/venue/catalogue",
    cta: "Review marketplace",
  },
];

export function DashboardWelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let show = false;
    try {
      show = sessionStorage.getItem("vy-welcome-steps") === "1";
      if (show) sessionStorage.removeItem("vy-welcome-steps");
    } catch {}
    if (show) setOpen(true);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Venuely"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 150,
        background: "rgba(28,25,23,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <style>{`
        @keyframes vyWelcomeIn { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes vyStepGlow { 0%, 18% { opacity: .35; transform: scale(.96); } 6%, 12% { opacity: 1; transform: scale(1); } }
        @keyframes vyHeart { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
        @keyframes vyRingDraw { to { stroke-dashoffset: 0; } }
        @keyframes vyConfetti { 0% { transform: translateY(0) rotate(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(46px) rotate(220deg); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .vy-anim * { animation: none !important; } }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, 100%)", maxHeight: "92vh", overflowY: "auto",
          background: "#FFF9F4", borderRadius: 22, border: "1px solid rgba(250,82,60,0.18)",
          boxShadow: "0 24px 60px rgba(28,25,23,0.32)", padding: "30px 28px",
          animation: "vyWelcomeIn 0.45s ease both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 24, color: "#1c1917", letterSpacing: "-0.02em" }}>
              You&apos;re all set up <span style={{ color: "#FA523C" }}>🎉</span>
            </div>
            <p style={{ color: "#57534e", fontSize: 14, marginTop: 4, maxWidth: 460 }}>
              Three quick things to get right, then create your first wedding and share its portal.
            </p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "transparent", border: "none", fontSize: 22, color: "#a8a29e", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Three setup steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
          {STEPS.map((s) => (
            <Link
              key={s.n}
              href={s.href}
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 14, textDecoration: "none",
                background: "#fff", border: "1px solid var(--line, #ecdfd6)", borderRadius: 14, padding: "13px 15px",
                transition: "box-shadow .15s, transform .15s",
              }}
              className="hover:shadow-md"
            >
              <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 11, background: "var(--cream, #FFF1EA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, color: "#1c1917", fontSize: 14.5 }}>{s.n}. {s.title}</span>
                <span style={{ display: "block", color: "#57534e", fontSize: 12.5, marginTop: 1 }}>{s.blurb}</span>
              </span>
              <span style={{ flexShrink: 0, color: "#FA523C", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{s.cta} →</span>
            </Link>
          ))}
        </div>

        {/* Step 4 — highlighted, with an autoplaying explainer (Seedance video when
            present, else the looping illustration as a graceful fallback). */}
        <div style={{ marginTop: 16, borderRadius: 16, overflow: "hidden", border: "1.5px solid #FA523C" }}>
          <ExplainerMedia />
          <div style={{ background: "#fff", padding: "15px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 200 }}>
              <span style={{ display: "block", fontFamily: SERIF, fontWeight: 800, fontSize: 16, color: "#1c1917" }}>4. Create your first wedding</span>
              <span style={{ display: "block", color: "#57534e", fontSize: 13, marginTop: 2 }}>Add the couple &amp; date — Venuely builds their private planning portal instantly.</span>
            </span>
            <Link href="/venue/weddings" onClick={() => setOpen(false)} style={{ background: "#FA523C", color: "#fff", textDecoration: "none", borderRadius: 999, padding: "11px 22px", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
              Create a wedding →
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "#8a857f", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>I&apos;ll explore on my own</button>
        </div>
      </div>
    </div>
  );
}

// Autoplays the Seedance explainer when it's available, muted + inline so browsers
// allow autoplay. Falls back to the looping illustration if the video is missing or
// can't play. Set NEXT_PUBLIC_WELCOME_VIDEO_URL (or drop welcome-explainer.mp4 in
// /public) to switch it on — no code change needed.
const EXPLAINER_SRC = process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL || "/welcome-explainer.mp4";

function ExplainerMedia() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="vy-anim" style={{ position: "relative", height: 148, background: "linear-gradient(135deg, #FFE9DF 0%, #FFF4D9 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {!failed ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={EXPLAINER_SRC}
          autoPlay muted playsInline loop
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <WeddingScene />
      )}
    </div>
  );
}

// Short looping illustrated scene: a calendar date lands, rings link with a heart,
// then a portal link "sends" — a light stand-in for a how-to clip.
function WeddingScene() {
  return (
    <svg width="320" height="104" viewBox="0 0 320 104" fill="none" role="img" aria-label="Creating a wedding illustration">
      {/* Step dots / connector */}
      <line x1="58" y1="52" x2="262" y2="52" stroke="#F3C7B7" strokeWidth="2" strokeDasharray="3 5" />

      {/* 1 · Couple card */}
      <g style={{ animation: "vyStepGlow 6s ease-in-out infinite", transformOrigin: "58px 52px" }}>
        <rect x="34" y="30" width="48" height="44" rx="9" fill="#fff" stroke="#F3C7B7" />
        <circle cx="50" cy="46" r="6" fill="#FA523C" />
        <circle cx="66" cy="46" r="6" fill="#E5412B" />
        <rect x="42" y="58" width="32" height="5" rx="2.5" fill="#FFD9C8" />
      </g>

      {/* 2 · Calendar date */}
      <g style={{ animation: "vyStepGlow 6s ease-in-out infinite 1.6s", transformOrigin: "160px 52px" }}>
        <rect x="136" y="28" width="48" height="48" rx="9" fill="#fff" stroke="#F3C7B7" />
        <rect x="136" y="28" width="48" height="13" rx="9" fill="#FA523C" />
        <text x="160" y="65" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="20" fill="#1c1917">14</text>
      </g>

      {/* 3 · Rings + heart (portal made) */}
      <g style={{ animation: "vyStepGlow 6s ease-in-out infinite 3.2s", transformOrigin: "262px 52px" }}>
        <rect x="238" y="30" width="48" height="44" rx="9" fill="#fff" stroke="#F3C7B7" />
        <circle cx="256" cy="50" r="9" fill="none" stroke="#FA523C" strokeWidth="3"
          strokeDasharray="57" strokeDashoffset="57" style={{ animation: "vyRingDraw 1.2s ease forwards 3.4s" }} />
        <circle cx="268" cy="50" r="9" fill="none" stroke="#E5412B" strokeWidth="3"
          strokeDasharray="57" strokeDashoffset="57" style={{ animation: "vyRingDraw 1.2s ease forwards 3.7s" }} />
        <text x="262" y="70" textAnchor="middle" fontSize="11" style={{ animation: "vyHeart 1.4s ease-in-out infinite 4s", transformOrigin: "262px 66px" }}>💍</text>
      </g>

      {/* confetti burst near the end */}
      {[
        { x: 262, c: "#FA523C", d: "4.4s" }, { x: 252, c: "#5F8B6A", d: "4.6s" }, { x: 272, c: "#E5C04B", d: "4.5s" },
      ].map((p, i) => (
        <rect key={i} x={p.x} y="22" width="4" height="7" rx="1.5" fill={p.c} style={{ animation: `vyConfetti 1.6s ease-in infinite ${p.d}`, transformOrigin: `${p.x}px 22px` }} />
      ))}
    </svg>
  );
}
