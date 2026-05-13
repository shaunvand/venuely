"use client";

import { useState, useRef, useTransition } from "react";
import { bulkDelete, bulkSetActive, bulkSetPrice, updateItem, bulkInsert } from "@/app/venue/_inventory/actions";
import type { InventoryType } from "@/lib/inventory/schemas";

type Field = { key: string; label: string; type: "string" | "number" | "select"; options: string[] | null };
type Item = Record<string, unknown> & { id: string; active?: boolean };
type ImportPreviewRow = Record<string, unknown> & { _include?: boolean };

export function InventoryManager({
  type,
  venueId,
  items,
  fields,
  priceColumn,
}: {
  type: InventoryType;
  venueId: string;
  items: Item[];
  fields: Field[];
  priceColumn: "price" | "price_per_night";
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  const [bulkPrice, setBulkPrice] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importFields, setImportFields] = useState<Field[]>([]);

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(items.map((i) => i.id)) : new Set());
  }
  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    const draft: Record<string, unknown> = {};
    for (const f of fields) draft[f.key] = item[f.key] ?? "";
    setEditDraft(draft);
  }
  function saveEdit() {
    if (!editingId) return;
    const id = editingId;
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      const v = editDraft[f.key];
      if (f.type === "number") patch[f.key] = v === "" || v == null ? null : Number(v);
      else patch[f.key] = v === "" ? null : v;
    }
    startTransition(async () => {
      await updateItem(type, id, patch);
      setEditingId(null);
    });
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

  const allChecked = items.length > 0 && selected.size === items.length;

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setEditOpen(true)} className="vy-btn vy-btn-secondary">
          ✎ Edit / bulk
        </button>
        <button type="button" onClick={() => setImportOpen(true)} className="vy-btn vy-btn-secondary">
          ⬆ Smart import (Excel)
        </button>
        <a href={`/api/venue/inventory/template?type=${type}`} className="vy-btn vy-btn-ghost text-sm">
          ↓ Download template
        </a>
      </div>

      {editOpen && (
        <Lightbox onClose={() => { setEditOpen(false); setSelected(new Set()); setEditingId(null); }} title={`Manage ${type}`}>
          <div className="flex gap-2 flex-wrap items-center mb-3 pb-3 border-b border-stone-200">
            <span className="text-xs text-stone-600">{selected.size} selected</span>
            <button disabled={!selected.size || isPending} onClick={() => doBulkActive(true)} className="vy-btn vy-btn-ghost text-xs">Show</button>
            <button disabled={!selected.size || isPending} onClick={() => doBulkActive(false)} className="vy-btn vy-btn-ghost text-xs">Hide</button>
            <div className="flex gap-1 items-center">
              <input type="number" step="0.01" placeholder="R" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} className="w-24 border rounded px-2 py-1 text-xs" />
              <button disabled={!selected.size || !bulkPrice || isPending} onClick={doBulkPrice} className="vy-btn vy-btn-ghost text-xs">Set price</button>
            </div>
            <button disabled={!selected.size || isPending} onClick={doBulkDelete} className="vy-btn vy-btn-danger text-xs">Delete</button>
          </div>

          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs text-stone-500 border-b">
                  <th className="w-8 py-2"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Price</th>
                  <th className="py-2">Active</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-stone-100">
                    <td className="py-2"><input type="checkbox" checked={selected.has(i.id)} onChange={(e) => toggle(i.id, e.target.checked)} /></td>
                    <td className="py-2"><div className="font-medium">{String(i.name ?? "")}</div>{i.category ? <div className="text-xs text-stone-500">{String(i.category)}</div> : null}</td>
                    <td className="py-2">R{Number(i[priceColumn] ?? 0).toLocaleString()}</td>
                    <td className="py-2 text-xs">{i.active ? "● Active" : "○ Hidden"}</td>
                    <td className="py-2 text-right"><button onClick={() => startEdit(i)} className="vy-btn vy-btn-ghost text-xs">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingId && (
            <div className="mt-4 p-3 border-t border-stone-200 space-y-2">
              <div className="font-medium text-sm">Edit item</div>
              <div className="grid grid-cols-2 gap-2">
                {fields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-xs text-stone-600">{f.label}</label>
                    {f.type === "select" ? (
                      <select className="w-full border rounded px-2 py-1.5 text-sm"
                        value={String(editDraft[f.key] ?? "")}
                        onChange={(e) => setEditDraft({ ...editDraft, [f.key]: e.target.value })}>
                        {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input className="w-full border rounded px-2 py-1.5 text-sm"
                        type={f.type === "number" ? "number" : "text"}
                        value={String(editDraft[f.key] ?? "")}
                        onChange={(e) => setEditDraft({ ...editDraft, [f.key]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditingId(null)} className="vy-btn vy-btn-ghost text-xs">Cancel</button>
                <button disabled={isPending} onClick={saveEdit} className="vy-btn vy-btn-primary text-xs">Save</button>
              </div>
            </div>
          )}
        </Lightbox>
      )}

      {importOpen && (
        <Lightbox onClose={() => { setImportOpen(false); setImportPreview([]); setImportMsg(null); }} title={`Smart import — ${type}`}>
          <div className="space-y-3">
            <p className="text-xs text-stone-600">
              Upload any Excel/CSV file. Our AI maps your columns to the right fields. Review and edit below, then confirm.
            </p>
            <div className="flex gap-2 items-center">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); }}
                className="text-sm" />
              <a href={`/api/venue/inventory/template?type=${type}`} className="vy-btn vy-btn-ghost text-xs">↓ Template</a>
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
                  <button onClick={() => { setImportPreview([]); if (fileRef.current) fileRef.current.value = ""; }} className="vy-btn vy-btn-ghost text-sm">Discard</button>
                  <button disabled={isPending} onClick={commitImport} className="vy-btn vy-btn-primary text-sm">
                    Import {importPreview.filter((r) => r._include).length} item(s)
                  </button>
                </div>
              </>
            )}
          </div>
        </Lightbox>
      )}
    </>
  );
}

function Lightbox({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 sticky top-0 bg-white">
          <h3 className="font-medium">{title}</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-900">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
