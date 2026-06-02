"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  INVOICE_TEMPLATE_LIST, resolveInvoiceTemplate,
  type InvoiceTemplateId, type InvoiceTokens,
} from "@/lib/invoice/templates";
import { saveVenueInvoiceDesign } from "@/app/venue/billing/actions";

export type InvoiceBank = {
  bank_account_name: string;
  bank_name: string;
  bank_account_number: string;
  bank_branch_code: string;
  bank_swift: string;
  bank_iban: string;
};

const SAMPLE_ITEMS = [
  { desc: "Venue hire — Saturday", qty: 1, unit: 45000 },
  { desc: "Catering (per guest)", qty: 120, unit: 650 },
  { desc: "Décor & styling package", qty: 1, unit: 18000 },
  { desc: "Accommodation — 8 rooms", qty: 8, unit: 1800 },
];

const rand = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

export function InvoiceDesigner({
  venueId, venueName, bank, initialTemplate, initialAccent, initialLogo, initiallySaved = false,
}: {
  venueId: string;
  venueName: string;
  bank: InvoiceBank;
  initialTemplate: InvoiceTemplateId;
  initialAccent: string;
  initialLogo: string | null;
  initiallySaved?: boolean;
}) {
  const router = useRouter();
  const [template, setTemplate] = useState<InvoiceTemplateId>(initialTemplate);
  const [accent, setAccent] = useState(initialAccent);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogo);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(initiallySaved);
  const [isPending, startTransition] = useTransition();

  const tokens = resolveInvoiceTemplate(template);

  // Saved state — collapse to the invoice preview with one button back to editing.
  if (minimized) {
    return (
      <section className="rounded-lg border border-[color:var(--line)] bg-white p-6 space-y-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
              Invoice design — {tokens.name}
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--leaf)", color: "#1f5d3e" }}>Saved ✓</span>
            </h2>
            <p className="text-sm text-[color:var(--ink-2)] mt-1">This is the invoice couples receive.</p>
          </div>
          <button type="button" onClick={() => { setMsg(null); setMinimized(false); }} className="vy-btn vy-btn-secondary">✎ Edit or change template</button>
        </div>
        <InvoicePreview tokens={tokens} accent={accent} logoUrl={logoUrl} venueName={venueName} bank={bank} />
      </section>
    );
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok && j.ok) setLogoUrl(j.url); else setMsg(`Logo upload failed: ${j.error ?? "unknown"}`);
    } finally { setUploading(false); }
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await saveVenueInvoiceDesign(venueId, { template, accent, logoUrl });
        setMsg("Invoice design saved ✓");
        setMinimized(true);
        router.refresh();
      } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    });
  }

  return (
    <section className="rounded-lg border border-[color:var(--line)] bg-white p-6 space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>Invoice design</h2>
          <p className="text-sm text-[color:var(--ink-2)] mt-1">Choose how the EFT invoice looks to couples, and add your logo. Your banking details above appear on it.</p>
        </div>
        <button onClick={save} disabled={isPending} className="vy-btn vy-btn-primary">{isPending ? "Saving…" : "Save invoice design"}</button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Controls */}
        <div className="space-y-5">
          <div>
            <div className="vy-label mb-2">Template</div>
            <div className="grid grid-cols-2 gap-2">
              {INVOICE_TEMPLATE_LIST.map((t) => {
                const active = t.id === template;
                return (
                  <button key={t.id} type="button" onClick={() => setTemplate(t.id)} title={t.blurb}
                    className="text-left rounded-xl p-3 transition"
                    style={{ border: active ? `2px solid ${accent}` : "1px solid var(--line)", background: active ? "var(--cream)" : "#fff" }}>
                    <InvoiceGlyph tokens={t} accent={accent} />
                    <div className="text-sm font-medium mt-2">{t.name}</div>
                    <div className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--ink-2)" }}>{t.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--ink-2)" }}>Accent colour</span>
            <span className="flex items-center gap-2 border rounded-full pl-1 pr-3 py-1" style={{ borderColor: "var(--line)" }}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#FA523C"} onChange={(e) => setAccent(e.target.value)} className="w-7 h-7 rounded-full border-0 bg-transparent cursor-pointer" />
              <input type="text" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-full text-xs font-mono bg-transparent outline-none" />
            </span>
          </div>

          <div>
            <div className="vy-label mb-2">Logo</div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden" style={{ border: "1px solid var(--line)", background: "var(--bone)" }}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="logo" className="max-w-full max-h-full object-contain" />
                ) : <span className="text-[10px]" style={{ color: "var(--ink-2)" }}>none</span>}
              </div>
              <label className="vy-btn vy-btn-secondary cursor-pointer">
                {uploading ? "Uploading…" : logoUrl ? "Replace" : "Upload logo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
              </label>
              {logoUrl && <button type="button" onClick={() => setLogoUrl(null)} className="text-xs hover:underline" style={{ color: "var(--ink-2)" }}>Remove</button>}
            </div>
          </div>

          {msg && <p className="text-xs" style={{ color: msg.includes("✓") ? "#1f5d3e" : "var(--poppy)" }}>{msg}</p>}
        </div>

        {/* Live preview */}
        <div>
          <div className="vy-label mb-2">What the couple receives</div>
          <InvoicePreview tokens={tokens} accent={accent} logoUrl={logoUrl} venueName={venueName} bank={bank} />
        </div>
      </div>
    </section>
  );
}

function InvoiceGlyph({ tokens, accent }: { tokens: InvoiceTokens; accent: string }) {
  return (
    <div className="rounded-md overflow-hidden bg-white" style={{ border: "1px solid var(--line)" }}>
      {tokens.headerStyle === "band" ? (
        <div className="h-6" style={{ background: accent }} />
      ) : (
        <div className="h-6 flex items-end px-1.5 pb-1"><span className="h-1.5 w-8" style={{ background: accent }} /></div>
      )}
      <div className="p-1.5 space-y-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-1" style={{ background: i === 2 ? accent : "var(--line)", width: i === 2 ? "40%" : "100%", marginLeft: i === 2 ? "auto" : 0 }} />
        ))}
      </div>
    </div>
  );
}

function InvoicePreview({ tokens, accent, logoUrl, venueName, bank }: {
  tokens: InvoiceTokens; accent: string; logoUrl: string | null; venueName: string; bank: InvoiceBank;
}) {
  const heading: React.CSSProperties = { fontFamily: tokens.headingFont };
  const items = SAMPLE_ITEMS.map((i) => ({ ...i, amount: i.qty * i.unit }));
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const total = subtotal;
  const hasBank = !!(bank.bank_account_name || bank.bank_account_number || bank.bank_name);
  const onBand = tokens.headerStyle === "band";

  return (
    <div className="rounded-xl overflow-hidden text-[11px]" style={{ border: "1px solid var(--line)", background: "#fff", fontFamily: tokens.bodyFont, color: "var(--ink)" }}>
      {/* Header */}
      {tokens.headerStyle === "band" ? (
        <div className="flex items-center justify-between px-5 py-4" style={{ background: accent, color: "#fff" }}>
          <InvoiceLogo logoUrl={logoUrl} venueName={venueName} headingFont={tokens.headingFont} onBand={onBand} />
          <div className="text-right">
            <div className="text-xl tracking-wide" style={heading}>INVOICE</div>
            <div className="opacity-90">#INV-2048 · 14 Dec 2025</div>
          </div>
        </div>
      ) : tokens.headerStyle === "split" ? (
        <div className="grid grid-cols-2 px-5 pt-5">
          <div><InvoiceLogo logoUrl={logoUrl} venueName={venueName} headingFont={tokens.headingFont} onBand={onBand} /><div className="mt-1 text-[color:var(--ink-2)]">{venueName}</div></div>
          <div className="text-right">
            <div className="text-2xl italic" style={heading}>Invoice</div>
            <div className="text-[color:var(--ink-2)]">#INV-2048 · 14 Dec 2025</div>
          </div>
        </div>
      ) : (
        <div className="px-5 pt-5 flex items-center justify-between">
          <InvoiceLogo logoUrl={logoUrl} venueName={venueName} headingFont={tokens.headingFont} onBand={onBand} />
          <div className="text-right">
            <div className="text-xl" style={heading}>INVOICE</div>
            <div className="text-[color:var(--ink-2)]">#INV-2048 · 14 Dec 2025</div>
          </div>
        </div>
      )}
      {tokens.headerStyle === "rule" && <div className="mx-5 mt-3 h-0.5" style={{ background: accent }} />}

      {/* Bill to */}
      <div className="px-5 pt-4 flex justify-between gap-4">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[color:var(--ink-2)]">Billed to</div>
          <div className="font-medium">Adam &amp; Eve</div>
          <div className="text-[color:var(--ink-2)]">Wedding · 14 Dec 2025</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-[color:var(--ink-2)]">From</div>
          <div className="font-medium">{venueName}</div>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 pt-4">
        <table className="w-full border-collapse">
          <thead>
            <tr style={tokens.accentOn === "all" ? { background: accent + "1f" } : undefined}>
              <th className="text-left py-1.5 font-semibold" style={{ borderBottom: `1px solid ${tokens.tableStyle === "minimal" ? "var(--line)" : accent}` }}>Description</th>
              <th className="text-right py-1.5 font-semibold w-10" style={{ borderBottom: `1px solid ${tokens.tableStyle === "minimal" ? "var(--line)" : accent}` }}>Qty</th>
              <th className="text-right py-1.5 font-semibold w-20" style={{ borderBottom: `1px solid ${tokens.tableStyle === "minimal" ? "var(--line)" : accent}` }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={i.desc} style={tokens.tableStyle === "striped" && idx % 2 ? { background: "var(--cream)" } : undefined}>
                <td className="py-1.5" style={{ borderBottom: tokens.tableStyle === "lined" ? "1px solid var(--line)" : undefined }}>{i.desc}</td>
                <td className="py-1.5 text-right" style={{ borderBottom: tokens.tableStyle === "lined" ? "1px solid var(--line)" : undefined }}>{i.qty}</td>
                <td className="py-1.5 text-right" style={{ borderBottom: tokens.tableStyle === "lined" ? "1px solid var(--line)" : undefined }}>{rand(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end mt-2">
          <div className="w-44">
            <div className="flex justify-between py-1"><span className="text-[color:var(--ink-2)]">Subtotal</span><span>{rand(subtotal)}</span></div>
            <div className="flex justify-between py-1.5 px-2 rounded font-semibold" style={{ background: accent, color: "#fff" }}>
              <span>Total due</span><span>{rand(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Banking (EFT) */}
      <div className="m-5 mt-4 p-3 rounded-lg" style={{ background: "var(--cream)" }}>
        <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: accent, fontWeight: 700 }}>Pay by EFT</div>
        {hasBank ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span className="text-[color:var(--ink-2)]">Account name</span><span className="text-right font-medium">{bank.bank_account_name || "—"}</span>
            <span className="text-[color:var(--ink-2)]">Bank</span><span className="text-right">{bank.bank_name || "—"}</span>
            <span className="text-[color:var(--ink-2)]">Account no.</span><span className="text-right">{bank.bank_account_number || "—"}</span>
            <span className="text-[color:var(--ink-2)]">Branch code</span><span className="text-right">{bank.bank_branch_code || "—"}</span>
            {bank.bank_swift && (<><span className="text-[color:var(--ink-2)]">SWIFT</span><span className="text-right">{bank.bank_swift}</span></>)}
            {bank.bank_iban && (<><span className="text-[color:var(--ink-2)]">IBAN</span><span className="text-right">{bank.bank_iban}</span></>)}
            <span className="text-[color:var(--ink-2)]">Reference</span><span className="text-right">INV-2048</span>
          </div>
        ) : (
          <div className="text-[color:var(--ink-2)]">Add your banking details above and they&apos;ll appear here for couples to pay you.</div>
        )}
      </div>
    </div>
  );
}

function InvoiceLogo({ logoUrl, venueName, headingFont, onBand }: { logoUrl: string | null; venueName: string; headingFont: string; onBand: boolean }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className="h-9 max-w-[140px] object-contain" />;
  }
  return <span className="text-lg font-semibold" style={{ fontFamily: headingFont, color: onBand ? "#fff" : "var(--ink)" }}>{venueName}</span>;
}
