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
  {
    n: 4,
    icon: "💍",
    title: "Create your first wedding",
    blurb: "Add the couple & date — Venuely builds their private planning portal instantly.",
    href: "/venue/weddings",
    cta: "Create a wedding",
  },
];

export function DashboardWelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show once, only after the wizard hand-off (WelcomeCover sets the flag on the
    // ?welcome=1 arrival). Pops ~2s after the dashboard settles, then never again.
    let show = false;
    try {
      show = sessionStorage.getItem("vy-welcome-steps") === "1";
      if (show) sessionStorage.removeItem("vy-welcome-steps");
    } catch {}
    if (!show) return;
    const id = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(id);
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
        {/* Full-width explainer hero — autoplaying motion-graphics walkthrough
            (or a video when NEXT_PUBLIC_WELCOME_VIDEO_URL / welcome-explainer.mp4
            is present). Close button floats over it. */}
        <div style={{ position: "relative", margin: "-30px -28px 0", borderRadius: "22px 22px 0 0", overflow: "hidden" }}>
          <ExplainerMedia />
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ position: "absolute", top: 10, right: 12, width: 30, height: 30, borderRadius: 999, background: "rgba(255,255,255,0.85)", border: "none", fontSize: 18, color: "#57534e", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Header */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 24, color: "#1c1917", letterSpacing: "-0.02em" }}>
            You&apos;re all set up <span style={{ color: "#FA523C" }}>🎉</span>
          </div>
          <p style={{ color: "#57534e", fontSize: 14, marginTop: 4 }}>
            A few quick things to get right, then create your first wedding and share its portal.
          </p>
        </div>

        {/* Four steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {STEPS.map((s) => {
            const isWedding = s.n === 4;
            return (
              <Link
                key={s.n}
                href={s.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, textDecoration: "none",
                  background: "#fff", border: `1px solid ${isWedding ? "#FA523C" : "var(--line, #ecdfd6)"}`, borderRadius: 14, padding: "13px 15px",
                  transition: "box-shadow .15s, transform .15s",
                }}
                className="hover:shadow-md"
              >
                <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 11, background: isWedding ? "#FA523C" : "var(--cream, #FFF1EA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, color: "#1c1917", fontSize: 14.5 }}>{s.n}. {s.title}</span>
                  <span style={{ display: "block", color: "#57534e", fontSize: 12.5, marginTop: 1 }}>{s.blurb}</span>
                </span>
                <span style={{ flexShrink: 0, color: "#FA523C", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{s.cta} →</span>
              </Link>
            );
          })}
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
// The polished welcome explainer (Claude Design) lives as a self-contained page in
// /public. We embed it 16:9 so it plays exactly as designed; it runs once and holds
// its final frame (loop removed in welcome-scenes.js). Optional NEXT_PUBLIC_WELCOME_
// VIDEO_URL can still override with a video instead.
const EXPLAINER_VIDEO = process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL || "";

function ExplainerMedia() {
  if (EXPLAINER_VIDEO) {
    return (
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#211d1a" }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={EXPLAINER_VIDEO} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  return (
    <iframe
      src="/welcome-video.html"
      title="How Venuely works"
      loading="eager"
      style={{ display: "block", width: "100%", aspectRatio: "16 / 9", border: "none", background: "#211d1a" }}
    />
  );
}
