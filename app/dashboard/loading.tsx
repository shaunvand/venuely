// Branded splash shown while /dashboard resolves where the user belongs.
// Server component — pure markup + CSS animations (draw-v / pop in globals.css).
export default function DashboardLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7"
      style={{ background: "var(--cream)" }}
    >
      {/* V. monogram — the V stroke-draws, the dot pops in after. */}
      <svg viewBox="0 0 64 64" width="96" height="96" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="var(--poppy)" />
        <path
          className="draw-v"
          d="M16 18 L30 46 L44 18"
          fill="none"
          stroke="#FFF6F0"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="draw-v-dot" cx="50" cy="42.5" r="3.6" fill="#FFF6F0" />
      </svg>
      <div className="anim-fade-in delay-300 text-center">
        <p className="font-serif text-3xl" style={{ color: "var(--ink)" }}>
          Welcome to Venuely
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
          Getting your dashboard ready…
        </p>
      </div>
    </div>
  );
}
