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
