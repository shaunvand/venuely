// Couple-portal design templates. Each template is a full bundle of
// presentational tokens (fonts, radii, surfaces, nav/hero treatments, dividers,
// chips) that both the venue-side designer preview AND the live couple portal
// render against the venue's chosen theme colours — so what the venue saves is
// exactly what every couple sees (WYSIWYG).
//
// IMPORTANT: "classic" is the untouched default portal look. Its token values
// mirror the portal's original hardcoded styles, and the portal components keep
// a dedicated classic code path — the other three templates are conditional
// departures from that baseline.
//
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
  headingItalic?: boolean;
  headingWeight?: number;         // omitted on classic (keeps original inherit behaviour)
  headingLetterSpacing?: string;  // omitted on classic
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
  navStyle: "sidebar" | "top-tabs" | "segmented" | "pills";
  heroStyle: "overlay" | "framed" | "split" | "arch";

  // Surfaces
  surface: string;     // page background
  mainBg: string;      // main-column background (may be a gradient glow)
  surfaceCard: string; // card background
  cardBorder: string;  // card border (CSS border value)
  cardShadow: string;  // card shadow ("none" allowed)
  divider: string;     // hairline rule (CSS border value)
  cardTint?: string;   // hex-alpha of accent layered over white cards (romantic)
  flourish?: string;   // decorative mark between hero name & date (romantic ✦)
};

const FRAUNCES = "'Fraunces', Georgia, serif";
const SATOSHI = "'Satoshi', system-ui, sans-serif";

export const PORTAL_TEMPLATES: Record<PortalTemplateId, TemplateTokens> = {
  classic: {
    id: "classic",
    name: "Classic",
    blurb: "The original portal — left sidebar nav, full-photo cover with overlaid names, warm cream surface, serif headings, pill buttons.",
    headingFont: FRAUNCES,
    bodyFont: SATOSHI,
    eyebrowTracking: "1px",
    cardRadius: "1rem",
    buttonRadius: "999px",
    chipRadius: "999px",
    buttonStyle: "solid",
    chipStyle: "tint",
    navStyle: "sidebar",
    heroStyle: "overlay",
    surface: "var(--cream, #FBF7F2)",
    mainBg: "linear-gradient(180deg, #FCE7DA 0%, var(--cream, #FBF7F2) 300px)",
    surfaceCard: "#FFFFFF",
    cardBorder: "1px solid rgba(0,0,0,0.08)",
    cardShadow: "none",
    divider: "1px solid var(--line, #ece7e1)",
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    blurb: "Magazine-style — numbered tabs across the top (no sidebar), a framed matted cover with caption names below, stark white surface, hairline ink rules, big serif display type, outline buttons.",
    headingFont: FRAUNCES,
    bodyFont: SATOSHI,
    headingWeight: 700,
    headingLetterSpacing: "-0.015em",
    eyebrowTracking: "0.22em",
    heroNameTransform: "uppercase",
    cardRadius: "3px",
    buttonRadius: "3px",
    chipRadius: "3px",
    buttonStyle: "outline",
    buttonCase: "uppercase",
    chipStyle: "outline",
    navStyle: "top-tabs",
    heroStyle: "framed",
    surface: "#FFFFFF",
    mainBg: "#FFFFFF",
    surfaceCard: "#FFFFFF",
    cardBorder: "1px solid #1c1917",
    cardShadow: "none",
    divider: "1px solid #1c1917",
  },
  modern: {
    id: "modern",
    name: "Modern",
    blurb: "App-like — segmented pill-group nav across the top, a split hero (colour block + photo) with a countdown chip, light neutral surface, bold all-sans type, bordered rounded cards.",
    headingFont: SATOSHI,
    bodyFont: SATOSHI,
    headingWeight: 800,
    headingLetterSpacing: "-0.02em",
    eyebrowTracking: "0.1em",
    cardRadius: "1rem",
    buttonRadius: "0.5rem",
    chipRadius: "0.5rem",
    buttonStyle: "solid",
    chipStyle: "solid",
    navStyle: "segmented",
    heroStyle: "split",
    surface: "#FAFAF9",
    mainBg: "#FAFAF9",
    surfaceCard: "#FFFFFF",
    cardBorder: "1.5px solid #E7E5E4",
    cardShadow: "none",
    divider: "1px solid #E7E5E4",
  },
  romantic: {
    id: "romantic",
    name: "Romantic",
    blurb: "Soft and dreamy — rounded pill tabs across the top, an arch-shaped cover photo with italic names and a ✦ flourish beneath, blush surface, pastel-tinted very-rounded cards.",
    headingFont: FRAUNCES,
    bodyFont: SATOSHI,
    headingItalic: true,
    headingWeight: 500,
    headingLetterSpacing: "0.01em",
    eyebrowTracking: "0.2em",
    cardRadius: "22px",
    buttonRadius: "999px",
    chipRadius: "999px",
    buttonStyle: "solid",
    chipStyle: "tint",
    navStyle: "pills",
    heroStyle: "arch",
    surface: "#FFF1EA",
    mainBg: "linear-gradient(180deg, #FFE7DB 0%, #FFF1EA 300px)",
    surfaceCard: "#FFFCFB",
    cardBorder: "1px solid rgba(190,120,110,0.16)",
    cardShadow: "0 6px 22px rgba(190,120,110,0.10)",
    divider: "1px solid rgba(190,120,110,0.22)",
    cardTint: "12",
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
