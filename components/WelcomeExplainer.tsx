"use client";

// Clean motion-graphics explainer — an ~18s looping, on-brand walkthrough of the
// four first-run steps. Built as coded animation (not AI video) so every label is
// crisp and legible and it needs no hosting. Five beats crossfade on a single 18s
// master timeline; each beat shows an icon scene + a real-text caption.
//
// Swappable: if NEXT_PUBLIC_WELCOME_VIDEO_URL (or /welcome-explainer.mp4) exists,
// the parent plays that instead and never mounts this.

const SERIF = "'Fraunces', Georgia, serif";
const CORAL = "#FA523C";

// Beat windows over an 18s loop (5 × 20%), each visible ~3.6s with a short fade.
const BEATS = [
  { key: "welcome", label: "Welcome to Venuely", tint: "#FFE9DF" },
  { key: "couple", label: "1 · Set up the Couple Experience", tint: "#FFF1EA" },
  { key: "invoice", label: "2 · Invoicing & bank details", tint: "#FFF4D9" },
  { key: "market", label: "3 · Check your marketplace", tint: "#EAF3EC" },
  { key: "wedding", label: "4 · Create your first wedding", tint: "#FFE4D9" },
];

export function WelcomeExplainer() {
  return (
    <div style={{ position: "relative", width: "100%", height: 196, overflow: "hidden", background: "linear-gradient(135deg,#FFF1EA,#FFF7E6)" }} className="vy-anim" aria-label="How Venuely works, in four steps" role="img">
      <style>{`
        @keyframes vyBeat { 0%{opacity:0} 2%{opacity:1} 18%{opacity:1} 20%{opacity:0} 100%{opacity:0} }
        @keyframes vyTint { 0%,2%{opacity:1} 20%{opacity:0} 100%{opacity:0} }
        @keyframes vyRise { 0%{opacity:0;transform:translateY(10px)} 3%{opacity:1;transform:none} 18%{opacity:1;transform:none} 20%{opacity:0} 100%{opacity:0} }
        @keyframes vyDraw { to { stroke-dashoffset:0 } }
        @keyframes vyHeart { 0%,100%{transform:scale(1)} 50%{transform:scale(1.16)} }
        @keyframes vyProgress { 0%{transform:scaleX(0)} 100%{transform:scaleX(1)} }
        .vy-beat { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; animation: vyBeat 18s ease-in-out infinite; }
        .vy-tint { position:absolute; inset:0; animation: vyTint 18s ease-in-out infinite; }
        .vy-cap { font-family:${SERIF}; font-weight:800; font-size:17px; color:#1c1917; letter-spacing:-0.01em; }
        @media (prefers-reduced-motion: reduce){ .vy-anim *{animation-duration:0s !important} }
      `}</style>

      {/* tint washes per beat */}
      {BEATS.map((b, i) => (
        <div key={b.key} className="vy-tint" style={{ background: b.tint, animationDelay: `${i * 3.6}s` }} />
      ))}

      {/* progress hairline */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(0,0,0,0.06)" }}>
        <div style={{ height: "100%", background: CORAL, transformOrigin: "left", animation: "vyProgress 18s linear infinite" }} />
      </div>

      {/* Beat 0 — Welcome: the V. mark draws in */}
      <div className="vy-beat" style={{ animationDelay: "0s" }}>
        <svg width="84" height="84" viewBox="0 0 240 240">
          <rect x="0" y="0" width="240" height="240" rx="56" fill="none" stroke={CORAL} strokeWidth="10"
            strokeDasharray="900" strokeDashoffset="900" style={{ animation: "vyDraw 1.6s ease forwards" }} />
          <text x="124" y="168" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="120" fill={CORAL}>V</text>
          <circle cx="160" cy="159" r="10" fill="#E5412B" />
        </svg>
        <div className="vy-cap">{BEATS[0].label}</div>
      </div>

      {/* Beat 1 — Couple Experience: photo tiles fill in */}
      <div className="vy-beat" style={{ animationDelay: "3.6s" }}>
        <svg width="150" height="74" viewBox="0 0 150 74">
          <rect x="2" y="2" width="146" height="70" rx="10" fill="#fff" stroke="#F3C7B7" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={12 + i * 33} y="14" width="26" height="46" rx="5" fill={["#FAD7C8", "#F6C7A8", "#F4D9B0", "#E8CFB6"][i]}
              style={{ animation: "vyRise 18s ease-in-out infinite", animationDelay: `${3.6 + i * 0.18}s` }} />
          ))}
        </svg>
        <div className="vy-cap">{BEATS[1].label}</div>
      </div>

      {/* Beat 2 — Invoicing & bank: an invoice + bank card slide in */}
      <div className="vy-beat" style={{ animationDelay: "7.2s" }}>
        <svg width="150" height="74" viewBox="0 0 150 74">
          <rect x="14" y="8" width="58" height="58" rx="8" fill="#fff" stroke="#F3C7B7" />
          {[0, 1, 2].map((i) => <rect key={i} x="24" y={20 + i * 12} width={38 - i * 8} height="5" rx="2.5" fill="#FFD9C8" />)}
          <rect x="80" y="22" width="58" height="36" rx="7" fill={CORAL} />
          <rect x="80" y="32" width="58" height="7" fill="#E5412B" />
          <rect x="86" y="46" width="22" height="5" rx="2.5" fill="#fff" opacity="0.8" />
        </svg>
        <div className="vy-cap">{BEATS[2].label}</div>
      </div>

      {/* Beat 3 — Marketplace: list rows get ticked */}
      <div className="vy-beat" style={{ animationDelay: "10.8s" }}>
        <svg width="150" height="74" viewBox="0 0 150 74">
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="22" y={12 + i * 18} width="106" height="13" rx="6.5" fill="#fff" stroke="#CDE3D2" />
              <circle cx="32" cy={18.5 + i * 18} r="5.5" fill="#5F8B6A"
                style={{ animation: "vyRise 18s ease-in-out infinite", animationDelay: `${10.8 + i * 0.3}s` }} />
              <path d={`M29.5 ${18.5 + i * 18} l2 2 l3.5 -3.5`} stroke="#fff" strokeWidth="1.6" fill="none"
                style={{ animation: "vyRise 18s ease-in-out infinite", animationDelay: `${10.8 + i * 0.3}s` }} />
              <rect x="44" y={15.5 + i * 18} width={60 - i * 12} height="6" rx="3" fill="#DCEADF" />
            </g>
          ))}
        </svg>
        <div className="vy-cap">{BEATS[3].label}</div>
      </div>

      {/* Beat 4 — Create a wedding: couple + date → portal sends */}
      <div className="vy-beat" style={{ animationDelay: "14.4s" }}>
        <svg width="160" height="74" viewBox="0 0 160 74">
          <rect x="6" y="20" width="44" height="40" rx="8" fill="#fff" stroke="#F3C7B7" />
          <circle cx="22" cy="36" r="5" fill={CORAL} /><circle cx="34" cy="36" r="5" fill="#E5412B" />
          <rect x="14" y="48" width="28" height="5" rx="2.5" fill="#FFD9C8" />
          <rect x="60" y="20" width="40" height="40" rx="8" fill="#fff" stroke="#F3C7B7" />
          <rect x="60" y="20" width="40" height="11" rx="8" fill={CORAL} />
          <text x="80" y="52" textAnchor="middle" fontFamily={SERIF} fontWeight="700" fontSize="16" fill="#1c1917">14</text>
          <g style={{ transformOrigin: "134px 40px", animation: "vyHeart 1.3s ease-in-out infinite", animationDelay: "15.4s" }}>
            <text x="134" y="46" textAnchor="middle" fontSize="22">💍</text>
          </g>
        </svg>
        <div className="vy-cap">{BEATS[4].label}</div>
      </div>
    </div>
  );
}
