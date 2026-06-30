"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { statusColor } from "@/lib/wedding/status";
import { HEALTH_COLOR, HEALTH_LABEL, type WeddingHealth } from "@/lib/venue/progress";

const STATUS_OPTIONS = ["inquiry", "provisional", "booked", "completed", "cancelled"];

// Status badge that's also a dropdown — change a wedding's status inline.
function StatusCell({ id, status, onSetStatus }: { id: string; status: string; onSetStatus: (id: string, status: string) => Promise<void> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const c = statusColor(status);
  const opts = STATUS_OPTIONS.includes(status) ? STATUS_OPTIONS : [status, ...STATUS_OPTIONS];
  return (
    <select
      value={status}
      disabled={pending}
      aria-label="Change wedding status"
      title="Click to change status"
      onChange={(e) => { const v = e.target.value; if (v !== status) start(async () => { await onSetStatus(id, v); router.refresh(); }); }}
      className="text-[11px] font-medium uppercase tracking-wider pl-2.5 pr-6 py-1 rounded-full whitespace-nowrap border-0 cursor-pointer appearance-none"
      style={{
        background: `${c.bg} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' fill='none' stroke='${encodeURIComponent(c.text)}' stroke-width='1.6' stroke-linecap='round'/></svg>") right 8px center/9px no-repeat`,
        color: c.text,
        opacity: pending ? 0.6 : 1,
      }}
    >
      {opts.map((s) => <option key={s} value={s} style={{ background: "#fff", color: "#1c1917", textTransform: "capitalize" }}>{s.replace(/_/g, " ")}</option>)}
    </select>
  );
}

export type WeddingRow = {
  id: string;
  couple: string;
  date: string | null;
  endDate: string | null;
  guests: number | null;
  status: string;
  progressPct: number;
  health: WeddingHealth;
  missing: string[];
  portalShort: string; // e.g. venuely.co.za/h-s-2027
  portalFull: string;
  actions: React.ReactNode; // server-bound <WeddingRowActions />
};

const PAGE_SIZE = 10;

// "All weddings" card from the dashboard mock: count badge, search, status
// filter, table with copyable portal URLs and pagination.
export function WeddingsTable({ rows, onSetStatus }: { rows: WeddingRow[]; onSetStatus: (id: string, status: string) => Promise<void> }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const statuses = useMemo(() => Array.from(new Set(rows.map((r) => r.status))).sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (needle && !`${r.couple} ${r.portalShort}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function copy(r: WeddingRow) {
    navigator.clipboard.writeText(r.portalFull).then(() => {
      setCopiedId(r.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  return (
    <div className="vy-card p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl" style={{ color: "var(--ink)" }}>All weddings</h2>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--cream)", color: "var(--poppy-deep)" }}>{filtered.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-2)" }}>
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" aria-hidden><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </span>
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search weddings…"
              className="vy-input text-sm"
              style={{ paddingLeft: "2.1rem", paddingTop: "0.45rem", paddingBottom: "0.45rem", width: "230px" }}
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="vy-select text-sm"
            style={{ paddingTop: "0.45rem", paddingBottom: "0.45rem" }}
            aria-label="Filter by status"
          >
            <option value="all">Filter: all</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="vy-table">
        <thead>
          <tr>
            <th>Couple</th>
            <th>Date</th>
            <th>Guests</th>
            <th>Status</th>
            <th>Planned</th>
            <th>Portal URL</th>
            <th className="text-right">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.id}>
              <td><div className="font-medium">{r.couple}</div></td>
              <td className="whitespace-nowrap">{r.date ? (r.endDate ? `${r.date} → ${r.endDate}` : r.date) : "—"}</td>
              <td>{r.guests ?? "—"}</td>
              <td>
                <StatusCell id={r.id} status={r.status} onSetStatus={onSetStatus} />
              </td>
              <td>
                <div
                  className="min-w-[84px] max-w-[110px]"
                  title={r.missing.length ? `${HEALTH_LABEL[r.health]} — still to do: ${r.missing.join(", ")}` : "Everything in place"}
                >
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-xs font-semibold w-9">{r.progressPct}%</span>
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: HEALTH_COLOR[r.health].text }} aria-label={HEALTH_LABEL[r.health]} />
                  </div>
                  <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: "var(--line)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${r.progressPct}%`, background: HEALTH_COLOR[r.health].text }} />
                  </div>
                </div>
              </td>
              <td>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-stone-500 max-w-[150px]">
                  <span className="truncate" title={r.portalFull}>{r.portalShort}</span>
                  <button type="button" onClick={() => copy(r)} aria-label="Copy portal URL" className="press shrink-0" style={{ color: copiedId === r.id ? "#1f5d3e" : "var(--ink-2)" }}>
                    {copiedId === r.id ? "✓" : (
                      <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" aria-hidden><rect x="4" y="4" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M10 4V3a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 0 2 3v5A1.5 1.5 0 0 0 3.5 9.5H4" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
                    )}
                  </button>
                </span>
              </td>
              <td className="text-right whitespace-nowrap">{r.actions}</td>
            </tr>
          ))}
          {!visible.length && (
            <tr><td colSpan={7} className="text-center text-sm py-8" style={{ color: "var(--ink-2)" }}>No weddings match — clear the search or filter.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-1 py-3 border-t" style={{ borderColor: "var(--line)" }}>
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="w-8 h-8 rounded-lg border border-stone-200 disabled:opacity-40 press" aria-label="Previous page">‹</button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className="w-8 h-8 rounded-lg text-sm font-medium press"
              style={p === safePage ? { background: "var(--cream)", color: "var(--poppy-deep)", border: "1px solid var(--peach)" } : { color: "var(--ink-2)" }}
            >
              {p}
            </button>
          ))}
          <button type="button" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="w-8 h-8 rounded-lg border border-stone-200 disabled:opacity-40 press" aria-label="Next page">›</button>
        </div>
      )}
    </div>
  );
}
