"use client";

import { useState } from "react";

type Props = {
  venueId: string;
  venueName: string;
  /** Pre-fills the source field so the venue knows where the lead came from. */
  source?: string;
};

type Status = "idle" | "sending" | "done" | "error";

export function EnquiryForm({ venueId, venueName, source = "listing" }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    couple_name: "",
    email: "",
    phone: "",
    event_date: "",
    guest_count: "",
    message: "",
    consent: false,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.couple_name.trim() || !form.email.trim()) {
      setError("Please add your name and email so the venue can reply.");
      return;
    }
    if (!form.consent) {
      setError("Please tick the consent box so we can pass your enquiry on.");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id: venueId,
          couple_name: form.couple_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          event_date: form.event_date || null,
          guest_count: form.guest_count ? Number(form.guest_count) : null,
          message: form.message.trim() || null,
          consent: form.consent,
          source,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setError(j.error || "Something went wrong — please try again.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "var(--cream)", border: "1px solid var(--line)" }}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
          style={{ background: "var(--leaf)", color: "#1f5d3e" }}
        >
          ✓
        </div>
        <h3 className="font-serif text-2xl" style={{ color: "var(--ink)" }}>
          Enquiry sent!
        </h3>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
          Thanks — {venueName} has your details and will be in touch soon about your day.
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--line)",
    background: "#fff",
    borderRadius: 10,
    padding: "0.65rem 0.85rem",
    fontSize: "0.95rem",
    color: "var(--ink)",
    width: "100%",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--ink-2)",
    marginBottom: "0.3rem",
    display: "block",
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label style={labelStyle}>Your name(s) *</label>
          <input
            value={form.couple_name}
            onChange={(e) => set("couple_name", e.target.value)}
            placeholder="Alex & Sam"
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@email.com"
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="082 000 0000"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Preferred date</label>
          <input
            type="date"
            value={form.event_date}
            onChange={(e) => set("event_date", e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Guest count</label>
          <input
            type="number"
            min={0}
            value={form.guest_count}
            onChange={(e) => set("guest_count", e.target.value)}
            placeholder="120"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Tell them about your day</label>
        <textarea
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          placeholder="We're hoping for an outdoor ceremony in autumn…"
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <label className="flex items-start gap-3 text-sm" style={{ color: "var(--ink-2)" }}>
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => set("consent", e.target.checked)}
          className="mt-0.5"
          style={{ accentColor: "var(--poppy)", width: 18, height: 18, flexShrink: 0 }}
        />
        <span>
          I agree that Venuely &amp; {venueName} may contact me about my enquiry. (POPIA)
        </span>
      </label>

      {error && (
        <p className="text-sm" style={{ color: "var(--poppy-deep)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-lg px-6 py-3.5 font-medium text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        style={{ background: "var(--poppy)" }}
      >
        {status === "sending" ? "Sending…" : "Request a quote"}
      </button>
    </form>
  );
}
