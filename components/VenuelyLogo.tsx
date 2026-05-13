type Variant = "full" | "mark" | "wordmark";

export function VenuelyLogo({
  variant = "full",
  className,
  color = "#2d4a3a",
}: {
  variant?: Variant;
  className?: string;
  color?: string;
}) {
  if (variant === "mark") {
    return (
      <svg viewBox="0 0 60 72" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Venuely">
        <Mark color={color} />
      </svg>
    );
  }
  if (variant === "wordmark") {
    return (
      <svg viewBox="0 0 320 72" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Venuely">
        <Wordmark color={color} x={0} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 340 72" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Venuely">
      <Mark color={color} />
      <Wordmark color={color} x={76} />
    </svg>
  );
}

function Mark({ color }: { color: string }) {
  // A minimal altar/arch: two pillars + half-circle keystone, intersected by a single horizon line.
  // Centered roughly in a 60x72 frame with even optical padding.
  return (
    <g fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="square">
      {/* horizon */}
      <line x1="6" y1="60" x2="54" y2="60" />
      {/* left pillar */}
      <line x1="14" y1="60" x2="14" y2="30" />
      {/* right pillar */}
      <line x1="46" y1="60" x2="46" y2="30" />
      {/* arch */}
      <path d="M 14 30 A 16 16 0 0 1 46 30" />
      {/* inner mark: small dot at the keystone — a couple's tie point */}
      <circle cx="30" cy="22" r="1.8" fill={color} stroke="none" />
    </g>
  );
}

function Wordmark({ color, x }: { color: string; x: number }) {
  return (
    <text
      x={x}
      y="50"
      fill={color}
      fontFamily="'EB Garamond', Garamond, 'Times New Roman', serif"
      fontSize="44"
      fontWeight="500"
      letterSpacing="0.5"
    >
      Venuely
    </text>
  );
}
