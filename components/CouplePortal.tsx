"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { catalogueQuantity } from "@/lib/billing/catalogue-qty";
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
import { SpacesSection, type AreaItem } from "@/components/SpacesSection";
import { CoupleMessages, type MessageThread, type StartVendor } from "@/components/CoupleMessages";

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
type CustomRequest = { id: string; name: string; note?: string };
type WState = {
  catalogueSelections?: Record<string, DaySel>;
  rentalSelections?: Record<string, DaySel & { qty?: number }>;
  roomAssignments?: Record<string, string[]>;
  customRequests?: CustomRequest[];
  [k: string]: unknown;
};
const DAY_TYPES: { key: "mg" | "wed" | "fb"; label: string }[] = [
  { key: "mg", label: "M&G" }, { key: "wed", label: "Wedding" }, { key: "fb", label: "Farewell" },
];

type CatItem = { id: string; category: string; name: string; description: string; img: string | null; price?: number; priceUnit?: string | null; included: boolean; eventPart?: string | null };
type RentItem = CatItem & { price: number };
type RoomItem = { id: string; name: string; type: string; sleeps: number; description: string; img: string | null; price: number };
type VendorItem = { id: string; type: string; name: string; description: string; img: string | null; price: number | null; email: string | null; phone: string | null; website: string | null; commissionValue?: number | null; commissionType?: string | null };
type GalleryItem = { url: string; category: string; label: string };
type TableItem = { id: string; label: string; shape: string; seats: number; quantity: number };
type Venue = { name: string; region: string | null; address: string | null; description: string | null; email: string | null; phone: string | null; mapsUrl: string | null };

const TABS = ["Overview", "Our Venue", "Messages", "Catalogue & Rentals", "Inspiration", "Flowers", "Dress", "Décor", "Accommodation", "Suppliers", "Guests", "Invites", "Reminders", "Seating", "Timeline", "Checklist", "Contacts", "Music", "Budget", "Payments", "Documents"] as const;
type Tab = (typeof TABS)[number];

type NavLeaf = { key: Tab; label: string; icon: string };
type NavGroup = { group: string; icon: string; defaultOpen?: boolean; children: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;
const isGroup = (e: NavEntry): e is NavGroup => "group" in e;

// Couple sidebar — simplified into 2 pinned leaves (Overview, Messages) + 5
// collapsible journey sections so a first-time couple isn't faced with ~19 flat
// tabs. Every planning tab lives inside the section that matches the couple's
// mental model. See docs/couple-portal-ia-audit-2026-06.md.
const COUPLE_NAV: NavEntry[] = [
  { key: "Overview", label: "Overview", icon: "home" },
  { key: "Messages", label: "Messages", icon: "chat" },
  {
    group: "Our Venue", icon: "venue", defaultOpen: true, children: [
      { key: "Our Venue", label: "Spaces & Rooms", icon: "venue" },
      { key: "Accommodation", label: "Accommodation", icon: "bed" },
      { key: "Catalogue & Rentals", label: "Extras & Rentals", icon: "box" },
    ],
  },
  {
    group: "Our Guests", icon: "users", children: [
      { key: "Guests", label: "Guest List", icon: "users" },
      { key: "Seating", label: "Seating plan", icon: "seat" },
    ],
  },
  {
    group: "Money", icon: "wallet", children: [
      { key: "Budget", label: "Budget", icon: "wallet" },
      { key: "Payments", label: "Payments", icon: "card" },
      { key: "Documents", label: "Documents", icon: "box" },
    ],
  },
  {
    group: "Suppliers & Style", icon: "store", children: [
      { key: "Suppliers", label: "Suppliers", icon: "store" },
      { key: "Inspiration", label: "Inspiration", icon: "sparkle" },
      { key: "Invites", label: "Invites", icon: "mail" },
      { key: "Flowers", label: "Flowers", icon: "flower" },
      { key: "Dress", label: "The Dress", icon: "dress" },
      { key: "Décor", label: "Décor", icon: "decor" },
      { key: "Music", label: "Music", icon: "music" },
      { key: "Contacts", label: "Contacts", icon: "phone" },
    ],
  },
  {
    group: "The Day", icon: "clock", children: [
      { key: "Timeline", label: "Wedding day Timeline", icon: "clock" },
      { key: "Checklist", label: "Checklist", icon: "check" },
    ],
  },
];

// Thin line icons (Venuely style) for the couple sidebar. Plain function (not a
// component) so it can be called inline without remount/lint issues.
function navIcon(name: string) {
  const P: Record<string, React.ReactNode> = {
    home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>,
    venue: <><path d="M4 21V5l8-3 8 3v16" /><path d="M9 21v-5h6v5" /><path d="M8 9h.01M12 9h.01M16 9h.01" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M21 20c0-2.2-1.6-3.7-4-4.2" /></>,
    bed: <><path d="M3 18v-7a2 2 0 0 1 2-2h9a4 4 0 0 1 4 4v5" /><path d="M3 14h18" /><path d="M3 18v2M21 13v7" /></>,
    sparkle: <><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
    store: <><path d="M4 9l1-4h14l1 4" /><path d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /><path d="M5 11v8h14v-8" /></>,
    box: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>,
    wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1.1" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18" /><path d="M7 15l2 2 4-4" /></>,
    seat: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>,
    flower: <><circle cx="12" cy="8" r="3" /><path d="M12 11v10" /><path d="M12 17c-2.8 0-4.6-1.4-5-3.5 2.8 0 4.6 1.4 5 3.5z" /><path d="M12 17c2.8 0 4.6-1.4 5-3.5-2.8 0-4.6 1.4-5 3.5z" /></>,
    dress: <><path d="M9 3l3 3 3-3" /><path d="M12 6l-2 4-4 8c2 1.4 4 2 6 2s4-.6 6-2l-4-8z" /></>,
    decor: <><path d="M3 5c3 4.5 15 4.5 18 0" /><path d="M6.5 7.3L8 11M17.5 7.3L16 11M12 8.4V12" /></>,
    music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
    phone: <><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></>,
    chat: <><path d="M21 11.5c0 4.1-4 7.5-9 7.5-1.2 0-2.3-.2-3.3-.5L3 20l1.4-3.4C3.5 15.4 3 13.5 3 11.5 3 7.4 7 4 12 4s9 3.4 9 7.5z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{P[name] ?? null}</svg>;
}

const VENDOR_LABELS: Record<string, string> = { caterer: "Caterers", planner: "Planners", florist: "Florists", dj: "DJs", photographer: "Photographers", decor: "Décor", bar: "Bar services" };
const rZA = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;

function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const it of items) { const k = key(it) || "Other"; (m.get(k) ?? m.set(k, []).get(k)!).push(it); }
  return [...m.entries()];
}

export function CouplePortal({
  slug, tokens, theme, cover, logoUrl, venue, coupleNames, daysToGo, dateLabel, weddingDate, weddingEndDate, totalDue, guestCount = 0, initialState, catalogue, rentals, rooms, vendors, introducedVendorIds = [], gallery, tables, areas = [], initialAreaSelections = [], messageThreads = [],
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
  guestCount?: number;
  initialState: WState;
  catalogue: CatItem[];
  rentals: RentItem[];
  rooms: RoomItem[];
  vendors: VendorItem[];
  introducedVendorIds?: string[];
  gallery: GalleryItem[];
  tables: TableItem[];
  areas?: AreaItem[];
  initialAreaSelections?: Array<{ area_id: string; day_type: string }>;
  messageThreads?: MessageThread[];
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [navOpen, setNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.matchMedia("(max-width: 859px)").matches : false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  // Remember the active tab across page refreshes AND soft router.refresh()
  // re-renders (selecting a rental/catalogue item calls router.refresh to
  // recompute the total) so the couple stays on the tab they're working in
  // instead of being dropped back to Overview. We use sessionStorage rather than
  // history.replaceState — manual replaceState interferes with the Next App
  // Router and was itself bouncing the page to Overview on refresh.
  // Hydration-safe: server + first client render are always "Overview", restored
  // on mount.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`vy-tab-${slug}`);
      if (saved && (TABS as readonly string[]).includes(saved)) setTab(saved as Tab);
    } catch { /* sessionStorage unavailable — keep default */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  useEffect(() => {
    try { sessionStorage.setItem(`vy-tab-${slug}`, tab); } catch { /* ignore */ }
  }, [tab, slug]);
  const [rentFilter, setRentFilter] = useState("All");
  const [rentFolder, setRentFolder] = useState<"all" | "included" | "extra">("all");
  // Per-section open state for the sidebar accordion (undefined → use the
  // section's defaultOpen; the section holding the active tab is always open).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // First-run guided tour — auto-starts once per couple, re-launchable from the
  // sidebar "Take the tour" link. Seen-state in localStorage (survives refresh).
  const [tourOpen, setTourOpen] = useState(false);
  const startTour = () => setTourOpen(true);
  const closeTour = () => { setTourOpen(false); try { localStorage.setItem(`venuely_tour_v1_${slug}`, "1"); } catch { /* ignore */ } };
  useEffect(() => {
    try {
      if (!localStorage.getItem(`venuely_tour_v1_${slug}`)) {
        const t = setTimeout(() => setTourOpen(true), 900);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  // "+ Add custom item" — a request to the venue (not self-priced; the venue
  // quotes/adds it to the proforma properly). Stored in wedding_state.
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customNote, setCustomNote] = useState("");
  function addCustomRequest() {
    if (!customName.trim()) return;
    const req = { id: crypto.randomUUID?.() ?? String(Date.now()), name: customName.trim(), note: customNote.trim() || undefined };
    persist({ ...state, customRequests: [...(state.customRequests ?? []), req] });
    setCustomName(""); setCustomNote(""); setCustomOpen(false);
  }
  function removeCustomRequest(id: string) {
    persist({ ...state, customRequests: (state.customRequests ?? []).filter((r) => r.id !== id) });
  }
  const [supFilter, setSupFilter] = useState("All");
  // Mediated supplier messaging — unread badge on the nav item + the supplier a
  // "venuely:message-supplier" event asked to open (SuppliersManager dispatches
  // it; the portal owns tab state so it ALSO switches to the Messages tab).
  const [msgUnread, setMsgUnread] = useState(() => messageThreads.reduce((s, t) => s + (Number(t.coupleUnread) || 0), 0));
  const [msgStartVendor, setMsgStartVendor] = useState<StartVendor>(null);
  useEffect(() => {
    function onMessageSupplier(e: Event) {
      const d = (e as CustomEvent).detail as { vendorId?: string; name?: string; type?: string } | undefined;
      if (d?.name) setMsgStartVendor({ vendorId: d.vendorId, name: d.name, type: d.type });
      setTab("Messages");
    }
    window.addEventListener("venuely:message-supplier", onMessageSupplier);
    return () => window.removeEventListener("venuely:message-supplier", onMessageSupplier);
  }, []);
  const router = useRouter();
  const [state, setState] = useState<WState>(initialState ?? {});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [, startTransition] = useTransition();
  const primary = theme.primary;
  const accent = theme.accent;
  // Classic omits weight/letter-spacing tokens so headings inherit exactly as before.
  const heading: React.CSSProperties = {
    fontFamily: tokens.headingFont,
    fontStyle: tokens.headingItalic ? "italic" : "normal",
    ...(tokens.headingWeight != null ? { fontWeight: tokens.headingWeight } : {}),
    ...(tokens.headingLetterSpacing ? { letterSpacing: tokens.headingLetterSpacing } : {}),
  };

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

  // ── Template-driven design system ────────────────────────────────────────
  // Classic = the original portal, untouched: it keeps the desktop sidebar and
  // all of its original hardcoded styles (the classic token values mirror them
  // exactly). Editorial / Modern / Romantic depart via a horizontal top nav,
  // their own hero treatment (rendered inside CoupleOverview) and surfaces.
  const isClassic = tokens.id === "classic";
  const topNav = tokens.navStyle !== "sidebar"; // editorial/modern/romantic use a top nav strip on desktop
  const showAside = isMobile || !topNav;        // mobile always keeps the drawer

  const btnBase: React.CSSProperties = tokens.buttonStyle === "solid"
    ? { background: primary, color: "#fff", borderRadius: tokens.buttonRadius }
    : { background: "transparent", color: primary, border: `1.5px solid ${primary}`, borderRadius: tokens.buttonRadius };
  const btn: React.CSSProperties = tokens.buttonCase === "uppercase"
    ? { ...btnBase, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 12.5 }
    : btnBase;

  // Romantic layers a soft accent tint over its near-white cards; others are flat.
  const cardBg = tokens.cardTint
    ? `linear-gradient(0deg, ${accent}${tokens.cardTint}, ${accent}${tokens.cardTint}), ${tokens.surfaceCard}`
    : tokens.surfaceCard;
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: cardBg, border: tokens.cardBorder, borderRadius: tokens.cardRadius, boxShadow: tokens.cardShadow, ...extra });

  const eyebrow: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: tokens.eyebrowTracking, fontWeight: 700 };

  // Filter chips / folder toggles — tint (classic, romantic), outline (editorial) or solid (modern).
  const chip = (on: boolean): React.CSSProperties => {
    const base: React.CSSProperties = { borderRadius: tokens.chipRadius, cursor: "pointer", fontWeight: on ? 700 : 500 };
    if (tokens.chipStyle === "outline") return { ...base, border: `1px solid ${on ? "#1c1917" : "rgba(0,0,0,0.35)"}`, background: on ? "#1c1917" : "#fff", color: on ? "#fff" : "#44403c", textTransform: "uppercase", letterSpacing: "0.07em" };
    if (tokens.chipStyle === "solid") return { ...base, border: `1px solid ${on ? primary : "rgba(0,0,0,0.12)"}`, background: on ? primary : "#fff", color: on ? "#fff" : "#57534e" };
    return { ...base, border: `1px solid ${on ? primary : "rgba(0,0,0,0.15)"}`, background: on ? `${primary}1f` : "#fff", color: on ? primary : "#57534e" };
  };
  // Classic keeps its two original (slightly different) chip treatments exactly.
  const folderChip = (on: boolean): React.CSSProperties => isClassic ? { ...chip(on), borderRadius: tokens.cardRadius } : chip(on);
  const filterChip = (on: boolean): React.CSSProperties => isClassic
    ? { borderRadius: 999, cursor: "pointer", border: `1px solid ${on ? primary : "rgba(0,0,0,0.15)"}`, background: on ? primary : "#fff", color: on ? "#fff" : "#57534e", fontWeight: on ? 700 : 500 }
    : chip(on);

  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 };
  const itemProps = { primary, accent, heading, cardRadius: tokens.cardRadius, cardBorder: tokens.cardBorder };

  return (
    // Re-point the brand CSS variables to the VENUE's saved theme so the whole
    // portal subtree (incl. sub-components that use var(--poppy)/var(--peach))
    // renders in the venue's primary/accent, not the default Venuely coral.
    <div style={{ display: "flex", minHeight: "100vh", background: tokens.surface, fontFamily: tokens.bodyFont, color: "var(--ink, #1c1917)",
      "--poppy": primary, "--poppy-deep": primary, "--peach": accent, "--accent": accent } as React.CSSProperties}>
      {isMobile && navOpen && <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 55 }} />}
      {tourOpen && (
        <PortalTour
          primary={primary}
          onClose={closeTour}
          steps={[
            { title: "Welcome to your wedding hub 🎉", body: `Everything for your day with ${venue.name} lives here. Here's a 30-second tour.`, before: () => { setTab("Overview"); if (isMobile) setNavOpen(false); } },
            { sel: '[data-tour="nav"]', title: "Your plan, in 5 simple sections", body: "Tasks are grouped so nothing feels overwhelming. Open a section to see what's inside.", before: () => { if (isMobile) setNavOpen(true); } },
            { sel: '[data-tour="start-here"]', title: "Always start here", body: "On Overview, this card always tells you the single most important thing to do next.", before: () => { setTab("Overview"); if (isMobile) setNavOpen(false); } },
            { sel: '[data-tour="section-Our Venue"]', title: "1 · Our Venue", body: "Choose your ceremony & reception spaces, accommodation, and any paid extras.", before: () => { if (isMobile) setNavOpen(true); } },
            { sel: '[data-tour="section-Our Guests"]', title: "2 · Our Guests", body: "Build your guest list — seating unlocks once you've added a guest.", before: () => { if (isMobile) setNavOpen(true); } },
            { sel: '[data-tour="section-Money"]', title: "3 · Money", body: "Track your budget, view invoices & payments, and store your documents.", before: () => { if (isMobile) setNavOpen(true); } },
            { sel: '[data-tour="section-Suppliers & Style"]', title: "4 · Suppliers & Style", body: "Message venue-recommended suppliers and build your inspiration board.", before: () => { if (isMobile) setNavOpen(true); } },
            { sel: '[data-tour="section-The Day"]', title: "5 · The Day", body: "Plan your hour-by-hour timeline and tick off your checklist as the day nears.", before: () => { if (isMobile) setNavOpen(true); } },
            { title: "You're all set! 💍", body: "Reopen this tour any time via “Take the tour” at the bottom of the menu.", before: () => { if (isMobile) setNavOpen(false); } },
          ]}
        />
      )}
      {/* SIDEBAR — classic keeps it on desktop; every template uses it as the mobile drawer */}
      {showAside && (
      <aside style={isMobile
        ? { width: 256, background: "#fffdfb", borderRight: "1px solid var(--line, #ece7e1)", display: "flex", flexDirection: "column", padding: "20px 14px", position: "fixed", top: 0, left: 0, height: "100vh", overflowY: "auto", zIndex: 60, transform: navOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.2s ease", boxShadow: navOpen ? "4px 0 24px rgba(0,0,0,0.18)" : "none" }
        : { width: 240, flexShrink: 0, background: "#fffdfb", borderRight: "1px solid var(--line, #ece7e1)", display: "flex", flexDirection: "column", padding: "20px 13px", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ padding: "0 6px 18px" }}>
          {/* Venue identity — a circular photo/logo avatar next to the venue name,
              like a profile chip (replaces the old stretched logo image). */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            {(cover || logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(cover || logoUrl) as string} alt={venue.name} title={venue.name} style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid var(--line,#ece7e1)" }} />
            ) : (
              <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: primary, color: "#fff", fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 17, lineHeight: 1 }}>
                {venue.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, color: "var(--ink,#1c1917)" }}>{venue.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12 }}>
            <LogoMark size={12} />
            <span style={{ fontSize: 10, letterSpacing: 0.3, color: "#a8a29e" }}>Powered by Venuely</span>
          </div>
        </div>
        <nav data-tour="nav" style={{ display: "grid", gap: 2, flex: 1 }}>
          {COUPLE_NAV.map((entry) => {
            if (!isGroup(entry)) {
              const active = entry.key === tab;
              return <button key={entry.key} onClick={() => { setTab(entry.key); setNavOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", border: "none", cursor: "pointer", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, fontWeight: active ? 700 : 500, background: active ? "var(--poppy,#FA523C)" : "transparent", color: active ? "#fff" : "#44403c" }}>{navIcon(entry.icon)}<span style={{ flex: 1 }}>{entry.label}</span>{entry.key === "Messages" && msgUnread > 0 && <span style={{ background: active ? "#fff" : "var(--poppy,#FA523C)", color: active ? "var(--poppy,#FA523C)" : "#fff", borderRadius: 999, fontSize: 10.5, fontWeight: 700, padding: "1px 7px", lineHeight: 1.5 }}>{msgUnread}</span>}</button>;
            }
            const childActive = entry.children.some((c) => c.key === tab);
            const explicit = openGroups[entry.group];
            const open = (explicit === undefined ? !!entry.defaultOpen : explicit) || childActive;
            return (
              <div key={entry.group}>
                <button data-tour={`section-${entry.group}`} onClick={() => setOpenGroups((o) => ({ ...o, [entry.group]: !open }))} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, textAlign: "left", border: "none", cursor: "pointer", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, fontWeight: childActive ? 700 : 600, background: "transparent", color: childActive ? "var(--poppy,#FA523C)" : "#44403c" }}>
                  {navIcon(entry.icon)}
                  <span style={{ flex: 1 }}>{entry.group}</span>
                  <svg viewBox="0 0 12 12" width="11" height="11" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} aria-hidden><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {open && (
                  <div style={{ display: "grid", gap: 2, marginLeft: 12, paddingLeft: 10, borderLeft: "1px solid rgba(0,0,0,0.08)" }}>
                    {entry.children.map((c) => {
                      const active = c.key === tab;
                      // Seating needs guests first — dim + lock until ≥1 guest added.
                      const locked = c.key === "Seating" && guestCount === 0;
                      return <button key={c.key} disabled={locked} onClick={() => { if (locked) { setTab("Guests"); setNavOpen(false); return; } setTab(c.key); setNavOpen(false); }} title={locked ? "Add guests first to unlock seating" : undefined} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", border: "none", cursor: locked ? "not-allowed" : "pointer", borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: active ? 700 : 500, background: active ? "var(--poppy,#FA523C)" : "transparent", color: active ? "#fff" : "#57534e", opacity: locked ? 0.45 : 1 }}>{navIcon(c.icon)}<span style={{ flex: 1 }}>{c.label}</span>{locked && <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>}</button>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <button onClick={() => { setNavOpen(false); startTour(); }} style={{ marginTop: 14, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, border: "1px dashed var(--line,#e3ded7)", background: "transparent", color: "#78716c", borderRadius: 10, padding: "8px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3" /><path d="M12 17h.01" /></svg>
          Take the tour
        </button>
        <div style={{ marginTop: 10, background: "var(--bone,#FFF6F0)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Need help?</div>
          <div style={{ fontSize: 11.5, color: "#78716c", margin: "2px 0 8px" }}>Your venue coordinator is here to help.</div>
          {venue.email && <a href={`mailto:${venue.email}`} style={{ display: "block", textAlign: "center", border: "1px solid var(--poppy,#FA523C)", color: "var(--poppy,#FA523C)", borderRadius: 999, padding: "6px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>Message Venue</a>}
        </div>
      </aside>
      )}

      {/* MAIN COLUMN — surface from the template (classic: soft peach→cream fade) */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: tokens.mainBg }}>
        <div style={{ position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(6px)", background: topNav && !isMobile ? `${tokens.surface}E6` : "transparent", borderBottom: topNav && !isMobile && tokens.navStyle !== "top-tabs" ? tokens.divider : "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px" }}>
            {isMobile ? <button onClick={() => setNavOpen(true)} aria-label="Menu" style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>☰</button>
              : topNav ? <PortalLogo logoUrl={logoUrl} venueName={venue.name} heading={{ ...heading, color: primary }} light={false} /> : <span />}
            <span style={{ fontSize: 13, color: "#78716c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, textAlign: isMobile ? "center" : "right" }}>{venue.name} · {dateLabel}</span>
            {!isMobile && <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap" }}>{coupleNames}</span>}
          </div>
          {topNav && !isMobile && <TopNavBar tokens={tokens} primary={primary} accent={accent} tab={tab} onTab={setTab} msgUnread={msgUnread} />}
        </div>

        {/* BODY */}
        <main style={{ flex: 1, padding: isMobile ? "16px 14px 80px" : "24px 28px 90px", width: "100%" }}>
        <div key={tab} className="anim-fade-up">
        {tab === "Overview" && (
          <div style={{ display: "grid", gap: 16 }}>
            <CoupleOverview
              slug={slug} venue={venue} coupleNames={coupleNames} daysToGo={daysToGo} dateLabel={dateLabel} totalDue={totalDue}
              rooms={rooms} rentals={rentals} state={state} cover={cover} onNavigate={(t) => setTab(t as Tab)}
              weddingDate={weddingDate} weddingEndDate={weddingEndDate}
              selectedAreas={areas.filter((a) => initialAreaSelections.some((s) => s.area_id === a.id)).map((a) => ({ name: a.name, kind: a.kind }))}
              tokens={tokens} themePrimary={primary} themeAccent={accent}
            />
            {weddingDate && (
              <div style={card({ padding: 18 })}>
                <div style={{ ...heading, fontSize: 17, marginBottom: 10 }}>Save the date</div>
                <AddToCalendar slug={slug} title={coupleNames || "Our wedding"} location={[venue.name, venue.address || venue.region].filter(Boolean).join(", ")} weddingDate={weddingDate} weddingEndDate={weddingEndDate} primary={primary} accent={accent} />
              </div>
            )}
          </div>
        )}

        {tab === "Our Venue" && (
          <Section heading={heading} tokens={tokens} primary={primary} title={venue.name} sub={venue.address || venue.region || ""}>
            {weddingDate && (() => {
              const fmtD = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
              const multi = !!(weddingEndDate && weddingEndDate !== weddingDate);
              const dateText = multi ? `${fmtD(weddingDate)} – ${fmtD(weddingEndDate as string)}` : fmtD(weddingDate);
              return (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16, padding: "7px 14px", borderRadius: 999, background: `${primary}0f`, border: `1px solid ${primary}33`, fontSize: 13 }}>
                  <span style={{ color: primary, fontWeight: 700 }}>Wedding {multi ? "dates" : "date"}:</span>
                  <span style={{ fontWeight: 600, color: "#44403c" }}>{dateText}</span>
                  {daysToGo != null && daysToGo >= 0 && <span style={{ color: "#78716c" }}>· {daysToGo} day{daysToGo === 1 ? "" : "s"} to go</span>}
                </div>
              );
            })()}
            {venue.description && <p style={{ color: "#57534e", maxWidth: 720, marginBottom: 16 }}>{venue.description}</p>}
            {gallery.length === 0 ? <Empty radius={isClassic ? undefined : tokens.cardRadius}>No photos yet.</Empty> : groupBy(gallery, (g) => g.category || "The venue").map(([label, items]) => (
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
            <SpacesSection slug={slug} areas={areas} initialSelections={initialAreaSelections} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
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
            <Section heading={heading} tokens={tokens} primary={primary} title="Catalogue & Rentals" sub="Everything included with your booking, plus optional extras to add">
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {([["all", "All", null], ["included", "Included with booking", "calendar"], ["extra", "To pay for", "dollar"]] as const).map(([k, label, icon]) => {
                  const on = rentFolder === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setRentFolder(k)}
                      style={{ fontSize: 13, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 7, ...folderChip(on), borderRadius: 999 }}
                    >
                      {icon === "calendar" && (
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
                        </svg>
                      )}
                      {icon === "dollar" && (
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <circle cx="12" cy="12" r="9" /><path d="M12 7v10M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2" />
                        </svg>
                      )}
                      {label}
                    </button>
                  );
                })}
              </div>
              {/* Custom item request + AI planner — per the dashboard mock */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 999, background: "#fff", border: "1px solid rgba(0,0,0,0.12)", color: "var(--ink, #1c1917)", cursor: "pointer" }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
                  Add custom item
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("venuely:open-planner"))}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, padding: "8px 16px", borderRadius: 999, background: primary, border: "none", color: "#fff", cursor: "pointer" }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" /><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" /></svg>
                  Plan with AI
                </button>
              </div>
              </div>
              <FilterChips chip={filterChip} value={rentFilter} onChange={setRentFilter} options={cats} />

              {/* The couple's custom requests — venue quotes these before they're billable */}
              {(state.customRequests ?? []).length > 0 && (
                <div style={{ margin: "12px 0", display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#a8a29e", fontWeight: 700 }}>Your custom requests</div>
                  {(state.customRequests ?? []).map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderLeft: `3px solid ${primary}`, borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink, #1c1917)" }}>{r.name}</div>
                        {r.note && <div style={{ fontSize: 12, color: "#57534e" }}>{r.note}</div>}
                      </div>
                      <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "#8a6116", background: "#fdf0d4", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>Awaiting venue quote</span>
                      <button type="button" onClick={() => removeCustomRequest(r.id)} style={{ background: "none", border: "none", color: "#a8a29e", cursor: "pointer", fontSize: 14 }} aria-label={`Remove ${r.name}`}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add-custom-item dialog */}
              {customOpen && (
                <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setCustomOpen(false)}>
                  <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 24, width: "min(440px,100%)" }}>
                    <h3 style={{ ...heading, fontSize: 21, margin: "0 0 6px" }}>Request a custom item</h3>
                    <p style={{ fontSize: 12.5, color: "#57534e", margin: "0 0 14px" }}>Not on the list? Tell {venue.name} what you&apos;d like — they&apos;ll quote it and add it to your booking.</p>
                    <div style={{ display: "grid", gap: 10 }}>
                      <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="What would you like? e.g. Fireworks display" style={{ width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13.5 }} autoFocus />
                      <textarea value={customNote} onChange={(e) => setCustomNote(e.target.value)} placeholder="Any details (quantity, timing, style…)" rows={3} style={{ width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, resize: "vertical" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                      <button type="button" onClick={() => setCustomOpen(false)} style={{ background: "none", border: "none", color: "#57534e", fontSize: 13.5, cursor: "pointer", padding: "9px 12px" }}>Cancel</button>
                      <button type="button" onClick={addCustomRequest} disabled={!customName.trim()} style={{ background: primary, color: "#fff", border: "none", borderRadius: 999, padding: "9px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", opacity: customName.trim() ? 1 : 0.5 }}>Send request</button>
                    </div>
                  </div>
                </div>
              )}
              {shown.length === 0 ? <Empty radius={isClassic ? undefined : tokens.cardRadius}>Nothing in this folder.</Empty> : groupBy(shown, (m) => keyOf(m.item)).map(([catName, items]) => (
                <div key={catName} style={{ marginBottom: 22 }}>
                  <div style={{ ...eyebrow, color: primary, marginBottom: 8 }}>{catName}</div>
                  <div style={grid}>{items.map((m) => m.kind === "cat" ? (
                    <PortalItemCard key={m.item.id} name={m.item.name} description={m.item.description} img={m.item.img} price={m.item.included ? 0 : m.item.price} badge={m.item.included ? "Included" : undefined} paidItem={!m.item.included} selected={catIsSelected(m.item)} onToggle={() => toggleCat(m.item)} days={catSel[m.item.id]} onDay={(d) => toggleCatDay(m.item, d)} {...itemProps} />
                  ) : (
                    <PortalItemCard key={m.item.id} name={m.item.name} description={m.item.description} img={m.item.img} price={m.item.included ? 0 : m.item.price} badge={m.item.included ? "Included" : undefined} paidItem={!m.item.included} selected={!!rentSel[m.item.id]?.sel} onToggle={() => toggleRent(m.item.id)} days={rentSel[m.item.id]} onDay={(d) => toggleRentDay(m.item.id, d)} qty={rentSel[m.item.id]?.qty} onQty={(n) => setRentQty(m.item.id, n)} {...itemProps} />
                  ))}</div>
                </div>
              ))}
            </Section>
          );
        })()}

        {tab === "Accommodation" && (
          <div style={{ display: "grid", gap: 26 }}>
            <GuestManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} />
            {rooms.length === 0 ? <Section heading={heading} tokens={tokens} primary={primary} title="Accommodation" sub="On-site stays for you and your guests"><Empty radius={isClassic ? undefined : tokens.cardRadius}>No accommodation listed by your venue yet.</Empty></Section> : (
              <RoomAllocator
                slug={slug}
                rooms={rooms.map((r) => ({ id: r.id, name: r.name, sleeps: r.sleeps, price: r.price, description: r.description, img: r.img, type: r.type }))}
                onAllocated={(ids) => {
                  // Merge, don't clobber: keep non-guest markers (e.g. ["Reserved"] set by
                  // the AI planner / room toggle) for rooms the allocator didn't touch;
                  // only drop previous guest-derived ["Allocated"] markers that emptied.
                  const next = { ...(stateRef.current.roomAssignments ?? {}) };
                  const occupied = new Set(ids);
                  for (const [roomId, val] of Object.entries(next)) {
                    if (!occupied.has(roomId) && Array.isArray(val) && val.length === 1 && val[0] === "Allocated") delete next[roomId];
                  }
                  ids.forEach((id) => { next[id] = ["Allocated"]; });
                  persist({ ...stateRef.current, roomAssignments: next });
                }}
                primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius}
              />
            )}
          </div>
        )}

        {tab === "Suppliers" && (
          <SuppliersManager
            venueName={venue.name}
            slug={slug}
            venueEmail={venue.email}
            introducedVendorIds={introducedVendorIds}
            vendors={vendors.map((v) => ({ id: v.id, type: v.type, name: v.name, description: v.description, price: v.price, email: v.email, phone: v.phone, website: v.website, img: v.img, commissionValue: v.commissionValue ?? null, commissionType: v.commissionType ?? null }))}
            suppliers={((state as Record<string, unknown>).suppliers as import("@/components/SuppliersManager").Supplier[]) ?? []}
            onChange={(next) => persist({ ...state, suppliers: next })}
            primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius}
          />
        )}

        {tab === "Messages" && (
          <CoupleMessages
            slug={slug}
            initialThreads={messageThreads}
            startVendor={msgStartVendor}
            onUnreadChange={setMsgUnread}
            primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius}
          />
        )}

        {tab === "Guests" && (
          <GuestManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} />
        )}
        {tab === "Invites" && (
          <div style={{ display: "grid", gap: 28 }}>
            <GuestInvites slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
            <div style={{ borderTop: tokens.divider, paddingTop: 20 }}>
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
            <div style={{ borderTop: tokens.divider, paddingTop: 20 }}>
              <DocumentManager slug={slug} primary={primary} accent={accent} heading={heading} cardRadius={tokens.cardRadius} />
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Running total + submit — non-classic picks up the template's surface + rule */}
      <div style={{ position: "sticky", bottom: 0, zIndex: 20, background: isClassic ? "#fff" : tokens.surfaceCard, borderTop: isClassic ? "1px solid rgba(0,0,0,0.1)" : tokens.divider, boxShadow: tokens.id === "editorial" ? "none" : "0 -4px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setBillOpen(true)} title="View your bill breakdown" style={{ background: "transparent", border: "none", textAlign: "left", cursor: "pointer", padding: 0 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: tokens.eyebrowTracking, color: "#57534e" }}>Estimated total{busy ? " · updating…" : ""}</div>
            <div style={{ ...heading, fontSize: 24, color: primary, display: "flex", alignItems: "center", gap: 7 }}>{rZA(totalDue)}<span style={{ fontSize: 13, opacity: 0.6 }}>▸</span></div>
            <div style={{ fontSize: 11, color: "#8a8a8a", textDecoration: "underline" }}>{selectedCount} item{selectedCount === 1 ? "" : "s"} selected · view breakdown</div>
          </button>
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

      {billOpen && typeof document !== "undefined" && (() => {
        const dayCount = (s?: DaySel) => ["mg", "wed", "fb"].filter((d) => (s as Record<string, boolean> | undefined)?.[d]).length || 1;
        const money = (s: unknown) => Number(String(s ?? "").replace(/[^\d.]/g, "")) || 0;
        const catLines = catalogue.filter(catIsSelected);
        const rentLines = rentals.filter((r) => rentSel[r.id]?.sel);
        const roomLines = rooms.filter((r) => Array.isArray(rooms_[r.id]) && rooms_[r.id].length);
        const customLines = (state.customRequests ?? []) as CustomRequest[];
        const supplierLines = ((state.suppliers as Array<{ id: number; name: string; status?: string; price?: string }>) ?? []).filter((s) => s.status === "booked" || money(s.price) > 0);
        const anyLines = catLines.length || rentLines.length || roomLines.length || customLines.length || supplierLines.length;
        const rowWrap: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" };
        const secHead: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.4, color: "#a8a29e", fontWeight: 700, margin: "16px 0 2px" };
        const delBtn: React.CSSProperties = { border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: "#b42318", borderRadius: 8, width: 26, height: 26, cursor: "pointer", fontSize: 14, lineHeight: 1, flexShrink: 0 };
        return createPortal(
          <div role="dialog" aria-modal="true" onClick={() => setBillOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(28,25,23,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)", maxHeight: "88vh", overflowY: "auto", background: "#fff", borderRadius: 18, padding: "26px 26px 18px", boxShadow: "0 24px 70px rgba(0,0,0,0.35)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.4, color: "#a8a29e", fontWeight: 700 }}>Your bill breakdown</div>
                  <div style={{ ...heading, fontSize: 26, color: primary }}>{rZA(totalDue)}</div>
                  <div style={{ fontSize: 12, color: "#8a8a8a" }}>{selectedCount} item{selectedCount === 1 ? "" : "s"} selected · final quote confirmed by {venue.name}</div>
                </div>
                <button onClick={() => setBillOpen(false)} aria-label="Close" style={{ background: "transparent", border: "none", fontSize: 22, color: "#a8a29e", cursor: "pointer" }}>×</button>
              </div>

              {!anyLines && <p style={{ color: "#57534e", fontSize: 14, marginTop: 18 }}>Nothing selected yet — add catering, rentals or accommodation from their tabs and they&apos;ll appear here.</p>}

              {catLines.length > 0 && <>
                <div style={secHead}>Catering &amp; venue extras</div>
                {catLines.map((it) => {
                  const days = dayCount(catSel[it.id]);
                  const q = catalogueQuantity({ name: it.name, priceUnit: it.priceUnit, guests: guestCount, days });
                  const rate = it.price ?? 0;
                  const amount = rate * q.units;
                  // Sub-line: how it's charged (flat / per guest × N / per day / threshold).
                  const sub = it.included ? `${days} day${days === 1 ? "" : "s"} · Included`
                    : q.basis === "per_person" ? `${rZA(rate)} × ${guestCount || "—"} guest${guestCount === 1 ? "" : "s"}${days > 1 ? ` × ${days} days` : ""}`
                    : q.basis === "tier_overage" ? `${rZA(rate)} × ${q.applies ? q.units : 0} (${q.perUnitNote})`
                    : q.basis === "conditional" ? (q.applies ? `${rZA(rate)}${days > 1 ? ` × ${days} days` : ""} · ${q.perUnitNote}` : q.perUnitNote)
                    : q.basis === "per_day" ? `${rZA(rate)} × ${days} day${days === 1 ? "" : "s"}` : "Flat fee";
                  return (
                    <div key={it.id} style={{ ...rowWrap, opacity: !it.included && !q.applies ? 0.55 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: "#1c1917" }}>{it.name}</div><div style={{ fontSize: 12, color: "#8a8a8a" }}>{sub}</div></div>
                      <div style={{ color: primary, fontWeight: 700, whiteSpace: "nowrap", minWidth: 70, textAlign: "right" }}>{it.included ? "Included" : q.applies ? rZA(amount) : "—"}</div>
                      {!it.included && <button title="Remove" style={delBtn} onClick={() => toggleCat(it)}>✕</button>}
                    </div>
                  );
                })}
              </>}

              {rentLines.length > 0 && <>
                <div style={secHead}>Rentals</div>
                {rentLines.map((r) => { const sel = rentSel[r.id]; const qty = sel?.qty ?? 1; const days = dayCount(sel); const amt = r.price * qty * days; return (
                  <div key={r.id} style={rowWrap}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: "#1c1917" }}>{r.name}</div><div style={{ fontSize: 12, color: "#8a8a8a" }}>{rZA(r.price)} each · {days} day{days === 1 ? "" : "s"}</div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button aria-label="Less" onClick={() => setRentQty(r.id, qty - 1)} style={{ ...delBtn, color: "#57534e", width: 24, height: 24 }}>−</button>
                      <span style={{ minWidth: 18, textAlign: "center", fontWeight: 600 }}>{qty}</span>
                      <button aria-label="More" onClick={() => setRentQty(r.id, qty + 1)} style={{ ...delBtn, color: "#57534e", width: 24, height: 24 }}>+</button>
                    </div>
                    <div style={{ color: primary, fontWeight: 700, whiteSpace: "nowrap", minWidth: 70, textAlign: "right" }}>{rZA(amt)}</div>
                    <button title="Remove" style={delBtn} onClick={() => toggleRent(r.id)}>✕</button>
                  </div>
                ); })}
              </>}

              {roomLines.length > 0 && <>
                <div style={secHead}>Accommodation <span style={{ color: "#c9c4be" }}>· per night</span></div>
                {roomLines.map((r) => (
                  <div key={r.id} style={rowWrap}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: "#1c1917" }}>{r.name}</div><div style={{ fontSize: 12, color: "#8a8a8a" }}>Sleeps {r.sleeps}</div></div>
                    <div style={{ color: primary, fontWeight: 700, whiteSpace: "nowrap" }}>{r.price ? `${rZA(r.price)}/night` : "—"}</div>
                    <button title="Remove" style={delBtn} onClick={() => toggleRoom(r.id)}>✕</button>
                  </div>
                ))}
              </>}

              {supplierLines.length > 0 && <>
                <div style={secHead}>Suppliers</div>
                {supplierLines.map((s) => (
                  <div key={s.id} style={rowWrap}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: "#1c1917" }}>{s.name}</div><div style={{ fontSize: 12, color: "#8a8a8a" }}>Manage in the Suppliers tab</div></div>
                    <div style={{ color: primary, fontWeight: 700, whiteSpace: "nowrap" }}>{money(s.price) ? rZA(money(s.price)) : (s.status === "booked" ? "Booked" : "")}</div>
                  </div>
                ))}
              </>}

              {customLines.length > 0 && <>
                <div style={secHead}>Custom requests</div>
                {customLines.map((c) => (
                  <div key={c.id} style={rowWrap}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: "#1c1917" }}>{c.name}</div><div style={{ fontSize: 12, color: "#9a6a00" }}>Awaiting venue quote</div></div>
                    <button title="Remove" style={delBtn} onClick={() => removeCustomRequest(c.id)}>✕</button>
                  </div>
                ))}
              </>}

              <p style={{ fontSize: 11.5, color: "#a8a29e", marginTop: 16, lineHeight: 1.5 }}>
                Catering is charged per guest and spaces are confirmed with your venue, so the figure above is your venue&apos;s authoritative quote — these lines show what&apos;s in it. Edit or remove items here, or in their own tabs.
              </p>
              <div style={{ textAlign: "right", marginTop: 10 }}>
                <button onClick={() => setBillOpen(false)} style={{ ...btn, padding: "9px 22px", cursor: "pointer" }}>Done</button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      <AiPlanner slug={slug} primary={primary} accent={accent} />
    </div>
  );
}

// Top nav strip for the non-sidebar templates (desktop only — mobile uses the
// drawer). Renders the SAME grouped nav as the sidebar: leaves as tabs, and "For
// the Vibes" as one tab that opens a dropdown of its children.
function TopNavBar({ tokens, primary, accent, tab, onTab, msgUnread = 0 }: { tokens: TemplateTokens; primary: string; accent: string; tab: Tab; onTab: (t: Tab) => void; msgUnread?: number }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!openGroup) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpenGroup(null); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openGroup]);

  const variant = tokens.navStyle === "segmented" ? "segmented" : tokens.navStyle === "pills" ? "pills" : "editorial";

  // Per-variant button style for a single tab.
  const tabStyle = (active: boolean, i: number): React.CSSProperties => {
    if (variant === "segmented") return { border: "none", borderLeft: i === 0 ? "none" : tokens.divider, padding: "8px 13px", fontSize: 12.5, whiteSpace: "nowrap", cursor: "pointer", fontWeight: active ? 700 : 500, background: active ? primary : "transparent", color: active ? "#fff" : "#57534e" };
    if (variant === "pills") return { borderRadius: 999, padding: "7px 14px", fontSize: 12.5, whiteSpace: "nowrap", cursor: "pointer", fontWeight: active ? 700 : 500, border: `1px solid ${active ? `${primary}55` : "rgba(0,0,0,0.10)"}`, background: active ? `${accent}55` : "rgba(255,255,255,0.65)", color: active ? primary : "#57534e", display: "inline-flex", alignItems: "center", gap: 5 };
    return { border: "none", background: "transparent", cursor: "pointer", padding: "4px 0 10px", whiteSpace: "nowrap", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: active ? 700 : 500, color: active ? "#1c1917" : "#78716c", boxShadow: active ? "inset 0 -2px 0 #1c1917" : "none", display: "inline-flex", alignItems: "center", gap: 5 };
  };

  // Leaves + group dropdowns, one sequential index per top-level entry (editorial
  // numbering). Each group opens its own dropdown of children.
  const entries = COUPLE_NAV.map((e, idx) => isGroup(e) ? { kind: "group" as const, group: e, num: idx } : { kind: "leaf" as const, leaf: e, num: idx });

  const wrapStyle: React.CSSProperties =
    variant === "segmented" ? { padding: "0 16px 12px", overflowX: "auto" }
    : variant === "pills" ? { display: "flex", gap: 6, padding: "0 16px 12px", overflowX: "auto", position: "relative" }
    : { display: "flex", gap: 22, padding: "0 16px", overflowX: "auto", borderBottom: tokens.divider, position: "relative" };
  const innerStyle: React.CSSProperties | undefined =
    variant === "segmented" ? { display: "inline-flex", border: tokens.cardBorder, borderRadius: "0.75rem", overflow: "hidden", background: "#fff", position: "relative" } : undefined;

  const renderTabs = entries.map((it) => {
    if (it.kind === "leaf") {
      const active = it.leaf.key === tab;
      return (
        <button key={it.leaf.key} onClick={() => onTab(it.leaf.key)} style={tabStyle(active, it.num)}>
          {variant === "editorial" && <span style={{ fontSize: 9.5, color: active ? primary : "#a8a29e" }}>{String(it.num + 1).padStart(2, "0")}</span>}
          {it.leaf.label}
          {it.leaf.key === "Messages" && msgUnread > 0 && <span style={{ background: "var(--poppy,#FA523C)", color: "#fff", border: "1px solid #fff", borderRadius: 999, fontSize: 9.5, fontWeight: 700, padding: "0px 6px", lineHeight: 1.6, marginLeft: 4 }}>{msgUnread}</span>}
        </button>
      );
    }
    const g = it.group;
    const childActive = g.children.some((c) => c.key === tab);
    const isOpen = openGroup === g.group;
    return (
      <div key={g.group} style={{ position: "relative", display: "inline-flex" }}>
        <button onClick={() => setOpenGroup((o) => o === g.group ? null : g.group)} style={tabStyle(childActive, it.num)}>
          {variant === "editorial" && <span style={{ fontSize: 9.5, color: childActive ? primary : "#a8a29e" }}>{String(it.num + 1).padStart(2, "0")}</span>}
          {g.group}
          <svg viewBox="0 0 12 12" width="10" height="10" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} aria-hidden><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {isOpen && (
          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 30, background: "#fff", border: "1px solid var(--line, #ece7e1)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 6, minWidth: 180 }}>
            {g.children.map((c) => {
              const active = c.key === tab;
              return <button key={c.key} onClick={() => { onTab(c.key); setOpenGroup(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", border: "none", cursor: "pointer", borderRadius: 8, padding: "8px 10px", fontSize: 13, whiteSpace: "nowrap", fontWeight: active ? 700 : 500, background: active ? "var(--poppy,#FA523C)" : "transparent", color: active ? "#fff" : "#44403c" }}>{navIcon(c.icon)}<span>{c.label}</span></button>;
            })}
          </div>
        )}
      </div>
    );
  });

  return <div ref={ref} style={wrapStyle}>{innerStyle ? <div style={innerStyle}>{renderTabs}</div> : renderTabs}</div>;
}

// ── First-run guided tour ──────────────────────────────────────────────────
// Hand-rolled spotlight: a dimmed overlay with a cut-out over the current target
// + a tooltip card. Rendered via createPortal to document.body so position:fixed
// escapes the portal's transformed/animated ancestors (the recurring trap here).
type TourStep = { sel?: string; title: string; body: string; before?: () => void };

function PortalTour({ steps, onClose, primary }: { steps: TourStep[]; onClose: () => void; primary: string }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => {
    step.before?.();
    let raf = 0, tries = 0, cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const el = step.sel ? (document.querySelector(step.sel) as HTMLElement | null) : null;
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "auto" });
        setRect(el.getBoundingClientRect());
      } else if (step.sel && tries < 12) {
        tries++; raf = requestAnimationFrame(measure);
      } else {
        setRect(null); // centered fallback (no target / not visible)
      }
    };
    // Give `before` (tab switch / drawer open) time to lay out before measuring.
    const t = setTimeout(() => { raf = requestAnimationFrame(measure); }, step.before ? 340 : 60);
    const onMove = () => {
      const el = step.sel ? (document.querySelector(step.sel) as HTMLElement | null) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => { cancelled = true; clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const PAD = 8;
  const hole = rect ? { left: rect.left - PAD, top: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 } : null;

  // Tooltip placement: below the hole if there's room, else above; centered when
  // there's no target. Clamped horizontally to the viewport.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const TW = Math.min(300, vw - 24);
  let tip: React.CSSProperties;
  if (hole) {
    const below = hole.top + hole.h + 12;
    const placeBelow = below + 160 < vh;
    const left = Math.max(12, Math.min(hole.left, vw - TW - 12));
    tip = placeBelow
      ? { top: below, left }
      : { top: Math.max(12, hole.top - 12), left, transform: "translateY(-100%)" };
  } else {
    tip = { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9998 }}>
      {hole ? (
        <div style={{ position: "fixed", left: hole.left, top: hole.top, width: hole.w, height: hole.h, borderRadius: 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.58)", pointerEvents: "none", transition: "left .2s, top .2s, width .2s, height .2s" }} />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.58)", pointerEvents: "none" }} />
      )}
      <div style={{ position: "fixed", width: TW, background: "#fff", borderRadius: 16, boxShadow: "0 18px 50px rgba(0,0,0,0.35)", padding: 18, zIndex: 9999, ...tip }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: primary, textTransform: "uppercase", letterSpacing: 1 }}>Step {i + 1} of {steps.length}</span>
          <button onClick={onClose} aria-label="Skip tour" style={{ border: "none", background: "transparent", color: "#a8a29e", fontSize: 12, cursor: "pointer" }}>Skip ✕</button>
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, margin: "6px 0 6px", color: "#1c1917" }}>{step.title}</div>
        <div style={{ fontSize: 13, color: "#57534e", lineHeight: 1.55 }}>{step.body}</div>
        <div style={{ display: "flex", gap: 6, margin: "14px 0 12px" }}>
          {steps.map((_, k) => <span key={k} style={{ height: 5, flex: 1, borderRadius: 999, background: k <= i ? primary : "#e7e2db" }} />)}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {i > 0 && <button onClick={() => setI(i - 1)} style={{ border: "1px solid var(--line,#e3ded7)", background: "#fff", color: "#57534e", borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Back</button>}
          <button onClick={() => last ? onClose() : setI(i + 1)} style={{ border: "none", background: primary, color: "#fff", borderRadius: 999, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{last ? "Got it!" : "Next"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, sub, heading, tokens, primary, children }: { title: string; sub?: string; heading: React.CSSProperties; tokens: TemplateTokens; primary: string; children: React.ReactNode }) {
  const editorial = tokens.id === "editorial";
  return (
    <div>
      <div style={{ marginBottom: 16, paddingBottom: editorial ? 12 : 0, borderBottom: editorial ? tokens.divider : "none" }}>
        {editorial && <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: tokens.eyebrowTracking, color: "#78716c", fontWeight: 700, marginBottom: 5 }}>{sub || "Your wedding"}</div>}
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>
          {tokens.flourish && <span style={{ color: primary, fontSize: 15, marginRight: 9, verticalAlign: "middle" }}>{tokens.flourish}</span>}
          {title}
        </h2>
        {!editorial && sub && <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function FilterChips({ options, value, onChange, chip }: { options: string[]; value: string; onChange: (v: string) => void; chip: (on: boolean) => React.CSSProperties }) {
  if (options.length <= 2) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{ fontSize: 12, padding: "5px 12px", ...chip(o === value) }}>{o}</button>
      ))}
    </div>
  );
}

function Empty({ children, radius }: { children: React.ReactNode; radius?: string }) {
  return <div style={{ padding: 24, textAlign: "center", color: "#8a8a8a", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: radius ?? 12 }}>{children}</div>;
}

function PortalLogo({ logoUrl, venueName, heading, light }: { logoUrl: string | null; venueName: string; heading: React.CSSProperties; light: boolean }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" style={{ height: 34, maxWidth: 150, objectFit: "contain" }} />;
  }
  return <span style={{ ...heading, color: light ? "#fff" : "var(--ink)", fontWeight: 700 }}>{venueName}</span>;
}

function PortalItemCard({ name, description, img, price, badge, paidItem, selected, onToggle, days, onDay, qty, onQty, primary, accent, heading, cardRadius, cardBorder }: {
  name: string; description: string; img: string | null; price?: number; badge?: string; paidItem?: boolean;
  selected?: boolean; onToggle?: () => void;
  days?: DaySel; onDay?: (d: "mg" | "wed" | "fb") => void;
  qty?: number; onQty?: (n: number) => void;
  primary: string; accent: string; heading: React.CSSProperties; cardRadius: string; cardBorder?: string;
}) {
  // Included vs paid treatment (per the dashboard mock): badge rides the image
  // top-left; paid items show their coral price (or "Price on request" when the
  // venue hasn't priced them yet); footers read "✓ Included" (neutral) vs
  // "+ Add to my wedding" (peach tint). `paidItem` marks catalogue/rental extras
  // explicitly so rooms/vendors keep their plain price display.
  const included = badge === "Included";
  const paid = paidItem ?? (!included && price != null && price > 0);
  const overlay = included ? "Included" : paid ? "To pay for" : null;
  return (
    <div className="hover-lift" style={{ background: "#fff", border: selected ? `2px solid ${primary}` : (cardBorder ?? "1px solid rgba(0,0,0,0.08)"), borderRadius: cardRadius, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: 120, background: `${accent}33`, display: "flex", alignItems: "center", justifyContent: "center", color: "#9a8", fontSize: 12 }}>No image</div>
        )}
        {overlay && (
          <span
            style={{
              position: "absolute", top: 8, left: 8, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
              background: included ? "rgba(255,253,251,0.92)" : "rgba(28,25,23,0.78)",
              color: included ? "var(--ink, #1c1917)" : "#fff",
            }}
          >
            {overlay}
          </span>
        )}
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <div style={{ ...heading, fontWeight: 700, fontSize: 16 }}>{name}</div>
        {description && <div style={{ fontSize: 12.5, color: "#57534e", lineHeight: 1.5, flex: 1 }}>{description}</div>}
        {paid && (
          (price ?? 0) > 0
            ? <div style={{ color: primary, fontWeight: 700, fontSize: 15, marginTop: 6 }}>{rZA(price!)}</div>
            : <div style={{ color: "#8a6116", fontWeight: 600, fontSize: 12.5, marginTop: 6 }}>Price on request</div>
        )}
        {onToggle && (
          included ? (
            <button onClick={onToggle} style={{ marginTop: 8, padding: "8px 0", width: "100%", borderRadius: cardRadius, border: "1px solid rgba(0,0,0,0.1)", background: selected ? "#eef0e9" : "#fff", color: selected ? "var(--ink, #1c1917)" : "#57534e", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
              {selected ? "✓ Included" : "+ Include"}
            </button>
          ) : (
            <button onClick={onToggle} style={{ marginTop: 8, padding: "8px 0", width: "100%", borderRadius: cardRadius, border: selected ? "none" : `1px solid ${primary}40`, background: selected ? primary : `${primary}14`, color: selected ? "#fff" : primary, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
              {selected ? "✓ Added" : "+ Add to my wedding"}
            </button>
          )
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
