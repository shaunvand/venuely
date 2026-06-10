// Invoice design templates — how the EFT invoice couples receive looks. Plain
// style tokens consumed by the on-billing preview (and, later, the generated
// invoice document).

export type InvoiceTemplateId = "classic" | "minimal" | "bold" | "elegant";

export type InvoiceTheme = {
  accent: string;
  logoUrl?: string | null;
};

export type InvoiceTokens = {
  id: InvoiceTemplateId;
  name: string;
  blurb: string;
  headingFont: string;
  bodyFont: string;
  headerStyle: "band" | "rule" | "plain" | "split"; // top-of-invoice treatment
  tableStyle: "striped" | "lined" | "minimal";
  accentOn: "header" | "total" | "all";
};

const FRAUNCES = "'Fraunces', Georgia, serif";
const SATOSHI = "'Satoshi', system-ui, sans-serif";

export const INVOICE_TEMPLATES: Record<InvoiceTemplateId, InvoiceTokens> = {
  classic: {
    id: "classic", name: "Classic", blurb: "Serif heading, accent rule, lined table — timeless and clear.",
    headingFont: FRAUNCES, bodyFont: SATOSHI, headerStyle: "rule", tableStyle: "lined", accentOn: "header",
  },
  minimal: {
    id: "minimal", name: "Minimal", blurb: "Lots of whitespace, hairline rules, accent only on the total.",
    headingFont: SATOSHI, bodyFont: SATOSHI, headerStyle: "plain", tableStyle: "minimal", accentOn: "total",
  },
  bold: {
    id: "bold", name: "Bold", blurb: "Full-width accent header band, striped rows — strong and modern.",
    headingFont: SATOSHI, bodyFont: SATOSHI, headerStyle: "band", tableStyle: "striped", accentOn: "all",
  },
  elegant: {
    id: "elegant", name: "Elegant", blurb: "Split header with logo, italic serif accents — refined.",
    headingFont: FRAUNCES, bodyFont: SATOSHI, headerStyle: "split", tableStyle: "lined", accentOn: "header",
  },
};

export const INVOICE_TEMPLATE_LIST = Object.values(INVOICE_TEMPLATES);
export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplateId = "classic";
export const DEFAULT_INVOICE_THEME: InvoiceTheme = { accent: "#FA523C", logoUrl: null };

export function resolveInvoiceTemplate(id: string | null | undefined): InvoiceTokens {
  return INVOICE_TEMPLATES[(id as InvoiceTemplateId)] ?? INVOICE_TEMPLATES[DEFAULT_INVOICE_TEMPLATE];
}
export function resolveInvoiceTheme(raw: unknown): InvoiceTheme {
  const t = (raw ?? {}) as Partial<InvoiceTheme>;
  return {
    accent: typeof t.accent === "string" && t.accent ? t.accent : DEFAULT_INVOICE_THEME.accent,
    logoUrl: typeof t.logoUrl === "string" && t.logoUrl ? t.logoUrl : null,
  };
}

// --- Shared helpers (email renderer + on-screen designer preview) -----------
// Pure functions only — this module is imported by the client InvoiceDesigner,
// so nothing server-only may live here.

// Web-safe stacks for email clients (no webfonts there): Fraunces ≈ Georgia
// serif, Satoshi ≈ Helvetica/Arial.
export const EMAIL_SERIF = "Georgia, 'Times New Roman', serif";
export const EMAIL_SANS = "Helvetica, Arial, sans-serif";
export function emailFontStack(font: string): string {
  return font.includes("Fraunces") ? EMAIL_SERIF : EMAIL_SANS;
}

// Blend the accent toward white by `ratio` (0..1) and return a SOLID hex —
// the email-safe substitute for rgba()/8-digit-hex opacity. Used for striped
// rows (~8%) and the accented table header (~12%) in BOTH the email renderer
// and the designer preview, so the two stay visually identical.
export function tintFromAccent(accent: string, ratio: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((accent || "").trim());
  if (!m) return "#f5f5f4";
  const n = parseInt(m[1], 16);
  const ch = (c: number) => Math.round(255 - (255 - c) * ratio);
  const v = (ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255);
  return `#${v.toString(16).padStart(6, "0")}`;
}
