"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addItem, updateItem, bulkDelete, bulkSetCommission } from "@/app/venue/_inventory/actions";
import { VENDOR_TYPES, VENDOR_LABELS, VENDOR_DB_VALUE } from "@/lib/inventory/schemas";
import { useLoading } from "@/components/LoadingProvider";

// Generic stock placeholders (attached during Smart Import) — a supplier's own
// website image always beats these, so the auto-pull treats them as replaceable.
const isStockImage = (u: unknown) => /images\.(pexels|unsplash)\.com/i.test(String(u ?? ""));
const needsSiteImage = (i: Record<string, unknown>) =>
  String(i.website_url ?? "").trim() !== "" &&
  (String(i.image_url ?? "").trim() === "" || isStockImage(i.image_url));

type Row = Record<string, unknown> & { id: string };
const serif: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif" };
const rZA = (n: unknown) => { const v = Number(String(n ?? "").replace(/[^\d.]/g, "")); return v ? `R${Math.round(v).toLocaleString("en-ZA")}` : ""; };
// db vendor_type value → display label.
const DB_TO_LABEL: Record<string, string> = Object.fromEntries(VENDOR_TYPES.map((s) => [VENDOR_DB_VALUE[s], VENDOR_LABELS[s]]));

type Draft = { id?: string; typeSlug: string; name: string; description: string; price_from: string; contact_phone: string; contact_email: string; website_url: string; image_url: string; commission_type: "percent" | "fixed"; commission_value: string };
const blank = (): Draft => ({ typeSlug: "caterers", name: "", description: "", price_from: "", contact_phone: "", contact_email: "", website_url: "", image_url: "", commission_type: "percent", commission_value: "" });
const commissionLabel = (type: unknown, value: unknown) => {
  const v = Number(value ?? 0);
  if (!v) return "";
  return String(type) === "fixed" ? `${rZA(v)} fixed` : `${v % 1 ? v.toFixed(1) : v}%`;
};

// One Suppliers page for all partner-vendor types — filter by category, add your own,
// bulk-pull website images. Mirrors the couple portal's supplier layout.
export function VendorPartnersManager({ venueId, items }: { venueId: string; items: Row[] }) {
  const router = useRouter();
  const loading = useLoading();
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  // Multi-select for bulk commission setting.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [commModal, setCommModal] = useState<{ type: "percent" | "fixed"; value: string } | null>(null);

  const shown = filter === "all" ? items : items.filter((i) => String(i.vendor_type) === filter);
  const allShownSelected = shown.length > 0 && shown.every((i) => selected.has(i.id));

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) shown.forEach((i) => next.delete(i.id));
      else shown.forEach((i) => next.add(i.id));
      return next;
    });
  }
  async function applyBulkCommission() {
    if (!commModal || !selected.size) return;
    const value = Number(commModal.value.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(value) || value < 0) return;
    setBusy(true);
    loading.show("Setting commission…");
    try {
      await bulkSetCommission("caterers", [...selected], value, commModal.type);
      setCommModal(null); setSelected(new Set());
      loading.complete("Commission set ✓"); router.refresh();
    } catch (e) { loading.hide(); throw e; } finally { setBusy(false); }
  }

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    loading.show("Saving supplier…");
    try {
      // No photo chosen but a website given → pull their site image automatically
      // (the Upload / From website / Remove controls still override it any time).
      let imageUrl = editing.image_url;
      if (!imageUrl.trim() && editing.website_url.trim()) {
        try {
          const r = await fetch("/api/venue/site-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: editing.website_url, venue_id: venueId }) });
          const j = await r.json();
          if (r.ok && j.ok && j.url) imageUrl = j.url;
        } catch { /* save proceeds without an image */ }
      }
      const patch = {
        name: editing.name.trim(), description: editing.description, price_from: editing.price_from === "" ? null : Number(editing.price_from.replace(/[^\d.]/g, "")) || 0,
        contact_phone: editing.contact_phone, contact_email: editing.contact_email, website_url: editing.website_url, image_url: imageUrl,
        vendor_type: VENDOR_DB_VALUE[editing.typeSlug as keyof typeof VENDOR_DB_VALUE],
        commission_type: editing.commission_type,
        commission_value: Number(editing.commission_value.replace(/[^\d.]/g, "")) || 0,
      };
      if (editing.id) await updateItem("caterers", editing.id, patch);
      else await addItem(editing.typeSlug as never, venueId, patch);
      setEditing(null); loading.complete("Saved ✓"); router.refresh();
    } catch (e) {
      loading.hide();
      throw e;
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Remove this supplier?")) return;
    await bulkDelete("caterers", [id]); router.refresh();
  }
  async function toggleActive(id: string, active: boolean) { await updateItem("caterers", id, { active }); router.refresh(); }

  async function uploadImage(f: File) {
    setImgBusy(true);
    loading.show("Uploading image…", { messages: ["Uploading…", "Optimising…"] });
    try {
      const fd = new FormData(); fd.append("file", f); fd.append("venue_id", venueId);
      const r = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
      const j = await r.json(); if (r.ok && j.ok) { setEditing((d) => d ? { ...d, image_url: j.url } : d); loading.complete("Uploaded ✓"); } else loading.hide();
    } catch (e) { loading.hide(); throw e; } finally { setImgBusy(false); }
  }
  async function fromWebsite() {
    if (!editing?.website_url.trim()) return;
    setImgBusy(true);
    loading.show("Reading the website…", { messages: ["Reading the website…", "Finding their best image…"] });
    try {
      const r = await fetch("/api/venue/site-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: editing.website_url, venue_id: venueId }) });
      const j = await r.json(); if (r.ok && j.ok && j.url) { setEditing((d) => d ? { ...d, image_url: j.url } : d); loading.complete("Pulled ✓"); } else { loading.hide(); alert(`No image: ${j.error ?? "nothing usable"}`); }
    } catch (e) { loading.hide(); throw e; } finally { setImgBusy(false); }
  }
  async function pullAllImages(auto = false) {
    const targets = items.filter(needsSiteImage);
    if (!targets.length) { if (!auto) setBulkMsg("No suppliers with a website and a missing or stock image."); return; }
    setBulkBusy(true); let done = 0, failed = 0;
    // Only surface the full-screen overlay for the explicit user action — the
    // silent auto-pull on mount keeps its quiet inline message instead.
    if (!auto) loading.show(`Fetching supplier photos…`, { determinate: true });
    try {
      for (const i of targets) {
        setBulkMsg(`${auto ? "Auto-fetching supplier photos from their websites — " : ""}${done + failed + 1} of ${targets.length}…`);
        if (!auto) loading.set(((done + failed) / targets.length) * 100, `${done + failed + 1} of ${targets.length}…`);
        try {
          const r = await fetch("/api/venue/site-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: String(i.website_url), venue_id: venueId }) });
          const j = await r.json();
          if (r.ok && j.ok && j.url) { await updateItem("caterers", i.id, { image_url: j.url }); done++; } else failed++;
        } catch { failed++; }
        if (done && (done + failed) % 8 === 0) router.refresh(); // surface progress as cards update
      }
      if (!auto) loading.complete(`${done} photo${done === 1 ? "" : "s"} pulled`);
    } catch (e) {
      if (!auto) loading.hide();
      throw e;
    } finally {
      setBulkBusy(false); setBulkMsg(`Done — ${done} supplier photo${done === 1 ? "" : "s"} pulled from their websites${failed ? `, ${failed} had no usable image` : ""}.`); router.refresh();
    }
  }

  // Auto-pull: any supplier with a website but no photo (or just a generic stock
  // placeholder from import) gets their real site image fetched automatically —
  // once per session per venue; the Edit dialog still lets people override it.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || bulkBusy) return;
    if (!items.some(needsSiteImage)) return;
    try {
      const key = `vy-vendor-autopull-${venueId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { return; }
    autoRan.current = true;
    void pullAllImages(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, venueId]);

  const chip = (active: boolean): React.CSSProperties => ({ border: `1px solid ${active ? "var(--poppy)" : "var(--line)"}`, background: active ? "var(--poppy)" : "#fff", color: active ? "#fff" : "var(--ink-2)", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" });
  const cardChrome: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderLeft: "3px solid var(--poppy)", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(28,25,23,0.08)" };
  const chipStyle: React.CSSProperties = { display: "inline-block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--poppy-deep)", background: "var(--cream)", borderRadius: 999, padding: "3px 9px" };
  const field = "w-full border rounded-full px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
            <input type="checkbox" checked={allShownSelected} onChange={toggleSelectAll} style={{ width: 16, height: 16, accentColor: "var(--poppy)", cursor: "pointer" }} />
            {shown.length} supplier{shown.length === 1 ? "" : "s"}
          </label>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => pullAllImages()} disabled={bulkBusy} className="vy-btn vy-btn-secondary">{bulkBusy ? "Fetching images…" : "📷 Images from websites"}</button>
          <button onClick={() => setEditing(blank())} className="vy-btn vy-btn-primary">+ Add supplier</button>
        </div>
      </div>
      {bulkMsg && <p className="text-xs" style={{ color: "var(--ink-2)" }}>{bulkMsg}</p>}

      {/* Bulk action bar — appears once suppliers are ticked */}
      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--cream)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 14px" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{selected.size} selected</span>
          <button onClick={() => setCommModal({ type: "percent", value: "" })} className="vy-btn vy-btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>Set commission</button>
          <button onClick={() => setSelected(new Set())} className="vy-btn vy-btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }}>Clear selection</button>
        </div>
      )}

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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={chipStyle}>{DB_TO_LABEL[String(i.vendor_type)] ?? String(i.vendor_type ?? "Other")}</span>
                    <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggleSelect(i.id)} title="Select for bulk commission" style={{ width: 16, height: 16, accentColor: "var(--poppy)", cursor: "pointer", flexShrink: 0 }} />
                  </div>
                  <div style={{ ...serif, fontSize: 17, fontWeight: 700, marginTop: 6 }}>{String(i.name ?? "")}</div>
                  {(i.contact_phone || i.contact_email) ? <div style={{ fontSize: 12, color: "#57534e", marginTop: 3 }}>{[i.contact_phone, i.contact_email].filter(Boolean).join(" · ")}</div> : null}
                  {rZA(i.price_from) ? <div style={{ color: "var(--poppy)", fontWeight: 700, fontSize: 14, marginTop: 4 }}>From {rZA(i.price_from)}</div> : null}
                  {commissionLabel(i.commission_type, i.commission_value) ? <div style={{ fontSize: 12, color: "#1f5d3e", fontWeight: 600, marginTop: 4 }}>Commission: {commissionLabel(i.commission_type, i.commission_value)}</div> : null}
                  {i.description ? <div style={{ fontSize: 12.5, color: "#57534e", fontStyle: "italic", margin: "8px 0" }}>{String(i.description)}</div> : null}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button onClick={() => toggleActive(i.id, i.active === false)} className="rounded-full px-3 py-1 text-[11px] font-medium" style={i.active === false ? { background: "var(--bone)", color: "var(--ink-2)", border: "1px solid var(--line)" } : { background: "var(--leaf)", color: "#1f5d3e", border: "1px solid #c2dbcf" }}>{i.active === false ? "○ Hidden" : "● Active"}</button>
                    <button onClick={() => setEditing({ id: i.id, typeSlug: (VENDOR_TYPES.find((s) => VENDOR_DB_VALUE[s] === String(i.vendor_type)) ?? "caterers"), name: String(i.name ?? ""), description: String(i.description ?? ""), price_from: i.price_from ? String(i.price_from) : "", contact_phone: String(i.contact_phone ?? ""), contact_email: String(i.contact_email ?? ""), website_url: String(i.website_url ?? ""), image_url: String(i.image_url ?? ""), commission_type: String(i.commission_type) === "fixed" ? "fixed" : "percent", commission_value: Number(i.commission_value) ? String(i.commission_value) : "" })} className="rounded-full px-3 py-1 text-[11px] font-medium" style={{ border: "1px solid var(--line)", color: "var(--ink)" }}>Edit</button>
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
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-stone-600 font-medium">Commission</label>
                  <select className={field} value={editing.commission_type} onChange={(e) => setEditing({ ...editing, commission_type: e.target.value === "fixed" ? "fixed" : "percent" })}>
                    <option value="percent">% of booking</option>
                    <option value="fixed">Fixed amount (R)</option>
                  </select></div>
                <div><label className="text-xs text-stone-600 font-medium">{editing.commission_type === "fixed" ? "Amount (R)" : "Percentage (%)"}</label><input className={field} inputMode="decimal" value={editing.commission_value} onChange={(e) => setEditing({ ...editing, commission_value: e.target.value })} placeholder={editing.commission_type === "fixed" ? "e.g. 500" : "e.g. 10"} /></div>
              </div>
              <p className="text-[11px] text-stone-500 -mt-1">What this supplier owes you per booked wedding — applied when a couple requests an introduction.</p>
              <div><label className="text-xs text-stone-600 font-medium">Notes / description</label><textarea className="w-full border rounded-2xl px-3 py-2 text-sm" rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-stone-200">
              <button onClick={() => setEditing(null)} className="vy-btn vy-btn-ghost">Cancel</button>
              <button onClick={save} disabled={busy || !editing.name.trim()} className="vy-btn vy-btn-primary">{busy ? "Saving…" : editing.id ? "Save" : "Add supplier"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk commission modal */}
      {commModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setCommModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-xl mb-1">Set commission</h3>
            <p className="text-sm text-stone-600 mb-4">Applies to {selected.size} selected supplier{selected.size === 1 ? "" : "s"} — what each owes you per booked wedding.</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["percent", "fixed"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setCommModal({ ...commModal, type: t })}
                    className="flex-1 rounded-full px-3 py-2 text-sm font-medium"
                    style={commModal.type === t ? { background: "var(--poppy)", color: "#fff", border: "1px solid var(--poppy)" } : { background: "#fff", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
                    {t === "percent" ? "% of booking" : "Fixed amount (R)"}
                  </button>
                ))}
              </div>
              <div><label className="text-xs text-stone-600 font-medium">{commModal.type === "fixed" ? "Amount (R)" : "Percentage (%)"}</label>
                <input className={field} inputMode="decimal" autoFocus value={commModal.value} onChange={(e) => setCommModal({ ...commModal, value: e.target.value })} placeholder={commModal.type === "fixed" ? "e.g. 500" : "e.g. 10"} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-stone-200">
              <button onClick={() => setCommModal(null)} className="vy-btn vy-btn-ghost">Cancel</button>
              <button onClick={applyBulkCommission} disabled={busy || commModal.value.trim() === ""} className="vy-btn vy-btn-primary">{busy ? "Applying…" : `Apply to ${selected.size}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
