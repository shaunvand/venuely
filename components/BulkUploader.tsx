"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useTransition } from "react";
import { undoImport } from "@/app/venue/_inventory/actions";

export type BulkUploaderHandle = {
  commit: () => void;
  includedCount: number;
  isImporting: boolean;
  imported: boolean;
};

type Item = {
  _id: number;
  _include: boolean;
  category: string;
  source_file: string | null;
  data: Record<string, unknown>;
  image_source?: "embedded" | "online" | "none";
};

const CATEGORY_LABELS: Record<string, string> = {
  catalogue: "Catalogue",
  rentals: "Rentals",
  accommodation: "Accommodation",
  caterers: "Caterers",
  planners: "Planners",
  florists: "Florists",
  djs: "DJs",
  photographers: "Photographers",
  decor: "Decor",
  bar: "Bar services",
};

const CATEGORY_LIST = Object.keys(CATEGORY_LABELS);

// Commit results are keyed by destination table name (multiple vendor categories
// collapse into vendor_partners), so we label them separately from the categories.
const TABLE_LABELS: Record<string, string> = {
  catalogue_items: "Catalogue",
  rental_items: "Rentals",
  accommodation_rooms: "Accommodation",
  vendor_partners: "Vendors",
};

// Pricing-critical fields are surfaced on the review card so the owner can fix them
// BEFORE commit (cost_treatment + commission drive what the couple is charged).
const VENDOR_REVIEW_FIELDS = [
  "name", "description", "cost_treatment", "price_from",
  "commission_type", "commission_value", "contact_email", "contact_phone", "website_url",
];
const FIELDS_BY_CATEGORY: Record<string, string[]> = {
  catalogue: ["category", "name", "description", "cost_treatment", "price", "price_unit", "commission_type", "commission_value"],
  rentals: ["category", "name", "description", "cost_treatment", "price", "stock_total", "commission_type", "commission_value"],
  accommodation: ["name", "room_type", "sleeps", "cost_treatment", "price_per_night", "commission_type", "commission_value", "description"],
  caterers: VENDOR_REVIEW_FIELDS,
  planners: VENDOR_REVIEW_FIELDS,
  florists: VENDOR_REVIEW_FIELDS,
  djs: VENDOR_REVIEW_FIELDS,
  photographers: VENDOR_REVIEW_FIELDS,
  decor: VENDOR_REVIEW_FIELDS,
  bar: VENDOR_REVIEW_FIELDS,
};

// Fields that should render as a <select> in the review card, with their options.
const SELECT_FIELD_OPTIONS: Record<string, string[]> = {
  cost_treatment: ["included", "extra"],
  commission_type: ["percent", "fixed"],
  price_unit: ["fixed", "per_person", "per_hour"],
};

const BUBBLE = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition";
const BUBBLE_PRIMARY = `${BUBBLE} bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed`;
const BUBBLE_SECONDARY = `${BUBBLE} bg-white border border-stone-300 text-stone-800 hover:bg-stone-100`;
const BUBBLE_GHOST = `${BUBBLE} text-stone-700 hover:bg-stone-100`;

type BulkUploaderProps = {
  venueId: string;
  embedded?: boolean;
  onStateChange?: (s: { includedCount: number; isImporting: boolean; imported: boolean; hasItems: boolean }) => void;
};

export const BulkUploader = forwardRef<BulkUploaderHandle, BulkUploaderProps>(function BulkUploader(
  { venueId, embedded = false, onStateChange },
  ref,
) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const [imported, setImported] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [extractedImages, setExtractedImages] = useState<Array<{ url: string; source_file: string; ordinal: number }>>([]);
  const [searchOpen, setSearchOpen] = useState<{ itemId: number; query: string; results: Array<{ url: string; thumb: string; alt: string; photographer_name: string; photographer_profile_url: string; source?: string; source_url?: string; unsplash_url?: string; download_location?: string }>; busy: boolean; err: string | null } | null>(null);
  const [fileReports, setFileReports] = useState<Array<{ filename: string; chars: number; items: number; status: string; error?: string; stop_reason?: string | null; truncated?: boolean; unsupported?: string }>>([]);
  const [filter, setFilter] = useState<string>("all");
  const [commitResults, setCommitResults] = useState<Record<string, { added: number; updated: number; failed: number; error?: string }> | null>(null);
  const [undo, setUndo] = useState<{ batchId: string; expiresAt: number } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [isPending, startTransition] = useTransition();

  // Tick once a second while an undo window is open so the countdown updates + auto-hides.
  useEffect(() => {
    if (!undo) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [undo]);
  useEffect(() => {
    if (undo && nowTick >= undo.expiresAt) setUndo(null);
  }, [undo, nowTick]);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setFiles(Array.from(list));
  }

  const includedCount = items.filter((it) => it._include).length;

  useImperativeHandle(ref, () => ({
    commit: () => commit(),
    includedCount,
    isImporting: isPending,
    imported,
  }), [includedCount, isPending, imported]);

  useEffect(() => {
    onStateChange?.({ includedCount, isImporting: isPending, imported, hasItems: items.length > 0 });
  }, [includedCount, isPending, imported, items.length, onStateChange]);

  async function parse() {
    if (!files.length) return;
    setBusy(true); setStatus({ tone: "info", text: `Reading ${files.length} file${files.length === 1 ? "" : "s"} — this can take 30-60 seconds for large PDFs.` }); setMsg(null); setItems([]); setImported(false); setCommitResults(null); setUndo(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/uploads/parse", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || !j.ok) { setStatus({ tone: "error", text: `Reading failed: ${j.error ?? "unknown error"}` }); return; }
      setItems(j.items as Item[]);
      setFileReports(j.files ?? []);
      setExtractedImages(j.images ?? []);
      const counts = Object.entries(j.counts as Record<string, number>).map(([k, v]) => `${v} ${CATEGORY_LABELS[k] ?? k}`).join(", ");
      if (counts) {
        setStatus({ tone: "success", text: `Found: ${counts}. Now review below and click "Import" to save into your dashboard.` });
      } else {
        setStatus({ tone: "error", text: "Nothing recognisable found — see per-file report below." });
      }
    } catch (e) {
      setStatus({ tone: "error", text: `Error: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setBusy(false); }
  }

  function updateItem(id: number, patch: Partial<Item>) {
    setItems((curr) => curr.map((it) => it._id === id ? { ...it, ...patch } : it));
  }
  async function findOnline(itemId: number) {
    const it = items.find((x) => x._id === itemId);
    if (!it) return;
    // Simplify: drop codes/quantities/parentheticals so Unsplash gets a clean term.
    const query = String(it.data.name ?? "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b[FR]\d+\s*[-–]?\s*[FR]?\d*\b/gi, " ")
      .replace(/\b\d{1,4}\b/g, " ")
      .replace(/[^a-zA-Z\s&]/g, " ")
      .replace(/\b(set|sets|of|the|a|an|various|sundry|incl|etc|x)\b/gi, " ")
      .replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ") || "wedding decor";
    setSearchOpen({ itemId, query, results: [], busy: true, err: null });
    try {
      const res = await fetch("/api/venue/image-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setSearchOpen({ itemId, query, results: [], busy: false, err: j.error ?? "Search failed" });
        return;
      }
      setSearchOpen({ itemId, query, results: j.results ?? [], busy: false, err: null });
    } catch (e) {
      setSearchOpen({ itemId, query, results: [], busy: false, err: e instanceof Error ? e.message : String(e) });
    }
  }

  async function rerunSearch(query: string) {
    if (!searchOpen) return;
    setSearchOpen({ ...searchOpen, query, busy: true, err: null });
    try {
      const res = await fetch("/api/venue/image-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setSearchOpen({ ...searchOpen, query, results: [], busy: false, err: j.error ?? "Search failed" });
        return;
      }
      setSearchOpen({ ...searchOpen, query, results: j.results ?? [], busy: false, err: null });
    } catch (e) {
      setSearchOpen({ ...searchOpen, query, results: [], busy: false, err: e instanceof Error ? e.message : String(e) });
    }
  }

  function updateField(id: number, key: string, value: string) {
    setItems((curr) => curr.map((it) => it._id === id ? { ...it, data: { ...it.data, [key]: value } } : it));
  }

  function commit() {
    const payload = items.filter((it) => it._include && it.data?.name).map((it) => ({
      category: it.category,
      data: Object.fromEntries(Object.entries(it.data).map(([k, v]) => {
        const numeric = ["price", "price_per_night", "price_from", "stock_total", "sleeps"];
        if (numeric.includes(k) && v !== "" && v != null) return [k, Number(v)];
        return [k, v];
      })),
    }));
    if (!payload.length) { setStatus({ tone: "error", text: "Nothing selected to import." }); return; }
    setStatus({ tone: "info", text: `Importing ${payload.length} item${payload.length === 1 ? "" : "s"} — please wait, this can take 10-30 seconds.` });
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/venue/uploads/commit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ venue_id: venueId, items: payload }),
        });
        const j = await res.json();
        const results = (j.results ?? null) as Record<string, { added: number; updated: number; failed: number; error?: string }> | null;
        // Hard failure: route errored outright, or every destination failed and nothing landed.
        const nothingSaved = results
          ? Object.values(results).every((r) => r.added + r.updated === 0)
          : !j.ok;
        if (!res.ok || (!j.ok && nothingSaved)) {
          setStatus({ tone: "error", text: `Import failed: ${j.error ?? "unknown error"}. Nothing was saved — please try again or contact support.` });
          setCommitResults(results);
          return;
        }
        setCommitResults(results);
        // Build a per-destination sentence: "Catalogue 24 added, Rentals 30 (3 updated), …".
        const lines = results
          ? Object.entries(results).map(([table, r]) => {
              const label = TABLE_LABELS[table] ?? table;
              if (r.failed && r.added + r.updated === 0) return `${label} failed: ${r.error ?? "error"}`;
              const parts = [`${r.added + r.updated} ${label.toLowerCase()}`];
              if (r.updated) parts.push(`${r.updated} updated`);
              if (r.failed) parts.push(`${r.failed} failed`);
              return parts.join(" — ");
            })
          : Object.entries(j.summary as Record<string, number>).map(([k, v]) => `${v} ${CATEGORY_LABELS[k] ?? k}`);
        const skipped = (j.skipped ?? []).length;
        const anyFailed = results ? Object.values(results).some((r) => r.failed > 0) : false;
        setStatus({
          tone: anyFailed ? "info" : "success",
          text: `Imported: ${lines.join(", ")}.${skipped ? ` (${skipped} skipped — missing required fields.)` : ""} Your dashboard is ready.`,
        });
        setImported(true);
        // Open a ~10-minute undo window so a wrong import can be reversed in one click.
        if (j.import_batch_id) setUndo({ batchId: j.import_batch_id as string, expiresAt: Date.now() + 10 * 60 * 1000 });
        setItems([]); setFiles([]); if (fileRef.current) fileRef.current.value = "";
      } catch (e) {
        setStatus({ tone: "error", text: `Import error: ${e instanceof Error ? e.message : String(e)}. Nothing was saved.` });
      }
    });
  }

  function doUndo() {
    if (!undo) return;
    const batchId = undo.batchId;
    setUndoBusy(true);
    startTransition(async () => {
      try {
        const { deleted } = await undoImport(venueId, batchId);
        setUndo(null);
        setCommitResults(null);
        setImported(false);
        setStatus({ tone: "info", text: `Import undone — ${deleted} item${deleted === 1 ? "" : "s"} removed from your dashboard.` });
      } catch (e) {
        setStatus({ tone: "error", text: `Undo failed: ${e instanceof Error ? e.message : String(e)}` });
      } finally {
        setUndoBusy(false);
      }
    });
  }

  const visible = filter === "all" ? items : items.filter((it) => it.category === filter);

  const stage: 1 | 2 | 3 = imported ? 3 : items.length > 0 ? 3 : files.length > 0 ? 2 : 1;
  const stepperSteps: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: "Upload files" },
    { n: 2, label: "Read & detect" },
    { n: 3, label: "Import to dashboard" },
  ];
  const statusStyles = {
    info:    { bg: "var(--peach)",    fg: "var(--poppy-deep)", icon: "⏳" },
    success: { bg: "var(--leaf)",     fg: "#1f5d3e",           icon: "✓"  },
    error:   { bg: "#fde2dd",         fg: "#a3210e",           icon: "⚠"  },
  } as const;

  return (
    <div className="vy-card space-y-4">
      {/* 3-step header so users always know where they are */}
      <ol className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm" aria-label="Smart Import progress">
        {stepperSteps.map((s, i) => {
          const active = s.n === stage;
          const done = s.n < stage || (imported && s.n <= 3);
          return (
            <li key={s.n} className="flex items-center gap-2 sm:gap-3 flex-1">
              <span
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${done ? "" : active ? "" : "opacity-60"}`}
                style={{
                  background: done ? "var(--leaf)" : active ? "var(--peach)" : "var(--bone)",
                  color: done ? "#1f5d3e" : active ? "var(--poppy-deep)" : "var(--ink-2)",
                  border: "1px solid var(--line)",
                }}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.7)" }}>
                  {done ? "✓" : s.n}
                </span>
                {s.label}
              </span>
              {i < stepperSteps.length - 1 && <span className="flex-1 h-px" style={{ background: "var(--line)" }} />}
            </li>
          );
        })}
      </ol>

      {/* Prominent status banner — success / failure / in-progress */}
      {status && (
        <div
          role={status.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: statusStyles[status.tone].bg, color: statusStyles[status.tone].fg, border: "1px solid var(--line)" }}
        >
          <span className="text-lg leading-none flex-shrink-0 mt-0.5">{statusStyles[status.tone].icon}</span>
          <span className="flex-1 leading-relaxed">{status.text}</span>
        </div>
      )}

      {/* Per-destination commit breakdown + undo window (shown ~10 min after a commit) */}
      {(commitResults || undo) && (
        <div className="rounded-xl px-4 py-3 text-sm space-y-2" style={{ background: "var(--bone)", border: "1px solid var(--line)" }}>
          {commitResults && (
            <ul className="space-y-1">
              {Object.entries(commitResults).map(([table, r]) => (
                <li key={table} className="flex items-center gap-2 text-xs" style={{ color: "var(--ink)" }}>
                  <span className="font-medium">{TABLE_LABELS[table] ?? table}:</span>
                  {r.added > 0 && <span className="text-emerald-700">{r.added} added</span>}
                  {r.updated > 0 && <span className="text-sky-700">{r.updated} updated</span>}
                  {r.failed > 0 && <span className="text-red-700">{r.failed} failed{r.error ? ` (${r.error})` : ""}</span>}
                  {r.added === 0 && r.updated === 0 && r.failed === 0 && <span className="text-stone-500">no rows</span>}
                </li>
              ))}
            </ul>
          )}
          {undo && nowTick < undo.expiresAt && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={doUndo}
                disabled={undoBusy || isPending}
                className={BUBBLE_SECONDARY + " text-xs"}
              >
                {undoBusy ? "Undoing…" : "↩ Undo this import"}
              </button>
              <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                You can undo for the next {Math.max(0, Math.ceil((undo.expiresAt - nowTick) / 60000))} min.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 items-center flex-wrap">
        <label className={BUBBLE_SECONDARY + " cursor-pointer"}>
          {files.length ? "Change files" : "Choose files (PDF / Excel / CSV)"}
          <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.txt"
            onChange={(e) => pickFiles(e.target.files)}
            className="hidden" />
        </label>
        <button disabled={!files.length || busy} onClick={parse} className={BUBBLE_PRIMARY}>
          {busy ? "Reading your files…" : `Read ${files.length || "no"} file${files.length === 1 ? "" : "s"}`}
        </button>
        {!files.length && !items.length && (
          <span className="text-xs text-stone-500">Drop in the same docs you send couples — quotes, brochures, stock lists, rooming spreadsheets.</span>
        )}
      </div>

      {files.length > 0 && (
        <div className="text-xs text-stone-600 flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <span key={i} className="px-2 py-1 rounded-full bg-stone-100 border border-stone-200">{f.name} <span className="text-stone-400">· {(f.size/1024).toFixed(0)}kB</span></span>
          ))}
        </div>
      )}

      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-stone-200">
          <div className="h-full w-1/3 animate-[vyImportBar_1.1s_ease-in-out_infinite] rounded bg-stone-900" />
        </div>
      )}

      {msg && <p className="text-sm text-stone-700">{msg}</p>}

      {fileReports.length > 0 && (
        <details className="text-xs border border-stone-200 rounded-lg p-3 bg-stone-50">
          <summary className="cursor-pointer font-medium">Per-file report ({fileReports.length} files)</summary>
          <table className="w-full mt-2">
            <thead className="text-left text-stone-500">
              <tr><th className="py-1">File</th><th>Chars</th><th>Items</th><th>Status</th></tr>
            </thead>
            <tbody>
              {fileReports.map((r) => (
                <tr key={r.filename} className="border-t border-stone-200 align-top">
                  <td className="py-1 pr-2 max-w-[260px] truncate" title={r.filename}>{r.filename}</td>
                  <td className="text-stone-600">{r.chars.toLocaleString()}</td>
                  <td className={r.items > 0 ? "text-emerald-700 font-medium" : "text-stone-500"}>{r.items}</td>
                  <td className={r.error || r.unsupported ? "text-red-700" : "text-stone-600"}>
                    {r.error ? r.error : r.status}
                    {r.truncated && (
                      <div className="text-amber-700 mt-0.5">⚠ List may be truncated — split this file into smaller parts and re-upload to capture the rest.</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {extractedImages.length > 0 && (
        <details className="border border-stone-200 rounded-lg p-3 bg-stone-50">
          <summary className="cursor-pointer text-xs font-medium">{extractedImages.length} images extracted from your files (click to view)</summary>
          <div className="mt-3 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
            {extractedImages.map((img) => (
              <a key={img.url} href={img.url} target="_blank" rel="noopener noreferrer" title={`${img.source_file} #${img.ordinal + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="aspect-square w-full object-cover rounded border border-stone-200 hover:border-stone-900 transition" />
              </a>
            ))}
          </div>
        </details>
      )}

      {items.length > 0 && (
        <>
          {/* Category filter pills — matches Vendor Tracker styling */}
          <div className="flex gap-2 flex-wrap items-center border-t pt-4" style={{ borderColor: "var(--line)" }}>
            <button
              onClick={() => setFilter("all")}
              className="rounded-full px-4 py-1.5 text-xs font-medium transition"
              style={
                filter === "all"
                  ? { background: "var(--ink)", color: "#fff" }
                  : { background: "#fff", color: "var(--ink)", border: "1px solid var(--line)" }
              }
            >
              All ({items.length})
            </button>
            {CATEGORY_LIST.filter((c) => items.some((i) => i.category === c)).map((c) => {
              const n = items.filter((i) => i.category === c).length;
              const active = filter === c;
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className="rounded-full px-4 py-1.5 text-xs font-medium transition"
                  style={
                    active
                      ? { background: "var(--ink)", color: "#fff" }
                      : { background: "#fff", color: "var(--ink)", border: "1px solid var(--line)" }
                  }
                >
                  {CATEGORY_LABELS[c]} ({n})
                </button>
              );
            })}
          </div>

          {/* Card grid review — modelled on the Vendor Tracker layout */}
          <div className="overflow-auto max-h-[55vh] pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visible.map((it) => {
                const fields = FIELDS_BY_CATEGORY[it.category] ?? Object.keys(it.data);
                const name = String(it.data.name ?? "Untitled item");
                const priceKeys = ["price", "price_per_night", "price_from"] as const;
                const priceKey = priceKeys.find((k) => it.data[k] != null && it.data[k] !== "");
                const priceVal = priceKey ? Number(it.data[priceKey]) : null;
                const description = String(it.data.description ?? "");
                const contactEmail = String(it.data.contact_email ?? "");
                const contactPhone = String(it.data.contact_phone ?? "");
                const includedSource = it.image_source;
                return (
                  <div
                    key={it._id}
                    className="relative rounded-xl bg-white overflow-hidden transition"
                    style={{
                      border: "1px solid var(--line)",
                      opacity: it._include ? 1 : 0.55,
                    }}
                  >
                    {/* Left accent bar */}
                    <span
                      aria-hidden
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ background: it._include ? "var(--poppy)" : "var(--line)" }}
                    />
                    <div className="p-4 pl-5 space-y-2.5">
                      {/* Category badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md"
                          style={{ background: "var(--cream)", color: "var(--poppy-deep)" }}
                        >
                          {CATEGORY_LABELS[it.category] ?? it.category}
                        </span>
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer select-none" style={{ color: "var(--ink-2)" }}>
                          <input
                            type="checkbox"
                            checked={it._include}
                            onChange={(e) => updateItem(it._id, { _include: e.target.checked })}
                            style={{ accentColor: "var(--poppy)" }}
                          />
                          Include
                        </label>
                      </div>

                      {/* Item name */}
                      <h3 className="font-serif text-lg leading-tight" style={{ fontWeight: 700 }}>{name}</h3>

                      {/* Image strip */}
                      <div className="flex items-center gap-2">
                        {it.data.image_url ? (
                          <div className="relative flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={String(it.data.image_url)} alt="" className="h-14 w-14 rounded object-cover" style={{ border: "1px solid var(--line)" }} />
                            {includedSource === "online" && (
                              <span className="absolute -bottom-1 -right-1 text-[9px] px-1 rounded-full" style={{ background: "var(--peach)", color: "var(--poppy-deep)" }} title="Unsplash">🌐</span>
                            )}
                            {includedSource === "embedded" && (
                              <span className="absolute -bottom-1 -right-1 text-[9px] px-1 rounded-full" style={{ background: "var(--leaf)", color: "#1f5d3e" }} title="From your file">📎</span>
                            )}
                          </div>
                        ) : (
                          <div className="h-14 w-14 rounded flex items-center justify-center text-[10px] flex-shrink-0" style={{ border: "1px dashed var(--line)", background: "var(--bone)", color: "var(--ink-2)" }}>
                            no image
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) updateField(it._id, "image_url", e.target.value); }}
                            className="border rounded-full px-2 py-0.5 text-[10px] bg-white"
                            style={{ borderColor: "var(--line)" }}
                          >
                            <option value="">pick from file…</option>
                            {extractedImages.map((img) => (
                              <option key={img.url} value={img.url}>{img.source_file.slice(0, 12)}…#{img.ordinal + 1}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => findOnline(it._id)}
                            className="rounded-full px-2 py-0.5 text-[10px]"
                            style={{ background: "var(--ink)", color: "#fff" }}
                          >
                            🔍 Find online
                          </button>
                        </div>
                      </div>

                      {/* Contact line */}
                      {(contactEmail || contactPhone) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--ink-2)" }}>
                          {contactEmail && <span>✉ {contactEmail}</span>}
                          {contactPhone && <span>📞 {contactPhone}</span>}
                        </div>
                      )}

                      {/* Price */}
                      {priceVal != null && priceVal > 0 && (
                        <div className="font-serif text-lg" style={{ color: "var(--poppy)", fontWeight: 700 }}>
                          R{priceVal.toLocaleString("en-ZA")}
                          {priceKey === "price_per_night" && <span className="text-[11px] font-sans ml-1" style={{ color: "var(--ink-2)" }}>/ night</span>}
                          {priceKey === "price_from" && <span className="text-[11px] font-sans ml-1" style={{ color: "var(--ink-2)" }}>from</span>}
                        </div>
                      )}

                      {/* Description */}
                      {description && (
                        <p className="text-[11px] leading-relaxed italic line-clamp-3" style={{ color: "var(--ink-2)" }}>
                          {description}
                        </p>
                      )}

                      {/* Status pill */}
                      <div className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                           style={{ color: it._include ? "var(--poppy)" : "var(--ink-2)" }}>
                        <span>●</span> {it._include ? "Will Import" : "Excluded"}
                      </div>

                      {/* Edit fields disclosure */}
                      <details className="text-[11px]">
                        <summary className="cursor-pointer select-none py-1 rounded" style={{ color: "var(--ink-2)" }}>
                          Edit fields ▾
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--ink-2)" }}>Category</label>
                            <select
                              value={it.category}
                              onChange={(e) => updateItem(it._id, { category: e.target.value })}
                              className="w-full rounded-md px-2 py-1 text-[11px]"
                              style={{ border: "1px solid var(--line)", background: "#fff" }}
                            >
                              {CATEGORY_LIST.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                            </select>
                          </div>
                          {fields.map((k) => {
                            const selectOpts = SELECT_FIELD_OPTIONS[k];
                            return (
                              <div key={k}>
                                <label className="block text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--ink-2)" }}>{k.replace(/_/g, " ")}</label>
                                {selectOpts ? (
                                  <select
                                    value={String(it.data[k] ?? "")}
                                    onChange={(e) => updateField(it._id, k, e.target.value)}
                                    className="w-full rounded-md px-2 py-1 text-[11px]"
                                    style={{ border: "1px solid var(--line)", background: "#fff" }}
                                  >
                                    <option value="">—</option>
                                    {selectOpts.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                                  </select>
                                ) : (
                                  <input
                                    value={String(it.data[k] ?? "")}
                                    onChange={(e) => updateField(it._id, k, e.target.value)}
                                    placeholder={k}
                                    className="w-full rounded-md px-2 py-1 text-[11px]"
                                    style={{ border: "1px solid var(--line)" }}
                                  />
                                )}
                              </div>
                            );
                          })}
                          {it.source_file && (
                            <div className="text-[10px] truncate pt-1" style={{ color: "var(--ink-2)" }} title={it.source_file}>
                              Source: {it.source_file}
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex gap-2">
              <button onClick={() => setItems((c) => c.map((it) => ({ ...it, _include: true })))} className={BUBBLE_GHOST + " text-xs"}>Select all</button>
              <button onClick={() => setItems((c) => c.map((it) => ({ ...it, _include: false })))} className={BUBBLE_GHOST + " text-xs"}>Select none</button>
            </div>
            {!embedded && (
              <button disabled={isPending || !includedCount} onClick={commit} className={BUBBLE_PRIMARY}>
                {isPending ? (
                  <>
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Importing — don&apos;t close this tab…
                  </>
                ) : (
                  `Import ${includedCount} item${includedCount === 1 ? "" : "s"} →`
                )}
              </button>
            )}
          </div>
        </>
      )}

      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSearchOpen(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 sticky top-0 bg-white">
              <h3 className="font-medium">Find an image online</h3>
              <button onClick={() => setSearchOpen(null)} className="text-stone-500 hover:text-stone-900">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-2">
                <input value={searchOpen.query}
                  onChange={(e) => setSearchOpen({ ...searchOpen, query: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") rerunSearch(searchOpen.query); }}
                  className="flex-1 border rounded-full px-3 py-2 text-sm" />
                <button onClick={() => rerunSearch(searchOpen.query)} disabled={searchOpen.busy}
                  className="rounded-full bg-stone-900 text-white px-4 py-2 text-sm hover:bg-stone-700 disabled:opacity-50">
                  {searchOpen.busy ? "Searching…" : "Search"}
                </button>
              </div>
              {searchOpen.err && <p className="text-xs text-red-700">{searchOpen.err}</p>}
              {searchOpen.busy && <p className="text-xs text-stone-500">Searching…</p>}
              {!searchOpen.busy && searchOpen.results.length === 0 && !searchOpen.err && (
                <p className="text-xs text-stone-500">No results. Try a more generic query like the item type.</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {searchOpen.results.map((r) => (
                  <div key={r.url} className="space-y-1">
                    <button onClick={() => {
                      updateField(searchOpen.itemId, "image_url", r.url);
                      if (r.download_location) {
                        fetch("/api/venue/image-track-download", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ download_location: r.download_location }),
                        }).catch(() => {});
                      }
                      setSearchOpen(null);
                    }} className="block w-full text-left group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.thumb} alt={r.alt} className="aspect-[4/3] w-full object-cover rounded-lg border border-stone-200 group-hover:border-stone-900 transition" />
                    </button>
                    <div className="text-[10px] text-stone-500 leading-tight">
                      Photo by{" "}
                      <a href={r.photographer_profile_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-900">
                        {r.photographer_name}
                      </a>{" "}
                      on{" "}
                      <a href={r.source_url ?? r.unsplash_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-900">
                        {r.source ?? "Unsplash"}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 pt-2 border-t border-stone-200">
                Free stock photos from{" "}
                <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline">Pexels</a>
                {" "}/{" "}
                <a href="https://unsplash.com/?utm_source=venuely&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline">Unsplash</a>,
                free for commercial use. Photographer attribution shown above each image.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
