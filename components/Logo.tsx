// Venuely brand mark — "V." submark in a rounded square (Poppy on white,
// or white on Poppy). Wordmark is "Venuely." with the signature period.

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={28} />
      <span
        className="text-xl font-bold tracking-tight"
        style={{ color: "var(--poppy)", fontFamily: "'Fraunces', Georgia, serif" }}
      >
        Venuely<span style={{ color: "var(--poppy)" }}>.</span>
      </span>
    </span>
  );
}

export function LogoMark({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Venuely"
    >
      <rect width="64" height="64" rx="16" fill="var(--poppy)" />
      <text
        x="32"
        y="44"
        textAnchor="middle"
        fontFamily="'Fraunces', Georgia, serif"
        fontSize="38"
        fontWeight="700"
        fill="#FFF6F0"
      >
        V.
      </text>
    </svg>
  );
}
