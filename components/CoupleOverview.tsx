"use client";

import { useEffect, useState } from "react";
import type { TemplateTokens } from "@/lib/portal/templates";

// Couple dashboard Overview — renders against the venue's chosen portal template
// + theme (WYSIWYG with the venue-side designer). Aggregates the couple's live
// data into stat rings + summaries + a right rail, all read from the venue (the
// source of truth) and the couple's own selections. The big hero/cover banner
// lives in CouplePortal (template-specific treatment), not here.

const INK = "var(--ink, #1c1917)";
const INK2 = "var(--ink-2, #57534e)";
const rZA = (n: number) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;
const fmtDate = (s: string | null) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "—");
const fmtShort = (s: string | null) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—");
const daysUntil = (s: string | null) => { if (!s) return null; const d = Math.ceil((new Date(`${String(s).slice(0, 10)}T00:00:00`).getTime() - Date.now()) / 86400000); return d; };

function Donut({ pct, color, label, track }: { pct: number; color: string; label: string; track: string }) {
  const r = 26, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={r} fill="none" stroke={track} strokeWidth="7" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 34 34)" />
      <text x="34" y="38" textAnchor="middle" fontSize="14" fontWeight="700" fill={INK}>{label}</text>
    </svg>
  );
}

type Venue = { name: string; region: string | null; address: string | null; email: string | null; phone: string | null; mapsUrl: string | null };
type RoomItem = { id: string; name: string };
type RentItem = { id: string };
type WState = { rentalSelections?: Record<string, { sel?: boolean }>; roomAssignments?: Record<string, string[]>; sharedNote?: string };

export function CoupleOverview({ slug, venue, coupleNames, daysToGo, totalDue, rooms, rentals, state, onNavigate, tokens, primary, accent }: {
  slug: string; venue: Venue; coupleNames: string; daysToGo: number | null; totalDue: number;
  rooms: RoomItem[]; rentals: RentItem[]; state: WState; onNavigate: (tab: string) => void;
  tokens: TemplateTokens; primary: string; accent: string;
}) {
  const [guests, setGuests] = useState<Array<{ rsvp_status: string | null }>>([]);
  const [pay, setPay] = useState<{ invoiced: number; paid: number; balance: number; depositDue: string | null; balanceDue: string | null; payments: Array<{ id: string; amount: number; direction: string; kind: string | null; paid_at: string | null }> } | null>(null);
  const [timeline, setTimeline] = useState<Array<{ id: string; start_time: string | null; title: string; location: string | null }>>([]);
  const [checklist, setChecklist] = useState<Array<{ id: string; title: string; due_date: string | null; done: boolean | null }>>([]);
  const [docs, setDocs] = useState<Array<{ id: string; label: string | null; mime_type: string | null; url: string | null }>>([]);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" ? window.matchMedia("(max-width: 979px)").matches : false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 980);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch(`/api/wedding/${slug}/guests`).then((r) => r.json()).then((j) => setGuests(j.guests ?? [])).catch(() => {});
    fetch(`/api/wedding/${slug}/payments`).then((r) => r.json()).then((j) => setPay(j.toVenue ?? null)).catch(() => {});
    fetch(`/api/wedding/${slug}/list/timeline`).then((r) => r.json()).then((j) => setTimeline(j.rows ?? [])).catch(() => {});
    fetch(`/api/wedding/${slug}/list/checklist`).then((r) => r.json()).then((j) => setChecklist(j.rows ?? [])).catch(() => {});
    fetch(`/api/wedding/${slug}/files/documents`).then((r) => r.json()).then((j) => setDocs(j.rows ?? [])).catch(() => {});
  }, [slug]);

  // ── Template design system (mirrors CouplePortal) ──────────────────────────
  const heading: React.CSSProperties = { fontFamily: tokens.headingFont, fontStyle: tokens.headingItalic ? "italic" : "normal", fontWeight: tokens.headingWeight, letterSpacing: tokens.headingLetterSpacing };
  const cardBg = tokens.cardTint ? `linear-gradient(0deg, ${accent}${tokens.cardTint}, ${accent}${tokens.cardTint}), #FFFFFF` : tokens.surfaceCard;
  const card: React.CSSProperties = { background: cardBg, border: tokens.cardBorder, borderRadius: tokens.cardRadius, boxShadow: tokens.cardShadow };
  const eyebrow: React.CSSProperties = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: tokens.eyebrowTracking, color: INK2, fontWeight: 700 };
  const rowRule = tokens.id === "editorial" ? "1px solid rgba(0,0,0,0.16)" : tokens.divider; // full-ink hairlines are too heavy inside list rows
  const donutTrack = tokens.id === "editorial" ? "#eceae6" : "var(--line, #ece7e1)";
  const editorial = tokens.id === "editorial";
  const btnPrimary: React.CSSProperties = tokens.buttonStyle === "solid"
    ? { background: primary, color: "#fff", border: "none", borderRadius: tokens.buttonRadius }
    : { background: "transparent", color: primary, border: `1.5px solid ${primary}`, borderRadius: tokens.buttonRadius, textTransform: tokens.buttonCase ?? "none", letterSpacing: tokens.buttonCase ? "0.08em" : undefined };
  const badge = (on: boolean, onColor: string, onBg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, color: on ? onColor : INK2, background: on ? onBg : `${accent}26`, borderRadius: tokens.chipRadius, padding: "3px 10px" });

  // Derived figures.
  const invited = guests.length;
  const confirmed = guests.filter((g) => g.rsvp_status === "attending").length;
  const roomsBooked = Object.values(state.roomAssignments ?? {}).filter((a) => Array.isArray(a) && a.length).length;
  const roomsTotal = rooms.length;
  const rentReserved = Object.values(state.rentalSelections ?? {}).filter((v) => v?.sel).length;
  const rentTotal = rentals.length;
  const invoiced = pay?.invoiced || totalDue || 0;
  const paid = pay?.paid || 0;
  const openChecklist = checklist.filter((c) => !c.done);
  const tasksDone = checklist.length - openChecklist.length;
  const nextUp = [...openChecklist].sort((a, b) => (a.due_date && b.due_date ? String(a.due_date).localeCompare(String(b.due_date)) : 0)).slice(0, 3);
  // "Deposit due" only while the deposit itself is unpaid (no deposit recorded in
  // the ledger — the deposit amount isn't exposed, so a kind:"deposit" payment is
  // the signal); after that, the balance date while anything is still outstanding.
  const balanceOutstanding = (pay?.invoiced || 0) > 0 && (pay?.paid || 0) < (pay?.invoiced || 0);
  const depositPaid = (pay?.payments ?? []).some((p) => p.direction === "in" && p.kind === "deposit");
  const nextPaymentDue = !balanceOutstanding ? null : (pay?.depositDue && !depositPaid ? pay.depositDue : pay?.balanceDue || null);

  const docIcon = (m: string | null) => (m?.includes("pdf") ? "PDF" : m?.startsWith("image") ? "IMG" : "DOC");

  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0,1fr)" : "minmax(0,1fr) 320px", gap: 20, alignItems: "start" }}>
      {/* ── MAIN COLUMN ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 18 }}>
        {/* Welcome */}
        <div>
          <h2 style={{ ...heading, fontSize: 26, margin: 0, color: INK }}>
            {tokens.flourish && <span style={{ color: primary, fontSize: 15, marginRight: 9, verticalAlign: "middle" }}>{tokens.flourish}</span>}
            Welcome back{coupleNames ? `, ${coupleNames.split("&")[0].trim()}` : ""}
          </h2>
          <p style={{ color: INK2, marginTop: 4 }}>Here&apos;s everything you need for your big day.</p>
        </div>

        {/* AI planner banner */}
        <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: editorial ? "#1c1917" : `linear-gradient(135deg, ${primary}, ${accent})`, border: "none", borderRadius: tokens.cardRadius, color: "#fff" }}>
          <div><div style={{ ...heading, fontSize: 18 }}>✨ Plan with AI</div><div style={{ fontSize: 12.5, opacity: 0.95 }}>Tell me your vibe and I&apos;ll set up your selections.</div></div>
          <button onClick={() => window.dispatchEvent(new Event("venuely:open-planner"))} style={{ background: "#fff", color: editorial ? "#1c1917" : primary, border: "none", borderRadius: tokens.buttonRadius, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13.5, textTransform: tokens.buttonCase ?? "none", letterSpacing: tokens.buttonCase ? "0.08em" : undefined }}>Start planning</button>
        </div>

        {/* 4 stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          {[
            { eb: "Guests", big: String(confirmed), sub: `Confirmed of ${invited} invited`, pct: invited ? confirmed / invited : 0, color: primary, link: "Guests", linkLabel: "View guest list" },
            { eb: "Accommodation", big: `${roomsBooked} / ${roomsTotal}`, sub: "Rooms booked", pct: roomsTotal ? roomsBooked / roomsTotal : 0, color: accent, link: "Accommodation", linkLabel: "View all rooms" },
            { eb: "Payments", big: rZA(paid), sub: `Paid of ${rZA(invoiced)}`, pct: invoiced ? paid / invoiced : 0, color: primary, link: "Payments", linkLabel: "View payments" },
            { eb: "Checklist", big: `${tasksDone}/${checklist.length}`, sub: "Tasks complete", pct: checklist.length ? tasksDone / checklist.length : 0, color: accent, link: "Checklist", linkLabel: "View checklist" },
          ].map((s) => (
            <div key={s.eb} style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={eyebrow}>{s.eb}</div>
                  <div style={{ ...heading, fontSize: 30, color: INK, marginTop: 6 }}>{s.big}</div>
                  <div style={{ fontSize: 12, color: INK2 }}>{s.sub}</div>
                </div>
                <Donut pct={s.pct} color={s.color} label={`${Math.round(s.pct * 100)}%`} track={donutTrack} />
              </div>
              <button onClick={() => onNavigate(s.link)} style={{ marginTop: 10, background: "none", border: "none", color: primary, fontWeight: 600, fontSize: 12.5, cursor: "pointer", padding: 0 }}>{s.linkLabel} →</button>
            </div>
          ))}
        </div>

        {/* Next Up + Wedding Timeline */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>📋 Next up</span><button onClick={() => onNavigate("Checklist")} style={{ background: "none", border: "none", color: primary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View all →</button></div>
            {nextUp.length === 0 ? <div style={{ color: INK2, fontSize: 13 }}>No tasks yet — add some in your Checklist.</div> : nextUp.map((t) => {
              const d = daysUntil(t.due_date);
              return (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: rowRule }}>
                  <div><div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{t.title}</div><div style={{ fontSize: 11.5, color: INK2 }}>{fmtShort(t.due_date)}</div></div>
                  {d != null && <span style={{ ...badge(d <= 7, primary, `${primary}1a`), whiteSpace: "nowrap" }}>{d < 0 ? "overdue" : d === 0 ? "today" : `in ${d} days`}</span>}
                </div>
              );
            })}
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>🕐 Wedding timeline</span><button onClick={() => onNavigate("Timeline")} style={{ background: "none", border: "none", color: primary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>See full →</button></div>
            {timeline.length === 0 ? <div style={{ color: INK2, fontSize: 13 }}>Build your run sheet in the Timeline tab.</div> : timeline.slice(0, 6).map((t) => (
              <div key={t.id} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: rowRule }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: primary, minWidth: 46 }}>{t.start_time || "—"}</span>
                <div><div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{t.title}</div>{t.location && <div style={{ fontSize: 11.5, color: INK2 }}>{t.location}</div>}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Accommodation overview + Rentals + Documents */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>🛏 Accommodation</span><button onClick={() => onNavigate("Accommodation")} style={{ background: "none", border: "none", color: primary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View all →</button></div>
            {rooms.length === 0 ? <div style={{ color: INK2, fontSize: 13 }}>No rooms listed.</div> : rooms.slice(0, 6).map((r) => {
              const booked = Array.isArray(state.roomAssignments?.[r.id]) && state.roomAssignments![r.id].length > 0;
              return (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: rowRule }}>
                  <span style={{ fontSize: 13, color: INK }}>{r.name}</span>
                  <span style={badge(booked, "#1a7f4b", "#e7f4ec")}>{booked ? "Booked" : "Available"}</span>
                </div>
              );
            })}
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>🪑 Rentals</span><button onClick={() => onNavigate("Catalogue & Rentals")} style={{ background: "none", border: "none", color: primary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Manage →</button></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Donut pct={rentTotal ? rentReserved / rentTotal : 0} color={primary} label={String(rentReserved)} track={donutTrack} />
              <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><span style={{ color: INK2 }}>Reserved</span><b>{rentReserved}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><span style={{ color: INK2 }}>Available</span><b>{Math.max(0, rentTotal - rentReserved)}</b></div>
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>📄 Documents</span><button onClick={() => onNavigate("Documents")} style={{ background: "none", border: "none", color: primary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View all →</button></div>
            {docs.length === 0 ? <div style={{ color: INK2, fontSize: 13 }}>No documents yet.</div> : docs.slice(0, 5).map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: rowRule }}>
                <span style={{ fontSize: 13, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label || "Document"}</span>
                {d.url ? <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: INK2, fontWeight: 700 }}>{docIcon(d.mime_type)} ↗</a> : <span style={{ fontSize: 10.5, color: INK2 }}>{docIcon(d.mime_type)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT RAIL ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 16, position: narrow ? "static" : "sticky", top: 16 }}>
        {/* Countdown hero — editorial gets an ink plate, others the brand colour */}
        <div style={{ borderRadius: tokens.cardRadius, padding: 22, background: editorial ? "#1c1917" : primary, color: "#fff", textAlign: "center", boxShadow: tokens.cardShadow }}>
          <div style={{ ...heading, fontStyle: editorial ? "normal" : "italic", fontSize: 14, opacity: 0.95, textTransform: editorial ? "uppercase" : "none", letterSpacing: editorial ? tokens.eyebrowTracking : undefined }}>Your wedding day</div>
          <div style={{ ...heading, fontSize: 64, lineHeight: 1, margin: "6px 0" }}>{daysToGo ?? "—"}</div>
          <div style={{ fontSize: 12, letterSpacing: tokens.eyebrowTracking, textTransform: "uppercase", opacity: 0.9 }}>days to go</div>
          {tokens.flourish && <div style={{ fontSize: 13, marginTop: 10, opacity: 0.9 }}>{tokens.flourish}</div>}
          <div style={{ ...heading, fontStyle: editorial ? "normal" : "italic", fontSize: 15, marginTop: tokens.flourish ? 6 : 16, opacity: 0.95 }}>We can&apos;t wait to celebrate with you!</div>
        </div>

        {/* Next task / payment */}
        <div style={{ ...card, padding: 16 }}>
          <div style={eyebrow}>Next task</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginTop: 8 }}>{nextPaymentDue ? "Payment due" : nextUp[0]?.title || "You're all caught up 🎉"}</div>
          <div style={{ fontSize: 12.5, color: INK2 }}>{nextPaymentDue ? fmtDate(nextPaymentDue) : nextUp[0]?.due_date ? fmtDate(nextUp[0].due_date) : "Nothing due right now"}</div>
          <button onClick={() => onNavigate(nextPaymentDue ? "Payments" : "Checklist")} style={{ ...btnPrimary, marginTop: 12, width: "100%", padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: 13.5 }}>{nextPaymentDue ? "View payment details" : "View tasks"}</button>
        </div>

        {/* Venue contact */}
        <div style={{ ...card, padding: 16 }}>
          <div style={eyebrow}>Venue contact</div>
          <div style={{ ...heading, fontSize: 16, color: INK, marginTop: 6 }}>{venue.name}</div>
          {venue.region && <div style={{ fontSize: 12, color: INK2 }}>{venue.region}</div>}
          <div style={{ display: "grid", gap: 6, marginTop: 10, fontSize: 12.5, color: INK }}>
            {venue.phone && <a href={`tel:${venue.phone}`} style={{ color: INK, textDecoration: "none" }}>📞 {venue.phone}</a>}
            {venue.email && <a href={`mailto:${venue.email}`} style={{ color: INK, textDecoration: "none", wordBreak: "break-all" }}>✉ {venue.email}</a>}
          </div>
          {venue.email && <a href={`mailto:${venue.email}`} style={{ display: "block", textAlign: "center", marginTop: 12, border: `1px solid ${primary}`, color: primary, borderRadius: tokens.buttonRadius, padding: "8px", fontWeight: 600, fontSize: 13, textDecoration: "none", textTransform: tokens.buttonCase ?? "none", letterSpacing: tokens.buttonCase ? "0.08em" : undefined }}>Message {venue.name}</a>}
        </div>

        {/* Payment summary */}
        {pay && (invoiced > 0) && (
          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={eyebrow}>Payments</span><button onClick={() => onNavigate("Payments")} style={{ background: "none", border: "none", color: primary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View →</button></div>
            <div style={{ fontSize: 13, display: "grid", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: INK2 }}>Paid</span><b style={{ color: "#1a7f4b" }}>{rZA(paid)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: INK2 }}>Balance</span><b style={{ color: primary }}>{rZA(Math.max(0, invoiced - paid))}</b></div>
              {pay.balanceDue && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: INK2 }}>Due by</span><span>{fmtShort(pay.balanceDue)}</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
