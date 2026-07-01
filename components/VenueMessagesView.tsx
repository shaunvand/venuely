"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendVenueMessage } from "@/app/venue/messages/actions";

// Venue oversight inbox for mediated couple↔supplier messaging. The venue sees
// every thread with the FULL transcript — including the unredacted originals of
// flagged messages (hidden from couple and supplier until booked) — and can
// write into any thread as "Venue".

export type VenueThreadMessage = {
  id: string;
  sender: "couple" | "supplier" | "venue" | "system";
  body: string;
  rawBody: string | null; // original text when flagged — venue eyes only
  flagged: boolean;
  flagReason: string | null;
  createdAt: string;
};

export type VenueThread = {
  id: string;
  weddingId: string | null;
  coupleNames: string;
  weddingDate: string | null;
  supplierName: string;
  supplierType: string | null;
  supplierEmail: string | null;
  supplierPhone: string | null;
  status: "active" | "booked" | "closed";
  lastMessageAt: string | null;
  commission: { type: string; value: number; status: string; amount: number | null } | null;
  messages: VenueThreadMessage[];
};

const STATUS_PILL: Record<VenueThread["status"], { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "var(--cream)", text: "var(--poppy-deep)" },
  booked: { label: "Booked", bg: "#dcf3e6", text: "#1a7f4b" },
  closed: { label: "Closed", bg: "#f1efee", text: "var(--ink-2)" },
};

const rZA = (n: number | null | undefined) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Pin the timezone — without it the server (UTC) and client (SAST) format the
  // same instant differently, tripping React #418 hydration mismatch.
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "Africa/Johannesburg" }) + " " +
    d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
}

const SENDER_LABEL: Record<VenueThreadMessage["sender"], string> = {
  couple: "Couple", supplier: "Supplier", venue: "You (venue)", system: "System",
};

export function VenueMessagesView({ threads }: { threads: VenueThread[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(threads[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  // Keep the transcript pinned to the latest message.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const msgCount = selected?.messages.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selectedId, msgCount]);

  function send() {
    const text = draft.trim();
    if (!text || !selected || pending) return;
    setErr(null);
    startTransition(async () => {
      try {
        await sendVenueMessage(selected.id, text);
        setDraft("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not send");
      }
    });
  }

  if (threads.length === 0) {
    return (
      <div className="vy-empty">
        No conversations yet. When a couple messages one of your recommended suppliers from their
        portal, the full thread appears here.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr] items-start">
      {/* Thread list */}
      <div className="rounded-2xl bg-white overflow-hidden" style={{ border: "1px solid var(--line)" }}>
        <div className="max-h-[70vh] overflow-y-auto">
          {threads.map((t) => {
            const pill = STATUS_PILL[t.status];
            const flaggedCount = t.messages.filter((m) => m.flagged).length;
            const on = t.id === selectedId;
            return (
              <button
                key={t.id}
                onClick={() => { setSelectedId(t.id); setErr(null); }}
                className="w-full text-left px-4 py-3 transition-colors hover:bg-[color:var(--bone)]"
                style={{ borderBottom: "1px solid var(--line)", background: on ? "var(--cream)" : "transparent" }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-sm font-bold truncate" style={{ color: "var(--ink)" }}>
                    {t.coupleNames} <span className="font-sans font-normal" style={{ color: "var(--ink-2)" }}>→</span> {t.supplierName}
                  </span>
                  <span className="text-[10px] whitespace-nowrap" style={{ color: "var(--ink-2)" }}>{fmtWhen(t.lastMessageAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {t.supplierType && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: "var(--cream)", color: "var(--poppy-deep)" }}>
                      {t.supplierType}
                    </span>
                  )}
                  <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: pill.bg, color: pill.text }}>
                    {pill.label}
                  </span>
                  {flaggedCount > 0 && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#fdf3d8", color: "#8a6116" }}>
                      ⚠ {flaggedCount} flagged
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: "var(--ink-2)" }}>
                    {t.messages.length} message{t.messages.length === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transcript */}
      <div className="rounded-2xl bg-white overflow-hidden flex flex-col" style={{ border: "1px solid var(--line)", minHeight: 420, maxHeight: "76vh" }}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm p-6" style={{ color: "var(--ink-2)" }}>
            Select a conversation.
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-serif text-base font-bold truncate" style={{ color: "var(--ink)" }}>
                    {selected.coupleNames} ↔ {selected.supplierName}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
                    {selected.supplierType ? `${selected.supplierType} · ` : ""}
                    {selected.weddingDate ? new Date(selected.weddingDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "Date TBC"}
                    {(selected.supplierEmail || selected.supplierPhone) && (
                      <> · {[selected.supplierEmail, selected.supplierPhone].filter(Boolean).join(" · ")}</>
                    )}
                  </div>
                  {selected.commission && (
                    <div className="text-xs mt-0.5" style={{ color: "var(--poppy-deep)" }}>
                      Commission: {selected.commission.type === "fixed" ? `${rZA(selected.commission.value)} fixed` : `${Number(selected.commission.value) || 0}%`}
                      {selected.commission.status === "booked" && selected.commission.amount != null && <> · {rZA(selected.commission.amount)} due</>}
                      <span className="ml-1" style={{ color: "var(--ink-2)" }}>({selected.commission.status.replace("_", " ")})</span>
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: STATUS_PILL[selected.status].bg, color: STATUS_PILL[selected.status].text }}>
                  {STATUS_PILL[selected.status].label}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ background: "var(--bone)" }}>
              {selected.messages.length === 0 && (
                <div className="text-sm text-center py-8" style={{ color: "var(--ink-2)" }}>No messages in this thread yet.</div>
              )}
              {selected.messages.map((m) => {
                if (m.sender === "system") {
                  return (
                    <div key={m.id} className="text-center text-xs italic" style={{ color: "var(--ink-2)" }}>
                      {m.body} <span className="not-italic text-[10px]">· {fmtWhen(m.createdAt)}</span>
                    </div>
                  );
                }
                const mine = m.sender === "venue";
                // Direct couple→venue messages render in urgent orange.
                const urgent = selected.supplierType === "venue" && m.sender === "couple";
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: urgent ? "#c2410c" : m.sender === "couple" ? "var(--poppy-deep)" : m.sender === "supplier" ? "#1a7f4b" : "var(--ink-2)" }}>
                      {urgent ? "Couple · direct message" : SENDER_LABEL[m.sender]} · {fmtWhen(m.createdAt)}
                    </span>
                    <div className="max-w-[82%]">
                      <div
                        className="rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words"
                        style={mine
                          ? { background: "var(--poppy)", color: "#fff", borderBottomRightRadius: 6 }
                          : urgent
                            ? { background: "#F97316", color: "#fff", borderBottomLeftRadius: 6, boxShadow: "0 1px 6px rgba(249,115,22,0.4)" }
                            : { background: "#fff", border: "1px solid var(--line)", color: "var(--ink)", borderBottomLeftRadius: 6 }}
                      >
                        {m.body}
                      </div>
                      {m.flagged && (
                        <div className="mt-1.5 rounded-lg px-3 py-2 text-xs leading-relaxed" style={{ background: "#fdf3d8", border: "1px solid #f0d9a0", color: "#8a6116" }}>
                          <span className="font-semibold">⚠ Flagged{m.flagReason ? ` — ${m.flagReason}` : ""}.</span>{" "}
                          {m.rawBody ? (
                            <>Original (hidden from couple/supplier): <span className="font-medium">{m.rawBody}</span></>
                          ) : (
                            <>Contact details were redacted before delivery.</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Venue composer */}
            <div className="px-4 py-3 bg-white" style={{ borderTop: "1px solid var(--line)" }}>
              {err && <div className="text-xs mb-2" style={{ color: "#b42318" }}>{err}</div>}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Reply in this thread as the venue…"
                  className="vy-input flex-1"
                  disabled={pending}
                />
                <button onClick={send} disabled={pending || !draft.trim()} className="vy-btn vy-btn-primary text-sm whitespace-nowrap">
                  {pending ? "Sending…" : "Send as venue"}
                </button>
              </div>
              <div className="text-[11px] mt-1.5" style={{ color: "var(--ink-2)" }}>
                Both the couple and the supplier see venue messages. Venue messages are not redacted.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
