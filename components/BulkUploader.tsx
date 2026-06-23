"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useTransition } from "react";
import { undoImport } from "@/app/venue/_inventory/actions";
import { SmartImportOverlay } from "@/components/SmartImportOverlay";

export type BulkUploaderHandle = {
  commit: () => void;
  includedCount: number;
  isImporting: boolean;
  imported: boolean;
  openFilePicker: () => void;
  openFolderPicker: () => void;
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

// Per-category colour coding drawn from the brand palette. `accent` is the strong
// colour (left bar / active tab / dot), `soft` the tinted badge background, and
// `text` a readable on-soft tone. Rentals = orange (Poppy), Accommodation =
// green; Catalogue gets a warm gold and partner vendors a shared terracotta.
type CatColor = { accent: string; soft: string; text: string };
const CATEGORY_COLORS: Record<string, CatColor> = {
  catalogue:     { accent: "#C99A2E", soft: "#FAF2E8", text: "#8a6a1f" },
  rentals:       { accent: "#FA523C", soft: "#FFEDE7", text: "#E03E28" },
  accommodation: { accent: "#5F8B6A", soft: "#EBF2ED", text: "#3F6B4D" },
  caterers:      { accent: "#D98B6A", soft: "#FFF1EA", text: "#B5663F" },
  planners:      { accent: "#D98B6A", soft: "#FFF1EA", text: "#B5663F" },
  florists:      { accent: "#D98B6A", soft: "#FFF1EA", text: "#B5663F" },
  djs:           { accent: "#D98B6A", soft: "#FFF1EA", text: "#B5663F" },
  photographers: { accent: "#D98B6A", soft: "#FFF1EA", text: "#B5663F" },
  decor:         { accent: "#D98B6A", soft: "#FFF1EA", text: "#B5663F" },
  bar:           { accent: "#D98B6A", soft: "#FFF1EA", text: "#B5663F" },
};
const FALLBACK_CAT_COLOR: CatColor = { accent: "#8a9a86", soft: "#FFF6F0", text: "#57534e" };
function catColor(category: string): CatColor {
  return CATEGORY_COLORS[category] ?? FALLBACK_CAT_COLOR;
}

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

// Rotating status lines shown on the progress bar so Smart Import looks busy.
const READING_MESSAGES = [
  "Reading your documents…",
  "Detecting items…",
  "Categorising your catalogue…",
  "Sorting rentals & extras…",
  "Adding areas…",
  "Allocating accommodation rooms…",
  "Matching your suppliers…",
  "Checking prices…",
  "Almost there…",
];

const BUBBLE = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition";
const BUBBLE_PRIMARY = `${BUBBLE} bg-[var(--poppy)] text-white hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed`;
// Larger, unmissable variant for the final "Approve" step — the key next action.
const BUBBLE_PRIMARY_LG = "inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-bold transition bg-[var(--poppy)] text-white shadow-lg hover:brightness-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed";
const BUBBLE_SECONDARY = `${BUBBLE} bg-white border border-stone-300 text-stone-800 hover:bg-stone-100`;
const BUBBLE_GHOST = `${BUBBLE} text-stone-700 hover:bg-stone-100`;

type BulkUploaderProps = {
  venueId: string;
  embedded?: boolean;
  onStateChange?: (s: { includedCount: number; isImporting: boolean; imported: boolean; hasItems: boolean; processing: boolean }) => void;
};

export const BulkUploader = forwardRef<BulkUploaderHandle, BulkUploaderProps>(function BulkUploader(
  { venueId, embedded = false, onStateChange },
  ref,
) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  // Anchors for auto-scroll: down to the populated review once parsing lands, and
  // down to the per-category results once the import is approved — so the user
  // always sees what happened and what to do next instead of a still screen.
  const reviewRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const [imported, setImported] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [extractedImages, setExtractedImages] = useState<Array<{ url: string; source_file: string; ordinal: number }>>([]);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState<{ itemId: number; query: string; results: Array<{ url: string; thumb: string; alt: string; photographer_name: string; photographer_profile_url: string; source?: string; source_url?: string; unsplash_url?: string; download_location?: string }>; busy: boolean; err: string | null } | null>(null);
  const [fileReports, setFileReports] = useState<Array<{ filename: string; chars: number; items: number; status: string; error?: string; stop_reason?: string | null; truncated?: boolean; unsupported?: string }>>([]);
  const [filter, setFilter] = useState<string>("all");
  const [commitResults, setCommitResults] = useState<Record<string, { added: number; updated: number; failed: number; error?: string }> | null>(null);
  const [undo, setUndo] = useState<{ batchId: string; expiresAt: number } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [isPending, startTransition] = useTransition();

  // Smart Import progress: a single bar that slow-loads while we read & detect —
  // pace scaled to the upload size, with rotating status messages so it never looks
  // frozen — then speeds up to 100% the moment parsing finishes.
  const [phase, setPhase] = useState<"idle" | "reading" | "finishing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [phaseMsg, setPhaseMsg] = useState("");
  const climbRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Abort plumbing for the parse fetch. We do NOT cut large imports off at 4
  // minutes — instead, at LONG_NOTICE_MS we reassure ("taking longer than usual,
  // almost done") and keep waiting; PARSE_HARD_TIMEOUT_MS is only a far backstop
  // so a truly dead connection can't hang forever. The Cancel button still aborts.
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const noticeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LONG_NOTICE_MS = 240_000;       // 4 min → switch to the "almost done" notice
  const PARSE_HARD_TIMEOUT_MS = 1_200_000; // 20 min hard backstop only

  function cancelParse() {
    cancelledRef.current = true;
    abortRef.current?.abort();
  }

  function stopTimers() {
    for (const r of [climbRef, finishRef, msgRef]) {
      if (r.current) { clearInterval(r.current); r.current = null; }
    }
  }
  useEffect(() => () => stopTimers(), []);

  // After the loading overlay finishes (parse done + items populated), glide down
  // to the review grid so the freshly-sorted categories are in view — not left
  // off-screen below a screen that looks unchanged.
  useEffect(() => {
    if (phase !== "done" || items.length === 0) return;
    const id = setTimeout(() => {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 600); // let the overlay begin its fade first
    return () => clearTimeout(id);
  }, [phase, items.length]);

  // After a successful import, scroll to the per-category results + next steps so
  // the user sees what landed instead of staring at the same review screen.
  useEffect(() => {
    if (!imported) return;
    const id = setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(id);
  }, [imported]);

  // Slow, size-scaled climb toward a ceiling (never reaches 100 until done). Bigger
  // uploads ease more slowly; a small floor keeps the bar always inching forward so
  // it never appears stuck. Status messages rotate to look like constant work.
  function startProgress(totalBytes: number) {
    stopTimers();
    const mb = totalBytes / (1024 * 1024);
    const ease = Math.max(0.012, 0.06 / (1 + mb / 2.5)); // bigger files → slower climb
    const ceiling = 96;
    climbRef.current = setInterval(() => {
      setProgress((p) =>
        p >= ceiling ? Math.min(98, p + 0.05) : p + Math.max(0.1, (ceiling - p) * ease)
      );
    }, 250);
    setPhaseMsg(READING_MESSAGES[0]);
    let last = 0;
    msgRef.current = setInterval(() => {
      let i = last;
      while (i === last) i = Math.floor(Math.random() * READING_MESSAGES.length);
      last = i;
      setPhaseMsg(READING_MESSAGES[i]);
    }, 2200);
  }

  // Parsing finished → speed up to 100% quickly, then resolve.
  function finishFast(): Promise<void> {
    return new Promise((resolve) => {
      stopTimers();
      setPhaseMsg("Finishing up…");
      finishRef.current = setInterval(() => {
        setProgress((p) => {
          const next = p + Math.max(2, (100 - p) * 0.35);
          if (next >= 100) { stopTimers(); resolve(); return 100; }
          return next;
        });
      }, 40);
    });
  }

  // Tick once a second while an undo window is open so the countdown updates + auto-hides.
  useEffect(() => {
    if (!undo) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [undo]);
  useEffect(() => {
    if (undo && nowTick >= undo.expiresAt) setUndo(null);
  }, [undo, nowTick]);

  const SUPPORTED_RE = /\.(pdf|xlsx|xls|csv|txt)$/i;
  // Accept a file OR folder selection, keep only supported docs, then kick off the
  // read automatically — no separate "parse" click. Folder picks (webkitdirectory)
  // can include anything, so we always filter by extension first.
  function pickFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const arr = Array.from(list).filter((f) => SUPPORTED_RE.test(f.name));
    if (!arr.length) {
      setStatus({ tone: "error", text: "No PDF, Excel or CSV files found in that selection — choose a folder or files containing those." });
      return;
    }
    setFiles(arr);
    parse(arr);
  }

  const includedCount = items.filter((it) => it._include).length;

  useImperativeHandle(ref, () => ({
    commit: () => commit(),
    includedCount,
    isImporting: isPending,
    imported,
    openFilePicker: () => { if (!busy) fileRef.current?.click(); },
    openFolderPicker: () => { if (!busy) folderRef.current?.click(); },
  }), [includedCount, isPending, imported, busy]);

  useEffect(() => {
    onStateChange?.({ includedCount, isImporting: isPending, imported, hasItems: items.length > 0, processing: busy || isPending });
  }, [includedCount, isPending, imported, items.length, busy, onStateChange]);

  async function parse(fileList?: File[]) {
    const toParse = fileList ?? files;
    if (!toParse.length) return;
    const totalBytes = toParse.reduce((s, f) => s + f.size, 0);
    setBusy(true); setPhase("reading"); setProgress(4); startProgress(totalBytes);
    setStatus({ tone: "info", text: `Reading ${toParse.length} file${toParse.length === 1 ? "" : "s"} — this can take 30-60 seconds for large PDFs.` });
    setMsg(null); setItems([]); setImported(false); setCommitResults(null); setUndo(null);
    // Abortable fetch: Cancel aborts immediately. At 4 minutes we reassure and
    // keep waiting (no abort); only the far backstop aborts a truly dead request.
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    cancelledRef.current = false;
    noticeRef.current = setTimeout(() => {
      setStatus({ tone: "info", text: "This is taking a little longer than usual — almost done. Please keep this tab open; we'll finish your import." });
    }, LONG_NOTICE_MS);
    const timeoutId = setTimeout(() => ctrl.abort(), PARSE_HARD_TIMEOUT_MS);
    try {
      const fd = new FormData();
      toParse.forEach((f) => fd.append("files", f));
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/uploads/parse", { method: "POST", body: fd, signal: ctrl.signal });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        stopTimers(); setPhase("idle"); setProgress(0);
        setStatus({ tone: "error", text: `Reading failed: ${j.error ?? "unknown error"}` });
        return;
      }
      // Option A: when the file gave us embedded photos, default each item to YOUR
      // photo (by order) instead of an online stock image — correctable per item.
      const imgs = (j.images ?? []) as Array<{ url: string }>;
      const parsed = j.items as Item[];
      const withFileImages = imgs.length
        ? parsed.map((it, idx) => idx < imgs.length ? { ...it, data: { ...it.data, image_url: imgs[idx].url }, image_source: "embedded" as const } : it)
        : parsed;
      const counts = Object.entries(j.counts as Record<string, number>).map(([k, v]) => `${v} ${CATEGORY_LABELS[k] ?? k}`).join(", ");

      // Nothing usable — skip the finishing flourish and surface the per-file report.
      if (!withFileImages.length) {
        stopTimers(); setPhase("idle"); setProgress(0);
        setFileReports(j.files ?? []);
        setStatus({ tone: "error", text: "Nothing recognisable found — see per-file report below." });
        return;
      }

      // Read done → speed up to 100% quickly, then reveal.
      setPhase("finishing");
      setStatus({ tone: "info", text: `Found: ${counts}. Organising and finishing up…` });
      await finishFast();

      setItems(withFileImages);
      setFileReports(j.files ?? []);
      setExtractedImages(j.images ?? []);
      setProgress(100); setPhase("done");
      setStatus({ tone: "success", text: `Found: ${counts}. Review the sorted categories below and click "Approve" to save them into your dashboard.` });
    } catch (e) {
      stopTimers(); setPhase("idle"); setProgress(0);
      if (cancelledRef.current) {
        // User pressed Cancel — back to the pick step, no scary error.
        setStatus({ tone: "info", text: "Reading cancelled. Your files are still selected — press Retry to read them again, or change files." });
      } else if (e instanceof DOMException && e.name === "AbortError") {
        setStatus({ tone: "error", text: "We couldn't reach the server for a while — your connection may have dropped. Press Retry; your files are still selected." });
      } else {
        setStatus({ tone: "error", text: `Reading failed: ${e instanceof Error ? e.message : String(e)}. Check your connection and press Retry.` });
      }
    } finally {
      clearTimeout(timeoutId);
      if (noticeRef.current) { clearTimeout(noticeRef.current); noticeRef.current = null; }
      abortRef.current = null;
      setBusy(false);
    }
  }

  function updateItem(id: number, patch: Partial<Item>) {
    setItems((curr) => curr.map((it) => it._id === id ? { ...it, ...patch } : it));
  }
  // "Pick from file" — upload an image straight off the user's computer to
  // venue-media and pin it to this item. Works for every item regardless of
  // whether the original upload carried embedded photos.
  async function uploadLocalImage(itemId: number, file: File) {
    setUploadingId(itemId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || !j.ok || !j.url) {
        setStatus({ tone: "error", text: `Image upload failed: ${j.error ?? "unknown error"}` });
        return;
      }
      updateItem(itemId, { data: { ...(items.find((x) => x._id === itemId)?.data ?? {}), image_url: j.url }, image_source: "embedded" });
    } catch (e) {
      setStatus({ tone: "error", text: `Image upload failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setUploadingId(null);
    }
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
      {/* Branded loading overlay: the lockup fills with coral as the import runs,
          cycling status lines underneath; shimmer + fade-out on completion. */}
      <SmartImportOverlay
        active={phase === "reading" || phase === "finishing" || phase === "done"}
        progress={progress}
        message={phaseMsg || READING_MESSAGES[0]}
        done={phase === "done"}
        onCancel={phase === "reading" ? cancelParse : undefined}
      />
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
          {/* Retry after a failed / cancelled / timed-out read — files are still selected */}
          {!busy && phase === "idle" && status.tone !== "success" && files.length > 0 && items.length === 0 && (
            <button type="button" onClick={() => parse()} className={BUBBLE_SECONDARY + " text-xs flex-shrink-0"}>
              ↻ Retry
            </button>
          )}
        </div>
      )}

      {/* Per-destination commit breakdown + undo window (shown ~10 min after a commit) */}
      {(commitResults || undo) && (
        <div ref={resultsRef} className="rounded-xl px-4 py-3 text-sm space-y-2 scroll-mt-4" style={{ background: "var(--bone)", border: "1px solid var(--line)" }}>
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
        <label className={(busy ? BUBBLE_PRIMARY + " opacity-50 cursor-not-allowed" : BUBBLE_PRIMARY + " cursor-pointer")}>
          {files.length ? "Change files" : "Choose files (PDF / Excel / CSV)"}
          <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.txt"
            disabled={busy}
            onChange={(e) => pickFiles(e.target.files)}
            className="hidden" />
        </label>
        <label className={(busy ? BUBBLE_SECONDARY + " opacity-50 cursor-not-allowed" : BUBBLE_SECONDARY + " cursor-pointer")}>
          📁 Choose a folder
          <input ref={folderRef} type="file"
            disabled={busy}
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => pickFiles(e.target.files)}
            className="hidden" />
        </label>
        {!busy && files.length > 0 && !items.length && (
          <button type="button" onClick={() => parse()} className={BUBBLE_GHOST + " text-xs"}>↻ Re-read</button>
        )}
        {!files.length && !items.length && (
          <span className="text-xs text-stone-500">Pick a folder or files — quotes, brochures, stock lists, rooming spreadsheets. We read them automatically.</span>
        )}
      </div>

      {files.length > 0 && (
        <div className="text-xs text-stone-600 flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <span key={i} className="group relative pl-3 pr-7 py-1 rounded-full bg-stone-100 border border-stone-200">
              {f.name} <span className="text-stone-400">· {(f.size/1024).toFixed(0)}kB</span>
              <button
                type="button"
                onClick={() => { setFiles((prev) => prev.filter((_, idx) => idx !== i)); if (fileRef.current) fileRef.current.value = ""; }}
                title="Remove this file"
                aria-label={`Remove ${f.name}`}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none text-white shadow"
                style={{ background: "var(--poppy)" }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {(phase === "reading" || phase === "finishing") && (() => {
        // Near the top while still reading = it's taking a while → reassure + warn.
        const lateReading = phase === "reading" && progress >= 97.5;
        return (
          <div className="space-y-1.5">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%`, background: "var(--poppy)" }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--ink-2)" }}>
              <span>
                {lateReading
                  ? "Setting up your dashboard — please be patient, this is taking longer than normal…"
                  : (phaseMsg || "Reading & detecting your items…")}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums font-medium">{Math.round(progress)}%</span>
                {phase === "reading" && (
                  <button
                    type="button"
                    onClick={cancelParse}
                    className="rounded-full px-2.5 py-0.5 font-medium bg-white border border-stone-300 text-stone-700 hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                )}
              </span>
            </div>
            {lateReading && (
              <div className="flex items-start gap-1.5 text-[11px] font-medium" style={{ color: "#a3210e" }}>
                <span aria-hidden>⚠</span>
                <span>Please don&apos;t refresh or close this page — we&apos;re almost there.</span>
              </div>
            )}
          </div>
        );
      })()}

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
          <div ref={reviewRef} className="scroll-mt-4" aria-hidden />
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
              const col = catColor(c);
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className="rounded-full px-4 py-1.5 text-xs font-medium transition inline-flex items-center gap-1.5"
                  style={
                    active
                      ? { background: col.accent, color: "#fff" }
                      : { background: "#fff", color: "var(--ink)", border: `1px solid ${col.accent}` }
                  }
                >
                  {!active && <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: col.accent }} />}
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
                    className="relative rounded-xl bg-white overflow-hidden transition hover:shadow-md"
                    style={{
                      border: "1px solid var(--line)",
                      boxShadow: "0 2px 8px rgba(28,25,23,0.08)",
                      opacity: it._include ? 1 : 0.55,
                    }}
                  >
                    {/* Left accent bar — category-coloured */}
                    <span
                      aria-hidden
                      className="absolute left-0 top-0 bottom-0 w-1.5"
                      style={{ background: it._include ? catColor(it.category).accent : "var(--line)" }}
                    />
                    <div className="p-4 pl-5 space-y-2.5">
                      {/* Category badge — category-coloured */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md"
                          style={{ background: catColor(it.category).soft, color: catColor(it.category).text }}
                        >
                          <span aria-hidden className="w-2 h-2 rounded-full" style={{ background: catColor(it.category).accent }} />
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

                      {/* Image — large + centred, with the pick/find controls underneath */}
                      <div className="flex flex-col items-center gap-2">
                        {it.data.image_url ? (
                          <div className="relative w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={String(it.data.image_url)} alt="" className="w-full aspect-[4/3] rounded-lg object-cover" style={{ border: "1px solid var(--line)" }} />
                            {includedSource === "embedded" && (
                              <span className="absolute bottom-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--leaf)", color: "#1f5d3e" }} title="From your file">📎</span>
                            )}
                          </div>
                        ) : (
                          <div className="w-full aspect-[4/3] rounded-lg flex items-center justify-center text-xs" style={{ border: "1px dashed var(--line)", background: "var(--bone)", color: "var(--ink-2)" }}>
                            no image
                          </div>
                        )}
                        <div className="flex flex-col gap-2 w-full">
                          <label
                            className="w-full box-border rounded-full px-3 py-1.5 text-[11px] text-center truncate cursor-pointer bg-white"
                            style={{ border: "1px solid var(--line)", opacity: uploadingId === it._id ? 0.6 : 1 }}
                          >
                            {uploadingId === it._id ? "Uploading…" : "📁 Pick from file"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingId === it._id}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLocalImage(it._id, f); e.target.value = ""; }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => findOnline(it._id)}
                            className="w-full box-border rounded-full px-3 py-1.5 text-[11px] text-center truncate"
                            style={{ background: "var(--ink)", color: "#fff" }}
                          >
                            🔍 Find a different image online
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
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {!isPending && includedCount > 0 && (
                  <span className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--ink-2)" }}>
                    You can edit these later <span aria-hidden>→</span>
                  </span>
                )}
                <button disabled={isPending || !includedCount} onClick={commit} className={BUBBLE_PRIMARY_LG}>
                  {isPending ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Importing — don&apos;t close this tab…
                    </>
                  ) : (
                    `Approve ${includedCount} item${includedCount === 1 ? "" : "s"} →`
                  )}
                </button>
              </div>
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
