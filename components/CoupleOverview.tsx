"use client";

import { useEffect, useState } from "react";

// Couple dashboard Overview — mirrors the venue dashboard's look & feel (Venuely
// palette: poppy/sage/cream, Fraunces serif, soft cards). Aggregates the couple's
// live data into stat rings + summaries + a right rail, all read from the venue
// (the source of truth) and the couple's own selections.

const POPPY = "var(--poppy, #FA523C)";
const SAGE = "var(--sage, #8a9a86)";
const INK = "var(--ink, #1c1917)";
const INK2 = "var(--ink-2, #57534e)";
const LINE = "var(--line, #ece7e1)";
const serif: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif" };
const rZA = (n: number) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;
const fmtDate = (s: string | null) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "—");
const fmtShort = (s: string | null) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—");
const daysUntil = (s: string | null) => { if (!s) return null; const d = Math.ceil((new Date(`${String(s).slice(0, 10)}T00:00:00`).getTime() - Date.now()) / 86400000); return d; };

function Donut({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 26, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={r} fill="none" stroke={LINE} strokeWidth="7" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 34 34)" />
      <text x="34" y="38" textAnchor="middle" fontSize="14" fontWeight="700" fill={INK}>{label}</text>
    </svg>
  );
}

const card: React.CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16 };
const eyebrow: React.CSSProperties = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1.5, color: INK2, fontWeight: 700 };

type Venue = { name: string; region: string | null; address: string | null; email: string | null; phone: string | null; mapsUrl: string | null };
type RoomItem = { id: string; name: string };
type RentItem = { id: string };
type WState = { rentalSelections?: Record<string, { sel?: boolean }>; roomAssignments?: Record<string, string[]>; sharedNote?: string };

export function CoupleOverview({ slug, venue, coupleNames, daysToGo, dateLabel, totalDue, rooms, rentals, state, cover, onNavigate, weddingDate = null, weddingEndDate = null, selectedAreas = [] }: {
  slug: string; venue: Venue; coupleNames: string; daysToGo: number | null; dateLabel: string; totalDue: number;
  rooms: RoomItem[]; rentals: RentItem[]; state: WState; cover: string | null; onNavigate: (tab: string) => void;
  weddingDate?: string | null; weddingEndDate?: string | null; selectedAreas?: Array<{ name: string; kind: string }>;
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

  // ── Wedding progress (6 signals, mirrors the venue-side engine) ──
  const cateringDone = rentReserved > 0;
  const checklistFrac = checklist.length ? tasksDone / checklist.length : 0;
  const progressPct = Math.round(
    ([weddingDate ? 1 : 0, roomsBooked > 0 ? 1 : 0, cateringDone ? 1 : 0, invited > 0 ? 1 : 0, checklistFrac, paid > 0 ? 1 : 0]
      .reduce((s, x) => s + x, 0) / 6) * 100,
  );
  const balance = Math.max(0, invoiced - paid);
  type ChipState = "done" | "progress" | "due";
  const chips: Array<{ icon: string; label: string; sub: string; state: ChipState }> = [
    { icon: "🏡", label: "Venue & Date", sub: weddingDate ? "Confirmed" : "To confirm", state: weddingDate ? "done" : "progress" },
    { icon: "🛏", label: "Accommodation", sub: roomsBooked > 0 ? "Selected" : "To do", state: roomsBooked > 0 ? "done" : "progress" },
    { icon: "🍴", label: "Catering", sub: cateringDone ? "Selected" : "To do", state: cateringDone ? "done" : "progress" },
    { icon: "👥", label: "Guest List", sub: invited === 0 ? "To do" : confirmed >= invited ? "Complete" : "In progress", state: invited > 0 && confirmed >= invited ? "done" : "progress" },
    { icon: "📅", label: "Timeline", sub: timeline.length >= 5 ? "Planned" : timeline.length > 0 ? "In progress" : "To do", state: timeline.length >= 5 ? "done" : "progress" },
    { icon: "💰", label: "Payments", sub: balance > 0 ? "1 due" : paid > 0 ? "Up to date" : "None due", state: balance > 0 ? "due" : paid > 0 ? "done" : "progress" },
  ];
  const chipBadge: Record<ChipState, { glyph: string; bg: string; fg: string }> = {
    done: { glyph: "✓", bg: "#dcefe2", fg: "#1a7f4b" },
    progress: { glyph: "○", bg: "#fdf0d4", fg: "#c07c10" },
    due: { glyph: "!", bg: "#fde2dd", fg: "#c2371f" },
  };

  // ── Derived "Next Up" tasks (replaces the single next-task card) ──
  const tasks: Array<{ icon: string; title: string; detail: string; tab: string }> = [];
  if (balance > 0) tasks.push({ icon: "💰", title: "Review and pay invoice", detail: `${rZA(balance)}${nextPaymentDue ? ` due ${fmtShort(nextPaymentDue)}` : " outstanding"}`, tab: "Payments" });
  if (roomsTotal > 0 && roomsBooked < roomsTotal) tasks.push({ icon: "🛏", title: "Assign accommodation", detail: `${roomsTotal - roomsBooked} room${roomsTotal - roomsBooked === 1 ? "" : "s"} left to assign`, tab: "Accommodation" });
  if (invited === 0) tasks.push({ icon: "👥", title: "Start your guest list", detail: "Add guests to unlock RSVPs & rooming", tab: "Guests" });
  else if (confirmed < invited) tasks.push({ icon: "👥", title: "Complete your guest list", detail: `${invited} invited · ${confirmed} confirmed`, tab: "Guests" });
  if (timeline.length === 0) tasks.push({ icon: "🕐", title: "Build your wedding timeline", detail: "Plan your day hour by hour", tab: "Timeline" });
  if (openChecklist.length > 0) tasks.push({ icon: "✓", title: "Tick off your checklist", detail: `${openChecklist.length} task${openChecklist.length === 1 ? "" : "s"} remaining`, tab: "Checklist" });
  const topTasks = tasks.slice(0, 3);

  // ── Wedding summary rows ──
  const findArea = (re: RegExp) => selectedAreas.find((a) => re.test(`${a.kind} ${a.name}`));
  const ceremonyArea = findArea(/ceremon|chapel|forest|garden/i) ?? selectedAreas[0] ?? null;
  const receptionArea = (findArea(/recept|hall|deck|barn/i) ?? selectedAreas.find((a) => a !== ceremonyArea)) ?? null;
  const weekendLabel = weddingDate
    ? weddingEndDate && weddingEndDate !== weddingDate
      ? `${fmtShort(weddingDate)} – ${fmtShort(weddingEndDate)}`
      : fmtShort(weddingDate)
    : dateLabel;

  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0,1fr)" : "minmax(0,1fr) 320px", gap: 20, alignItems: "start" }}>
      {/* ── MAIN COLUMN ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 18 }}>
        {/* Cover banner — the venue represents itself here */}
        <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", minHeight: 220, display: "flex", alignItems: "flex-end", background: cover ? `center/cover no-repeat url('${cover}')` : `linear-gradient(135deg, ${POPPY}, ${SAGE})` }}>
          {cover && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 30%, rgba(0,0,0,0.6))" }} />}
          <div style={{ position: "relative", padding: "26px 28px", color: "#fff" }}>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: 0.9 }}>Wedding portal</div>
            <h1 style={{ ...serif, fontStyle: "italic", fontSize: 40, margin: "6px 0 4px", color: "#fff", lineHeight: 1.05 }}>{coupleNames}</h1>
            <div style={{ fontSize: 14, opacity: 0.95 }}>{venue.name} · {dateLabel}{daysToGo != null ? ` · ${daysToGo} days to go` : ""}</div>
          </div>
        </div>

        {/* Welcome */}
        <div>
          <h2 style={{ ...serif, fontSize: 26, margin: 0, color: INK }}>Welcome back{coupleNames ? `, ${coupleNames.split("&")[0].trim()}` : ""}</h2>
          <p style={{ color: INK2, marginTop: 4 }}>Here&apos;s everything you need for your big day.</p>
        </div>

        {/* AI planner banner */}
        <div style={{ ...card, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: `linear-gradient(135deg, ${POPPY}, ${SAGE})`, border: "none", color: "#fff" }}>
          <div><div style={{ ...serif, fontSize: 18 }}>✨ Plan with AI</div><div style={{ fontSize: 12.5, opacity: 0.95 }}>Tell me your vibe and I&apos;ll set up your selections.</div></div>
          <button onClick={() => window.dispatchEvent(new Event("venuely:open-planner"))} style={{ background: "#fff", color: POPPY, border: "none", borderRadius: 999, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13.5 }}>Start planning</button>
        </div>

        {/* Wedding progress — overall % + the six category chips */}
        <div style={{ ...card, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ ...serif, fontSize: 19, color: INK }}>Wedding Progress</div>
              <div style={{ fontSize: 12.5, color: INK2, marginTop: 2 }}>
                {progressPct >= 75 ? "You're doing great! Keep ticking off those tasks." : progressPct >= 35 ? "Good start — keep ticking off those tasks." : "Let's get planning — start with the items below."}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ ...serif, fontSize: 28, color: INK }}>{progressPct}%</span>
              <span style={{ fontSize: 12, color: INK2, marginLeft: 6 }}>Complete</span>
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "#efe7e0", marginTop: 12, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, borderRadius: 999, background: POPPY, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: narrow ? "repeat(3, 1fr)" : "repeat(6, 1fr)", gap: 10, marginTop: 18 }}>
            {chips.map((c) => {
              const b = chipBadge[c.state];
              return (
                <div key={c.label} style={{ textAlign: "center" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 999, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, background: c.state === "done" ? "#e8f1ea" : "#fbf1e7" }}>{c.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginTop: 7 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: INK2 }}>{c.sub}</div>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: 999, fontSize: 10, fontWeight: 800, marginTop: 5, background: b.bg, color: b.fg }}>{b.glyph}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          {[
            { eb: "Guests", big: String(confirmed), sub: `Confirmed of ${invited} invited`, pct: invited ? confirmed / invited : 0, color: POPPY, link: "Guests", linkLabel: "View guest list" },
            { eb: "Accommodation", big: `${roomsBooked} / ${roomsTotal}`, sub: "Rooms booked", pct: roomsTotal ? roomsBooked / roomsTotal : 0, color: SAGE, link: "Accommodation", linkLabel: "View all rooms" },
            { eb: "Payments", big: rZA(paid), sub: `Paid of ${rZA(invoiced)}`, pct: invoiced ? paid / invoiced : 0, color: POPPY, link: "Payments", linkLabel: "View payments" },
            { eb: "Checklist", big: `${tasksDone}/${checklist.length}`, sub: "Tasks complete", pct: checklist.length ? tasksDone / checklist.length : 0, color: SAGE, link: "Checklist", linkLabel: "View checklist" },
          ].map((s) => (
            <div key={s.eb} style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={eyebrow}>{s.eb}</div>
                  <div style={{ ...serif, fontSize: 30, color: INK, marginTop: 6 }}>{s.big}</div>
                  <div style={{ fontSize: 12, color: INK2 }}>{s.sub}</div>
                </div>
                <Donut pct={s.pct} color={s.color} label={`${Math.round(s.pct * 100)}%`} />
              </div>
              <button onClick={() => onNavigate(s.link)} style={{ marginTop: 10, background: "none", border: "none", color: POPPY, fontWeight: 600, fontSize: 12.5, cursor: "pointer", padding: 0 }}>{s.linkLabel} →</button>
            </div>
          ))}
        </div>

        {/* Next Up + Wedding Timeline */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>📋 Next up</span><button onClick={() => onNavigate("Checklist")} style={{ background: "none", border: "none", color: POPPY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View all →</button></div>
            {nextUp.length === 0 ? <div style={{ color: INK2, fontSize: 13 }}>No tasks yet — add some in your Checklist.</div> : nextUp.map((t) => {
              const d = daysUntil(t.due_date);
              return (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${LINE}` }}>
                  <div><div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{t.title}</div><div style={{ fontSize: 11.5, color: INK2 }}>{fmtShort(t.due_date)}</div></div>
                  {d != null && <span style={{ fontSize: 11, fontWeight: 700, color: d <= 7 ? POPPY : INK2, background: d <= 7 ? "var(--bone,#FFF6F0)" : "transparent", borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>{d < 0 ? "overdue" : d === 0 ? "today" : `in ${d} days`}</span>}
                </div>
              );
            })}
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>🕐 Wedding timeline</span><button onClick={() => onNavigate("Timeline")} style={{ background: "none", border: "none", color: POPPY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>See full →</button></div>
            {timeline.length === 0 ? <div style={{ color: INK2, fontSize: 13 }}>Build your run sheet in the Timeline tab.</div> : timeline.slice(0, 6).map((t) => (
              <div key={t.id} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: `1px solid ${LINE}` }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: POPPY, minWidth: 46 }}>{t.start_time || "—"}</span>
                <div><div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{t.title}</div>{t.location && <div style={{ fontSize: 11.5, color: INK2 }}>{t.location}</div>}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Accommodation overview + Rentals + Documents */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>🛏 Accommodation</span><button onClick={() => onNavigate("Accommodation")} style={{ background: "none", border: "none", color: POPPY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View all →</button></div>
            {rooms.length === 0 ? <div style={{ color: INK2, fontSize: 13 }}>No rooms listed.</div> : rooms.slice(0, 6).map((r) => {
              const booked = Array.isArray(state.roomAssignments?.[r.id]) && state.roomAssignments![r.id].length > 0;
              return (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${LINE}` }}>
                  <span style={{ fontSize: 13, color: INK }}>{r.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: booked ? "#1a7f4b" : INK2, background: booked ? "#e7f4ec" : "var(--bone,#FFF6F0)", borderRadius: 999, padding: "3px 10px" }}>{booked ? "Booked" : "Available"}</span>
                </div>
              );
            })}
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>🪑 Rentals</span><button onClick={() => onNavigate("Catalogue & Rentals")} style={{ background: "none", border: "none", color: POPPY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Manage →</button></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Donut pct={rentTotal ? rentReserved / rentTotal : 0} color={POPPY} label={String(rentReserved)} />
              <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><span style={{ color: INK2 }}>Reserved</span><b>{rentReserved}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}><span style={{ color: INK2 }}>Available</span><b>{Math.max(0, rentTotal - rentReserved)}</b></div>
              </div>
            </div>
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={eyebrow}>📄 Documents</span><button onClick={() => onNavigate("Documents")} style={{ background: "none", border: "none", color: POPPY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View all →</button></div>
            {docs.length === 0 ? <div style={{ color: INK2, fontSize: 13 }}>No documents yet.</div> : docs.slice(0, 5).map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${LINE}` }}>
                <span style={{ fontSize: 13, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label || "Document"}</span>
                {d.url ? <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: INK2, fontWeight: 700 }}>{docIcon(d.mime_type)} ↗</a> : <span style={{ fontSize: 10.5, color: INK2 }}>{docIcon(d.mime_type)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT RAIL ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 16, position: narrow ? "static" : "sticky", top: 16 }}>
        {/* Countdown hero */}
        <div style={{ borderRadius: 18, padding: 22, background: SAGE, color: "#fff", textAlign: "center" }}>
          <div style={{ ...serif, fontStyle: "italic", fontSize: 14, opacity: 0.95 }}>Your wedding day</div>
          <div style={{ ...serif, fontSize: 64, lineHeight: 1, margin: "6px 0" }}>{daysToGo ?? "—"}</div>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>days to go</div>
          <div style={{ ...serif, fontStyle: "italic", fontSize: 15, marginTop: 16, opacity: 0.95 }}>We can&apos;t wait to celebrate with you!</div>
        </div>

        {/* Next Up — derived upcoming tasks */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ ...serif, fontSize: 18, color: INK }}>Next Up</div>
              <div style={{ fontSize: 11.5, color: INK2 }}>Your upcoming tasks</div>
            </div>
            <button onClick={() => onNavigate("Checklist")} style={{ background: "none", border: "none", color: POPPY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View all</button>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {topTasks.length ? topTasks.map((t) => (
              <button key={t.title} onClick={() => onNavigate(t.tab)} style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "11px 12px", cursor: "pointer" }}>
                <span style={{ width: 36, height: 36, borderRadius: 999, background: "#fbf1e7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: INK }}>{t.title}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: INK2 }}>{t.detail}</span>
                </span>
                <span style={{ color: INK2 }}>›</span>
              </button>
            )) : (
              <div style={{ fontSize: 12.5, color: INK2, padding: "6px 2px" }}>You&apos;re all caught up 🎉</div>
            )}
          </div>
        </div>

        {/* Wedding summary — at a glance */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ ...serif, fontSize: 18, color: INK }}>Wedding Summary</div>
          <div style={{ fontSize: 11.5, color: INK2 }}>At a glance</div>
          <div style={{ display: "grid", gap: 9, marginTop: 12, fontSize: 13 }}>
            {[
              { icon: "👥", label: "Guests Invited", value: invited ? String(invited) : "—" },
              { icon: "🛏", label: "Accommodation", value: roomsTotal ? `${roomsBooked} / ${roomsTotal} booked` : "—" },
              { icon: "🏡", label: "Ceremony", value: ceremonyArea?.name ?? "Not chosen yet" },
              { icon: "🥂", label: "Reception", value: receptionArea?.name ?? "Not chosen yet" },
              { icon: "📅", label: "Weekend", value: weekendLabel },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ color: INK2 }}>{r.icon} {r.label}</span>
                <b style={{ color: INK, textAlign: "right" }}>{r.value}</b>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate("Our Venue")} style={{ marginTop: 13, width: "100%", background: "#fff", border: `1px solid ${LINE}`, color: INK, borderRadius: 999, padding: "9px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>View Full Details</button>
        </div>

        {/* Need help? — message the venue team */}
        <div style={{ ...card, padding: 16, background: "#fbf1e7", border: "none" }}>
          <div style={{ ...serif, fontSize: 18, color: INK }}>Need help?</div>
          <div style={{ fontSize: 12.5, color: INK2, marginTop: 3 }}>We&apos;re here for you every step of the way.</div>
          <div style={{ display: "grid", gap: 6, marginTop: 10, fontSize: 12.5 }}>
            {venue.phone && <a href={`tel:${venue.phone}`} style={{ color: INK, textDecoration: "none" }}>📞 {venue.phone}</a>}
            {venue.email && <a href={`mailto:${venue.email}`} style={{ color: INK, textDecoration: "none", wordBreak: "break-all" }}>✉ {venue.email}</a>}
          </div>
          {(venue.email || venue.phone) && (
            <a
              href={venue.email ? `mailto:${venue.email}?subject=${encodeURIComponent(`Question from ${coupleNames || "your couple"}`)}` : `tel:${venue.phone}`}
              style={{ display: "block", textAlign: "center", marginTop: 12, background: POPPY, color: "#fff", borderRadius: 999, padding: "10px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
            >
              Message your venue team
            </a>
          )}
        </div>

        {/* Payment summary */}
        {pay && (invoiced > 0) && (
          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={eyebrow}>Payments</span><button onClick={() => onNavigate("Payments")} style={{ background: "none", border: "none", color: POPPY, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View →</button></div>
            <div style={{ fontSize: 13, display: "grid", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: INK2 }}>Paid</span><b style={{ color: "#1a7f4b" }}>{rZA(paid)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: INK2 }}>Balance</span><b style={{ color: POPPY }}>{rZA(Math.max(0, invoiced - paid))}</b></div>
              {pay.balanceDue && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: INK2 }}>Due by</span><span>{fmtShort(pay.balanceDue)}</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
