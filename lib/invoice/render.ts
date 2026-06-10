// Email renderer for the EFT invoice couples receive. Framework-free string
// builder producing EMAIL-SAFE HTML: nested tables, fully inline styles, no
// external CSS, no flex/grid, web-safe font stacks (Fraunces→Georgia/serif,
// Satoshi→Helvetica/Arial). Implements the four Invoice Designer templates
// (classic/minimal/bold/elegant) from lib/invoice/templates.ts so the email a
// couple receives matches the preview the venue approved on the billing page.
//
// Template semantics (must stay in lock-step with InvoiceDesigner's preview):
//   headerStyle "rule"  (classic) — venue name in serif, thin accent rule under header
//   headerStyle "plain" (minimal) — generous whitespace, small-caps venue name,
//                                   hairline dividers, accent ONLY on the total row
//   headerStyle "band"  (bold)    — full-width accent band, white text, striped rows
//                                   (alternate bg = accent tinted to ~8% on white)
//   headerStyle "split" (elegant) — logo left (or venue-initial circle), invoice
//                                   meta right, italic serif accents
//   tableStyle striped/lined/minimal — alternate bg / border-bottom each row /
//                                   no rules except header + total
//   accentOn header/total/all     — where the accent colour appears

import {
  EMAIL_SANS, emailFontStack, resolveInvoiceTemplate, resolveInvoiceTheme, tintFromAccent,
} from "./templates";

const INK = "#1c1917";
const INK2 = "#57534e";
const INK3 = "#78716c";
const LINE = "#e7e5e4";
const CREAM = "#FFF6F0";

export type InvoiceLineItem = {
  description: string;
  /** Shown only when provided (the Qty column is omitted when no line has one). */
  qty?: number | null;
  /** Rands. 0 renders as "Included". */
  amount: number;
};

export type InvoiceScheduleRow = {
  /** Row label, e.g. "Deposit (50%)" — defaults per slot. */
  label?: string;
  amount: number;
  /** Small sub-line under the label, e.g. "Due by 14 Oct 2025". */
  dueLabel?: string | null;
};

export type InvoiceBankDetails = {
  accountName?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  branchCode?: string | null;
  swift?: string | null;
  iban?: string | null;
};

export type RenderInvoiceEmailOpts = {
  /** venues.invoice_template — unknown/null falls back to the default template. */
  templateId?: string | null;
  /** venues.invoice_theme (raw jsonb) — accent colour + logo override. */
  theme?: unknown;
  /** venues.branding_logo_url — used when the invoice theme carries no logo. */
  logoFallbackUrl?: string | null;
  venueName: string;
  coupleNames: string;
  /** Pre-formatted, e.g. "14 Dec 2025". */
  weddingDateLabel?: string | null;
  invoiceRef: string;
  /** Pre-formatted issue date for the header meta line. */
  issueDateLabel?: string | null;
  items?: InvoiceLineItem[];
  subtotal?: number | null;
  total: number;
  paidToDate?: number | null;
  deposit?: InvoiceScheduleRow | null;
  balance?: InvoiceScheduleRow | null;
  bank: InvoiceBankDetails;
  portalUrl?: string | null;
};

const rZA = (n: number) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;

export function formatDateZA(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(String(date).slice(0, 10));
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderInvoiceEmailHtml(opts: RenderInvoiceEmailOpts): string {
  const tokens = resolveInvoiceTemplate(opts.templateId);
  const theme = resolveInvoiceTheme(opts.theme);
  const accent = theme.accent;
  const logoUrl = theme.logoUrl ?? opts.logoFallbackUrl ?? null;
  const headFont = emailFontStack(tokens.headingFont);
  const bodyFont = emailFontStack(tokens.bodyFont);
  // Minimal gets generous whitespace; the others keep the standard gutter.
  const padX = tokens.headerStyle === "plain" ? 32 : 24;

  const venue = esc(opts.venueName);
  const couple = esc(opts.coupleNames);
  const meta = `#${esc(opts.invoiceRef)}${opts.issueDateLabel ? ` &middot; ${esc(opts.issueDateLabel)}` : ""}`;
  const logoImg = (height: number) =>
    `<img src="${esc(logoUrl)}" alt="${venue}" height="${height}" style="display:block;height:${height}px;max-width:170px;border:0" />`;

  // --- Header (the four template treatments) -------------------------------
  let header = "";
  if (tokens.headerStyle === "band") {
    // bold: full-width accent band, white text.
    header = `
    <tr><td style="background:${accent};border-radius:12px 12px 0 0;padding:20px ${padX}px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">${logoUrl ? logoImg(36) : `<span style="font-family:${headFont};font-size:18px;font-weight:600;color:#ffffff">${venue}</span>`}</td>
        <td align="right" style="vertical-align:middle">
          <div style="font-family:${headFont};font-size:22px;font-weight:700;letter-spacing:2px;color:#ffffff">INVOICE</div>
          <div style="font-family:${bodyFont};font-size:12px;color:#ffffff;opacity:.9">${meta}</div>
        </td>
      </tr></table>
    </td></tr>`;
  } else if (tokens.headerStyle === "split") {
    // elegant: logo left (or venue-initial circle), italic serif meta right.
    const initial = esc((opts.venueName.trim()[0] || "V").toUpperCase());
    header = `
    <tr><td style="padding:28px ${padX}px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top">
          ${logoUrl ? logoImg(40) : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:44px;height:44px;border-radius:50%;background:${accent};color:#ffffff;font-family:${headFont};font-size:18px;font-weight:700">${initial}</td></tr></table>`}
          <div style="font-family:${bodyFont};font-size:12px;color:${INK2};margin-top:8px">${venue}</div>
        </td>
        <td align="right" style="vertical-align:top">
          <div style="font-family:${headFont};font-style:italic;font-size:26px;color:${tokens.accentOn === "total" ? INK : accent}">Invoice</div>
          <div style="font-family:${bodyFont};font-size:12px;color:${INK2}">${meta}</div>
        </td>
      </tr></table>
    </td></tr>`;
  } else if (tokens.headerStyle === "plain") {
    // minimal: small-caps venue name, hairline divider, lots of air.
    header = `
    <tr><td style="padding:36px ${padX}px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">${logoUrl ? logoImg(32) : `<span style="font-family:${bodyFont};font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${INK}">${venue}</span>`}</td>
        <td align="right" style="vertical-align:middle">
          <div style="font-family:${bodyFont};font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${INK}">Invoice</div>
          <div style="font-family:${bodyFont};font-size:12px;color:${INK3}">${meta}</div>
        </td>
      </tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr>
        <td style="height:1px;background:${LINE};font-size:0;line-height:1px">&nbsp;</td>
      </tr></table>
    </td></tr>`;
  } else {
    // classic ("rule"): venue name in serif, thin accent rule under the header.
    header = `
    <tr><td style="padding:24px ${padX}px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">${logoUrl ? logoImg(36) : `<span style="font-family:${headFont};font-size:20px;font-weight:600;color:${INK}">${venue}</span>`}</td>
        <td align="right" style="vertical-align:middle">
          <div style="font-family:${headFont};font-size:20px;font-weight:700;letter-spacing:1px;color:${INK}">INVOICE</div>
          <div style="font-family:${bodyFont};font-size:12px;color:${INK2}">${meta}</div>
        </td>
      </tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>
        <td style="height:3px;background:${accent};font-size:0;line-height:3px">&nbsp;</td>
      </tr></table>
    </td></tr>`;
  }

  // --- Greeting + billed-to -------------------------------------------------
  const greeting = `
    <tr><td style="padding:18px ${padX}px 0;font-family:${bodyFont}">
      <p style="margin:0 0 4px;font-size:14px;color:${INK}">Hi ${couple},</p>
      <p style="margin:0;font-size:13px;color:${INK2}">Your selections have been confirmed. Please settle the total below by EFT directly to ${venue}.</p>
    </td></tr>
    <tr><td style="padding:16px ${padX}px 0;font-family:${bodyFont};font-size:13px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${INK3}">Billed to</div>
          <div style="font-weight:600;color:${INK}">${couple}</div>
          ${opts.weddingDateLabel ? `<div style="color:${INK2}">Wedding &middot; ${esc(opts.weddingDateLabel)}</div>` : ""}
        </td>
        <td align="right" style="vertical-align:top">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${INK3}">From</div>
          <div style="font-weight:600;color:${INK}">${venue}</div>
        </td>
      </tr></table>
    </td></tr>`;

  // --- Line items table -----------------------------------------------------
  const items = opts.items ?? [];
  const showQty = items.some((i) => i.qty != null);
  const headBorder = tokens.tableStyle === "minimal" ? `1px solid ${LINE}` : `1px solid ${accent}`;
  const headBg = tokens.accentOn === "all" ? `background:${tintFromAccent(accent, 0.12)};` : "";
  const cellPadX = tokens.tableStyle === "striped" || tokens.accentOn === "all" ? "8px" : "0";
  const rowExtras = (idx: number) => {
    const stripe = tokens.tableStyle === "striped" && idx % 2 === 1 ? `background:${tintFromAccent(accent, 0.08)};` : "";
    const line = tokens.tableStyle === "lined" ? `border-bottom:1px solid ${LINE};` : "";
    return stripe + line;
  };
  const th = (label: string, align: "left" | "right", width?: string) =>
    `<th align="${align}" style="${headBg}padding:7px ${cellPadX};border-bottom:${headBorder};font-family:${bodyFont};font-size:12px;font-weight:700;color:${INK};${width ? `width:${width};` : ""}">${label}</th>`;
  const itemRows = items.map((it, idx) => {
    const cell = `padding:7px ${cellPadX};font-family:${bodyFont};font-size:13px;color:${INK};${rowExtras(idx)}`;
    const amount = it.amount > 0 ? rZA(it.amount) : `<span style="color:${INK2};font-style:italic">Included</span>`;
    return `<tr>
      <td style="${cell}">${esc(it.description)}</td>
      ${showQty ? `<td align="right" style="${cell}">${it.qty != null ? esc(String(it.qty)) : ""}</td>` : ""}
      <td align="right" style="${cell}">${amount}</td>
    </tr>`;
  }).join("");
  const itemsBlock = items.length ? `
    <tr><td style="padding:16px ${padX}px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>${th("Description", "left")}${showQty ? th("Qty", "right", "50px") : ""}${th("Amount", "right", "110px")}</tr>
        ${itemRows}
      </table>
    </td></tr>` : "";

  // --- Totals (subtotal / paid / deposit / balance / total) ------------------
  const trow = (label: string, value: string, dueLabel?: string | null) => `
    <tr>
      <td style="padding:4px 8px 4px 0;font-family:${bodyFont};font-size:13px;color:${INK2}">${esc(label)}${dueLabel ? `<div style="font-size:11px;color:${INK3}">${esc(dueLabel)}</div>` : ""}</td>
      <td align="right" style="padding:4px 0;font-family:${bodyFont};font-size:13px;color:${INK};vertical-align:top">${value}</td>
    </tr>`;
  let totalsRows = "";
  if (opts.subtotal != null && items.length) totalsRows += trow("Subtotal", rZA(opts.subtotal));
  if (opts.paidToDate) totalsRows += trow("Paid to date", `&minus;${rZA(opts.paidToDate)}`);
  if (opts.deposit && opts.deposit.amount > 0) totalsRows += trow(opts.deposit.label ?? "Deposit", rZA(opts.deposit.amount), opts.deposit.dueLabel);
  if (opts.balance && opts.balance.amount > 0) totalsRows += trow(opts.balance.label ?? "Balance due", rZA(opts.balance.amount), opts.balance.dueLabel);
  // accentOn "header" templates keep a neutral ink total; "total"/"all" use the accent.
  const totalBg = tokens.accentOn === "header" ? INK : accent;
  totalsRows += `
    <tr><td colspan="2" style="height:6px;font-size:0;line-height:0">&nbsp;</td></tr>
    <tr>
      <td style="padding:8px 10px;background:${totalBg};border-radius:6px 0 0 6px;font-family:${bodyFont};font-size:13px;font-weight:700;color:#ffffff">Total due</td>
      <td align="right" style="padding:8px 10px;background:${totalBg};border-radius:0 6px 6px 0;font-family:${bodyFont};font-size:13px;font-weight:700;color:#ffffff">${rZA(opts.total)}</td>
    </tr>`;
  const totalsBlock = `
    <tr><td align="right" style="padding:10px ${padX}px 0">
      <table role="presentation" width="280" cellpadding="0" cellspacing="0" style="width:280px;border-collapse:collapse">${totalsRows}</table>
    </td></tr>`;

  // --- EFT banking block ------------------------------------------------------
  const eftColor = tokens.accentOn === "total" ? INK : accent; // minimal keeps accent for the total only
  const bankRow = (k: string, v?: string | null) => v
    ? `<tr><td style="padding:2px 12px 2px 0;font-family:${bodyFont};font-size:13px;color:${INK2}">${k}</td><td align="right" style="padding:2px 0;font-family:${bodyFont};font-size:13px;font-weight:600;color:${INK}">${esc(v)}</td></tr>`
    : "";
  const bankingBlock = `
    <tr><td style="padding:20px ${padX}px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:10px"><tr><td style="padding:14px 16px">
        <div style="font-family:${bodyFont};font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:${eftColor};margin-bottom:6px">Pay by EFT</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          ${bankRow("Account name", opts.bank.accountName)}
          ${bankRow("Bank", opts.bank.bankName)}
          ${bankRow("Account no.", opts.bank.accountNumber)}
          ${bankRow("Branch code", opts.bank.branchCode)}
          ${bankRow("SWIFT", opts.bank.swift)}
          ${bankRow("IBAN", opts.bank.iban)}
          ${bankRow("Reference", opts.invoiceRef)}
        </table>
      </td></tr></table>
    </td></tr>`;

  // --- Portal CTA --------------------------------------------------------------
  const ctaBg = tokens.accentOn === "total" ? INK : accent;
  const ctaBlock = opts.portalUrl ? `
    <tr><td style="padding:22px ${padX}px 0">
      <a href="${esc(opts.portalUrl)}" style="display:inline-block;background:${ctaBg};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-family:${bodyFont};font-size:14px;font-weight:600">View your portal &rarr;</a>
    </td></tr>` : "";

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;font-family:${bodyFont};color:${INK}">
      ${header}
      ${greeting}
      ${itemsBlock}
      ${totalsBlock}
      ${bankingBlock}
      ${ctaBlock}
      <tr><td style="height:${tokens.headerStyle === "plain" ? 32 : 24}px;font-size:0;line-height:0">&nbsp;</td></tr>
    </table>
    <div style="font-family:${EMAIL_SANS};font-size:11px;color:#a8a29e;padding:14px 0;text-align:center">Sent via Venuely</div>
  </td></tr></table>`;
}
