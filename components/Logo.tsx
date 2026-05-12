export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Arch — animates in on first paint */}
        <path
          d="M5 28 L5 14 A11 11 0 0 1 27 14 L27 28"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="logo-arch"
        />
        {/* Two columns base */}
        <circle cx="5" cy="28" r="1.6" fill="currentColor" />
        <circle cx="27" cy="28" r="1.6" fill="currentColor" />
        {/* Heart-leaf at the apex */}
        <path
          d="M16 11 C 14 8.5, 11 9, 11 11.5 C 11 13.5, 16 17, 16 17 C 16 17, 21 13.5, 21 11.5 C 21 9, 18 8.5, 16 11 Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
      <span className="font-serif text-xl tracking-tight">Venuely</span>
    </span>
  );
}

export function LogoMark({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 28 L5 14 A11 11 0 0 1 27 14 L27 28"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="5" cy="28" r="1.6" fill="currentColor" />
      <circle cx="27" cy="28" r="1.6" fill="currentColor" />
      <path
        d="M16 11 C 14 8.5, 11 9, 11 11.5 C 11 13.5, 16 17, 16 17 C 16 17, 21 13.5, 21 11.5 C 21 9, 18 8.5, 16 11 Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}
