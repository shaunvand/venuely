"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TemplateTokens, PortalTheme } from "@/lib/portal/templates";
import { GuestManager } from "@/components/GuestManager";
import { SuppliersManager } from "@/components/SuppliersManager";
import { ListManager, type ListField } from "@/components/ListManager";
import { InspirationBoard } from "@/components/InspirationBoard";
import { DocumentManager } from "@/components/DocumentManager";
import { AddToCalendar } from "@/components/AddToCalendar";
import { GuestInvites } from "@/components/GuestInvites";
import { AiPlanner } from "@/components/AiPlanner";
import { PaymentsManager } from "@/components/PaymentsManager";
import { RemindersManager } from "@/components/RemindersManager";
import { CoupleOverview } from "@/components/CoupleOverview";
import { LogoMark } from "@/components/Logo";
import { RoomAllocator } from "@/components/RoomAllocator";
import { ChecklistBoard } from "@/components/ChecklistBoard";
import { TimelineBoard } from "@/components/TimelineBoard";
import { SeatingPlan } from "@/components/SeatingPlan";
import { BudgetBoard } from "@/components/BudgetBoard";

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
const CHECKLIST_FIELDS: ListField[] = [
  { key: "title", label: "To-do", grow: 2, width: 200 },
  { key: "due_date", label: "Due (YYYY-MM-DD)", width: 140 },
  { key: "done", label: "Done", type: "checkbox" },
];
const FLOWER_FIELDS: ListField[] = [
  { key: "title", label: "Flower / arrangement", grow: 2, width: 180 },
  { key: "category", label: "For (bouquet, centrepiece…)", width: 170 },
  { key: "notes", label: "Notes", width: 150 },
];
const DRESS_FIELDS: ListField[] = [
  { key: "title", label: "Dress / outfit", grow: 2, width: 180 },
  { key: "shop", label: "Shop / designer", width: 150 },
  { key: "notes", label: "Features you love", width: 160 },
];
const DECOR_FIELDS: ListField[] = [
  { key: "title", label: "Décor item", grow: 2, width: 180 },
  { key: "area", label: "Where (ceremony, tables…)", width: 170 },
  { key: "notes", label: "Notes", width: 150 },
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
type TableItem = { id: string; label: string; shape: string; seats: number; quantity: number };
type Venue = { name: string; region: string | null; address: string | null; description: string | null; email: string | null; phone: string | null; mapsUrl: string | null };

const TABS = ["Overview", "Our Venue", "Catalogue & Rentals", "Inspiration", "Flowers", "Dress", "Décor", "Accommodation", "Suppliers", "Guests", "Invites", "Reminders", "Seating", "Timeline", "Checklist", "Contacts", "Music", "Budget", "Payments", "Documents"] as const;
type Tab = (typeof TABS)[number];

// Grouped navigation — keeps the portal simple: 5 top sections, sub-tabs below.
const SECTIONS: { name: string; icon: string; tabs: Tab[] }[] = [
  { name: "Plan", icon: "✨", tabs: ["Overview", "Our Venue", "Inspiration"] },
  { name: "Choose", icon: "🍽️", tabs: ["Catalogue & Rentals", "Accommodation", "Suppliers"] },
  { name: "Guests", icon: "💌", tabs: ["Guests", "Invites", "Reminders", "Seating"] },
  { name: "Details", icon: "📝", tabs: ["Flowers", "Dress", "Décor", "Timeline", "Music", "Checklist", "Contacts"] },
  { name: "Money & Docs", icon: "📄", tabs: ["Budget", "Payments", "Documents"] },
];

// Couple sidebar — flat, curated order + display labels (tab keys unchanged).
const COUPLE_NAV: { key: Tab; label: string }[] = [
  { key: "Overview", label: "Overview" },
  { key: "Our Venue", label: "Our Venue" },
  { key: "Guests", label: "Guest List" },
  { key: "Accommodation", label: "Accommodation" },
  { key: "Inspiration", label: "Inspiration" },
  { key: "Invites", label: "Invites" },
  { key: "Suppliers", label: "Suppliers" },
  { key: "Catalogue & Rentals", label: "Venue stock / Rentals" },
  { key: "Budget", label: "Budget" },
  { key: "Payments", label: "Payments" },
  { key: "Seating", label: "Seating plan" },
  { key: "Timeline", label: "Wedding day Timeline" },
  { key: "Checklist", label: "Checklist" },
];

const VENDOR_LABELS: Record<string, string> = { caterer: "Caterers", planner: "Planners", florist: "Florists", dj: "DJs", photographer: "Photographers", decor: "Décor", bar: "Bar services" };
const rZA = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const it of items) { const k = key(it) || "Other"; (m.get(k) ?? m.set(k, []).get(k)!).push(it); }
  return [...m.entries()];
}

export function CouplePortal({
  slug, tokens, theme, cover, logoUrl, venue, coupleNames, daysToGo, dateLabel, weddingDate, weddingEndDate, totalDue, initialState, catalogue, rentals, rooms, vendors, gallery, tables,
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
  weddingDate: string | null;
  weddingEndDate: string | null;
  totalDue: number;
  initialState: WState;
  catalogue: CatItem[];
  rentals: RentItem[];
  rooms: RoomItem[];
  vendors: VendorItem[];
  gallery: GalleryItem[];
  tables: TableItem[];
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const activeSection = SECTIONS.find((s) => s.tabs.includes(tab))?.name ?? "Plan";
  const [navOpen, setNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
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

  // AI planner actions land here (single source of truth): pre-select items, set the
  // palette, add list rows — then jump to the relevant tab so the couple sees it.
  const stateRef = useRef(state); stateRef.current = state;
  useEffect(() => {
    async function onAction(e: Event) {
      const a = (e as CustomEvent).detail as { type: string; payload: Record<string, unknown> };
      if (!a?.type) return;
      const cur = stateRef.current;
      const ids = (Array.isArray(a.payload?.ids) ? a.payload.ids : []).map(String);
      if (a.type === "selectCatalogue") {
        const c = { ...(cur.catalogueSelections ?? {}) }; ids.forEach((id) => { c[id] = { sel: true, wed: true }; });
        persist({ ...cur, catalogueSelections: c }); setTab("Catalogue & Rentals");
      } else if (a.type === "selectRentals") {
        const r = { ...(cur.rentalSelections ?? {}) }; ids.forEach((id) => { r[id] = { sel: true, qty: 1, wed: true }; });
        persist({ ...cur, rentalSelections: r }); setTab("Catalogue & Rentals");
      } else if (a.type === "selectRooms") {
        const rm = { ...(cur.roomAssignments ?? {}) }; ids.forEach((id) => { rm[id] = ["Reserved"]; });
        persist({ ...cur, roomAssignments: rm }); setTab("Accommodation");
      } else if (a.type === "setPalette") {
        const colors = (Array.isArray(a.payload?.colors) ? a.payload.colors : []).map(String);
        persist({ ...cur, palette: colors } as WState); setTab("Inspiration");
      } else if (a.type === "addChecklist" || a.type === "addTimeline") {
        const kind = a.type === "addChecklist" ? "checklist" : "timeline";
        const items = (Array.isArray(a.payload?.items) ? a.payload.items : []) as unknown[];
        for (const it of items) {
          const bodyObj = kind === "checklist" ? { title: String(it) } : { title: String((it as { title?: string }).title ?? ""), start_time: String((it as { time?: string }).time ?? "") };
          if (!bodyObj.title) continue;
          await fetch(`/api/wedding/${slug}/list/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(bodyObj) });
        }
        setTab(kind === "checklist" ? "Checklist" : "Timeline");
      } else if (a.type === "goto") {
        const t = String(a.payload?.tab ?? "");
        if ((TABS as readonly string[]).includes(t)) setTab(t as Tab);
      }
    }
    window.addEventListener("venuely:action", onAction);
    return () => window.removeEventListener("venuely:action", onAction);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--cream, #FBF7F2)", fontFamily: tokens.bodyFont, color: "var(--ink, #1c1917)" }}>
      {isMobile && navOpen && <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 55 }} />}
      {/* SIDEBAR — mirrors the venue dashboard (drawer on mobile) */}
      <aside style={isMobile
        ? { width: 256, background: "#fffdfb", borderRight: "1px solid var(--line, #ece7e1)", display: "flex", flexDirection: "column", padding: "20px 14px", position: "fixed", top: 0, left: 0, height: "100vh", overflowY: "auto", zIndex: 60, transform: navOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.2s ease", boxShadow: navOpen ? "4px 0 24px rgba(0,0,0,0.18)" : "none" }
        : { width: 248, flexShrink: 0, background: "#fffdfb", borderRight: "1px solid var(--line, #ece7e1)", display: "flex", flexDirection: "column", padding: "20px 14px", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 18px" }}>
          <LogoMark size={34} />
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 800, fontSize: 20, color: "var(--poppy,#FA523C)" }}>Venuely</span>
        </div>
        <nav style={{ display: "grid", gap: 2, flex: 1 }}>
          {COUPLE_NAV.map(({ key, label }) => {
            const active = key === tab;
            return <button key={key} onClick={() => { setTab(key); setNavOpen(false); }} style={{ textAlign: "left", border: "none", cursor: "pointer", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, fontWeight: active ? 700 : 500, background: active ? "var(--poppy,#FA523C)" : "transparent", color: active ? "#fff" : "#44403c" }}>{label}</button>;
          })}
        </nav>
        <div style={{ marginTop: 14, background: "var(--bone,#FFF6F0)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Need help?</div>
          <div style={{ fontSize: 11.5, color: "#78716c", margin: "2px 0 8px" }}>Your venue coordinator is here to help.</div>
          {venue.email && <a href={`mailto:${venue.email}`} style={{ display: "block", textAlign: "center", border: "1px solid var(--poppy,#FA523C)", color: "var(--poppy,#FA523C)", borderRadius: 999, padding: "6px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>Message Venue</a>}
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line,#ece7e1)", background: "#fffdfb", position: "sticky", top: 0, zIndex: 10 }}>
          {isMobile ? <button onClick={() => setNavOpen(true)} aria-label="Menu" style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>☰</button> : <span />}
          <span style={{ fontSize: 13, color: "#78716c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, textAlign: isMobile ? "center" : "right" }}>{venue.name} · {dateLabel}</span>
          {!isMobile && <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>{coupleNames}</span>}
        </div>

        {/* BODY */}
        <main style={{ flex: 1, padding: isMobile ? "16px 14px 80px" : "24px 28px 90px", width: "100%" }}>
        {tab === "Overview" && (
          <CoupleOverview slug={slug} venue={venue} coupleNames={coupleNames} daysToGo={daysToGo} dateLabel={dateLabel} totalDue={totalDue} rooms={rooms} rentals={rentals} state={state} cover={cover} onNavigate={(t) => setTab(t as Tab)} />
        )}
        {false && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* AI front door */}
            <div style={{ borderRadius: tokens.cardRadius, padding: 24, background: `linear-gradient(135deg, ${primary}, ${accent})`, color: "#fff" }}>
              <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>Your AI wedding planner</div>
              <div style={{ ...heading, fontSize: 24, margin: "6px 0 4px", color: "#fff" }}>Not sure where to start?</div>
              <p style={{ opacity: 0.95, margin: "0 0 14px", fontSize: 14 }}>Tell me your vibe, guest count or budget and I&apos;ll guide you through everything {venue.name} offers — and fill in the rest.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => window.dispatchEvent(new Event("venuely:open-planner"))} style={{ background: "#fff", color: primary, border: "none", borderRadius: 999, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>✨ Plan with AI</button>
                <button onClick={() => setTab("Inspiration")} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 999, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Find your style</button>
              </div>
            </div>

            <div style={card({ padding: 22 })}>
              <div style={{ ...heading, fontSize: 22 }}>Welcome to your planning portal</div>
              <p style={{ color: "#57534e", marginTop: 6 }}>Browse everything {venue.name} offers — catalogue, rentals, accommodation and trusted suppliers — and plan your day in one place.</p>
              {weddingDate && (
                <div style={{ marginTop: 14 }}>
                  <AddToCalendar slug={slug} title={coupleNames || "Our wedding"} location={[venue.name, venue.address || venue.region].filter(Boolean).join(", ")} weddingDate={weddingDate} weddingEndDate={weddingEndDate} primary={primary} accent={accent} />
                </div>
              )}
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
            {gallery.length === 0 ? <Empty>No photos yet.</Empty> : groupBy(gallery, (g) => g.category || "The venue").map(([label, items]) => (
              <div key={label} style={{ marginBottom: 22 }}>
                <div style={{ ...heading, fontSize: 16, marginBottom: 10 }}>{label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                  {items.map((g, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={g.url} alt={g.label} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: tokens.cardRadius }} />
                  ))}
                </div>
              </div>
            ))}
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
          <div style={{ display: "grid", gap: 26 }}>
            <GuestManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} />
            {rooms.length === 0 ? <Section heading={heading} title="Accommodation" sub="On-site stays for you and your guests"><Empty>No accommodation listed by your venue yet.</Empty></Section> : (
              <RoomAllocator
                slug={slug}
                rooms={rooms.map((r) => ({ id: r.id, name: r.name, sleeps: r.sleeps, price: r.price, description: r.description }))}
                onAllocated={(ids) => persist({ ...stateRef.current, roomAssignments: Object.fromEntries(ids.map((id) => [id, ["Allocated"]])) })}
                primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius}
              />
            )}
          </div>
        )}

        {tab === "Suppliers" && (
          <SuppliersManager
            venueName={venue.name}
            vendors={vendors.map((v) => ({ id: v.id, type: v.type, name: v.name, description: v.description, price: v.price, email: v.email, phone: v.phone }))}
            suppliers={((state as Record<string, unknown>).suppliers as import("@/components/SuppliersManager").Supplier[]) ?? []}
            onChange={(next) => persist({ ...state, suppliers: next })}
            primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius}
          />
        )}

        {tab === "Guests" && (
          <GuestManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} />
        )}
        {tab === "Invites" && (
          <div style={{ display: "grid", gap: 28 }}>
            <GuestInvites slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
            <div style={{ borderTop: "1px solid var(--line,#ece7e1)", paddingTop: 20 }}>
              <RemindersManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
            </div>
          </div>
        )}
        {tab === "Seating" && (
          <SeatingPlan slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Inspiration" && (
          <InspirationBoard slug={slug} initialPalette={(state as Record<string, unknown>).palette as string[] ?? []} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Documents" && (
          <DocumentManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Timeline" && (
          <TimelineBoard slug={slug} weddingDate={weddingDate} weddingEndDate={weddingEndDate} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Contacts" && (
          <ListManager slug={slug} kind="contacts" title="Contacts" sub="Your vendors, coordinator and emergency contacts" fields={CONTACT_FIELDS} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Music" && (
          <ListManager slug={slug} kind="songs" title="Music & song requests" sub="Key moments + your playlist for the DJ" fields={SONG_FIELDS} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Checklist" && (
          <ChecklistBoard slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Flowers" && (
          <ListManager slug={slug} kind="flowers" title="Flowers" sub="Your flower wishlist to share with the florist" fields={FLOWER_FIELDS} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Dress" && (
          <ListManager slug={slug} kind="dress" title="The dress" sub="Track dresses, shops and the features you love" fields={DRESS_FIELDS} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Décor" && (
          <ListManager slug={slug} kind="decor" title="Décor" sub="Centrepieces, ceremony arch and styling notes" fields={DECOR_FIELDS} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Budget" && (
          <BudgetBoard slug={slug} totalDue={totalDue} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
        )}
        {tab === "Payments" && (
          <div style={{ display: "grid", gap: 28 }}>
            <PaymentsManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
            <div style={{ borderTop: "1px solid var(--line,#ece7e1)", paddingTop: 20 }}>
              <DocumentManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
            </div>
          </div>
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

      <AiPlanner slug={slug} primary={primary} accent={accent} />
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
