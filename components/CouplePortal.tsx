"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TemplateTokens, PortalTheme } from "@/lib/portal/templates";

type WState = {
  catalogueSelections?: Record<string, { sel?: boolean; mg?: boolean; wed?: boolean; fb?: boolean }>;
  rentalSelections?: Record<string, { sel?: boolean; qty?: number }>;
  roomAssignments?: Record<string, string[]>;
  [k: string]: unknown;
};

type CatItem = { id: string; category: string; name: string; description: string; img: string | null; included: boolean };
type RentItem = CatItem & { price: number };
type RoomItem = { id: string; name: string; type: string; sleeps: number; description: string; img: string | null; price: number };
type VendorItem = { id: string; type: string; name: string; description: string; img: string | null; price: number | null; email: string | null; phone: string | null; website: string | null };
type GalleryItem = { url: string; category: string; label: string };
type Venue = { name: string; region: string | null; address: string | null; description: string | null; email: string | null; phone: string | null; mapsUrl: string | null };

const TABS = ["Overview", "Our Venue", "Catalogue", "Rentals", "Accommodation", "Suppliers"] as const;
type Tab = (typeof TABS)[number];

const VENDOR_LABELS: Record<string, string> = { caterer: "Caterers", planner: "Planners", florist: "Florists", dj: "DJs", photographer: "Photographers", decor: "Décor", bar: "Bar services" };
const rZA = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

function groupBy<T extends { category?: string; type?: string }>(items: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const it of items) { const k = key(it) || "Other"; (m.get(k) ?? m.set(k, []).get(k)!).push(it); }
  return [...m.entries()];
}

export function CouplePortal({
  slug, tokens, theme, cover, logoUrl, venue, coupleNames, daysToGo, dateLabel, totalDue, initialState, catalogue, rentals, rooms, vendors, gallery,
}: {
  slug: string;
  tokens: TemplateTokens;
  theme: PortalTheme;
  cover: string | null;
  logoUrl: string | null;
  venue: Venue;
  coupleNames: string;
  daysToGo: number | null;
  dateLabel: string;
  totalDue: number;
  initialState: WState;
  catalogue: CatItem[];
  rentals: RentItem[];
  rooms: RoomItem[];
  vendors: VendorItem[];
  gallery: GalleryItem[];
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const router = useRouter();
  const [state, setState] = useState<WState>(initialState ?? {});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [, startTransition] = useTransition();
  const primary = theme.primary;
  const accent = theme.accent;
  const heading: React.CSSProperties = { fontFamily: tokens.headingFont, fontStyle: tokens.headingItalic ? "italic" : "normal" };

  const catSel = state.catalogueSelections ?? {};
  const rentSel = state.rentalSelections ?? {};
  const rooms_ = state.roomAssignments ?? {};
  // Included catalogue items are selected by DEFAULT (couples deselect to opt out);
  // extras are off until added.
  const catIsSelected = (it: CatItem) => { const e = catSel[it.id]; return e ? !!e.sel : it.included; };
  const selectedCount = catalogue.filter(catIsSelected).length
    + Object.values(rentSel).filter((v) => v?.sel).length
    + Object.values(rooms_).filter((a) => Array.isArray(a) && a.length).length;

  async function persist(next: WState) {
    setState(next);
    setBusy(true);
    try {
      await fetch(`/api/wedding/${slug}/state`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      startTransition(() => router.refresh()); // recompute the authoritative total
    } finally {
      setBusy(false);
    }
  }
  function toggleCat(it: CatItem) {
    const cur = { ...(state.catalogueSelections ?? {}) };
    cur[it.id] = { sel: !catIsSelected(it) };
    persist({ ...state, catalogueSelections: cur });
  }
  function toggleRent(id: string) {
    const cur = { ...(state.rentalSelections ?? {}) };
    if (cur[id]?.sel) delete cur[id]; else cur[id] = { sel: true, qty: 1 };
    persist({ ...state, rentalSelections: cur });
  }
  function toggleRoom(id: string) {
    const cur = { ...(state.roomAssignments ?? {}) };
    if (Array.isArray(cur[id]) && cur[id].length) delete cur[id]; else cur[id] = ["Reserved"];
    persist({ ...state, roomAssignments: cur });
  }
  async function submitToVenue() {
    setBusy(true);
    try {
      // Materialise default-selected included items so the venue sees them.
      const cat = { ...(state.catalogueSelections ?? {}) };
      catalogue.forEach((it) => { if (cat[it.id] === undefined) cat[it.id] = { sel: it.included }; });
      const full = { ...state, catalogueSelections: cat };
      await fetch(`/api/wedding/${slug}/state`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(full) });
      const res = await fetch(`/api/wedding/${slug}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "full", state: full, totals: { grandTotal: totalDue } }),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setBusy(false);
    }
  }

  const btn: React.CSSProperties = tokens.buttonStyle === "solid"
    ? { background: primary, color: "#fff", borderRadius: tokens.buttonRadius }
    : { background: "transparent", color: primary, border: `1.5px solid ${primary}`, borderRadius: tokens.buttonRadius };

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: tokens.cardRadius, ...extra });

  const heroImg: React.CSSProperties = cover
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url('${cover}')`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(135deg, ${primary}, ${accent})` };

  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 };
  const itemProps = { primary, accent, heading, cardRadius: tokens.cardRadius };

  return (
    <div style={{ minHeight: "100vh", background: tokens.surface, fontFamily: tokens.bodyFont, color: "var(--ink, #1c1917)" }}>
      {/* HERO */}
      <header style={{ ...heroImg, position: "relative", color: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 36px" }}>
          <PortalLogo logoUrl={logoUrl} venueName={venue.name} heading={heading} light />
          <div style={{ textAlign: "center", padding: "40px 0 8px" }}>
            <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", opacity: 0.9 }}>{venue.name}</div>
            <h1 style={{ ...heading, fontSize: 44, margin: "8px 0", color: "#fff", lineHeight: 1.05 }}>{coupleNames}</h1>
            <div style={{ opacity: 0.95 }}>{dateLabel}</div>
            {daysToGo != null && (
              <div style={{ marginTop: 18, ...heading, fontSize: 30 }}>{daysToGo}<span style={{ fontSize: 12, letterSpacing: 2, marginLeft: 8, opacity: 0.9 }}>DAYS TO GO</span></div>
            )}
          </div>
        </div>
      </header>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 10, background: "#fffdfb", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 16px", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {TABS.map((t) => {
            const active = t === tab;
            const base: React.CSSProperties = { fontSize: 13, padding: "6px 14px", cursor: "pointer", border: "none", background: "transparent", color: active ? primary : "#57534e", fontWeight: active ? 700 : 500 };
            const styled: React.CSSProperties =
              tokens.tabStyle === "pill" ? { ...base, borderRadius: 999, background: active ? primary : "transparent", color: active ? "#fff" : "#57534e", border: active ? "none" : "1px solid rgba(0,0,0,0.12)" }
              : tokens.tabStyle === "segmented" ? { ...base, border: "1px solid rgba(0,0,0,0.12)", borderRadius: tokens.buttonRadius, background: active ? primary : "#fff", color: active ? "#fff" : "#57534e" }
              : { ...base, borderBottom: active ? `2px solid ${primary}` : "2px solid transparent", borderRadius: 0 };
            return <button key={t} onClick={() => setTab(t)} style={styled}>{t}</button>;
          })}
        </div>
      </nav>

      {/* BODY */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px 60px" }}>
        {tab === "Overview" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={card({ padding: 22 })}>
              <div style={{ ...heading, fontSize: 22 }}>Welcome to your planning portal</div>
              <p style={{ color: "#57534e", marginTop: 6 }}>Browse everything {venue.name} offers — catalogue, rentals, accommodation and trusted suppliers — and plan your day in one place.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
              <Stat label="Days to go" value={daysToGo != null ? String(daysToGo) : "—"} heading={heading} accent={accent} primary={primary} />
              <Stat label="Catalogue items" value={String(catalogue.length)} heading={heading} accent={accent} primary={primary} />
              <Stat label="Rentals" value={String(rentals.length)} heading={heading} accent={accent} primary={primary} />
              <Stat label="Rooms" value={String(rooms.length)} heading={heading} accent={accent} primary={primary} />
            </div>
            {(venue.email || venue.phone) && (
              <div style={card({ padding: 18 })}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700 }}>Your venue coordinator</div>
                <div style={{ ...heading, fontSize: 18, marginTop: 4 }}>{venue.name}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {venue.email && <a href={`mailto:${venue.email}`} style={{ ...btn, padding: "8px 16px", fontSize: 13, textDecoration: "none" }}>✉ Email us</a>}
                  {venue.phone && <a href={`tel:${venue.phone}`} style={{ ...btn, padding: "8px 16px", fontSize: 13, textDecoration: "none" }}>📞 Call</a>}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "Our Venue" && (
          <Section heading={heading} title="Our Venue" sub={venue.address || venue.region || ""}>
            {venue.description && <p style={{ color: "#57534e", maxWidth: 720, marginBottom: 16 }}>{venue.description}</p>}
            {gallery.length === 0 ? <Empty>No photos yet.</Empty> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                {gallery.map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={g.url} alt={g.label} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: tokens.cardRadius }} />
                ))}
              </div>
            )}
          </Section>
        )}

        {tab === "Catalogue" && (
          <Section heading={heading} title="Catalogue" sub="Included with your booking — tick what you'd like; add optional extras">
            {catalogue.length === 0 ? <Empty>Nothing here yet.</Empty> : (
              <>
                {([{ inc: true, label: "Included with your booking", note: "Selected by default — deselect anything you don't need." },
                   { inc: false, label: "Optional extras", note: "Add these to your day for an extra charge." }] as const).map((grp) => {
                  const groupItems = catalogue.filter((c) => c.included === grp.inc);
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={String(grp.inc)} style={{ marginBottom: 28 }}>
                      <div style={{ ...heading, fontSize: 20 }}>{grp.label}</div>
                      <div style={{ fontSize: 12, color: "#8a8a8a", marginBottom: 12 }}>{grp.note}</div>
                      {groupBy(groupItems, (c) => c.category).map(([catName, items]) => (
                        <div key={catName} style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: accent === "#FFC6AD" ? "var(--ink-2)" : primary, fontWeight: 700, marginBottom: 8 }}>{catName}</div>
                          <div style={grid}>{items.map((it) => (
                            <PortalItemCard key={it.id} name={it.name} description={it.description} img={it.img} badge={grp.inc ? "Included" : undefined} selected={catIsSelected(it)} onToggle={() => toggleCat(it)} {...itemProps} />
                          ))}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </Section>
        )}

        {tab === "Rentals" && (
          <Section heading={heading} title="Rentals" sub="Optional extras to hire">
            {rentals.length === 0 ? <Empty>Nothing here yet.</Empty> : groupBy(rentals, (r) => r.category).map(([catName, items]) => (
              <div key={catName} style={{ marginBottom: 22 }}>
                <div style={{ ...heading, fontSize: 17, marginBottom: 10 }}>{catName}</div>
                <div style={grid}>{items.map((it) => <PortalItemCard key={it.id} name={it.name} description={it.description} img={it.img} price={it.price} selected={!!rentSel[it.id]?.sel} onToggle={() => toggleRent(it.id)} {...itemProps} />)}</div>
              </div>
            ))}
          </Section>
        )}

        {tab === "Accommodation" && (
          <Section heading={heading} title="Accommodation" sub="On-site stays for you and your guests">
            {rooms.length === 0 ? <Empty>No accommodation listed.</Empty> : (
              <div style={grid}>{rooms.map((r) => <PortalItemCard key={r.id} name={r.name} description={`Sleeps ${r.sleeps}${r.description ? ` · ${r.description}` : ""}`} img={r.img} price={r.price} selected={!!(rooms_[r.id]?.length)} onToggle={() => toggleRoom(r.id)} {...itemProps} />)}</div>
            )}
          </Section>
        )}

        {tab === "Suppliers" && (
          <Section heading={heading} title="Suppliers" sub={`Trusted partners recommended by ${venue.name}`}>
            {vendors.length === 0 ? <Empty>No suppliers listed.</Empty> : groupBy(vendors, (v) => VENDOR_LABELS[v.type] || v.type).map(([label, items]) => (
              <div key={label} style={{ marginBottom: 22 }}>
                <div style={{ ...heading, fontSize: 17, marginBottom: 10 }}>{label}</div>
                <div style={grid}>{items.map((v) => (
                  <div key={v.id} style={card({ overflow: "hidden" })}>
                    {v.img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.img} alt="" style={{ width: "100%", height: 110, objectFit: "cover" }} />
                    )}
                    <div style={{ padding: 14 }}>
                      <div style={{ ...heading, fontWeight: 700 }}>{v.name}</div>
                      {v.description && <div style={{ fontSize: 12.5, color: "#57534e", margin: "4px 0" }}>{v.description}</div>}
                      {v.price != null && <div style={{ color: primary, fontWeight: 700, fontSize: 13 }}>From {rZA(v.price)}</div>}
                      <div style={{ fontSize: 12, color: "#57534e", marginTop: 6, display: "grid", gap: 2 }}>
                        {v.phone && <span>📞 {v.phone}</span>}
                        {v.email && <span>✉ {v.email}</span>}
                        {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" style={{ color: primary }}>↗ Website</a>}
                      </div>
                    </div>
                  </div>
                ))}</div>
              </div>
            ))}
          </Section>
        )}
      </main>

      {/* Running total + submit */}
      <div style={{ position: "sticky", bottom: 0, zIndex: 20, background: "#fff", borderTop: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 -4px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#57534e" }}>Estimated total{busy ? " · updating…" : ""}</div>
            <div style={{ ...heading, fontSize: 24, color: primary }}>{rZA(totalDue)}</div>
            <div style={{ fontSize: 11, color: "#8a8a8a" }}>{selectedCount} item{selectedCount === 1 ? "" : "s"} selected · final quote confirmed by {venue.name}</div>
          </div>
          {submitted ? (
            <span style={{ background: "#dcefe2", color: "#1f5d3e", padding: "10px 20px", borderRadius: tokens.buttonRadius, fontWeight: 600 }}>✓ Sent to {venue.name} for review</span>
          ) : (
            <button onClick={submitToVenue} disabled={busy || selectedCount === 0} style={{ ...btn, padding: "12px 26px", fontWeight: 700, cursor: busy || selectedCount === 0 ? "not-allowed" : "pointer", opacity: busy || selectedCount === 0 ? 0.55 : 1 }}>
              Submit to {venue.name} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, heading, accent, primary }: { label: string; value: string; heading: React.CSSProperties; accent: string; primary: string }) {
  return (
    <div style={{ background: `${accent}2e`, borderRadius: 14, padding: 16, textAlign: "center" }}>
      <div style={{ ...heading, fontSize: 26, color: primary }}>{value}</div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#57534e", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Section({ title, sub, heading, children }: { title: string; sub?: string; heading: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>{title}</h2>
        {sub && <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 24, textAlign: "center", color: "#8a8a8a", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12 }}>{children}</div>;
}

function PortalLogo({ logoUrl, venueName, heading, light }: { logoUrl: string | null; venueName: string; heading: React.CSSProperties; light: boolean }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" style={{ height: 34, maxWidth: 150, objectFit: "contain" }} />;
  }
  return <span style={{ ...heading, color: light ? "#fff" : "var(--ink)", fontWeight: 700 }}>{venueName}</span>;
}

function PortalItemCard({ name, description, img, price, badge, selected, onToggle, primary, accent, heading, cardRadius }: {
  name: string; description: string; img: string | null; price?: number; badge?: string;
  selected?: boolean; onToggle?: () => void;
  primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", aspectRatio: "4 / 3", background: `${accent}33`, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a8", fontSize: 12 }}>No image</div>
      )}
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <div style={{ ...heading, fontWeight: 700, fontSize: 16 }}>{name}</div>
        {description && <div style={{ fontSize: 12.5, color: "#57534e", lineHeight: 1.5, flex: 1 }}>{description}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          {price != null ? <span style={{ color: primary, fontWeight: 700 }}>{price > 0 ? rZA(price) : "Included"}</span> : <span />}
          {badge && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, background: `${accent}40`, color: "#5a4", padding: "2px 8px", borderRadius: 999 }}>{badge}</span>}
        </div>
        {onToggle && (
          <button onClick={onToggle} style={{ marginTop: 8, padding: "7px 0", width: "100%", borderRadius: cardRadius, border: `1.5px solid ${primary}`, background: selected ? primary : "transparent", color: selected ? "#fff" : primary, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {selected ? "✓ Added" : "+ Add to my wedding"}
          </button>
        )}
      </div>
    </div>
  );
}
