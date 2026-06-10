"use client";

import Link from "next/link";
import { useState } from "react";

// Calendar operations dashboard pieces. CalendarOpsCards = the top stats strip +
// upcoming-actions list. WeddingOverviewCards = the polished card row that sits at
// the BOTTOM of the page (avatars, guests/rooms/total, status flag, actions).

export type OpsStat = { label: string; value: string; sub: string; href: string; accent: string };

export type OpsAction = { id: string; name: string; detail: string; action: string; href: string; primary?: boolean };

export type OpsCard = {
  id: string;
  slug: string;
  couple: string;
  dateLabel: string;
  guests: number | null;
  roomsBooked: number;
  roomsTotal: number;
  totalLabel: string;
  flag: string; // health / invoice / payment summary line
  flagTone: "ok" | "warn" | "muted";
  upcoming: boolean;
  needsAttention: boolean;
  awaitingPayment: boolean;
  fullyBooked: boolean;
  hasAccommodation: boolean;
};

const FLAG_STYLE: Record<OpsCard["flagTone"], { bg: string; text: string; dot: string; border: string }> = {
  ok: { bg: "#dcefe2", text: "#1f5d3e", dot: "#1f5d3e", border: "rgba(31,93,62,0.25)" },
  warn: { bg: "#fdecdf", text: "#b3551b", dot: "#e0701f", border: "rgba(224,112,31,0.3)" },
  muted: { bg: "var(--cream)", text: "var(--ink-2)", dot: "var(--ink-2)", border: "var(--line)" },
};

// ── Top: stats strip + upcoming actions ──────────────────────────────────────
export function CalendarOpsCards({
  stats,
  actions,
}: {
  stats: OpsStat[];
  actions: OpsAction[];
}) {
  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="vy-stat hover:shadow-md transition-shadow relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: s.accent }} />
            <div className="vy-stat-label">{s.label}</div>
            <div className="vy-stat-value" style={{ color: s.accent }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--ink-2)" }}>{s.sub}</div>
          </Link>
        ))}
      </div>

      {/* Upcoming actions */}
      {actions.length > 0 && (
        <section className="vy-card" style={{ border: "2px solid var(--peach)" }}>
          <div className="flex items-center gap-2">
            <span className="vy-eyebrow">Upcoming actions</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--peach)", color: "var(--poppy-deep)" }}>{actions.length} to action</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {actions.slice(0, 3).map((it) => (
              <Link key={it.id} href={it.href} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-[color:var(--cream)] transition-colors" style={{ border: "1px solid var(--line)" }}>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{it.name}</div>
                  <div className="text-xs truncate" style={{ color: "var(--ink-2)" }}>{it.detail}</div>
                </div>
                {it.primary ? (
                  <span className="vy-btn vy-btn-primary text-xs flex-shrink-0">{it.action} →</span>
                ) : (
                  <span className="text-xs flex-shrink-0 px-2.5 py-1 rounded-full" style={{ background: "var(--cream)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>{it.action}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Bottom: the "Wedding overview" card row ───────────────────────────────────
function initials(name: string): string {
  const parts = name.trim().split(/[\s&]+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Icon({ name }: { name: "users" | "bed" | "money" }) {
  const P: Record<string, React.ReactNode> = {
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M21 20c0-2.2-1.6-3.7-4-4.2" /></>,
    bed: <><path d="M3 18v-7a2 2 0 0 1 2-2h9a4 4 0 0 1 4 4v5" /><path d="M3 14h18" /><path d="M3 18v2M21 13v7" /><circle cx="7" cy="11.5" r="1.1" /></>,
    money: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2" /></>,
  };
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">{P[name]}</svg>;
}

export function WeddingOverviewCards({ cards }: { cards: OpsCard[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  if (!cards.length) return null;

  function copyPortal(slug: string, id: string) {
    const url = `${typeof window !== "undefined" ? window.location.origin : "https://venuely.co.za"}/${slug}`;
    navigator.clipboard?.writeText(url).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); }).catch(() => {});
  }

  return (
    <section className="vy-card">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="font-serif text-xl" style={{ color: "var(--ink)" }}>Wedding overview</h2>
        <Link href="/venue/weddings" className="text-sm hover:underline" style={{ color: "var(--poppy)" }}>View all weddings →</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const fs = FLAG_STYLE[c.flagTone];
          return (
            <div key={c.id} className="rounded-2xl bg-white p-4 flex flex-col gap-3.5" style={{ border: `1px solid ${fs.border}` }}>
              {/* Couple + avatar */}
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: "var(--cream)", color: "var(--poppy-deep)" }}>
                  {initials(c.couple)}
                </span>
                <div className="min-w-0">
                  <div className="font-serif text-base leading-tight truncate" style={{ color: "var(--ink)" }}>{c.couple}</div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-2)" }}>{c.dateLabel}</div>
                </div>
              </div>

              {/* Stats with line icons */}
              <div className="space-y-1.5 text-sm" style={{ color: "var(--ink)" }}>
                <div className="flex items-center gap-2.5"><span style={{ color: "var(--ink-2)" }}><Icon name="users" /></span>{c.guests ?? "—"} Guests</div>
                <div className="flex items-center gap-2.5"><span style={{ color: "var(--ink-2)" }}><Icon name="bed" /></span>{c.roomsTotal > 0 ? `${c.roomsBooked} / ${c.roomsTotal} Rooms` : "— Rooms"}</div>
                <div className="flex items-center gap-2.5"><span style={{ color: "var(--ink-2)" }}><Icon name="money" /></span>{c.totalLabel === "—" ? "— Total" : `${c.totalLabel} Total`}</div>
              </div>

              {/* Status flag */}
              <div className="flex items-center gap-2 text-[13px] rounded-lg px-3 py-2" style={{ background: fs.bg, color: fs.text }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: fs.dot }} />
                <span className="truncate">{c.flag}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-auto">
                <Link href={`/venue/weddings/${c.slug}`} className="flex-1 text-center text-sm font-medium rounded-lg py-2 transition hover:bg-[color:var(--cream)]" style={{ border: "1px solid var(--line)", color: "var(--ink)" }}>
                  Open wedding
                </Link>
                <details className="relative shrink-0">
                  <summary className="list-none cursor-pointer w-9 h-9 rounded-lg flex items-center justify-center font-semibold tracking-widest transition hover:bg-[color:var(--cream)]" style={{ border: "1px solid var(--line)", color: "var(--ink-2)" }}>…</summary>
                  <div className="absolute right-0 bottom-11 z-10 rounded-xl bg-white shadow-lg py-1 text-sm" style={{ border: "1px solid var(--line)", minWidth: 180 }}>
                    <Link href={`/${c.slug}`} target="_blank" className="block px-3 py-2 hover:bg-[color:var(--cream)]">Open couple portal ↗</Link>
                    <button type="button" onClick={() => copyPortal(c.slug, c.id)} className="block w-full text-left px-3 py-2 hover:bg-[color:var(--cream)]">{copiedId === c.id ? "✓ Copied" : "Copy portal URL"}</button>
                  </div>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
