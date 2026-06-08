"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addItem, updateItem, bulkDelete } from "@/app/venue/_inventory/actions";
import { VENDOR_TYPES, VENDOR_LABELS, VENDOR_DB_VALUE } from "@/lib/inventory/schemas";

type Row = Record<string, unknown> & { id: string };
const serif: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif" };
const rZA = (n: unknown) => { const v = Number(String(n ?? "").replace(/[^\d.]/g, "")); return v ? `R${Math.round(v).toLocaleString("en-ZA")}` : ""; };
// db vendor_type value → display label.
const DB_TO_LABEL: Record<string, string> = Object.fromEntries(VENDOR_TYPES.map((s) => [VENDOR_DB_VALUE[s], VENDOR_LABELS[s]]));

type Draft = { id?: string; typeSlug: string; name: string; description: string; price_from: string; contact_phone: string; contact_email: string; website_url: string; image_url: string };
const blank = (): Draft => ({ typeSlug: "caterers", name: "", description: "", price_from: "", contact_phone: "", contact_email: "", website_url: "", image_url: "" });

// One Suppliers page for all partner-vendor types — filter by category, add your own,
// bulk-pull website images. Mirrors the couple portal's supplier layout.
export function VendorPartnersManager({ venueId, items }: { venueId: string; items: Row[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  const shown = filter === "all" ? items : items.filter((i) => String(i.vendor_type) === filter);

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    try {
      const patch = {
        name: editing.name.trim(), description: editing.description, price_from: editing.price_from === "" ? null : Number(editing.price_from.replace(/[^\d.]/g, "")) || 0,
        contact_phone: editing.contact_phone, contact_email: editing.contact_email, website_url: editing.website_url, image_url: editing.image_url,
        vendor_type: VENDOR_DB_VALUE[editing.typeSlug as keyof typeof VENDOR_DB_VALUE],
      };
      if (editing.id) await updateItem("caterers", editing.id, patch);
      else await addItem(editing.typeSlug as never, venueId, patch);
      setEditing(null); router.refresh();
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Remove this supplier?")) return;
    await bulkDelete("caterers", [id]); router.refresh();
  }
  async function toggleActive(id: string, active: boolean) { await updateItem("caterers", id, { active }); router.refresh(); }

  async function uploadImage(f: File) {
    setImgBusy(true);
    try {
      const fd = new FormData(); fd.append("file", f); fd.append("venue_id", venueId);
      const r = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
      const j = await r.json(); if (r.ok && j.ok) setEditing((d) => d ? { ...d, image_url: j.url } : d);
    } finally { setImgBusy(false); }
  }
  async function fromWebsite() {
    if (!editing?.website_url.trim()) return;
    setImgBusy(true);
    try {
      const r = await fetch("/api/venue/site-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: editing.website_url, venue_id: venueId }) });
      const j = await r.json(); if (r.ok && j.ok && j.url) setEditing((d) => d ? { ...d, image_url: j.url } : d); else alert(`No image: ${j.error ?? "nothing usable"}`);
    } finally { setImgBusy(false); }
  }
  async function pullAllImages() {
    const targets = items.filter((i) => String(i.website_url ?? "").trim() && !String(i.image_url ?? "").trim());
    if (!targets.length) { setBulkMsg("No suppliers with a website and a missing image."); return; }
    setBulkBusy(true); let done = 0, failed = 0;
    for (const i of targets) {
      setBulkMsg(`Fetching ${done + failed + 1} of ${targets.length}…`);
      try {
        const r = await fetch("/api/venue/site-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: String(i.website_url), venue_id: venueId }) });
        const j = await r.json();
        if (r.ok && j.ok && j.url) { await updateItem("caterers", i.id, { image_url: j.url }); done++; } else failed++;
      } catch { failed++; }
    }
    setBulkBusy(false); setBulkMsg(`Done — ${done} updated${failed ? `, ${failed} had no usable image` : ""}.`); router.refresh();
  }

  const chip = (active: boolean): React.CSSProperties => ({ border: `1px solid ${active ? "var(--poppy)" : "var(--line)"}`, background: active ? "var(--poppy)" : "#fff", color: active ? "#fff" : "var(--ink-2)", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" });
  const cardChrome: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderLeft: "3px solid var(--poppy)", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(28,25,23,0.08)" };
  const chipStyle: React.CSSProperties = { display: "inline-block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--poppy-deep)", background: "var(--cream)", borderRadius: 999, padding: "3px 9px" };
  const field = "w-full border rounded-full px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-stone-600">{shown.length} supplier{shown.length === 1 ? "" : "s"}</div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={pullAllImages} disabled={bulkBusy} className="vy-btn vy-btn-secondary">{bulkBusy ? "Fetching images…" : "📷 Images from websites"}</button>
          <button onClick={() => setEditing(blank())} className="vy-btn vy-btn-primary">+ Add supplier</button>
        </div>
      </div>
      {bulkMsg && <p className="text-xs" style={{ color: "var(--ink-2)" }}>{bulkMsg}</p>}

      {/* Category chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setFilter("all")} style={chip(filter === "all")}>All</button>
        {VENDOR_TYPES.map((s) => <button key={s} onClick={() => setFilter(VENDOR_DB_VALUE[s])} style={chip(filter === VENDOR_DB_VALUE[s])}>{VENDOR_LABELS[s]}</button>)}
      </div>

      {shown.length === 0 ? (
        <div className="vy-empty">No suppliers {filter === "all" ? "yet" : "in this category"}. Add your trusted partners — couples see them in their portal.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
          {shown.map((i) => {
            const img = i.image_url as string | undefined;
            return (
              <div key={i.id} style={{ ...cardChrome, opacity: i.active === false ? 0.6 : 1 }}>
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
                )}
                <div style={{ padding: 14 }}>
                  <span style={chipStyle}>{DB_TO_LABEL[String(i.vendor_type)] ?? String(i.vendor_type ?? "Other")}</span>
                  <div style={{ ...serif, fontSize: 17, fontWeight: 700, marginTop: 6 }}>{String(i.name ?? "")}</div>
                  {(i.contact_phone || i.contact_email) ? <div style={{ fontSize: 12, color: "#57534e", marginTop: 3 }}>{[i.contact_phone, i.contact_email].filter(Boolean).join(" · ")}</div> : null}
                  {rZA(i.price_from) ? <div style={{ color: "var(--poppy)", fontWeight: 700, fontSize: 14, marginTop: 4 }}>From {rZA(i.price_from)}</div> : null}
                  {i.description ? <div style={{ fontSize: 12.5, color: "#57534e", fontStyle: "italic", margin: "8px 0" }}>{String(i.description)}</div> : null}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button onClick={() => toggleActive(i.id, i.active === false)} className="rounded-full px-3 py-1 text-[11px] font-medium" style={i.active === false ? { background: "var(--bone)", color: "var(--ink-2)", border: "1px solid var(--line)" } : { background: "var(--leaf)", color: "#1f5d3e", border: "1px solid #c2dbcf" }}>{i.active === false ? "○ Hidden" : "● Active"}</button>
                    <button onClick={() => setEditing({ id: i.id, typeSlug: (VENDOR_TYPES.find((s) => VENDOR_DB_VALUE[s] === String(i.vendor_type)) ?? "caterers"), name: String(i.name ?? ""), description: String(i.description ?? ""), price_from: i.price_from ? String(i.price_from) : "", contact_phone: String(i.contact_phone ?? ""), contact_email: String(i.contact_email ?? ""), website_url: String(i.website_url ?? ""), image_url: String(i.image_url ?? "") })} className="rounded-full px-3 py-1 text-[11px] font-medium" style={{ border: "1px solid var(--line)", color: "var(--ink)" }}>Edit</button>
                    <button onClick={() => remove(i.id)} className="rounded-full px-3 py-1 text-[11px] font-medium" style={{ color: "#b42318" }}>Remove</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-xl mb-4">{editing.id ? "Edit supplier" : "Add supplier"}</h3>
            <div className="flex flex-col items-center gap-2 pb-4 mb-4 border-b border-stone-200">
              {editing.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={editing.image_url} alt="" className="h-28 w-28 rounded-lg border border-stone-200 object-cover" />
                : <div className="h-28 w-28 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-stone-400 text-xs">No image</div>}
              <div className="flex gap-2 flex-wrap justify-center">
                <label className="vy-btn vy-btn-secondary cursor-pointer text-xs">{imgBusy ? "…" : "Upload"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} /></label>
                {editing.website_url.trim() && <button type="button" onClick={fromWebsite} disabled={imgBusy} className="vy-btn vy-btn-secondary text-xs">📷 From website</button>}
                {editing.image_url && <button type="button" onClick={() => setEditing({ ...editing, image_url: "" })} className="vy-btn vy-btn-ghost text-xs">Remove</button>}
              </div>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-stone-600 font-medium">Category</label>
                <select className={field} value={editing.typeSlug} onChange={(e) => setEditing({ ...editing, typeSlug: e.target.value })}>
                  {VENDOR_TYPES.map((s) => <option key={s} value={s}>{VENDOR_LABELS[s]}</option>)}
                </select></div>
              <div><label className="text-xs text-stone-600 font-medium">Name</label><input className={field} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Supplier / business name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-stone-600 font-medium">Phone</label><input className={field} value={editing.contact_phone} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} /></div>
                <div><label className="text-xs text-stone-600 font-medium">Email</label><input className={field} value={editing.contact_email} onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-stone-600 font-medium">Price from (R)</label><input className={field} value={editing.price_from} onChange={(e) => setEditing({ ...editing, price_from: e.target.value })} placeholder="0" /></div>
                <div><label className="text-xs text-stone-600 font-medium">Website</label><input className={field} value={editing.website_url} onChange={(e) => setEditing({ ...editing, website_url: e.target.value })} placeholder="https://…" /></div>
              </div>
              <div><label className="text-xs text-stone-600 font-medium">Notes / description</label><textarea className="w-full border rounded-2xl px-3 py-2 text-sm" rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-stone-200">
              <button onClick={() => setEditing(null)} className="vy-btn vy-btn-ghost">Cancel</button>
              <button onClick={save} disabled={busy || !editing.name.trim()} className="vy-btn vy-btn-primary">{busy ? "Saving…" : editing.id ? "Save" : "Add supplier"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
