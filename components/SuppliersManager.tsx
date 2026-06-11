"use client";

import { useState } from "react";

export type Supplier = {
  id: string; category: string; name: string; email?: string; phone?: string;
  price?: string; status?: string; dueDate?: string; description?: string; fromVendorId?: string; img?: string | null;
};
type VenuePartner = { id: string; type: string; name: string; description: string; price: number | null; email: string | null; phone: string | null; website?: string | null; img?: string | null; commissionValue?: number | null; commissionType?: string | null };

const serif: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif" };
const CATEGORIES = ["Venue", "Catering", "Photography", "Flowers", "Music", "Hair & Makeup", "Cake", "Waiter/Bar Staff", "Beverages", "Other"];
const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#8a8a8a" }, contacted: { label: "Contacted", color: "#b7791f" }, booked: { label: "Booked", color: "#1a7f4b" },
};
const rZA = (n: string | number | undefined) => { const v = Number(String(n ?? "").replace(/[^\d.]/g, "")); return v ? `R${Math.round(v).toLocaleString("en-ZA")}` : ""; };
const fmtDate = (s?: string) => (s ? new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "");
const labelFor = (t: string) => ({ photo: "Photography", catering: "Catering", music: "Music", flowers: "Flowers", cake: "Cake", beauty: "Hair & Makeup", bar: "Waiter/Bar Staff", beverages: "Beverages", venue: "Venue" } as Record<string, string>)[t] || (t ? t[0].toUpperCase() + t.slice(1) : "Other");

const blank = (): Supplier => ({ id: "", category: "Photography", name: "", email: "", phone: "", price: "", status: "pending", dueDate: "", description: "" });

// Couple supplier hub: the venue's recommended partners (one-tap add) + the couple's
// own Vendor Tracker. Persists into wedding_state.suppliers (feeds the venue + total).
// Venue-recommended suppliers are CONTACT-MASKED: all conversation goes through the
// mediated Messages tab (contact is revealed there once the couple books). The
// couple's own vendors keep their contact info — they entered it themselves.
export function SuppliersManager({ venueName, vendors, suppliers, onChange, primary, accent, heading, cardRadius, introducedVendorIds = [] }: {
  venueName: string; vendors: VenuePartner[]; suppliers: Supplier[]; onChange: (next: Supplier[]) => void;
  primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
  slug?: string; venueEmail?: string | null; introducedVendorIds?: string[];
}) {
  const [list, setList] = useState<Supplier[]>(suppliers ?? []);
  const [filter, setFilter] = useState("All");
  const [editing, setEditing] = useState<Supplier | null>(null);
  // Vendors with an existing intro/thread — shows a small "conversation started"
  // hint on the card (the conversation itself lives in the Messages tab).
  const introduced = new Set(introducedVendorIds);

  // "Message supplier": CouplePortal listens for this event, switches to the
  // Messages tab and opens (or stages) the thread for this vendor. No contact
  // details ever leave the server until the thread is booked.
  function messageSupplier(v: VenuePartner) {
    window.dispatchEvent(new CustomEvent("venuely:message-supplier", {
      detail: { vendorId: v.id, name: v.name, type: labelFor(v.type) },
    }));
  }

  function commit(next: Supplier[]) { setList(next); onChange(next); }
  function save(s: Supplier) {
    const rec = { ...s, id: s.id || (crypto.randomUUID?.() ?? String(Date.now())) };
    commit(list.some((x) => x.id === rec.id) ? list.map((x) => x.id === rec.id ? rec : x) : [...list, rec]);
    setEditing(null);
  }
  function remove(id: string) { commit(list.filter((x) => x.id !== id)); }
  function addFromVenue(v: VenuePartner) {
    if (list.some((x) => x.fromVendorId === v.id)) return;
    // NB: deliberately does NOT copy the supplier's email/phone — venue-recommended
    // contact stays masked until the couple books them via Messages.
    commit([...list, { id: crypto.randomUUID?.() ?? String(Date.now()), category: labelFor(v.type), name: v.name, email: "", phone: "", price: v.price ? String(v.price) : "", status: "contacted", description: v.description || "", fromVendorId: v.id, img: v.img ?? null }]);
  }

  // Always show the full standard category set so couples can filter by any of them,
  // plus any custom categories they've added.
  const cats = ["All", ...CATEGORIES, ...Array.from(new Set(list.map((s) => s.category).filter((c) => c && !CATEGORIES.includes(c)) as string[]))];
  const shown = filter === "All" ? list : list.filter((s) => s.category === filter);

  const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius };
  // Shared card chrome matching the Accommodation / Catalogue cards.
  const cardChrome: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderLeft: `3px solid ${primary}`, borderRadius: cardRadius, overflow: "hidden", boxShadow: "0 2px 8px rgba(28,25,23,0.08)" };
  // Chip matches the venue-side Suppliers page exactly (cream + poppy-deep).
  const chipStyle: React.CSSProperties = { display: "inline-block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--poppy-deep, #c2371f)", background: "var(--cream, #FBF7F2)", borderRadius: 999, padding: "3px 9px" };
  const chip = (active: boolean): React.CSSProperties => ({ border: `1px solid ${active ? primary : "rgba(0,0,0,0.15)"}`, background: active ? primary : "#fff", color: active ? "#fff" : "#57534e", borderRadius: 999, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" });
  const btnSolid: React.CSSProperties = { background: primary, color: "#fff", border: "none", borderRadius: 999, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 0.5 };
  const field: React.CSSProperties = { width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, marginTop: 4 };
  const lbl: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#a8a29e", fontWeight: 700 };

  return (
    <div style={{ display: "grid", gap: 22 }}>
      {/* My Vendors tracker */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Vendor <span style={{ ...serif, fontStyle: "italic" }}>Tracker</span></h2>
        <button onClick={() => setEditing(blank())} style={btnSolid}>+ ADD VENDOR</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{cats.map((c) => <button key={c} onClick={() => setFilter(c)} style={chip(filter === c)}>{c}</button>)}</div>

      {shown.length === 0 ? (
        <div style={{ ...card, padding: 26, textAlign: "center", color: "#8a8a8a", fontSize: 13 }}>No vendors yet — add your own, or pick from your venue&apos;s recommendations below.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
          {shown.map((s) => {
            const st = STATUS[s.status || "pending"] || STATUS.pending;
            return (
              <div key={s.id} className="hover-lift" style={cardChrome}>
                {s.img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.img} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
                )}
                <div style={{ padding: 16 }}>
                  <span style={chipStyle}>{s.category}</span>
                  <div style={{ ...serif, fontSize: 18, fontWeight: 700, marginTop: 6 }}>{s.name}</div>
                  {(s.email || s.phone) && <div style={{ fontSize: 12, color: "#57534e", marginTop: 4 }}>{[s.phone, s.email].filter(Boolean).join(" · ")}</div>}
                  {rZA(s.price) && <div style={{ color: primary, fontWeight: 700, fontSize: 15, marginTop: 6 }}>{rZA(s.price)}</div>}
                  {s.description && <div style={{ fontSize: 12.5, color: "#57534e", fontStyle: "italic", margin: "8px 0" }}>{s.description}</div>}
                  {s.dueDate && <div style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#b42318", background: "#fdeceb", borderRadius: 6, padding: "3px 8px", margin: "2px 0 8px" }}>Balance due · {fmtDate(s.dueDate)}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: st.color, margin: "6px 0 10px" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />{st.label}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setEditing(s)} style={{ background: `${accent}33`, color: "#57534e", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase" }}>Edit</button>
                    <button onClick={() => remove(s.id)} style={{ background: "#fff", color: "#b42318", border: "1px solid #f0c9c5", borderRadius: 8, padding: "6px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase" }}>Remove</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommended by venue — below the couple's own tracker */}
      {vendors.length > 0 && (
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#a8a29e", fontWeight: 700, marginBottom: 10 }}>Recommended by {venueName}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
            {vendors.map((v) => {
              const added = list.some((x) => x.fromVendorId === v.id);
              const inConversation = introduced.has(v.id);
              return (
                <div key={v.id} className="hover-lift" style={cardChrome}>
                  {v.img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.img} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
                  )}
                  <div style={{ padding: 14 }}>
                    <span style={chipStyle}>{labelFor(v.type)}</span>
                    <div style={{ ...serif, fontSize: 16, fontWeight: 700, marginTop: 6 }}>{v.name}</div>
                    {v.description && <div style={{ fontSize: 12.5, color: "#57534e", fontStyle: "italic", margin: "6px 0" }}>{v.description}</div>}
                    {v.price != null && <div style={{ color: primary, fontWeight: 700, fontSize: 13, marginTop: 4 }}>From {rZA(v.price)}</div>}

                    {/* Contact details NEVER show here — all conversation happens in the
                        mediated Messages tab, where contact is revealed once booked. */}
                    {inConversation && (
                      <div style={{ fontSize: 10.5, color: "#1a7f4b", fontWeight: 600, marginTop: 8 }}>✓ Conversation started — continue in Messages</div>
                    )}
                    <button
                      onClick={() => messageSupplier(v)}
                      style={{ marginTop: inConversation ? 6 : 10, width: "100%", border: "none", background: primary, color: "#fff", borderRadius: 999, padding: "8px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", letterSpacing: 0.4 }}
                    >
                      💬 Message supplier
                    </button>

                    <button onClick={() => addFromVenue(v)} disabled={added} style={{ marginTop: 8, width: "100%", border: `1px solid ${added ? "#1a7f4b" : primary}`, background: added ? "#1a7f4b" : "#fff", color: added ? "#fff" : primary, borderRadius: 999, padding: "7px", fontWeight: 600, fontSize: 12.5, cursor: added ? "default" : "pointer" }}>{added ? "✓ Added to my vendors" : "+ Add to my vendors"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflow: "auto" }} onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 24, width: "min(460px,100%)", maxHeight: "90vh", overflow: "auto" }}>
            <h3 style={{ ...serif, fontSize: 22, margin: "0 0 14px" }}>{editing.id ? "Edit vendor" : "Add vendor"}</h3>
            <div style={{ display: "grid", gap: 12 }}>
              <div><span style={lbl}>Category</span><select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={field}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><span style={lbl}>Name</span><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Vendor / business name" style={field} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><span style={lbl}>Phone</span><input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} style={field} /></div>
                <div style={{ flex: 1 }}><span style={lbl}>Email</span><input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} style={field} /></div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><span style={lbl}>Price (R)</span><input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} placeholder="0" style={field} /></div>
                <div style={{ flex: 1 }}><span style={lbl}>Status</span><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} style={field}>{Object.entries(STATUS).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}</select></div>
              </div>
              <div><span style={lbl}>Balance due (optional)</span><input type="date" value={editing.dueDate ?? ""} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })} style={field} /></div>
              <div><span style={lbl}>Notes / details</span><textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} style={{ ...field, resize: "vertical" }} /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button onClick={() => setEditing(null)} style={{ background: `${accent}33`, color: "#57534e", border: "none", borderRadius: 999, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => save(editing)} disabled={!editing.name.trim()} style={{ ...btnSolid, opacity: editing.name.trim() ? 1 : 0.5 }}>Save vendor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
