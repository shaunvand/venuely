"use client";

import { useState } from "react";

// Shows the venue's live booking-feed URL with copy buttons. Subscribing (webcal)
// keeps the venue's own Google/Apple calendar in sync automatically.
export function CalendarSubscribe({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const webcal = url.replace(/^https?:/, "webcal:");
  function copy() { navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="text-xs px-3 py-2 rounded-lg bg-stone-100 text-stone-700 truncate max-w-full" style={{ maxWidth: 420 }}>{url}</code>
      <button onClick={copy} className="vy-btn vy-btn-sm" style={{ background: "var(--poppy)", color: "#fff", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600 }}>{copied ? "Copied ✓" : "Copy link"}</button>
      <a href={webcal} className="vy-btn vy-btn-sm" style={{ border: "1px solid var(--poppy)", color: "var(--poppy)", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Subscribe</a>
      <a href={url} download className="vy-btn vy-btn-sm" style={{ border: "1px solid var(--line)", color: "var(--ink)", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Download .ics</a>
    </div>
  );
}
