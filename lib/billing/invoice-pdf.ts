import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { resolveInvoiceTemplate, resolveInvoiceTheme, type InvoiceTokens } from "@/lib/invoice/templates";

// Generates the venue's proforma-invoice PDF, styled to the venue's SAVED invoice
// template (Classic / Minimal / Bold / Elegant) + theme accent + logo, with the
// venue's own details (name, address, contact, banking) — so the couple gets the
// venue's branded invoice, not a generic one. Pure pdf-lib (serverless-safe).

export type InvoicePdfInput = {
  // Venue identity + template
  venueName: string;
  venueAddress?: string | null;
  venueEmail?: string | null;
  venuePhone?: string | null;
  templateId?: string | null;     // venues.invoice_template
  theme?: unknown;                 // venues.invoice_theme (jsonb: accent + logo)
  logoFallbackUrl?: string | null; // venues.branding_logo_url
  // Wedding / amounts
  coupleNames: string;
  weddingDate?: string | null;
  reference?: string | null;
  lineItems: Array<{ label: string; amount: number }>;
  total: number;
  paid: number;
  balance: number;
  amountDueNow?: number | null;
  amountDueLabel?: string | null;
  dueDate?: string | null;
  banking?: {
    bank_name?: string | null; account_name?: string | null; account_number?: string | null;
    branch_code?: string | null; swift?: string | null; iban?: string | null;
  } | null;
};

const INK = rgb(0.11, 0.1, 0.09);
const MUTED = rgb(0.42, 0.4, 0.38);
const LINE = rgb(0.9, 0.87, 0.84);
const WHITE = rgb(1, 1, 1);

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return rgb(0.98, 0.32, 0.24);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
// Lighten an accent toward white for subtle fills (≈10% accent).
function tintAccent(c: RGB): RGB {
  const mix = (v: number) => 1 - (1 - v) * 0.12;
  return rgb(mix(c.red), mix(c.green), mix(c.blue));
}
// Word-wrap to a max width, returning up to `maxLines` lines.
function wrapText(s: string, font: PDFFont, size: number, maxW: number, maxLines: number): string[] {
  const words = String(s ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxW && cur) {
      lines.push(cur); cur = w;
      if (lines.length === maxLines - 1) break;
    } else cur = next;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}
const rand = (n: number) => `R ${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;
function fmtDate(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
}

async function fetchLogo(pdf: PDFDocument, url?: string | null) {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const buf = new Uint8Array(await res.arrayBuffer());
    if (ct.includes("png") || url.toLowerCase().endsWith(".png")) return await pdf.embedPng(buf);
    if (ct.includes("jpeg") || ct.includes("jpg") || /\.jpe?g($|\?)/i.test(url)) return await pdf.embedJpg(buf);
    return null; // svg/webp not supported by pdf-lib → fall back to name
  } catch { return null; }
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<{ base64: string; filename: string }> {
  const tpl: InvoiceTokens = resolveInvoiceTemplate(input.templateId);
  const theme = resolveInvoiceTheme(input.theme);
  const accent = hexToRgb(theme.accent);
  const serif = tpl.headingFont.includes("Fraunces"); // classic/elegant → serif heading

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const sansB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serifB = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const headFont = serif ? serifB : sansB;
  const logo = await fetchLogo(pdf, theme.logoUrl || input.logoFallbackUrl);

  const M = 50;
  const text = (s: string, x: number, y: number, size: number, font: PDFFont = reg, color: RGB = INK) =>
    page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xRight: number, y: number, size: number, font: PDFFont = reg, color: RGB = INK) =>
    page.drawText(s, { x: xRight - font.widthOfTextAtSize(s, size), y, size, font, color });
  // Fit the logo inside a box (max width AND height), preserving aspect ratio —
  // a wide/landscape logo previously kept full height and an unbounded width, so
  // it ran off the page edge (cropped) or collided with the right-hand "INVOICE".
  const LOGO_MAX_W = 170; // mirrors the HTML/email preview's max-width
  const drawLogo = (p: PDFPage, x: number, y: number, h: number) => {
    if (!logo) return 0;
    let w = (logo.width / logo.height) * h;
    let hh = h;
    if (w > LOGO_MAX_W) { hh = hh * (LOGO_MAX_W / w); w = LOGO_MAX_W; }
    p.drawImage(logo, { x, y: y - hh, width: w, height: hh });
    return w;
  };

  let y = height - 50;

  // ---------- Header (per template's headerStyle) ----------
  if (tpl.headerStyle === "band") {
    // Full-width accent band, venue name + INVOICE in white.
    page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: accent });
    if (logo) drawLogo(page, M, height - 30, 36);
    else text(input.venueName, M, height - 56, 22, headFont, WHITE);
    right("INVOICE", width - M, height - 56, 16, sansB, WHITE);
    y = height - 130;
  } else if (tpl.headerStyle === "split") {
    // Logo / initial circle left; INVOICE + venue name right.
    if (logo) drawLogo(page, M, y, 40);
    else {
      page.drawCircle({ x: M + 20, y: y - 20, size: 20, color: accent });
      text((input.venueName.trim()[0] || "V").toUpperCase(), M + 13, y - 27, 20, serifB, WHITE);
    }
    right("INVOICE", width - M, y - 6, 16, headFont, accent);
    right(input.venueName, width - M, y - 26, 11, reg, MUTED);
    y -= 64;
  } else if (tpl.headerStyle === "plain") {
    // Minimal: small-caps venue name, hairline rule, lots of air.
    if (logo) drawLogo(page, M, y, 30);
    else text(input.venueName.toUpperCase(), M, y - 12, 12, sansB, INK);
    right("INVOICE", width - M, y - 12, 12, sansB, MUTED);
    y -= 30;
    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.7, color: LINE });
    y -= 30;
  } else {
    // Classic "rule": venue name in serif + accent rule under the header.
    if (logo) drawLogo(page, M, y, 36);
    else text(input.venueName, M, y - 6, 20, serifB, INK);
    right("PROFORMA INVOICE", width - M, y - 6, 12, sansB, accent);
    y -= 24;
    page.drawRectangle({ x: M, y, width: width - 2 * M, height: 2.5, color: accent });
    y -= 26;
  }

  // ---------- Venue contact (FROM) + bill-to ----------
  const fromColW = 250; // keep FROM clear of the right-hand BILLED TO column
  text("FROM", M, y, 8, sansB, MUTED);
  let fy = y - 14;
  text(input.venueName, M, fy, 11, sansB, INK); fy -= 14;
  for (const al of wrapText(String(input.venueAddress ?? "").trim(), reg, 9.5, fromColW, 2)) { text(al, M, fy, 9.5, reg, MUTED); fy -= 12; }
  if (input.venueEmail) { text(String(input.venueEmail).trim(), M, fy, 9.5, reg, MUTED); fy -= 12; }
  if (input.venuePhone) { text(String(input.venuePhone).trim(), M, fy, 9.5, reg, MUTED); fy -= 12; }

  right("BILLED TO", width - M, y, 8, sansB, MUTED);
  right(input.coupleNames, width - M, y - 14, 11, sansB, INK);
  if (input.weddingDate) right(`Wedding: ${fmtDate(input.weddingDate)}`, width - M, y - 28, 9.5, reg, MUTED);
  if (input.reference) right(`Ref: ${input.reference}`, width - M, y - 42, 9.5, reg, MUTED);
  y = Math.min(fy, y - 56) - 16;

  // ---------- Line items ----------
  const accentTable = tpl.accentOn === "all" || tpl.accentOn === "header";
  // header row
  if (tpl.tableStyle === "striped" || accentTable) {
    page.drawRectangle({ x: M, y: y - 6, width: width - 2 * M, height: 22, color: accent });
    text("DESCRIPTION", M + 10, y, 8, sansB, WHITE);
    right("AMOUNT", width - M - 10, y, 8, sansB, WHITE);
  } else {
    text("DESCRIPTION", M, y, 8, sansB, MUTED);
    right("AMOUNT", width - M, y, 8, sansB, MUTED);
    page.drawLine({ start: { x: M, y: y - 6 }, end: { x: width - M, y: y - 6 }, thickness: 1, color: LINE });
  }
  y -= 28;

  const rows = input.lineItems.length ? input.lineItems : [{ label: "Wedding package", amount: input.total }];
  rows.forEach((li, i) => {
    // Start a fresh page when we run low — was resetting y to the top of the SAME
    // page, drawing rows over the header.
    if (y < 90) { page = pdf.addPage([595.28, 841.89]); y = height - 60; }
    if (tpl.tableStyle === "striped" && i % 2 === 1) {
      page.drawRectangle({ x: M, y: y - 6, width: width - 2 * M, height: 20, color: rgb(0.97, 0.95, 0.93) });
    }
    text(li.label.slice(0, 60), M + (tpl.tableStyle === "striped" ? 10 : 0), y, 11, reg, INK);
    const amt = li.amount > 0 ? rand(li.amount) : "Included";
    right(amt, width - M - (tpl.tableStyle === "striped" ? 10 : 0), y, 11, reg, li.amount > 0 ? INK : MUTED);
    if (tpl.tableStyle === "lined") page.drawLine({ start: { x: M, y: y - 8 }, end: { x: width - M, y: y - 8 }, thickness: 0.5, color: LINE });
    y -= 22;
  });

  // ---------- Totals — compact, right-aligned block ----------
  y -= 12;
  const tLeft = width - M - 220;        // totals block ~220pt wide, pinned right
  const totalAccent = tpl.accentOn === "total" || tpl.accentOn === "all" ? accent : INK;
  page.drawLine({ start: { x: tLeft, y }, end: { x: width - M, y }, thickness: 1, color: LINE });
  y -= 20;
  const row = (label: string, val: number, strong = false, col: RGB = INK, valCol: RGB = MUTED) => {
    text(label, tLeft, y, strong ? 11.5 : 10, strong ? sansB : reg, strong ? col : MUTED);
    right(rand(val), width - M, y, strong ? 12 : 10, strong ? sansB : reg, strong ? valCol : MUTED);
    y -= strong ? 21 : 17;
  };
  row("Total", input.total, true, INK, INK);
  if (input.paid > 0) row("Paid", input.paid);
  row("Balance outstanding", input.balance, true, INK, totalAccent);
  if (typeof input.amountDueNow === "number" && input.amountDueNow > 0 && input.amountDueLabel) {
    // Amount-due row gets an accent bar to stand out.
    y -= 2;
    page.drawRectangle({ x: tLeft - 8, y: y - 5, width: width - M - tLeft + 8, height: 24, color: tintAccent(accent) });
    const label = input.amountDueLabel + (input.dueDate ? ` (by ${fmtDate(input.dueDate)})` : "");
    text(label, tLeft, y, 11.5, sansB, INK);
    right(rand(input.amountDueNow), width - M, y, 12.5, sansB, accent);
    y -= 26;
  }

  // ---------- Banking (left-aligned, directly under, consistent gap) ----------
  const b = input.banking;
  if (b && (b.account_number || b.bank_name)) {
    const lines: Array<[string, string | null | undefined]> = [
      ["Account name", b.account_name], ["Bank", b.bank_name], ["Account number", b.account_number],
      ["Branch code", b.branch_code], ["SWIFT", b.swift], ["IBAN", b.iban],
    ].filter(([, v]) => v) as Array<[string, string]>;
    const boxH = 30 + lines.length * 15;
    y -= 22;
    page.drawRectangle({ x: M, y: y - boxH, width: width - 2 * M, height: boxH, borderColor: LINE, borderWidth: 1, color: rgb(0.99, 0.976, 0.96) });
    page.drawRectangle({ x: M, y: y - boxH, width: 3, height: boxH, color: accent });
    text("BANKING DETAILS (EFT)", M + 18, y - 18, 8, sansB, accent);
    let by = y - 36;
    for (const [k, v] of lines) { text(k, M + 18, by, 9, reg, MUTED); text(String(v), M + 150, by, 10, sansB, INK); by -= 15; }
  }

  text(`Please use the reference "${input.reference ?? input.coupleNames}" when paying. Thank you.`, M, 40, 9, reg, MUTED);

  const bytes = await pdf.save();
  const base64 = Buffer.from(bytes).toString("base64");
  const safe = input.coupleNames.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "wedding";
  return { base64, filename: `Invoice-${safe}.pdf` };
}
