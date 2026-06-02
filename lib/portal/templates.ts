// Couple-portal design templates. Each template is a bundle of presentational
// tokens (fonts, radii, button/tab/hero styles) that the on-venue preview — and,
// later, the live couple portal — render against the venue's chosen theme colours.
// Kept framework-free (plain data) so both a client preview and a server portal
// can consume it.

export type PortalTemplateId = "classic" | "editorial" | "modern" | "romantic";

export type PortalTheme = {
  primary: string;   // brand colour for buttons / accents
  accent: string;    // secondary colour for tints / highlights
  logoUrl?: string | null;
};

export type TemplateTokens = {
  id: PortalTemplateId;
  name: string;
  blurb: string;
  headingFont: string;
  bodyFont: string;
  cardRadius: string;
  buttonRadius: string;
  buttonStyle: "solid" | "outline";
  tabStyle: "underline" | "pill" | "segmented" | "sidebar";
  heroStyle: "overlay" | "framed" | "split";
  surface: string;       // page background tint
  headingItalic?: boolean;
};

const FRAUNCES = "'Fraunces', Georgia, serif";
const SATOSHI = "'Satoshi', system-ui, sans-serif";

export const PORTAL_TEMPLATES: Record<PortalTemplateId, TemplateTokens> = {
  classic: {
    id: "classic",
    name: "Classic",
    blurb: "Warm and timeless — serif headings, soft pill buttons, underlined tabs.",
    headingFont: FRAUNCES,
    bodyFont: SATOSHI,
    cardRadius: "1rem",
    buttonRadius: "999px",
    buttonStyle: "solid",
    tabStyle: "underline",
    heroStyle: "overlay",
    surface: "#FFF6F0",
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    blurb: "Magazine-style — big serif type, square edges, a framed cover image.",
    headingFont: FRAUNCES,
    bodyFont: SATOSHI,
    cardRadius: "0.25rem",
    buttonRadius: "0.25rem",
    buttonStyle: "outline",
    tabStyle: "segmented",
    heroStyle: "framed",
    surface: "#FFFFFF",
  },
  modern: {
    id: "modern",
    name: "Modern",
    blurb: "Clean and bold — sans type, rounded cards, a split hero, segmented tabs.",
    headingFont: SATOSHI,
    bodyFont: SATOSHI,
    cardRadius: "0.9rem",
    buttonRadius: "0.6rem",
    buttonStyle: "solid",
    tabStyle: "segmented",
    heroStyle: "split",
    surface: "#FAFAF9",
  },
  romantic: {
    id: "romantic",
    name: "Romantic",
    blurb: "Soft and pretty — italic serif, very rounded, pastel tints, pill tabs.",
    headingFont: FRAUNCES,
    bodyFont: SATOSHI,
    cardRadius: "1.5rem",
    buttonRadius: "999px",
    buttonStyle: "solid",
    tabStyle: "pill",
    heroStyle: "overlay",
    surface: "#FFF1EA",
    headingItalic: true,
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
  };
}
