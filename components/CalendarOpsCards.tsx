"use client";

import Link from "next/link";
import { useState } from "react";

// Client-side operations dashboard sections for the venue calendar: a stats
// strip, an "upcoming actions" list, filter chips, and the per-wedding cards
// the chips filter. All numbers are computed server-side and passed in — this
// component only owns the filter interactivity.

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
  // membership flags drive the chips
  upcoming: boolean;
  needsAttention: boolean;
  awaitingPayment: boolean;
  fullyBooked: boolean;
  hasAccommodation: boolean;
};

type FilterKey = "all" | "upcoming" | "attention" | "payment" | "booked" | "accommodation";

const FLAG_STYLE: Record<OpsCard["flagTone"], { bg: string; text: string }> = {
  ok: { bg: "#dcefe2", text: "#1f5d3e" },
  warn: { bg: "#fdf0d4", text: "#8a6116" },
  muted: { bg: "var(--cream)", text: "var(--ink-2)" },
};

export function CalendarOpsCards({
  stats,
  actions,
  cards,
}: {
  stats: OpsStat[];
  actions: OpsAction[];
  cards: OpsCard[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = {
    attention: cards.filter((c) => c.needsAttention).length,
    payment: cards.filter((c) => c.awaitingPayment).length,
  };

  const chips: Array<{ key: FilterKey; label: string; count?: number }> = [
    { key: "all", label: "All weddings" },
    { key: "upcoming", label: "Upcoming" },
    { key: "attention", label: "Needs attention", count: counts.attention },
    { key: "payment", label: "Awaiting payment", count: counts.payment },
    { key: "booked", label: "Fully booked" },
    { key: "accommodation", label: "Accommodation" },
  ];

  const filtered = cards.filter((c) => {
    switch (filter) {
      case "upcoming": return c.upcoming;
      case "attention": return c.needsAttention;
      case "payment": return c.awaitingPayment;
      case "booked": return c.fullyBooked;
      case "accommodation": return c.hasAccommodation;
      default: return true;
    }
  });

  return (
    <div className="space-y-8">
      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="vy-stat relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: s.accent }} />
            <div className="vy-stat-label">{s.label}</div>
            <div className="vy-stat-value tabular-nums" style={{ color: s.accent }}>{s.value}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs" style={{ color: "var(--ink-2)" }}>{s.sub}</span>
              <Link href={s.href} className="text-xs hover:underline shrink-0" style={{ color: "var(--poppy)" }}>View →</Link>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming actions */}
      {actions.length > 0 && (
        <section className="vy-card" style={{ border: "2px solid var(--peach)" }}>
          <div className="flex items-center gap-2">
            <span className="vy-eyebrow">Upcoming actions</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--peach)", color: "var(--poppy-deep)" }}>{actions.length} to action</span>
          </div>
          <h2 className="vy-h2 mt-1 mb-3">What needs your attention</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {actions.slice(0, 3).map((it) => (
              <Link key={it.id} href={it.href} className="flex flex-col justify-between gap-3 rounded-lg px-3 py-3 hover:bg-[color:var(--cream)] transition-colors" style={{ border: "1px solid var(--line)" }}>
                <div>
                  <div className="font-medium text-sm">{it.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>{it.detail}</div>
                </div>
                <span
                  className={it.primary ? "vy-btn vy-btn-primary text-xs self-start" : "text-xs self-start px-2.5 py-1 rounded-full"}
                  style={it.primary ? undefined : { background: "var(--cream)", color: "var(--ink-2)", border: "1px solid var(--line)" }}
                >
                  {it.action}{it.primary ? " →" : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className="text-xs px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: on ? "var(--poppy)" : "var(--cream)",
                color: on ? "#fff" : "var(--ink-2)",
                border: `1px solid ${on ? "var(--poppy)" : "var(--line)"}`,
                fontWeight: on ? 600 : 400,
              }}
            >
              {c.label}
              {typeof c.count === "number" && c.count > 0 && (
                <span
                  className="ml-1.5 tabular-nums text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: on ? "rgba(255,255,255,0.25)" : "var(--peach)", color: on ? "#fff" : "var(--poppy-deep)" }}
                >
                  {c.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Wedding cards */}
      {filtered.length === 0 ? (
        <div className="vy-empty text-sm">No weddings match this filter.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const fs = FLAG_STYLE[c.flagTone];
            return (
              <div key={c.id} className="vy-card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-serif text-lg leading-tight truncate" style={{ color: "var(--ink)" }}>{c.couple}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>{c.dateLabel}</div>
                  </div>
                  <details className="relative shrink-0">
                    <summary className="list-none cursor-pointer px-2 py-0.5 rounded-md hover:bg-[color:var(--cream)]" style={{ color: "var(--ink-2)" }}>⋯</summary>
                    <div className="absolute right-0 mt-1 z-10 rounded-lg bg-white shadow-lg py-1 text-sm" style={{ border: "1px solid var(--line)", minWidth: 160 }}>
                      <Link href={`/venue/weddings/${c.slug}`} className="block px-3 py-1.5 hover:bg-[color:var(--cream)]">Open wedding</Link>
                      <Link href={`/${c.slug}`} target="_blank" className="block px-3 py-1.5 hover:bg-[color:var(--cream)]">Couple portal ↗</Link>
                    </div>
                  </details>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>Guests</div>
                    <div className="text-sm font-semibold tabular-nums">{c.guests ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>Rooms</div>
                    <div className="text-sm font-semibold tabular-nums">{c.roomsTotal > 0 ? `${c.roomsBooked}/${c.roomsTotal}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>Total</div>
                    <div className="text-sm font-semibold tabular-nums">{c.totalLabel}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: fs.bg, color: fs.text }}>{c.flag}</span>
                  <Link href={`/venue/weddings/${c.slug}`} className="text-xs hover:underline shrink-0" style={{ color: "var(--poppy)" }}>Open →</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
