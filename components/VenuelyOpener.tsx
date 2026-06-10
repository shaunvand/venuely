"use client";

// Venuely logo opener — production port of the standalone animation.
// Sequence: charcoal "v" emerges → coral liquid fills the badge & splashes
// around the dot → "v" turns white as it submerges → "Venuely." wordmark
// reveals & lockup recentres → "Weddings Made Easy" tagline writes in →
// overlay fades to transparent and unmounts.
//
// trigger="landing": plays once per browser session on the public landing page.
// trigger="welcome": plays once (localStorage) when a venue finishes onboarding
// and lands on the dashboard with ?welcome=1.

import { useEffect, useRef, useState } from "react";

const C = {
  coral: "#FA523C",
  coralDeep: "#E5412B",
  offwhite: "#FFF6F0",
  charcoal: "#2A2622",
  white: "#FFFDFB",
  gray: "#57514C",
};

const SERIF = "'Fraunces', 'Playfair Display', Georgia, serif";
const SANS = "'Satoshi', 'Mulish', system-ui, sans-serif";

// Badge geometry (SVG user units)
const B = 240;
const R = 56;
const DOT = { x: 160, y: 159, r: 10 };

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

// Timeline (seconds)
const T = {
  vIn: [0.15, 1.15],
  fill: [1.45, 2.85],
  splash: [1.95, 2.95],
  settle: [2.85, 3.25],
  word: [3.15, 4.45],
  shift: [3.15, 4.05],
  tag: [4.45, 5.65],
  fade: [5.9, 6.55], // overlay → transparent
};
const TOTAL = 6.7;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeOutQuad = (t: number) => t * (2 - t);
const easeOutCubic = (t: number) => --t * t * t + 1;
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

function interpolate(input: number[], output: number[], ease: Array<(t: number) => number>) {
  return (t: number) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const eased = (ease[i] ?? ((x: number) => x))(local);
        return output[i] + (output[i + 1] - output[i]) * eased;
      }
    }
    return output[output.length - 1];
  };
}

const levelFn = interpolate(
  [0, 0.34, 0.5, 1],
  [B + 8, DOT.y - 2, DOT.y - 6, -8],
  [easeOutQuad, easeInOutSine, easeInOutCubic],
);

function Badge({ t }: { t: number }) {
  const vP = clamp((t - T.vIn[0]) / (T.vIn[1] - T.vIn[0]), 0, 1);
  const vEase = easeOutBack(vP);
  const vScale = 0.55 + 0.45 * vEase;
  const vOpacity = clamp(vP * 1.4, 0, 1);
  const vBlur = (1 - clamp(vP * 1.3, 0, 1)) * 5;

  const fillRaw = clamp((t - T.fill[0]) / (T.fill[1] - T.fill[0]), 0, 1);
  const level = t < T.fill[0] ? B + 8 : levelFn(fillRaw);

  const waveT = t * 2.4;
  const amp = 7 * (1 - fillRaw) + 2;
  const surfacePath = () => {
    const steps = 10;
    let d = `M -10 ${B + 20} L -10 ${level}`;
    for (let i = 0; i <= steps; i++) {
      const x = -10 + (B + 20) * (i / steps);
      const y = level + Math.sin(waveT + i * 0.9) * amp * Math.sin((i / steps) * Math.PI);
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L ${B + 10} ${B + 20} Z`;
    return d;
  };

  const setP = clamp((t - T.settle[0]) / (T.settle[1] - T.settle[0]), 0, 1);
  const squash = Math.sin(setP * Math.PI) * 0.05;
  const shadowA = clamp(fillRaw * 0.9, 0, 1);

  const drops = DROPS.map((d, i) => {
    const sp = clamp((t - T.splash[0] - d.delay) / (T.splash[1] - T.splash[0] - d.delay), 0, 1);
    if (sp <= 0 || sp >= 1) return null;
    const x = DOT.x + Math.cos(d.ang) * d.dist * sp;
    const y = DOT.y - d.vy * sp + 0.5 * d.g * sp * sp;
    const r = d.size * (1 - sp * 0.45);
    return <circle key={i} cx={x} cy={y} r={Math.max(0.5, r)} fill={C.coral} />;
  });

  const sheenP = clamp((t - 3.0) / 0.7, 0, 1);

  return (
    <svg
      width={B}
      height={B}
      viewBox={`0 0 ${B} ${B}`}
      style={{
        overflow: "visible",
        transform: `scale(${1 + squash}, ${1 - squash})`,
        transformOrigin: "center bottom",
        flexShrink: 0,
      }}
    >
      <defs>
        <clipPath id="vyOpBadgeClip"><rect x="0" y="0" width={B} height={B} rx={R} ry={R} /></clipPath>
        <clipPath id="vyOpSubmerge"><rect x="-20" y={level} width={B + 40} height={B + 40 - level} /></clipPath>
        <filter id="vyOpGoo" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="over" />
        </filter>
        <linearGradient id="vyOpCoralGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FB5841" />
          <stop offset="1" stopColor={C.coral} />
        </linearGradient>
      </defs>

      <ellipse cx={B / 2} cy={B + 26} rx={B * 0.42} ry="16" fill={C.coralDeep} opacity={shadowA * 0.28} style={{ filter: "blur(9px)" }} />

      <g opacity={vOpacity} style={{ filter: vBlur > 0.05 ? `blur(${vBlur}px)` : "none", transform: `scale(${vScale})`, transformOrigin: "center" }}>
        <text x="124" y="168" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="120" fill={C.charcoal}>V</text>
        <circle cx={DOT.x} cy={DOT.y} r={DOT.r} fill={C.charcoal} />
      </g>

      <g clipPath="url(#vyOpBadgeClip)">
        <g filter="url(#vyOpGoo)">
          <path d={surfacePath()} fill="url(#vyOpCoralGrad)" />
          {level < DOT.y + DOT.r + 30 && <circle cx={DOT.x} cy={DOT.y} r={DOT.r} fill={C.coral} />}
          {drops}
        </g>
      </g>

      <g filter="url(#vyOpGoo)">{drops}</g>

      <g clipPath="url(#vyOpSubmerge)">
        <text x="124" y="168" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="120" fill={C.white}>V</text>
        <circle cx={DOT.x} cy={DOT.y} r={DOT.r} fill={C.white} />
      </g>

      <g clipPath="url(#vyOpBadgeClip)">
        <rect
          x={-120 + (B + 160) * easeInOutCubic(sheenP)}
          y="0" width="60" height={B} fill="#fff"
          opacity={Math.sin(sheenP * Math.PI) * 0.18}
          transform="skewX(-18)"
        />
      </g>
    </svg>
  );
}

function Wordmark({ t }: { t: number }) {
  const wp = clamp((t - T.word[0]) / (T.word[1] - T.word[0]), 0, 1);
  const wipe = easeInOutCubic(wp);
  const rise = (1 - easeOutCubic(wp)) * 14;
  return (
    <div
      style={{
        fontFamily: SERIF, fontWeight: 700, fontSize: 168, lineHeight: 0.9,
        color: C.coral, whiteSpace: "nowrap",
        clipPath: `inset(-30% ${(1 - wipe) * 100}% -30% 0)`,
        transform: `translateY(${rise}px)`,
        letterSpacing: "-0.01em",
      }}
    >
      Venuely<span style={{ color: C.coralDeep }}>.</span>
    </div>
  );
}

function Tagline({ t }: { t: number }) {
  const gp = clamp((t - T.tag[0]) / (T.tag[1] - T.tag[0]), 0, 1);
  const wipe = easeInOutCubic(gp);
  const rise = (1 - easeOutCubic(gp)) * 10;
  return (
    <div
      style={{
        fontFamily: SANS, fontWeight: 600, fontSize: 42, color: C.gray,
        whiteSpace: "nowrap", letterSpacing: "0.16em",
        clipPath: `inset(-20% ${(1 - wipe) * 100}% -20% 0)`,
        transform: `translateY(${rise}px)`,
        marginTop: 14, marginLeft: 6,
      }}
    >
      Weddings Made Easy
    </div>
  );
}

export function VenuelyOpener({ trigger }: { trigger: "landing" | "welcome" }) {
  const [show, setShow] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [staticFade, setStaticFade] = useState(false);
  const [t, setT] = useState(0);
  const [scale, setScale] = useState(0.5);
  const textRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(330);

  // Gate: once per session (landing) / once ever (welcome). Force-params bypass
  // the gates for previewing: /?intro=1 on the landing, /venue?welcome=force.
  // Reduced-motion users get a static lockup that simply fades (no animation).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const force = trigger === "landing" ? params.get("intro") === "1" : params.get("welcome") === "force";
      if (!force) {
        if (trigger === "landing") {
          if (sessionStorage.getItem("vy-opener-shown")) return;
          sessionStorage.setItem("vy-opener-shown", "1");
        } else {
          if (localStorage.getItem("vy-welcome-opener-shown")) return;
          localStorage.setItem("vy-welcome-opener-shown", "1");
        }
      }
      setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setShow(true);
    } catch {
      /* private mode etc. — skip the intro */
    }
  }, [trigger]);

  // RAF clock (animated mode) / short static fade (reduced motion).
  useEffect(() => {
    if (!show) return;
    if (reduced) {
      setT(5.7); // final composed frame, no motion
      const fadeId = setTimeout(() => setStaticFade(true), 1300);
      const endId = setTimeout(() => setShow(false), 1900);
      return () => { clearTimeout(fadeId); clearTimeout(endId); };
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const next = (now - start) / 1000;
      if (next >= TOTAL) { setShow(false); return; }
      setT(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [show, reduced]);

  // Responsive lockup scale (the composition is ~1000px wide at scale 1).
  useEffect(() => {
    if (!show) return;
    const measure = () => setScale(Math.min(1, (window.innerWidth - 48) / 1060, (window.innerHeight - 48) / 420));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [show]);

  // Recentre offset = half of (text block + gap); re-measure once fonts land.
  useEffect(() => {
    if (!show) return;
    const measure = () => {
      if (textRef.current) setOffset((textRef.current.offsetWidth + 48) / 2);
    };
    measure();
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});
    const id = setTimeout(measure, 400);
    return () => clearTimeout(id);
  }, [show]);

  if (!show) return null;

  const shiftP = easeInOutCubic(clamp((t - T.shift[0]) / (T.shift[1] - T.shift[0]), 0, 1));
  const groupX = offset * (1 - shiftP);
  const idle = t > 5.8 ? Math.sin((t - 5.8) * 1.6) * 2.5 : 0;
  const fadeP = clamp((t - T.fade[0]) / (T.fade[1] - T.fade[0]), 0, 1);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: C.offwhite,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: reduced ? (staticFade ? 0 : 1) : 1 - easeInOutCubic(fadeP),
        transition: reduced ? "opacity 0.55s ease" : undefined,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 48, transform: `translate(${groupX}px, ${idle}px)` }}>
          <Badge t={t} />
          <div ref={textRef} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <Wordmark t={t} />
            <Tagline t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}
