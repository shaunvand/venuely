"use client";

import { useEffect, useRef, useState } from "react";

// Minimal, mobile-first supplier chat. The page (app/s/[token]) provides the
// initial thread server-side; this component only POSTs replies to
// /api/supplier/thread/[token] with an optimistic append (the server copy
// replaces it, since the body may come back redacted).

type Msg = { id: string; sender: string; body: string; flagged: boolean; createdAt: string };
type Thread = {
  supplierName: string;
  venueName: string | null;
  coupleNames: string;
  weddingDate: string | null;
  status: string;
  messages: Msg[];
};

const SERIF = "'Fraunces', Georgia, serif";
const POPPY = "#FA523C";
const INK = "#1c1917";
const INK2 = "#57534e";

const fmtDate = (s: string | null) => {
  if (!s) return "";
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
};
const fmtTime = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export function SupplierThreadChat({ token, thread }: { token: string; thread: Thread }) {
  const [messages, setMessages] = useState<Msg[]>(thread.messages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError("");
    const optimistic: Msg = { id: `tmp-${Date.now()}`, sender: "supplier", body: t, flagged: false, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    setText("");
    const r = await fetch(`/api/supplier/thread/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    }).catch(() => null);
    setSending(false);
    if (r?.ok) {
      const j = await r.json();
      // Swap in the server copy — it may be redacted.
      setMessages((m) => m.map((x) => (x.id === optimistic.id ? j.message : x)));
    } else {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setText(t);
      setError("Couldn't send — please try again.");
    }
  }

  const dateLabel = fmtDate(thread.weddingDate);
  const headerLine = `Chat about ${thread.coupleNames}'s wedding at ${thread.venueName || "their venue"}${dateLabel ? ` — ${dateLabel}` : ""}`;

  const bubble = (m: Msg) => {
    if (m.sender === "system") {
      return (
        <div key={m.id} style={{ textAlign: "center", margin: "14px 0" }}>
          <span style={{ display: "inline-block", background: "#FAF2E8", color: INK2, fontSize: 12.5, borderRadius: 999, padding: "6px 14px" }}>{m.body}</span>
        </div>
      );
    }
    const mine = m.sender === "supplier";
    return (
      <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", margin: "6px 0" }}>
        <div style={{ maxWidth: "82%" }}>
          {!mine && (
            <div style={{ fontSize: 11, color: INK2, margin: "0 0 2px 12px", textTransform: "capitalize" }}>
              {m.sender === "venue" ? thread.venueName || "Venue" : thread.coupleNames}
            </div>
          )}
          <div style={{
            background: mine ? POPPY : "#fff",
            color: mine ? "#fff" : INK,
            border: mine ? "none" : "1px solid rgba(0,0,0,0.07)",
            borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            padding: "10px 14px",
            fontSize: 14.5,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {m.body}
          </div>
          <div style={{ fontSize: 10.5, color: "#a8a29e", margin: mine ? "3px 12px 0 0" : "3px 0 0 12px", textAlign: mine ? "right" : "left" }}>
            {fmtTime(m.createdAt)}{m.flagged ? " · moderated" : ""}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFF6F0", display: "flex", flexDirection: "column", fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "#FFF6F0", borderBottom: "1px solid rgba(28,25,23,0.08)", padding: "14px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 20, letterSpacing: "-0.02em", color: INK }}>
            Venuely<span style={{ color: POPPY }}>.</span>
          </div>
          <div style={{ fontSize: 13.5, color: INK2, marginTop: 2 }}>{headerLine}</div>
          {thread.status === "booked" && (
            <div style={{ display: "inline-block", marginTop: 6, fontSize: 11.5, fontWeight: 700, color: "#3f6212", background: "#ecfccb", borderRadius: 999, padding: "3px 10px" }}>
              Booked — contact details unlocked
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {messages.length === 0 && (
            <p style={{ textAlign: "center", color: INK2, fontSize: 14, marginTop: 40 }}>
              No messages yet — say hello to {thread.coupleNames}.
            </p>
          )}
          {messages.map(bubble)}
          <div ref={endRef} />
        </div>
      </main>

      {/* Composer */}
      <footer style={{ position: "sticky", bottom: 0, background: "#FFF6F0", borderTop: "1px solid rgba(28,25,23,0.08)", padding: "10px 16px 14px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {error && <div style={{ color: POPPY, fontSize: 12.5, marginBottom: 6 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Reply to ${thread.coupleNames}…`}
              rows={1}
              style={{ flex: 1, resize: "none", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 14, padding: "11px 14px", fontSize: 14.5, fontFamily: "inherit", background: "#fff", color: INK, outline: "none", minHeight: 44, maxHeight: 120 }}
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              style={{ background: POPPY, color: "#fff", border: "none", borderRadius: 999, padding: "12px 22px", fontWeight: 700, fontSize: 14, cursor: sending || !text.trim() ? "default" : "pointer", opacity: sending || !text.trim() ? 0.55 : 1 }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          <p style={{ fontSize: 11.5, color: "#a8a29e", margin: "8px 2px 0" }}>
            Your contact details stay private until the couple books. Messages may be moderated.
          </p>
        </div>
      </footer>
    </div>
  );
}
