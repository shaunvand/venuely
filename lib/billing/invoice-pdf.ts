import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Generates a clean, branded proforma-invoice PDF (A4) for a wedding, returned as
// a base64 string ready to attach to a Resend email. Pure pdf-lib (no native deps,
// serverless-safe). Banking details print on the PDF — not in the email body.

export type InvoicePdfInput = {
  venueName: string;
  coupleNames: string;
  weddingDate?: string | null;
  reference?: string | null;
  lineItems: Array<{ label: string; amount: number }>;
  total: number;
  paid: number;
  balance: number;
  amountDueNow?: number | null;       // deposit or balance the reminder is about
  amountDueLabel?: string | null;     // "Deposit due" / "Balance due"
  dueDate?: string | null;
  banking?: {
    bank_name?: string | null; account_name?: string | null; account_number?: string | null;
    branch_code?: string | null; swift?: string | null; iban?: string | null;
  } | null;
};

const CORAL = rgb(0.98, 0.32, 0.24);
const INK = rgb(0.11, 0.1, 0.09);
const MUTED = rgb(0.42, 0.4, 0.38);
const LINE = rgb(0.93, 0.88, 0.84);

const rand = (n: number) => `R ${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;
function fmtDate(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<{ base64: string; filename: string }> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 portrait (pt)
  const { width, height } = page.getSize();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 50;
  let y = height - 56;

  const text = (s: string, x: number, yy: number, size: number, font = reg, color = INK) =>
    page.drawText(s, { x, y: yy, size, font, color });
  const right = (s: string, xRight: number, yy: number, size: number, font = reg, color = INK) =>
    page.drawText(s, { x: xRight - font.widthOfTextAtSize(s, size), y: yy, size, font, color });

  // Brand header: V. badge + wordmark
  page.drawRectangle({ x: M, y: y - 6, width: 30, height: 30, color: CORAL, borderColor: CORAL });
  text("V", M + 9, y + 2, 20, bold, rgb(1, 1, 1));
  text("Venuely", M + 40, y + 4, 20, bold, INK);
  text(".", M + 40 + bold.widthOfTextAtSize("Venuely", 20), y + 4, 20, bold, CORAL);
  right("PROFORMA INVOICE", width - M, y + 8, 12, bold, CORAL);
  right(input.venueName, width - M, y - 8, 10, reg, MUTED);
  y -= 52;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: LINE });
  y -= 26;

  // Bill-to + meta
  text("BILLED TO", M, y, 8, bold, MUTED);
  text(input.coupleNames, M, y - 16, 13, bold, INK);
  if (input.weddingDate) text(`Wedding date: ${fmtDate(input.weddingDate)}`, M, y - 32, 10, reg, MUTED);
  if (input.reference) right(`Ref: ${input.reference}`, width - M, y - 16, 10, reg, MUTED);
  if (input.dueDate && input.amountDueLabel) right(`${input.amountDueLabel} ${fmtDate(input.dueDate)}`, width - M, y - 32, 10, reg, MUTED);
  y -= 58;

  // Table header
  text("DESCRIPTION", M, y, 8, bold, MUTED);
  right("AMOUNT", width - M, y, 8, bold, MUTED);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: LINE });
  y -= 20;

  // Line items
  for (const li of input.lineItems) {
    if (y < 170) { y = height - 70; pdf.addPage([595.28, 841.89]); } // simple overflow guard
    text(li.label.slice(0, 64), M, y, 11, reg, INK);
    right(rand(li.amount), width - M, y, 11, reg, INK);
    y -= 20;
  }
  if (!input.lineItems.length) { text("Wedding package", M, y, 11, reg, INK); right(rand(input.total), width - M, y, 11, reg, INK); y -= 20; }

  y -= 4;
  page.drawLine({ start: { x: width / 2, y }, end: { x: width - M, y }, thickness: 1, color: LINE });
  y -= 20;
  const totalRow = (label: string, val: number, strong = false) => {
    const f = strong ? bold : reg; const c = strong ? CORAL : MUTED;
    text(label, width / 2, y, strong ? 12 : 10, strong ? bold : reg, strong ? INK : MUTED);
    right(rand(val), width - M, y, strong ? 12 : 10, f, c);
    y -= strong ? 22 : 18;
  };
  totalRow("Total", input.total, true);
  if (input.paid > 0) totalRow("Paid", input.paid);
  totalRow("Balance outstanding", input.balance, true);
  if (typeof input.amountDueNow === "number" && input.amountDueNow > 0 && input.amountDueLabel) {
    y -= 2; totalRow(input.amountDueLabel, input.amountDueNow, true);
  }

  // Banking block
  const b = input.banking;
  if (b && (b.account_number || b.bank_name)) {
    y -= 18;
    page.drawRectangle({ x: M, y: y - 92, width: width - 2 * M, height: 92, borderColor: LINE, borderWidth: 1, color: rgb(1, 0.976, 0.941) });
    text("BANKING DETAILS (EFT)", M + 16, y - 18, 8, bold, CORAL);
    const rows: Array<[string, string | null | undefined]> = [
      ["Account name", b.account_name], ["Bank", b.bank_name], ["Account number", b.account_number],
      ["Branch code", b.branch_code], ["SWIFT", b.swift], ["IBAN", b.iban],
    ];
    let by = y - 36;
    for (const [k, v] of rows) {
      if (!v) continue;
      text(k, M + 16, by, 9, reg, MUTED);
      text(String(v), M + 130, by, 10, bold, INK);
      by -= 15;
    }
    y -= 110;
  }

  // Footer
  text("Thank you — please use the reference above when paying.", M, 46, 9, reg, MUTED);

  const bytes = await pdf.save();
  const base64 = Buffer.from(bytes).toString("base64");
  const safe = input.coupleNames.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "wedding";
  return { base64, filename: `Invoice-${safe}.pdf` };
}
