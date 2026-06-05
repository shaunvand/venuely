"use client";

import { useState, useRef, useTransition } from "react";
import { bulkDelete, bulkSetActive, bulkSetPrice, bulkSetCommission, bulkSetCostTreatment, updateItem, bulkInsert, addItem } from "@/app/venue/_inventory/actions";
import type { InventoryType } from "@/lib/inventory/schemas";

type Field = { key: string; label: string; type: "string" | "number" | "select"; options: string[] | null; required?: boolean };
type Item = Record<string, unknown> & { id: string; active?: boolean };
type ImportPreviewRow = Record<string, unknown> & { _include?: boolean };

const BUBBLE = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition";
const BUBBLE_PRIMARY = `${BUBBLE} bg-[var(--poppy)] text-white hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed`;
const BUBBLE_SECONDARY = `${BUBBLE} bg-white border border-stone-300 text-stone-800 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed`;
const BUBBLE_DANGER = `${BUBBLE} bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed`;
const BUBBLE_GHOST = `${BUBBLE} text-stone-700 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed`;

export function InventoryManager({
  type,
  venueId,
  items,
  fields,
  priceColumn,
  showExtraColumns = false,
}: {
  type: InventoryType;
  venueId: string;
  items: Item[];
  fields: Field[];
  priceColumn: "price" | "price_per_night" | "price_from";
  showExtraColumns?: boolean;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<"add" | "edit">("add");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  const [uploadingImg, setUploadingImg] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCommission, setBulkCommission] = useState("");
  const [bulkCommissionType, setBulkCommissionType] = useState<"fixed" | "percent">("percent");
  const [query, setQuery] = useState("");
  // Which card+field is being inline-edited directly on the row (price / stock /
  // commission), so the owner can tweak money without opening the full editor.
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: "price" | "stock" | "commission" } | null>(null);

  const displayed = query.trim()
    ? items.filter((i) => {
        const q = query.trim().toLowerCase();
        return (
          String(i.name ?? "").toLowerCase().includes(q) ||
          String(i.category ?? "").toLowerCase().includes(q) ||
          String(i.description ?? "").toLowerCase().includes(q)
        );
      })
    : items;
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importFields, setImportFields] = useState<Field[]>([]);

  // Scope "Select all on this page" to the FILTERED set the owner can actually see,
  // so the checkbox state and bulk-select match what's displayed (not the full list).
  const displayedChecked = displayed.filter((i) => selected.has(i.id)).length;
  const allChecked = displayed.length > 0 && displayedChecked === displayed.length;
  const someChecked = displayedChecked > 0 && displayedChecked < displayed.length;

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) for (const i of displayed) next.add(i.id);
      else for (const i of displayed) next.delete(i.id);
      return next;
    });
  }
  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  }

  function startEdit(item: Item) {
    setEditMode("edit");
    setEditingId(item.id);
    const draft: Record<string, unknown> = {};
    for (const f of fields) draft[f.key] = item[f.key] ?? "";
    setEditDraft(draft);
    setEditOpen(true);
  }
  function startAdd() {
    setEditMode("add");
    setEditingId(null);
    const draft: Record<string, unknown> = {};
    for (const f of fields) draft[f.key] = "";
    if (fields.some((f) => f.key === "price_unit")) draft.price_unit = "fixed";
    if (fields.some((f) => f.key === "stock_total")) draft.stock_total = 1;
    if (fields.some((f) => f.key === "sleeps")) draft.sleeps = 2;
    setEditDraft(draft);
    setEditOpen(true);
  }
  function saveEdit() {
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      const v = editDraft[f.key];
      if (f.type === "number") patch[f.key] = v === "" || v == null ? null : Number(v);
      else if (f.key === "amenities") {
        // text[] column — accept a comma-separated list (or an existing array) and store an array.
        if (Array.isArray(v)) patch[f.key] = v;
        else {
          const parts = String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          patch[f.key] = parts.length ? parts : null;
        }
      } else if (f.key === "bridal_suite") {
        // boolean (NOT NULL) column — coerce the "true"/"false" select value, default false when blank.
        patch[f.key] = v === true || v === "true";
      } else patch[f.key] = v === "" ? null : v;
    }
    const missing = fields.filter((f) => f.required && !String(editDraft[f.key] ?? "").trim());
    if (missing.length) return;
    startTransition(async () => {
      if (editMode === "edit" && editingId) {
        await updateItem(type, editingId, patch);
      } else {
        await addItem(type, venueId, patch);
      }
      setEditOpen(false); setEditingId(null);
    });
  }

  async function uploadImage(f: File) {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok && j.ok) setEditDraft((d) => ({ ...d, image_url: j.url }));
      else alert(`Upload failed: ${j.error ?? "unknown"}`);
    } catch (e) {
      alert(`Upload error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setUploadingImg(false); }
  }

  function doBulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} item(s)?`)) return;
    const ids = Array.from(selected);
    startTransition(async () => { await bulkDelete(type, ids); setSelected(new Set()); });
  }
  function doBulkActive(active: boolean) {
    if (!selected.size) return;
    const ids = Array.from(selected);
    startTransition(async () => { await bulkSetActive(type, ids, active); });
  }
  function doBulkPrice() {
    const n = Number(bulkPrice);
    if (!Number.isFinite(n) || !selected.size) return;
    const ids = Array.from(selected);
    startTransition(async () => { await bulkSetPrice(type, ids, n); setBulkPrice(""); });
  }
  function doBulkCommission() {
    const n = Number(bulkCommission);
    if (!Number.isFinite(n) || !selected.size) return;
    const ids = Array.from(selected);
    startTransition(async () => { await bulkSetCommission(type, ids, n, bulkCommissionType); setBulkCommission(""); });
  }
  function doBulkCostTreatment(treatment: "included" | "extra") {
    if (!selected.size) return;
    const ids = Array.from(selected);
    startTransition(async () => { await bulkSetCostTreatment(type, ids, treatment); });
  }
  async function deleteSingle(id: string) {
    if (!confirm("Delete this item?")) return;
    startTransition(async () => { await bulkDelete(type, [id]); });
  }
  function toggleActiveSingle(id: string, active: boolean) {
    startTransition(async () => { await bulkSetActive(type, [id], active); });
  }

  // Inline single-field saves (reuse the generic updateItem action).
  function saveInlinePrice(id: string, v: string) {
    const n = v.trim() === "" ? null : Number(v);
    if (n != null && !Number.isFinite(n)) return;
    startTransition(async () => { await updateItem(type, id, { [priceColumn]: n }); setInlineEdit(null); });
  }
  function saveInlineStock(id: string, v: string) {
    const n = v.trim() === "" ? null : Math.max(0, Math.round(Number(v)));
    if (n != null && !Number.isFinite(n)) return;
    startTransition(async () => { await updateItem(type, id, { stock_total: n }); setInlineEdit(null); });
  }
  function saveInlineCommission(id: string, v: string, t: "fixed" | "percent") {
    const n = v.trim() === "" ? 0 : Number(v);
    if (!Number.isFinite(n)) return;
    startTransition(async () => { await updateItem(type, id, { commission_value: n, commission_type: t }); setInlineEdit(null); });
  }

  async function onImportFile(f: File) {
    setImporting(true); setImportMsg("Reading sheet & detecting columns…");
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("type", type);
      const res = await fetch("/api/venue/inventory/parse", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || !j.ok) { setImportMsg(`Import failed: ${j.error ?? "unknown"}`); return; }
      setImportFields(j.fields);
      setImportPreview((j.preview as Record<string, unknown>[]).map((r) => ({ ...r, _include: true })));
      const mapped = Object.entries(j.mapping || {}).filter(([, v]) => v).length;
      setImportMsg(`Detected ${mapped} columns. Review rows below — uncheck any you don't want, edit, then confirm.`);
    } catch (e) {
      setImportMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setImporting(false); }
  }

  function commitImport() {
    const numericKeys = new Set(importFields.filter((f) => f.type === "number").map((f) => f.key));
    const rows = importPreview.filter((r) => r._include).map((r) => {
      const out: Record<string, unknown> = {};
      for (const f of importFields) {
        const v = r[f.key];
        if (v === "" || v == null) continue;
        out[f.key] = numericKeys.has(f.key) ? Number(v) : v;
      }
      return out;
    }).filter((r) => r.name);
    if (!rows.length) { setImportMsg("Nothing to import — each row needs a Name."); return; }
    startTransition(async () => {
      try {
        await bulkInsert(type, venueId, rows);
        setImportMsg(`Imported ${rows.length} item(s).`);
        setImportPreview([]); setImportFields([]);
        setTimeout(() => { setImportOpen(false); setImportMsg(null); }, 1200);
      } catch (e) {
        setImportMsg(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }

  const hasCategory = fields.some((f) => f.key === "category");
  const hasStock = fields.some((f) => f.key === "stock_total");
  const hasCommission = fields.some((f) => f.key === "commission_value");

  return (
    <div className="vy-card space-y-4">
      {/* Top action row */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="text-sm text-stone-600">
          {query.trim() ? `${displayed.length} of ${items.length}` : items.length} item{items.length === 1 ? "" : "s"}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            className="border rounded-full px-4 py-2 text-sm w-48 focus:w-64 transition-[width]"
          />
          <button type="button" onClick={startAdd} className={BUBBLE_PRIMARY}>
            + Add item
          </button>
          <button type="button" onClick={() => setImportOpen(true)} className={BUBBLE_SECONDARY}>
            ⬆ Smart import (Excel)
          </button>
          <a href={`/api/venue/inventory/template?type=${type}`} className={BUBBLE_GHOST}>
            ↓ Download template
          </a>
        </div>
      </div>

      {/* Bulk bar (shown only when any row is selected) */}
      {selected.size > 0 && (
        <div className="flex gap-2 flex-wrap items-center rounded-lg border border-stone-300 bg-stone-50 p-3">
          <span className="text-xs text-stone-700 font-medium">{selected.size} selected</span>
          <button disabled={isPending} onClick={() => doBulkActive(true)} className={BUBBLE_GHOST}>● Set active</button>
          <button disabled={isPending} onClick={() => doBulkActive(false)} className={BUBBLE_GHOST}>○ Set not active</button>
          <div className="flex gap-1 items-center">
            <input type="number" step="0.01" placeholder="R"
              value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)}
              className="w-24 border rounded-full px-3 py-1.5 text-sm" />
            <button disabled={!bulkPrice || isPending} onClick={doBulkPrice} className={BUBBLE_SECONDARY}>Set price</button>
          </div>
          <div className="flex gap-1 items-center">
            <input type="number" step="0.01" placeholder={bulkCommissionType === "percent" ? "%" : "R"}
              value={bulkCommission} onChange={(e) => setBulkCommission(e.target.value)}
              className="w-20 border rounded-full px-3 py-1.5 text-sm" />
            <select value={bulkCommissionType} onChange={(e) => setBulkCommissionType(e.target.value as "fixed" | "percent")}
              className="border rounded-full px-2 py-1.5 text-sm bg-white">
              <option value="percent">%</option>
              <option value="fixed">R fixed</option>
            </select>
            <button disabled={!bulkCommission || isPending} onClick={doBulkCommission} className={BUBBLE_SECONDARY}>Set commission</button>
          </div>
          <div className="flex gap-1 items-center">
            <button disabled={isPending} onClick={() => doBulkCostTreatment("included")} className={BUBBLE_GHOST}>Mark included</button>
            <button disabled={isPending} onClick={() => doBulkCostTreatment("extra")} className={BUBBLE_GHOST}>Mark extra</button>
          </div>
          <button disabled={isPending} onClick={doBulkDelete} className={BUBBLE_DANGER}>Delete</button>
          <button disabled={isPending} onClick={() => setSelected(new Set())} className={BUBBLE_GHOST}>Clear</button>
        </div>
      )}

      {/* Item list */}
      {items.length === 0 ? (
        <div className="vy-empty">Nothing here yet. Add your first above or use Smart import.</div>
      ) : displayed.length === 0 ? (
        <div className="vy-empty">No items match &ldquo;{query}&rdquo;.</div>
      ) : (
        <div className="space-y-3">
          {/* Tiny select-all bar above cards */}
          <label className="flex items-center gap-2 text-xs px-1" style={{ color: "var(--ink-2)" }}>
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => { if (el) el.indeterminate = someChecked; }}
              onChange={(e) => toggleAll(e.target.checked)}
              style={{ accentColor: "var(--poppy)" }}
            />
            Select all on this page
          </label>

          {/* Horizontal card list — LekkeSlaap-style row, Venuely brand colours */}
          <ul className="space-y-3">
            {displayed.map((i) => {
              const img = i.image_url as string | undefined;
              const base = Number(i[priceColumn] ?? 0);
              const cv = Number(i.commission_value ?? 0);
              const ct = String(i.commission_type ?? "fixed");
              const commissionAmt = ct === "percent" ? Math.round(base * cv) / 100 : cv;
              const stock = Number(i.stock_total ?? 0);
              const isSel = selected.has(i.id);
              return (
                <li
                  key={i.id}
                  className="relative rounded-2xl bg-white flex items-stretch gap-4 p-3 sm:p-4 transition hover:shadow-md"
                  style={{
                    border: "1px solid var(--line)",
                    boxShadow: isSel ? "0 0 0 2px var(--poppy)" : undefined,
                  }}
                >
                  {/* Left edge accent */}
                  <span
                    aria-hidden
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-r-md"
                    style={{ background: i.active ? "var(--poppy)" : "var(--line)" }}
                  />

                  {/* Image */}
                  <div className="flex-shrink-0 self-center pl-2">
                    {img ? (
                      <button
                        type="button"
                        onClick={() => setZoomUrl(img)}
                        className="block h-20 w-20 sm:h-24 sm:w-24 rounded-xl overflow-hidden transition hover:scale-[1.04]"
                        style={{ border: "1px solid var(--line)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <div
                        className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl flex items-center justify-center text-[10px]"
                        style={{ border: "1px dashed var(--line)", background: "var(--bone)", color: "var(--ink-2)" }}
                      >
                        no image
                      </div>
                    )}
                  </div>

                  {/* Middle: identity + description */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {hasCategory && i.category ? (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md"
                          style={{ background: "var(--cream)", color: "var(--poppy-deep)" }}
                        >
                          {String(i.category)}
                        </span>
                      ) : null}
                      {showExtraColumns && (stock > 0 ? (
                        <span className="text-[10px] font-medium" style={{ color: "#1f5d3e" }}>● {stock} available</span>
                      ) : (
                        <span className="text-[10px] font-medium" style={{ color: "var(--poppy-deep)" }}>○ on request</span>
                      ))}
                    </div>
                    <div className="font-serif text-base sm:text-lg leading-tight truncate" style={{ fontWeight: 700 }}>
                      {String(i.name ?? "")}
                    </div>
                    {i.description ? (
                      <div className="text-xs leading-relaxed line-clamp-2 max-w-2xl" style={{ color: "var(--ink-2)" }}>
                        {String(i.description)}
                      </div>
                    ) : null}
                    {type === "accommodation" && (i.sleeps || i.room_type || i.tier || i.bridal_suite === true || i.bridal_suite === "true") ? (
                      <div className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: "var(--ink-2)" }}>
                        {i.sleeps ? <span>🛏 Sleeps {String(i.sleeps)}{i.max_sleeps && i.max_sleeps !== i.sleeps ? `–${String(i.max_sleeps)}` : ""}</span> : null}
                        {(i.room_type || i.tier) ? <span>· {String(i.room_type || i.tier)}</span> : null}
                        {(i.bridal_suite === true || i.bridal_suite === "true") ? <span style={{ color: "var(--poppy-deep)" }}>· Bridal suite</span> : null}
                        {(i.amenities && Array.isArray(i.amenities) && i.amenities.length) ? <span>· {(i.amenities as string[]).slice(0, 3).join(", ")}</span> : null}
                      </div>
                    ) : null}
                  </div>

                  {/* Right: editable price / stock / commission + actions */}
                  <div className="flex-shrink-0 flex flex-col items-end justify-between gap-2 sm:min-w-[220px] pr-1">
                    <div className="flex flex-col items-end gap-1 text-right">
                      {/* PRICE — click to edit inline */}
                      {inlineEdit?.id === i.id && inlineEdit.field === "price" ? (
                        <InlineNumber
                          initial={base ? String(base) : ""}
                          prefix="R"
                          pending={isPending}
                          onCancel={() => setInlineEdit(null)}
                          onSave={(v) => saveInlinePrice(i.id, v)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setInlineEdit({ id: i.id, field: "price" })}
                          className="group rounded-full px-3 py-1 text-sm font-semibold transition hover:shadow-sm inline-flex items-center gap-1.5"
                          style={{ background: "var(--cream)", color: "var(--poppy-deep)", border: "1px solid #f3d2cd" }}
                          title="Click to edit price"
                        >
                          R{base.toLocaleString("en-ZA")}
                          <span className="opacity-40 group-hover:opacity-80 text-[10px]" aria-hidden>✎</span>
                        </button>
                      )}

                      {/* STOCK — rentals only */}
                      {hasStock && (inlineEdit?.id === i.id && inlineEdit.field === "stock" ? (
                        <InlineNumber
                          initial={stock ? String(stock) : ""}
                          suffix="in stock"
                          pending={isPending}
                          onCancel={() => setInlineEdit(null)}
                          onSave={(v) => saveInlineStock(i.id, v)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setInlineEdit({ id: i.id, field: "stock" })}
                          className="group rounded-full px-3 py-1 text-[11px] font-medium transition hover:shadow-sm inline-flex items-center gap-1.5"
                          style={stock > 0
                            ? { background: "var(--leaf)", color: "#1f5d3e", border: "1px solid #c2dbcf" }
                            : { background: "var(--bone)", color: "var(--ink-2)", border: "1px solid var(--line)" }}
                          title="Click to edit stock"
                        >
                          {stock > 0 ? `${stock} in stock` : "Set stock"}
                          <span className="opacity-40 group-hover:opacity-80 text-[10px]" aria-hidden>✎</span>
                        </button>
                      ))}

                      {/* COMMISSION — value + fixed/percent */}
                      {hasCommission && (inlineEdit?.id === i.id && inlineEdit.field === "commission" ? (
                        <InlineCommission
                          initialValue={cv ? String(cv) : ""}
                          initialType={ct === "percent" ? "percent" : "fixed"}
                          pending={isPending}
                          onCancel={() => setInlineEdit(null)}
                          onSave={(v, t) => saveInlineCommission(i.id, v, t)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setInlineEdit({ id: i.id, field: "commission" })}
                          className="group rounded-full px-3 py-1 text-[11px] font-medium transition hover:shadow-sm inline-flex items-center gap-1.5"
                          style={cv > 0
                            ? { background: "var(--sage-2)", color: "#3F6B4D", border: "1px solid #c2cdbc" }
                            : { background: "#fff", color: "var(--ink-2)", border: "1px solid var(--line)" }}
                          title="Click to edit commission"
                        >
                          <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: cv > 0 ? "#5F8B6A" : "var(--sage)" }} />
                          {cv > 0
                            ? `${ct === "percent" ? `${cv}%` : `R${cv.toLocaleString("en-ZA")}`} commission${commissionAmt > 0 ? ` · R${Math.round(commissionAmt).toLocaleString("en-ZA")}` : ""}`
                            : "Set commission"}
                          <span className="opacity-40 group-hover:opacity-80 text-[10px]" aria-hidden>✎</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleActiveSingle(i.id, !i.active)}
                        className="rounded-full px-3 py-1 text-[11px] font-medium transition"
                        style={
                          i.active
                            ? { background: "var(--leaf)", color: "#1f5d3e", border: "1px solid #c2dbcf" }
                            : { background: "var(--bone)", color: "var(--ink-2)", border: "1px solid var(--line)" }
                        }
                      >
                        {i.active ? "● Active" : "○ Not active"}
                      </button>
                      <button
                        onClick={() => startEdit(i)}
                        className="rounded-full px-3 py-1 text-[11px] font-medium transition hover:bg-stone-100"
                        style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSingle(i.id)}
                        className="rounded-full px-3 py-1 text-[11px] font-medium transition hover:text-red-700"
                        style={{ color: "var(--ink-2)" }}
                      >
                        Remove
                      </button>
                      <label className="ml-1 flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={(e) => toggle(i.id, e.target.checked)}
                          style={{ accentColor: "var(--poppy)" }}
                          aria-label={`Select ${String(i.name ?? "item")}`}
                        />
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Add / edit lightbox */}
      {editOpen && (
        <Lightbox onClose={() => { setEditOpen(false); setEditingId(null); }} title={editMode === "add" ? "Add new item" : "Edit item"}>
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 pb-4 border-b border-stone-200">
              {editDraft.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={String(editDraft.image_url)} alt="" className="h-32 w-32 rounded-lg border border-stone-200 object-cover" />
              ) : (
                <div className="h-32 w-32 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-stone-400 text-xs">No image</div>
              )}
              <div className="flex gap-2">
                <label className={BUBBLE_SECONDARY + " cursor-pointer"}>
                  {uploadingImg ? "Uploading…" : "Upload image"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                </label>
                {editDraft.image_url ? (
                  <button type="button" onClick={() => setEditDraft({ ...editDraft, image_url: "" })} className={BUBBLE_GHOST}>Remove</button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {fields.filter((f) => f.key !== "image_url").map((f) => (
                <div key={f.key} className={f.key === "description" ? "col-span-2 space-y-1" : "space-y-1"}>
                  <label className="text-xs text-stone-600 font-medium">{f.label}{f.required ? <span className="text-red-600"> *</span> : null}</label>
                  {f.type === "select" ? (
                    <select className="w-full border rounded-full px-3 py-2 text-sm"
                      value={String(editDraft[f.key] ?? "")}
                      onChange={(e) => setEditDraft({ ...editDraft, [f.key]: e.target.value })}>
                      {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="w-full border rounded-full px-3 py-2 text-sm"
                      type={f.type === "number" ? "number" : "text"}
                      value={String(editDraft[f.key] ?? "")}
                      onChange={(e) => setEditDraft({ ...editDraft, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-stone-600 font-medium">Image URL (or upload above)</label>
              <input className="w-full border rounded-full px-3 py-2 text-sm" type="url"
                value={String(editDraft.image_url ?? "")}
                onChange={(e) => setEditDraft({ ...editDraft, image_url: e.target.value })}
                placeholder="https://…" />
            </div>
          </div>
          {(() => {
            const missing = fields.filter((f) => f.required && !String(editDraft[f.key] ?? "").trim()).map((f) => f.label);
            return (
              <>
                {missing.length > 0 && (
                  <p className="text-xs text-red-700 mt-3">Required: {missing.join(", ")}</p>
                )}
                <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-stone-200">
                  <button onClick={() => { setEditOpen(false); setEditingId(null); }} className={BUBBLE_GHOST}>Cancel</button>
                  <button disabled={isPending || missing.length > 0} onClick={saveEdit} className={BUBBLE_PRIMARY}>
                    {editMode === "add" ? "Add item" : "Save"}
                  </button>
                </div>
              </>
            );
          })()}
        </Lightbox>
      )}

      {/* Image zoom modal */}
      {zoomUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8" onClick={() => setZoomUrl(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt="" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}

      {/* Smart import lightbox */}
      {importOpen && (
        <Lightbox onClose={() => { setImportOpen(false); setImportPreview([]); setImportMsg(null); }} title={`Smart import — ${type}`}>
          <div className="space-y-3">
            <p className="text-xs text-stone-600">
              Upload any Excel/CSV file. Our AI maps your columns to the right fields. Review and edit below, then confirm.
              {" "}Got a <strong>PDF</strong> price list? Use <a href="/venue/uploads" className="underline" style={{ color: "var(--poppy)" }}>Smart Import</a> in the sidebar — it reads PDFs too.
            </p>
            <div className="flex gap-2 items-center flex-wrap">
              <label className={BUBBLE_PRIMARY + " cursor-pointer"}>
                Choose file
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); }}
                  className="hidden" />
              </label>
              <a href={`/api/venue/inventory/template?type=${type}`} className={BUBBLE_GHOST}>↓ Template</a>
            </div>
            {importing && (
              <div className="h-1.5 w-full overflow-hidden rounded bg-stone-200">
                <div className="h-full w-1/3 animate-[vyImportBar_1.1s_ease-in-out_infinite] rounded bg-stone-900" />
              </div>
            )}
            {importMsg && <p className="text-xs text-stone-700">{importMsg}</p>}

            {importPreview.length > 0 && (
              <>
                <div className="overflow-auto max-h-[50vh] border border-stone-200 rounded">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-stone-50">
                      <tr>
                        <th className="px-2 py-1.5 w-6"></th>
                        {importFields.map((f) => <th key={f.key} className="px-2 py-1.5 text-left">{f.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((r, idx) => (
                        <tr key={idx} className={`border-t ${r._include ? "" : "opacity-40"}`}>
                          <td className="px-2 py-1"><input type="checkbox" checked={!!r._include}
                            onChange={(e) => { const c = [...importPreview]; c[idx] = { ...c[idx], _include: e.target.checked }; setImportPreview(c); }} /></td>
                          {importFields.map((f) => (
                            <td key={f.key} className="px-1 py-1">
                              {f.type === "select" ? (
                                <select className="w-full border rounded px-1 py-0.5 text-xs"
                                  value={String(r[f.key] ?? "")}
                                  onChange={(e) => { const c = [...importPreview]; c[idx] = { ...c[idx], [f.key]: e.target.value }; setImportPreview(c); }}>
                                  <option value=""></option>
                                  {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input className="w-full border rounded px-1 py-0.5 text-xs"
                                  type={f.type === "number" ? "number" : "text"}
                                  value={String(r[f.key] ?? "")}
                                  onChange={(e) => { const c = [...importPreview]; c[idx] = { ...c[idx], [f.key]: e.target.value }; setImportPreview(c); }} />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setImportPreview([]); if (fileRef.current) fileRef.current.value = ""; }} className={BUBBLE_GHOST}>Discard</button>
                  <button disabled={isPending} onClick={commitImport} className={BUBBLE_PRIMARY}>
                    Import {importPreview.filter((r) => r._include).length} item(s)
                  </button>
                </div>
              </>
            )}
          </div>
        </Lightbox>
      )}
    </div>
  );
}

// Inline numeric editor used on the item row (price / stock). Holds its own
// draft so typing doesn't re-render the whole list; Enter saves, Esc cancels.
function InlineNumber({ initial, prefix, suffix, pending, onSave, onCancel }: {
  initial: string;
  prefix?: string;
  suffix?: string;
  pending: boolean;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <span className="inline-flex items-center gap-1">
      {prefix && <span className="text-xs" style={{ color: "var(--ink-2)" }}>{prefix}</span>}
      <input
        autoFocus
        type="number"
        step="0.01"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(v); else if (e.key === "Escape") onCancel(); }}
        className="w-20 border rounded-full px-2 py-0.5 text-sm"
        style={{ borderColor: "var(--line)" }}
      />
      {suffix && <span className="text-[10px]" style={{ color: "var(--ink-2)" }}>{suffix}</span>}
      <button type="button" disabled={pending} onClick={() => onSave(v)} className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--leaf)", color: "#1f5d3e" }} aria-label="Save">✓</button>
      <button type="button" onClick={onCancel} className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ color: "var(--ink-2)" }} aria-label="Cancel">✕</button>
    </span>
  );
}

// Inline commission editor: a value plus a fixed (R) / percent (%) toggle.
function InlineCommission({ initialValue, initialType, pending, onSave, onCancel }: {
  initialValue: string;
  initialType: "fixed" | "percent";
  pending: boolean;
  onSave: (v: string, t: "fixed" | "percent") => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initialValue);
  const [t, setT] = useState<"fixed" | "percent">(initialType);
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        type="number"
        step="0.01"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(v, t); else if (e.key === "Escape") onCancel(); }}
        className="w-16 border rounded-full px-2 py-0.5 text-sm"
        style={{ borderColor: "var(--line)" }}
      />
      <select
        value={t}
        onChange={(e) => setT(e.target.value as "fixed" | "percent")}
        className="border rounded-full px-1.5 py-0.5 text-xs bg-white"
        style={{ borderColor: "var(--line)" }}
        aria-label="Commission type"
      >
        <option value="percent">%</option>
        <option value="fixed">R fixed</option>
      </select>
      <button type="button" disabled={pending} onClick={() => onSave(v, t)} className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--leaf)", color: "#1f5d3e" }} aria-label="Save">✓</button>
      <button type="button" onClick={onCancel} className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ color: "var(--ink-2)" }} aria-label="Cancel">✕</button>
    </span>
  );
}

// 40×40 thumbnail. Hover state is driven by the FIXED-size wrapper, so the
// enlarged (5×) image — which is pointer-events-none and overflows the cell —
// never holds the hover open. Moving the pointer outside the original 40px
// footprint collapses it instantly, even if still over the big image.
function ZoomThumb({ img, onClick }: { img: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative block h-10 w-10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img}
        alt=""
        className={`absolute left-0 top-0 h-10 w-10 rounded border border-stone-200 object-cover origin-left pointer-events-none transition-transform duration-200 ${
          hovered ? "scale-[5] z-50 shadow-2xl rounded-lg" : "scale-100"
        }`}
      />
    </button>
  );
}

function Lightbox({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 sticky top-0 bg-white">
          <h3 className="font-medium">{title}</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900 rounded-full h-8 w-8 flex items-center justify-center hover:bg-stone-100">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
