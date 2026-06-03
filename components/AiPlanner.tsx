"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
const STARTERS = ["Help me pick a menu for our day", "What should our timeline look like?", "Ideas to match our style", "How many tables will we need?"];

// Right-side AI wedding planner. A chat recommendation tool grounded (server-side)
// in the venue's real assets, categories and the couple's wedding context.
export function AiPlanner({ slug, primary, accent }: { slug: string; primary: string; accent: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  // Let the Overview "front door" (or anything) open the planner.
  useEffect(() => { const h = () => setOpen(true); window.addEventListener("venuely:open-planner", h); return () => window.removeEventListener("venuely:open-planner", h); }, []);

  async function send(text: string) {
    const t = text.trim(); if (!t || busy) return;
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      const r = await fetch(`/api/wedding/${slug}/planner`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const j = await r.json();
      setMessages((m) => [...m, { role: "assistant", content: j.ok ? j.reply : (j.error === "AI not configured" ? "The AI planner isn't switched on yet — ask your venue to enable it." : "Sorry, I couldn't answer that just now. Please try again.") }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      {/* Launcher */}
      <button onClick={() => setOpen(true)} aria-label="Open AI planner"
        style={{ position: "fixed", right: 18, bottom: 18, zIndex: 50, background: primary, color: "#fff", border: "none", borderRadius: 999, padding: "12px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 20px rgba(0,0,0,0.25)", display: open ? "none" : "inline-flex", alignItems: "center", gap: 8 }}>
        ✨ Plan with AI
      </button>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
          <div style={{ position: "relative", width: "min(420px, 100%)", height: "100%", background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 30px rgba(0,0,0,0.18)" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(135deg, ${primary}, ${accent})`, color: "#fff" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>✨ AI Wedding Planner</div>
                <div style={{ fontSize: 11.5, opacity: 0.9 }}>Recommends from your venue&apos;s options</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 999, width: 30, height: 30, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: 16, display: "grid", gap: 10, alignContent: "start", background: "#FFF8F3" }}>
              {messages.length === 0 && (
                <div style={{ color: "#57534e", fontSize: 13.5 }}>
                  <p style={{ marginTop: 0 }}>Hi! I can help you plan using everything your venue offers — menus, rentals, accommodation, suppliers, seating and more. Try:</p>
                  <div style={{ display: "grid", gap: 6 }}>
                    {STARTERS.map((s) => <button key={s} onClick={() => send(s)} style={{ textAlign: "left", border: `1px solid ${primary}`, background: "#fff", color: primary, borderRadius: 12, padding: "9px 12px", fontSize: 13, cursor: "pointer" }}>{s}</button>)}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ justifySelf: m.role === "user" ? "end" : "start", maxWidth: "85%", background: m.role === "user" ? primary : "#fff", color: m.role === "user" ? "#fff" : "#1c1917", border: m.role === "user" ? "none" : "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: "10px 13px", fontSize: 13.5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.content}</div>
              ))}
              {busy && <div style={{ justifySelf: "start", color: "#8a8a8a", fontSize: 13 }}>Thinking…</div>}
            </div>

            <div style={{ padding: 12, borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", gap: 8 }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(input); }} placeholder="Ask anything about your wedding…" style={{ flex: 1, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 999, padding: "10px 14px", fontSize: 14 }} />
              <button onClick={() => send(input)} disabled={busy || !input.trim()} style={{ background: primary, color: "#fff", border: "none", borderRadius: 999, padding: "0 18px", fontWeight: 600, cursor: "pointer" }}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
