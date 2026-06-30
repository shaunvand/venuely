"use client";

// Download a wedding's line items as a CSV (opens in Excel). Pure client-side —
// builds a Blob from data passed by the server component, so no extra route.
export type ExportRow = { kind: string; label: string; qty: number; unit_price: number; amount: number };

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportLineItems({ rows, summary = [], filename }: { rows: ExportRow[]; summary?: Array<[string, number]>; filename: string }) {
  function download() {
    const lines: string[] = [];
    lines.push(["Kind", "Description", "Qty", "Unit price (R)", "Amount (R)"].map(csvCell).join(","));
    for (const r of rows) lines.push([r.kind, r.label, r.qty, r.unit_price, r.amount].map(csvCell).join(","));
    if (summary.length) {
      lines.push("");
      for (const [label, value] of summary) lines.push(["", label, "", "", value].map(csvCell).join(","));
    }
    // Prepend a BOM so Excel reads it as UTF-8.
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button onClick={download} className="vy-btn vy-btn-secondary text-xs" title="Download these line items as a CSV (opens in Excel)">
      ⤓ Export CSV
    </button>
  );
}
