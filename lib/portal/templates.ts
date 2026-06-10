// Couple-portal design templates. Each template is a full bundle of
// presentational tokens (fonts, radii, surfaces, nav/hero treatments, dividers,
// chips) that both the venue-side designer preview AND the live couple portal
// render against the venue's chosen theme colours — so what the venue saves is
// exactly what every couple sees (WYSIWYG).
// Kept framework-free (plain data) so both a client preview and a server portal
// can consume it.

export type PortalTemplateId = "classic" | "editorial" | "modern" | "romantic";

export type PortalTheme = {
  primary: string;   // brand colour for buttons / accents
  accent: string;    // secondary colour for tints / highlights
  logoUrl?: string | null;
  coverUrl?: string | null; // hero/cover image for the portal (overrides gallery)
};

export type TemplateTokens = {
  id: PortalTemplateId;
  name: string;
  blurb: string;

  // Type
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  headingLetterSpacing: string;   // applied to all headings
  headingItalic?: boolean;
  eyebrowTracking: string;        // letter-spacing for small uppercase labels
  heroNameTransform?: "uppercase"; // editorial caption-style couple names

  // Shape
  cardRadius: string;
  buttonRadius: string;
  chipRadius: string;

  // Buttons / chips
  buttonStyle: "solid" | "outline";
  buttonCase?: "uppercase";       // editorial buttons are small-caps style
  chipStyle: "tint" | "outline" | "solid"; // filter chips / tags / badges

  // Layout systems
  navStyle: "sidebar" | "tabs" | "segmented" | "pills";
  heroStyle: "overlay" | "framed" | "split" | "arch";

  // Surfaces
  surface: string;     // page background
  surfaceCard: string; // card background
  cardBorder: string;  // card border (CSS border value)
  cardShadow: string;  // card shadow ("none" allowed)
  divider: string;     // hairline rule (CSS border value)
  cardTint?: string;   // hex-alpha of accent layered over white cards (romantic)
  softTopGlow?: boolean; // soft accent fade at the top of the main column
  flourish?: string;   // decorative mark between hero name & date (romantic ✦)
};

const FRAUNCES = "'Fraunces', Georgia, serif";
const SATOSHI = "'Satoshi', system-ui, sans-serif";

export const PORTAL_TEMPLATES: Record<PortalTemplateId, TemplateTokens> = {
  classic: {
    id: "classic",
    name: "Classic",
    blurb: "Warm and timeless — cream surface, serif headings, soft shadows, an elegant full-bleed cover.",
    headingFont: FRAUNCES,
    bodyFont: SATOSHI,
    headingWeight: 600,
    headingLetterSpacing: "0.01em",
    eyebrowTracking: "0.16em",
    cardRadius: "1rem",
    buttonRadius: "999px",
    chipRadius: "999px",
    buttonStyle: "solid",
    chipStyle: "tint",
    navStyle: "sidebar",
    heroStyle: "overlay",
    surface: "#FAF4EC",
    surfaceCard: "#FFFFFF",
    cardBorder: "1px solid rgba(93,64,35,0.10)",
    cardShadow: "0 2px 14px rgba(93,64,35,0.07)",
    divider: "1px solid rgba(93,64,35,0.12)",
    softTopGlow: true,
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    blurb: "Magazine-style — stark white, big serif display type, hairline rules, a matted cover plate, numbered tabs.",
    headingFont: FRAUNCES,
    bodyFont: SATOSHI,
    headingWeight: 700,
    headingLetterSpacing: "-0.015em",
    eyebrowTracking: "0.22em",
    heroNameTransform: "uppercase",
    cardRadius: "0",
    buttonRadius: "0",
    chipRadius: "0",
    buttonStyle: "outline",
    buttonCase: "uppercase",
    chipStyle: "outline",
    navStyle: "tabs",
    heroStyle: "framed",
    surface: "#FFFFFF",
    surfaceCard: "#FFFFFF",
    cardBorder: "1px solid #1c1917",
    cardShadow: "none",
    divider: "1px solid #1c1917",
  },
  modern: {
    id: "modern",
    name: "Modern",
    blurb: "Clean and bold — all sans, heavy weights, bordered rounded cards, a split colour-block hero, segmented tabs.",
    headingFont: SATOSHI,
    bodyFont: SATOSHI,
    headingWeight: 800,
    headingLetterSpacing: "-0.02em",
    eyebrowTracking: "0.1em",
    cardRadius: "1.1rem",
    buttonRadius: "0.65rem",
    chipRadius: "0.55rem",
    buttonStyle: "solid",
    chipStyle: "solid",
    navStyle: "segmented",
    heroStyle: "split",
    surface: "#F4F4F1",
    surfaceCard: "#FFFFFF",
    cardBorder: "1.5px solid #E5E3DC",
    cardShadow: "none",
    divider: "1px solid #E5E3DC",
  },
  romantic: {
    id: "romantic",
    name: "Romantic",
    blurb: "Soft and dreamy — blush surface, italic serif, an arched cover, pastel-tinted cards, pill tabs.",
    headingFont: FRAUNCES,
    bodyFont: SATOSHI,
    headingWeight: 500,
    headingLetterSpacing: "0.01em",
    headingItalic: true,
    eyebrowTracking: "0.2em",
    cardRadius: "1.5rem",
    buttonRadius: "999px",
    chipRadius: "999px",
    buttonStyle: "solid",
    chipStyle: "tint",
    navStyle: "pills",
    heroStyle: "arch",
    surface: "#FBEFEA",
    surfaceCard: "#FFFCFB",
    cardBorder: "1px solid rgba(190,120,110,0.16)",
    cardShadow: "0 6px 22px rgba(190,120,110,0.10)",
    divider: "1px solid rgba(190,120,110,0.22)",
    cardTint: "12",
    softTopGlow: true,
    flourish: "✦",
  },
};

export const PORTAL_TEMPLATE_LIST = Object.values(PORTAL_TEMPLATES);

export const DEFAULT_PORTAL_TEMPLATE: PortalTemplateId = "classic";
export const DEFAULT_PORTAL_THEME: PortalTheme = { primary: "#FA523C", accent: "#FFC6AD", logoUrl: null };

export function resolveTemplate(id: string | null | undefined): TemplateTokens {
  return PORTAL_TEMPLATES[(id as PortalTemplateId)] ?? PORTAL_TEMPLATES[DEFAULT_PORTAL_TEMPLATE];
}

export function resolveTheme(raw: unknown): PortalTheme {
  const t = (raw ?? {}) as Partial<PortalTheme>;
  return {
    primary: typeof t.primary === "string" && t.primary ? t.primary : DEFAULT_PORTAL_THEME.primary,
    accent: typeof t.accent === "string" && t.accent ? t.accent : DEFAULT_PORTAL_THEME.accent,
    logoUrl: typeof t.logoUrl === "string" && t.logoUrl ? t.logoUrl : null,
    coverUrl: typeof t.coverUrl === "string" && t.coverUrl ? t.coverUrl : null,
  };
}
