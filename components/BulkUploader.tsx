"use client";

import { useRef, useState, useTransition } from "react";

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

const FIELDS_BY_CATEGORY: Record<string, string[]> = {
  catalogue: ["category", "name", "description", "price", "price_unit"],
  rentals: ["category", "name", "description", "price", "stock_total"],
  accommodation: ["name", "room_type", "sleeps", "price_per_night", "description"],
  caterers: ["name", "description", "price_from", "contact_email", "contact_phone", "website_url"],
  planners: ["name", "description", "price_from", "contact_email", "contact_phone", "website_url"],
  florists: ["name", "description", "price_from", "contact_email", "contact_phone", "website_url"],
  djs: ["name", "description", "price_from", "contact_email", "contact_phone", "website_url"],
  photographers: ["name", "description", "price_from", "contact_email", "contact_phone", "website_url"],
  decor: ["name", "description", "price_from", "contact_email", "contact_phone", "website_url"],
  bar: ["name", "description", "price_from", "contact_email", "contact_phone", "website_url"],
};

const BUBBLE = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition";
const BUBBLE_PRIMARY = `${BUBBLE} bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed`;
const BUBBLE_SECONDARY = `${BUBBLE} bg-white border border-stone-300 text-stone-800 hover:bg-stone-100`;
const BUBBLE_GHOST = `${BUBBLE} text-stone-700 hover:bg-stone-100`;

export function BulkUploader({ venueId }: { venueId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [extractedImages, setExtractedImages] = useState<Array<{ url: string; source_file: string; ordinal: number }>>([]);
  const [searchOpen, setSearchOpen] = useState<{ itemId: number; query: string; results: Array<{ url: string; thumb: string; alt: string; attribution: string }>; busy: boolean; err: string | null } | null>(null);
  const [fileReports, setFileReports] = useState<Array<{ filename: string; chars: number; items: number; status: string; error?: string }>>([]);
  const [filter, setFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setFiles(Array.from(list));
  }

  async function parse() {
    if (!files.length) return;
    setBusy(true); setMsg("Reading & extracting documents…"); setItems([]);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/uploads/parse", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || !j.ok) { setMsg(`Failed: ${j.error ?? "unknown"}`); return; }
      setItems(j.items as Item[]);
      setFileReports(j.files ?? []);
      setExtractedImages(j.images ?? []);
      const counts = Object.entries(j.counts as Record<string, number>).map(([k, v]) => `${v} ${CATEGORY_LABELS[k] ?? k}`).join(", ");
      setMsg(counts ? `Detected: ${counts}. Review below and confirm.` : "Nothing recognisable found — see per-file report below.");
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(false); }
  }

  function updateItem(id: number, patch: Partial<Item>) {
    setItems((curr) => curr.map((it) => it._id === id ? { ...it, ...patch } : it));
  }
  async function findOnline(itemId: number) {
    const it = items.find((x) => x._id === itemId);
    if (!it) return;
    const name = String(it.data.name ?? "").trim();
    const desc = String(it.data.description ?? "").trim();
    const query = [name, desc].filter(Boolean).join(" ").slice(0, 120) || "wedding venue";
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
    if (!payload.length) { setMsg("Nothing selected to import."); return; }
    setMsg(`Importing ${payload.length} item(s)…`);
    startTransition(async () => {
      try {
        const res = await fetch("/api/venue/uploads/commit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ venue_id: venueId, items: payload }),
        });
        const j = await res.json();
        if (!res.ok || !j.ok) { setMsg(`Failed: ${j.error ?? "unknown"}`); return; }
        const lines = Object.entries(j.summary as Record<string, number>).map(([k, v]) => `${v} → ${CATEGORY_LABELS[k] ?? k}`);
        setMsg(`Imported: ${lines.join(", ")}.`);
        setItems([]); setFiles([]); if (fileRef.current) fileRef.current.value = "";
      } catch (e) {
        setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }

  const visible = filter === "all" ? items : items.filter((it) => it.category === filter);
  const includedCount = items.filter((it) => it._include).length;

  return (
    <div className="vy-card space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <label className={BUBBLE_SECONDARY + " cursor-pointer"}>
          Choose files (PDF / Excel / CSV)
          <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.txt"
            onChange={(e) => pickFiles(e.target.files)}
            className="hidden" />
        </label>
        <button disabled={!files.length || busy} onClick={parse} className={BUBBLE_PRIMARY}>
          {busy ? "Parsing…" : `Parse ${files.length || "no"} file${files.length === 1 ? "" : "s"}`}
        </button>
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
                <tr key={r.filename} className="border-t border-stone-200">
                  <td className="py-1 pr-2 max-w-[260px] truncate" title={r.filename}>{r.filename}</td>
                  <td className="text-stone-600">{r.chars.toLocaleString()}</td>
                  <td className={r.items > 0 ? "text-emerald-700 font-medium" : "text-stone-500"}>{r.items}</td>
                  <td className={r.error ? "text-red-700" : "text-stone-600"}>{r.error ? r.error : r.status}</td>
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
          <div className="flex gap-2 flex-wrap items-center border-t border-stone-200 pt-3">
            <button onClick={() => setFilter("all")} className={`${filter === "all" ? "bg-stone-900 text-white" : "bg-white border border-stone-300"} rounded-full px-3 py-1 text-xs`}>All ({items.length})</button>
            {CATEGORY_LIST.filter((c) => items.some((i) => i.category === c)).map((c) => {
              const n = items.filter((i) => i.category === c).length;
              return (
                <button key={c} onClick={() => setFilter(c)} className={`${filter === c ? "bg-stone-900 text-white" : "bg-white border border-stone-300"} rounded-full px-3 py-1 text-xs`}>
                  {CATEGORY_LABELS[c]} ({n})
                </button>
              );
            })}
          </div>

          <div className="overflow-auto max-h-[60vh] border border-stone-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-stone-50">
                <tr>
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-2 py-2 text-left w-32">Category</th>
                  <th className="px-2 py-2 text-left w-20">Image</th>
                  <th className="px-2 py-2 text-left">Fields</th>
                  <th className="px-2 py-2 text-left w-32">Source</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((it) => {
                  const fields = FIELDS_BY_CATEGORY[it.category] ?? Object.keys(it.data);
                  return (
                    <tr key={it._id} className={`border-t ${it._include ? "" : "opacity-40"}`}>
                      <td className="px-2 py-2">
                        <input type="checkbox" checked={it._include}
                          onChange={(e) => updateItem(it._id, { _include: e.target.checked })} />
                      </td>
                      <td className="px-2 py-2">
                        <select value={it.category}
                          onChange={(e) => updateItem(it._id, { category: e.target.value })}
                          className="w-full border rounded-full px-2 py-1 text-xs">
                          {CATEGORY_LIST.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        {it.data.image_url ? (
                          <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={String(it.data.image_url)} alt="" className="h-14 w-14 rounded border border-stone-200 object-cover" />
                            {it.image_source === "online" && (
                              <span className="absolute -bottom-1 -right-1 bg-amber-100 text-amber-800 text-[9px] px-1 rounded-full border border-amber-200" title="Auto-fetched from Unsplash">🌐</span>
                            )}
                            {it.image_source === "embedded" && (
                              <span className="absolute -bottom-1 -right-1 bg-emerald-100 text-emerald-800 text-[9px] px-1 rounded-full border border-emerald-200" title="From your file">📎</span>
                            )}
                          </div>
                        ) : (
                          <div className="h-14 w-14 rounded border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-stone-400 text-[10px]">none</div>
                        )}
                        <select value=""
                          onChange={(e) => { if (e.target.value) updateField(it._id, "image_url", e.target.value); }}
                          className="mt-1 w-20 border rounded-full px-1 py-0.5 text-[10px] bg-white">
                          <option value="">pick…</option>
                          {extractedImages.map((img) => (
                            <option key={img.url} value={img.url}>
                              {img.source_file.slice(0, 14)}…/#{img.ordinal + 1}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => findOnline(it._id)}
                          className="mt-1 w-20 rounded-full bg-stone-900 text-white text-[10px] px-1 py-0.5 hover:bg-stone-700">
                          🔍 Find online
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="grid grid-cols-2 gap-1">
                          {fields.map((k) => (
                            <input key={k}
                              value={String(it.data[k] ?? "")}
                              onChange={(e) => updateField(it._id, k, e.target.value)}
                              placeholder={k}
                              className="border rounded px-2 py-1 text-xs" />
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-stone-500 truncate max-w-[120px]" title={it.source_file ?? ""}>{it.source_file ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex gap-2">
              <button onClick={() => setItems((c) => c.map((it) => ({ ...it, _include: true })))} className={BUBBLE_GHOST + " text-xs"}>Select all</button>
              <button onClick={() => setItems((c) => c.map((it) => ({ ...it, _include: false })))} className={BUBBLE_GHOST + " text-xs"}>Select none</button>
            </div>
            <button disabled={isPending || !includedCount} onClick={commit} className={BUBBLE_PRIMARY}>
              {isPending ? "Importing…" : `Import ${includedCount} item${includedCount === 1 ? "" : "s"}`}
            </button>
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
              {searchOpen.busy && <p className="text-xs text-stone-500">Searching Unsplash…</p>}
              {!searchOpen.busy && searchOpen.results.length === 0 && !searchOpen.err && (
                <p className="text-xs text-stone-500">No results. Try a more generic query like the item type.</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {searchOpen.results.map((r) => (
                  <button key={r.url} onClick={() => {
                    updateField(searchOpen.itemId, "image_url", r.url);
                    setSearchOpen(null);
                  }} className="text-left group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.thumb} alt={r.alt} className="aspect-[4/3] w-full object-cover rounded-lg border border-stone-200 group-hover:border-stone-900 transition" />
                    <div className="text-[10px] text-stone-500 mt-1 truncate">📷 {r.attribution}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 pt-2 border-t border-stone-200">
                Images from Unsplash. Licence-free for commercial use. Attribution shown.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
