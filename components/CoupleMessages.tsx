"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Couple-side mediated supplier messaging. Couples never see supplier contact
// details (the server redacts anything that looks like contact info) until the
// thread is marked booked — then the email/phone are revealed in the header and
// the commission is logged on the venue's supplier_intros ledger.

export type ThreadMessage = {
  id: string;
  sender: "couple" | "supplier" | "venue" | "system";
  body: string;
  flagged: boolean;
  flagReason: string | null;
  createdAt: string;
};

export type MessageThread = {
  id: string;
  vendorId: string | null;
  supplierName: string;
  supplierType: string | null;
  status: "active" | "booked" | "closed";
  lastMessageAt: string | null;
  coupleUnread: number;
  supplierEmail: string | null;
  supplierPhone: string | null;
  messages: ThreadMessage[];
};

export type StartVendor = { vendorId?: string; name: string; type?: string } | null;

function relTime(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

const Shield = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
    <path d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6z" />
  </svg>
);

export function CoupleMessages({ slug, initialThreads = [], startVendor = null, onUnreadChange, primary, accent, heading, cardRadius }: {
  slug: string;
  initialThreads?: MessageThread[];
  startVendor?: StartVendor;
  onUnreadChange?: (total: number) => void;
  primary: string;
  accent: string;
  heading: React.CSSProperties;
  cardRadius: string;
}) {
  const [threads, setThreads] = useState<MessageThread[]>(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(null);
  // A conversation that doesn't exist server-side yet (couple tapped "Message
  // supplier" on a vendor with no thread) — first send creates intro + thread.
  const [pendingNew, setPendingNew] = useState<{ vendorId?: string; name: string; type?: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookPrice, setBookPrice] = useState("");
  const [booking, setBooking] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.matchMedia("(max-width: 759px)").matches : false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 760);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const activeRef = useRef<string | null>(activeId); activeRef.current = activeId;
  const threadsRef = useRef(threads); threadsRef.current = threads;

  const report = useCallback((list: MessageThread[]) => {
    onUnreadChange?.(list.reduce((s, t) => s + (Number(t.coupleUnread) || 0), 0));
  }, [onUnreadChange]);

  // GET on mount + after sends + a 30s poll while the tab is visible. The open
  // thread is always shown read locally (the couple is literally looking at it).
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/wedding/${slug}/messages`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const list: MessageThread[] = Array.isArray(data?.threads) ? data.threads : [];
      const adjusted = list.map((t) => (t.id === activeRef.current ? { ...t, coupleUnread: 0 } : t));
      setThreads(adjusted);
      report(adjusted);
    } catch { /* offline / route not deployed yet — keep what we have */ }
  }, [slug, report]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 8000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.clearInterval(id); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh]);

  const openThread = useCallback((id: string) => {
    setActiveId(id);
    setPendingNew(null);
    setMobilePane("chat");
    setThreads((prev) => {
      const next = prev.map((t) => t.id === id ? { ...t, coupleUnread: 0 } : t);
      report(next);
      return next;
    });
  }, [report]);

  // Switch to (or stage) the conversation for a supplier — used by the
  // startVendor prop and the "venuely:message-supplier" CustomEvent that
  // SuppliersManager dispatches.
  const openFor = useCallback((v: { vendorId?: string; name: string; type?: string }) => {
    const name = v.name.trim().toLowerCase();
    const match = threadsRef.current.find((t) =>
      (v.vendorId && t.vendorId === v.vendorId) || t.supplierName.trim().toLowerCase() === name);
    if (match) openThread(match.id);
    else { setPendingNew(v); setActiveId(null); setMobilePane("chat"); }
  }, [openThread]);

  useEffect(() => { if (startVendor?.name) openFor(startVendor); }, [startVendor, openFor]);
  useEffect(() => {
    const onEvt = (e: Event) => {
      const d = (e as CustomEvent).detail as { vendorId?: string; name?: string; type?: string } | undefined;
      if (d?.name) openFor({ vendorId: d.vendorId, name: d.name, type: d.type });
    };
    window.addEventListener("venuely:message-supplier", onEvt);
    return () => window.removeEventListener("venuely:message-supplier", onEvt);
  }, [openFor]);

  const activeThread = pendingNew ? null : threads.find((t) => t.id === activeId) ?? null;

  // Keep the conversation pinned to the latest message.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const msgCount = activeThread?.messages.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, pendingNew, msgCount]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    const temp: ThreadMessage = { id: `tmp-${Date.now()}`, sender: "couple", body: text, flagged: false, flagReason: null, createdAt: new Date().toISOString() };
    const targetId = activeId;
    try {
      if (targetId) {
        // Optimistic append, then confirm against the server.
        setThreads((prev) => prev.map((t) => t.id === targetId ? { ...t, messages: [...t.messages, temp], lastMessageAt: temp.createdAt } : t));
        const res = await fetch(`/api/wedding/${slug}/messages`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ threadId: targetId, text }),
        });
        if (!res.ok) throw new Error("send failed");
      } else if (pendingNew) {
        const res = await fetch(`/api/wedding/${slug}/messages`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(pendingNew.vendorId ? { vendorId: pendingNew.vendorId } : { supplier: { name: pendingNew.name, type: pendingNew.type } }),
            text,
          }),
        });
        if (!res.ok) throw new Error("send failed");
        const data = await res.json().catch(() => null);
        if (data?.threadId) { setActiveId(String(data.threadId)); setPendingNew(null); }
      } else {
        return;
      }
      await refresh();
    } catch {
      // Roll back the optimistic bubble and give the text back to retry.
      if (targetId) setThreads((prev) => prev.map((t) => t.id === targetId ? { ...t, messages: t.messages.filter((m) => m.id !== temp.id) } : t));
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  async function confirmBook() {
    if (!activeId || booking) return;
    setBooking(true);
    try {
      const v = Number(bookPrice.replace(/[^\d.]/g, ""));
      const res = await fetch(`/api/wedding/${slug}/messages/book`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: activeId, ...(v > 0 ? { bookingValue: v } : {}) }),
      });
      if (res.ok) { setBookOpen(false); setBookPrice(""); await refresh(); }
    } finally {
      setBooking(false);
    }
  }

  const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, overflow: "hidden" };
  const chipStyle: React.CSSProperties = { display: "inline-block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--poppy-deep, #c2371f)", background: "var(--cream, #FBF7F2)", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" };

  const showList = !isMobile || mobilePane === "list";
  const showChat = !isMobile || mobilePane === "chat";
  const convoName = pendingNew?.name ?? activeThread?.supplierName ?? "";
  const convoType = pendingNew?.type ?? activeThread?.supplierType ?? null;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Messages</h2>
        <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>
          Chat with recommended suppliers right here — contact details are shared once you book.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(240px, 320px) 1fr", gap: 14, height: "min(640px, 72vh)", minHeight: 380 }}>
        {/* Thread list */}
        {showList && (
          <div style={{ ...card, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {threads.length === 0 && !pendingNew ? (
                <div style={{ padding: 24, textAlign: "center", color: "#8a8a8a", fontSize: 13 }}>
                  No conversations yet — head to <b>Suppliers</b> and tap “💬 Message supplier” to start one.
                </div>
              ) : (
                <>
                  {pendingNew && (
                    <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: `${primary}10`, alignItems: "center" }}>
                      <Avatar name={pendingNew.name} primary={primary} accent={accent} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingNew.name}</div>
                        <div style={{ fontSize: 12, color: "#78716c" }}>New conversation</div>
                      </div>
                    </div>
                  )}
                  {threads.map((t) => {
                    const last = t.messages[t.messages.length - 1];
                    const on = t.id === activeId && !pendingNew;
                    return (
                      <button key={t.id} onClick={() => openThread(t.id)} style={{ display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "12px 14px", border: "none", borderBottom: "1px solid rgba(0,0,0,0.06)", background: on ? `${primary}10` : "transparent", cursor: "pointer", alignItems: "flex-start" }}>
                        <Avatar name={t.supplierName} primary={primary} accent={accent} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.supplierName}</span>
                            <span style={{ fontSize: 10.5, color: "#a8a29e", whiteSpace: "nowrap" }}>{relTime(t.lastMessageAt)}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "2px 0" }}>
                            {t.supplierType && <span style={chipStyle}>{t.supplierType}</span>}
                            {t.status === "booked" && <span style={{ fontSize: 10, fontWeight: 700, color: "#1a7f4b", whiteSpace: "nowrap" }}>✓ Booked</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#78716c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {last ? (last.sender === "couple" ? `You: ${last.body}` : last.body) : "No messages yet"}
                            </span>
                            {t.coupleUnread > 0 && (
                              <span style={{ background: primary, color: "#fff", borderRadius: 999, fontSize: 10.5, fontWeight: 700, padding: "1px 7px", lineHeight: 1.5, whiteSpace: "nowrap" }}>{t.coupleUnread}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* Conversation */}
        {showChat && (
          <div style={{ ...card, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {!activeThread && !pendingNew ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#a8a29e", fontSize: 13.5, padding: 24, textAlign: "center" }}>
                Select a conversation, or message a supplier from the Suppliers tab.
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", flexWrap: "wrap" }}>
                  {isMobile && (
                    <button onClick={() => setMobilePane("list")} aria-label="Back to conversations" style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", lineHeight: 1, color: "#57534e", padding: "2px 4px" }}>←</button>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ ...heading, fontSize: 17 }}>{convoName}</span>
                      {convoType && <span style={chipStyle}>{convoType}</span>}
                    </div>
                    {activeThread?.status === "booked" && (activeThread.supplierPhone || activeThread.supplierEmail) && (
                      <div style={{ fontSize: 12, color: "#57534e", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[activeThread.supplierPhone, activeThread.supplierEmail].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  {activeThread && (
                    activeThread.status === "booked" ? (
                      <span style={{ background: "#dcf3e6", color: "#1a7f4b", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>🎉 Booked</span>
                    ) : (
                      <button onClick={() => setBookOpen(true)} style={{ border: `1.5px solid ${primary}`, background: "#fff", color: primary, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                        We booked them 🎉
                      </button>
                    )
                  )}
                </div>

                {/* Messages */}
                <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "#FBF8F3" }}>
                  {pendingNew ? (
                    <div style={{ alignSelf: "center", textAlign: "center", maxWidth: 360, margin: "auto", color: "#78716c", fontSize: 12.5, lineHeight: 1.6 }}>
                      <div style={{ fontSize: 26, marginBottom: 6 }}>💬</div>
                      Say hi to <b>{pendingNew.name}</b> — your message goes through your venue&apos;s inbox, and they&apos;ll reply right here. Contact details stay private until you book.
                    </div>
                  ) : (
                    activeThread?.messages.map((m) => {
                      if (m.sender === "system") {
                        return <div key={m.id} style={{ alignSelf: "center", textAlign: "center", fontSize: 11.5, fontStyle: "italic", color: "#a8a29e", padding: "2px 12px" }}>{m.body}</div>;
                      }
                      const mine = m.sender === "couple";
                      return (
                        <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                          {m.sender === "venue" && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: primary, marginBottom: 2 }}>Venue</span>
                          )}
                          <div style={{
                            background: mine ? primary : "#fff",
                            color: mine ? "#fff" : "var(--ink, #1c1917)",
                            border: mine ? "none" : "1px solid rgba(0,0,0,0.08)",
                            borderRadius: 16,
                            ...(mine ? { borderBottomRightRadius: 5 } : { borderBottomLeftRadius: 5 }),
                            padding: "9px 13px", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                          }}>
                            {m.body}
                          </div>
                          {m.flagged && (
                            <div title={m.flagReason ?? undefined} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8a6116", marginTop: 3 }}>
                              <Shield />
                              <span>Contact details hidden until you book{m.flagReason ? ` · ${m.flagReason}` : ""}</span>
                            </div>
                          )}
                          <span style={{ fontSize: 10, color: "#b8b2ac", marginTop: 2 }}>{relTime(m.createdAt)}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Composer */}
                <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid rgba(0,0,0,0.08)", background: "#fff" }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={`Message ${convoName}…`}
                    style={{ flex: 1, minWidth: 0, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 999, padding: "10px 16px", fontSize: 13.5 }}
                  />
                  <button
                    onClick={send}
                    disabled={!draft.trim() || sending}
                    aria-label="Send message"
                    style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: primary, color: "#fff", cursor: !draft.trim() || sending ? "default" : "pointer", opacity: !draft.trim() || sending ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* "We booked them" — optional final agreed price, logs the venue's commission */}
      {bookOpen && activeThread && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => !booking && setBookOpen(false)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 24, width: "min(420px,100%)" }}>
            <h3 style={{ ...heading, fontSize: 21, margin: "0 0 6px" }}>🎉 You booked {activeThread.supplierName}!</h3>
            <p style={{ fontSize: 12.5, color: "#57534e", margin: "0 0 14px", lineHeight: 1.6 }}>
              Wonderful! We&apos;ll let your venue know and share {activeThread.supplierName}&apos;s contact details with you. If you&apos;ve agreed a price, add it here (optional).
            </p>
            <input
              type="number" min="0" step="0.01" autoFocus value={bookPrice}
              onChange={(e) => setBookPrice(e.target.value)}
              placeholder="Final agreed price (R) — optional"
              style={{ width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13.5 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setBookOpen(false)} disabled={booking} style={{ background: "none", border: "none", color: "#57534e", fontSize: 13.5, cursor: "pointer", padding: "9px 12px" }}>Cancel</button>
              <button type="button" onClick={confirmBook} disabled={booking} style={{ background: primary, color: "#fff", border: "none", borderRadius: 999, padding: "9px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", opacity: booking ? 0.6 : 1 }}>
                {booking ? "Saving…" : "Confirm booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, primary, accent }: { name: string; primary: string; accent: string }) {
  return (
    <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${accent}55`, color: primary, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}
