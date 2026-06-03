"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TemplateTokens, PortalTheme } from "@/lib/portal/templates";
import { GuestManager } from "@/components/GuestManager";
import { ListManager, type ListField } from "@/components/ListManager";

const TIMELINE_FIELDS: ListField[] = [
  { key: "start_time", label: "Time", width: 90 },
  { key: "title", label: "What's happening", grow: 2, width: 180 },
  { key: "location", label: "Where", width: 130 },
  { key: "responsible", label: "Who", width: 120 },
];
const CONTACT_FIELDS: ListField[] = [
  { key: "role", label: "Role", type: "select", options: ["Photographer", "Videographer", "DJ", "MC", "Florist", "Coordinator", "Officiant", "Emergency", "Other"], width: 130 },
  { key: "name", label: "Name", grow: 2, width: 150 },
  { key: "company", label: "Company", width: 130 },
  { key: "phone", label: "Phone", width: 120 },
  { key: "email", label: "Email", width: 150 },
];
const SONG_FIELDS: ListField[] = [
  { key: "moment", label: "Moment", type: "select", options: ["Bridal entrance", "First dance", "Father/daughter", "Cake cut", "Last dance", "Reception playlist", "Do NOT play"], width: 150 },
  { key: "title", label: "Song title", grow: 2, width: 170 },
  { key: "artist", label: "Artist", width: 140 },
];
const BUDGET_FIELDS: ListField[] = [
  { key: "category", label: "Category", grow: 2, width: 150 },
  { key: "vendor_name", label: "Vendor", width: 130 },
  { key: "estimated", label: "Estimated R", width: 110 },
  { key: "actual", label: "Actual R", width: 100 },
  { key: "paid", label: "Paid R", width: 90 },
];

type DaySel = { sel?: boolean; mg?: boolean; wed?: boolean; fb?: boolean };
type WState = {
  catalogueSelections?: Record<string, DaySel>;
  rentalSelections?: Record<string, DaySel & { qty?: number }>;
  roomAssignments?: Record<string, string[]>;
  [k: string]: unknown;
};
const DAY_TYPES: { key: "mg" | "wed" | "fb"; label: string }[] = [
  { key: "mg", label: "M&G" }, { key: "wed", label: "Wedding" }, { key: "fb", label: "Farewell" },
];

type CatItem = { id: string; category: string; name: string; description: string; img: string | null; included: boolean; eventPart?: string | null };
type RentItem = CatItem & { price: number };
type RoomItem = { id: string; name: string; type: string; sleeps: number; description: string; img: string | null; price: number };
type VendorItem = { id: string; type: string; name: string; description: string; img: string | null; price: number | null; email: string | null; phone: string | null; website: string | null };
type GalleryItem = { url: string; category: string; label: string };
type Venue = { name: string; region: string | null; address: string | null; description: string | null; email: string | null; phone: string | null; mapsUrl: string | null };

const TABS = ["Overview", "Our Venue", "Catalogue & Rentals", "Accommodation", "Suppliers", "Guests", "Timeline", "Contacts", "Music", "Budget"] as const;
type Tab = (typeof TABS)[number];

const VENDOR_LABELS: Record<string, string> = { caterer: "Caterers", planner: "Planners", florist: "Florists", dj: "DJs", photographer: "Photographers", decor: "Décor", bar: "Bar services" };
const rZA = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
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
  const [rentFilter, setRentFilter] = useState("All");
  const [rentFolder, setRentFolder] = useState<"all" | "included" | "extra">("all");
  const [supFilter, setSupFilter] = useState("All");
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
  // Included items are checked by default (deselect to opt out) unless explicitly
  // turned off; extras are off until added.
  const catIsSelected = (it: CatItem) => { const e = catSel[it.id]; return it.included ? (e ? e.sel !== false : true) : !!e?.sel; };
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
    cur[it.id] = catIsSelected(it) ? { sel: false } : { sel: true, wed: true };
    persist({ ...state, catalogueSelections: cur });
  }
  function toggleCatDay(it: CatItem, day: "mg" | "wed" | "fb") {
    const cur = { ...(state.catalogueSelections ?? {}) };
    const e = { ...(cur[it.id] ?? {}), sel: true };
    e[day] = !e[day];
    cur[it.id] = e;
    persist({ ...state, catalogueSelections: cur });
  }
  function toggleRent(id: string) {
    const cur = { ...(state.rentalSelections ?? {}) };
    if (cur[id]?.sel) delete cur[id]; else cur[id] = { sel: true, qty: 1, wed: true };
    persist({ ...state, rentalSelections: cur });
  }
  function toggleRentDay(id: string, day: "mg" | "wed" | "fb") {
    const cur = { ...(state.rentalSelections ?? {}) };
    const e = { qty: 1, ...(cur[id] ?? {}), sel: true };
    e[day] = !e[day];
    cur[id] = e;
    persist({ ...state, rentalSelections: cur });
  }
  function setRentQty(id: string, n: number) {
    const cur = { ...(state.rentalSelections ?? {}) };
    cur[id] = { ...(cur[id] ?? {}), sel: true, qty: Math.max(1, n) };
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

  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 };
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

        {tab === "Catalogue & Rentals" && (() => {
          // Catalogue + rentals are browsed together (catalogue is just the
          // included/menu subset). Each keeps its own selection + pricing rules.
          const keyOf = (it: CatItem | RentItem) => (("eventPart" in it && it.eventPart) ? it.eventPart : it.category) || "Other";
          const merged: ({ item: CatItem; kind: "cat" } | { item: RentItem; kind: "rent" })[] = [
            ...catalogue.map((c) => ({ item: c, kind: "cat" as const })),
            ...rentals.map((r) => ({ item: r, kind: "rent" as const })),
          ];
          const cats = ["All", ...Array.from(new Set(merged.map((m) => keyOf(m.item))))];
          const shown = merged.filter((m) =>
            (rentFolder === "all" || (rentFolder === "included") === m.item.included) &&
            (rentFilter === "All" || keyOf(m.item) === rentFilter));
          return (
            <Section heading={heading} title="Catalogue & Rentals" sub="Everything included with your booking, plus optional extras to add">
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {([["all", "All"], ["included", "📁 Included with booking"], ["extra", "📁 To pay for"]] as const).map(([k, label]) => {
                  const on = rentFolder === k;
                  return <button key={k} onClick={() => setRentFolder(k)} style={{ fontSize: 12.5, padding: "7px 14px", borderRadius: tokens.cardRadius, cursor: "pointer", border: `1px solid ${on ? primary : "rgba(0,0,0,0.15)"}`, background: on ? `${primary}1f` : "#fff", color: on ? primary : "#57534e", fontWeight: on ? 700 : 500 }}>{label}</button>;
                })}
              </div>
              <FilterChips primary={primary} value={rentFilter} onChange={setRentFilter} options={cats} />
              {shown.length === 0 ? <Empty>Nothing in this folder.</Empty> : groupBy(shown, (m) => keyOf(m.item)).map(([catName, items]) => (
                <div key={catName} style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700, marginBottom: 8 }}>{catName}</div>
                  <div style={grid}>{items.map((m) => m.kind === "cat" ? (
                    <PortalItemCard key={m.item.id} name={m.item.name} description={m.item.description} img={m.item.img} badge={m.item.included ? "Included" : undefined} selected={catIsSelected(m.item)} onToggle={() => toggleCat(m.item)} days={catSel[m.item.id]} onDay={(d) => toggleCatDay(m.item, d)} {...itemProps} />
                  ) : (
                    <PortalItemCard key={m.item.id} name={m.item.name} description={m.item.description} img={m.item.img} price={m.item.included ? 0 : m.item.price} badge={m.item.included ? "Included" : undefined} selected={!!rentSel[m.item.id]?.sel} onToggle={() => toggleRent(m.item.id)} days={rentSel[m.item.id]} onDay={(d) => toggleRentDay(m.item.id, d)} qty={rentSel[m.item.id]?.qty} onQty={(n) => setRentQty(m.item.id, n)} {...itemProps} />
                  ))}</div>
                </div>
              ))}
            </Section>
          );
        })()}

        {tab === "Accommodation" && (
          <Section heading={heading} title="Accommodation" sub="On-site stays for you and your guests">
            {rooms.length === 0 ? <Empty>No accommodation listed.</Empty> : (
              <div style={grid}>{rooms.map((r) => <PortalItemCard key={r.id} name={r.name} description={`Sleeps ${r.sleeps}${r.description ? ` · ${r.description}` : ""}`} img={r.img} price={r.price} selected={!!(rooms_[r.id]?.length)} onToggle={() => toggleRoom(r.id)} {...itemProps} />)}</div>
            )}
          </Section>
        )}

        {tab === "Suppliers" && (
          <Section heading={heading} title="Suppliers" sub={`Trusted partners recommended by ${venue.name}`}>
            <FilterChips primary={primary} value={supFilter} onChange={setSupFilter}
              options={["All", ...Array.from(new Set(vendors.map((v) => VENDOR_LABELS[v.type] || v.type)))]} />
            {vendors.length === 0 ? <Empty>No suppliers listed.</Empty> : groupBy(vendors.filter((v) => supFilter === "All" || (VENDOR_LABELS[v.type] || v.type) === supFilter), (v) => VENDOR_LABELS[v.type] || v.type).map(([label, items]) => (
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

        {tab === "Guests" && (
          <GuestManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Timeline" && (
          <ListManager slug={slug} kind="timeline" title="Day timeline" sub="Your run sheet — when and where everything happens" fields={TIMELINE_FIELDS} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Contacts" && (
          <ListManager slug={slug} kind="contacts" title="Contacts" sub="Your vendors, coordinator and emergency contacts" fields={CONTACT_FIELDS} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Music" && (
          <ListManager slug={slug} kind="songs" title="Music & song requests" sub="Key moments + your playlist for the DJ" fields={SONG_FIELDS} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Budget" && (
          <ListManager slug={slug} kind="budget" title="Your budget" sub="Track your own spend — separate from the venue invoice" fields={BUDGET_FIELDS} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
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

function FilterChips({ options, value, onChange, primary }: { options: string[]; value: string; onChange: (v: string) => void; primary: string }) {
  if (options.length <= 2) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={o} onClick={() => onChange(o)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999, cursor: "pointer", border: `1px solid ${on ? primary : "rgba(0,0,0,0.15)"}`, background: on ? primary : "#fff", color: on ? "#fff" : "#57534e", fontWeight: on ? 700 : 500 }}>{o}</button>
        );
      })}
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

function PortalItemCard({ name, description, img, price, badge, selected, onToggle, days, onDay, qty, onQty, primary, accent, heading, cardRadius }: {
  name: string; description: string; img: string | null; price?: number; badge?: string;
  selected?: boolean; onToggle?: () => void;
  days?: DaySel; onDay?: (d: "mg" | "wed" | "fb") => void;
  qty?: number; onQty?: (n: number) => void;
  primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  return (
    <div style={{ background: "#fff", border: selected ? `2px solid ${primary}` : "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", height: 120, background: `${accent}33`, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a8", fontSize: 12 }}>No image</div>
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
        {selected && onDay && (
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
            {DAY_TYPES.map((d) => {
              const on = !!days?.[d.key];
              return (
                <button key={d.key} onClick={() => onDay(d.key)} title={`${d.label} day`}
                  style={{ flex: 1, minWidth: 56, fontSize: 10.5, padding: "4px 0", borderRadius: 999, cursor: "pointer", border: `1px solid ${on ? primary : "rgba(0,0,0,0.15)"}`, background: on ? `${primary}1f` : "#fff", color: on ? primary : "#57534e", fontWeight: on ? 700 : 500 }}>
                  {on ? "✓ " : ""}{d.label}
                </button>
              );
            })}
          </div>
        )}
        {selected && onQty && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "#57534e" }}>Qty</span>
            <button onClick={() => onQty((qty ?? 1) - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(0,0,0,0.15)", background: "#fff", cursor: "pointer" }}>−</button>
            <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700 }}>{qty ?? 1}</span>
            <button onClick={() => onQty((qty ?? 1) + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(0,0,0,0.15)", background: "#fff", cursor: "pointer" }}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
