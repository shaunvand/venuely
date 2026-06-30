"use client";

// Venue dashboard guided tour — the same hand-rolled spotlight used on the couple
// portal (PortalTour): a dimmed overlay with a cut-out over the current sidebar
// tab + a tooltip card explaining what it's for and the key buttons. Rendered via
// createPortal to <body> so position:fixed escapes any transformed ancestor.
//
// Starts on the `venuely:start-tour` event — dispatched once by DashboardWelcomeModal
// after the first-run "Get Started" animation, and by the sidebar "Take a tour"
// button for replays.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const PRIMARY = "#FA523C";

type Step = { sel: string; title: string; body: string };

const STEPS: Step[] = [
  { sel: '[data-tour="nav-overview"]', title: "Your home base", body: "Overview always shows what matters right now — upcoming weddings, payments collected, and your setup checklist. When in doubt, start here." },
  { sel: '[data-tour="nav-couple"]', title: "Couple Experience", body: "Design what couples see when they open their portal — your branding, cover photo and template. Hit “Save design” to publish it." },
  { sel: '[data-tour="nav-weddings"]', title: "Weddings", body: "Add and manage every wedding. “Add wedding” creates one; open it to share the couple’s portal link and approve their selections into an invoice." },
  { sel: '[data-tour="nav-inventory"]', title: "Inventory", body: "Everything couples can choose — catalogue, rentals, spaces, accommodation and seating — lives here. Fill it fast with “+ Add item” or “Smart Import”." },
  { sel: '[data-tour="nav-calendar"]', title: "Calendar", body: "See every booking by date. Click a day to jump straight to that wedding." },
  { sel: '[data-tour="nav-suppliers"]', title: "Suppliers", body: "List your recommended suppliers. Couples message them inside the portal and you earn commission when they book." },
  { sel: '[data-tour="nav-messages"]', title: "Enquiries & Messages", body: "New couple enquiries arrive under Enquiries; your ongoing conversations live in Messages." },
  { sel: '[data-tour="group-Money"]', title: "Money", body: "Record payments and set up your payouts & fees here. Click the section to expand it." },
  { sel: '[data-tour="group-Setup"]', title: "Finish setting up", body: "Your Checklist, venue Settings and Team live here. Work through the Checklist and you’re ready to take bookings." },
];

const SEEN_KEY = "vy-venue-tour-v1";

export function VenueTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  }, []);

  // Start on the custom event (first-run hand-off + manual replay).
  useEffect(() => {
    const start = () => { setI(0); setOpen(true); };
    window.addEventListener("venuely:start-tour", start);
    return () => window.removeEventListener("venuely:start-tour", start);
  }, []);

  // Measure the current target; retry a few frames while the layout settles, and
  // re-measure on scroll/resize. Centered fallback if the target isn't found.
  useEffect(() => {
    if (!open) return;
    let raf = 0, tries = 0, cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(step.sel) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "auto" });
        setRect(el.getBoundingClientRect());
      } else if (tries < 12) {
        tries++; raf = requestAnimationFrame(measure);
      } else {
        setRect(null);
      }
    };
    raf = requestAnimationFrame(measure);
    const onMove = () => {
      const el = document.querySelector(step.sel) as HTMLElement | null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => { cancelled = true; cancelAnimationFrame(raf); window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [open, i, step.sel]);

  // Esc skips.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  const PAD = 8;
  const hole = rect ? { left: rect.left - PAD, top: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 } : null;

  // Tooltip: prefer the RIGHT of the highlight (the sidebar is on the left), then
  // below; always clamped fully inside the viewport so the buttons never crop.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const TW = Math.min(320, vw - 24);
  const TH = 250;
  let tip: React.CSSProperties;
  if (hole) {
    const vTop = Math.max(12, Math.min(hole.top, vh - TH - 12));
    const rightLeft = hole.left + hole.w + 14;
    const leftLeft = hole.left - TW - 14;
    if (rightLeft + TW <= vw - 12) tip = { top: vTop, left: rightLeft };
    else if (leftLeft >= 12) tip = { top: vTop, left: leftLeft };
    else {
      const left = Math.max(12, Math.min(hole.left, vw - TW - 12));
      const below = hole.top + hole.h + 12;
      tip = below + TH <= vh - 12 ? { top: below, left } : { top: Math.max(12, vh - TH - 12), left };
    }
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
      <div role="dialog" aria-modal="true" aria-label={`Tour: ${step.title}`} style={{ position: "fixed", width: TW, background: "#fff", borderRadius: 16, boxShadow: "0 18px 50px rgba(0,0,0,0.35)", padding: 18, zIndex: 9999, ...tip }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: PRIMARY, textTransform: "uppercase", letterSpacing: 1 }}>Step {i + 1} of {STEPS.length}</span>
          <button onClick={close} aria-label="Skip tour" style={{ border: "none", background: "transparent", color: "#a8a29e", fontSize: 12, cursor: "pointer" }}>Skip ✕</button>
        </div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, margin: "6px 0 6px", color: "#1c1917" }}>{step.title}</div>
        <div style={{ fontSize: 13, color: "#57534e", lineHeight: 1.55 }}>{step.body}</div>
        <div style={{ display: "flex", gap: 6, margin: "14px 0 12px" }}>
          {STEPS.map((_, k) => <span key={k} style={{ height: 5, flex: 1, borderRadius: 999, background: k <= i ? PRIMARY : "#e7e2db" }} />)}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {i > 0 && <button onClick={() => setI(i - 1)} style={{ border: "1px solid var(--line,#e3ded7)", background: "#fff", color: "#57534e", borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Back</button>}
          <button onClick={() => last ? close() : setI(i + 1)} style={{ border: "none", background: PRIMARY, color: "#fff", borderRadius: 999, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{last ? "Got it!" : "Next"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
