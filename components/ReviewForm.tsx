"use client";

import { useState } from "react";

type Props = {
  venueId: string;
  venueName: string;
};

type Status = "idle" | "sending" | "done" | "error";

export function ReviewForm({ venueId, venueName }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    author_name: "",
    rating: 5,
    body: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.author_name.trim()) {
      setError("Please add your name so the venue knows who's reviewing.");
      return;
    }
    if (!form.body.trim()) {
      setError("Please write a few words about your experience.");
      return;
    }
    if (form.rating < 1 || form.rating > 5) {
      setError("Please pick a star rating.");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id: venueId,
          author_name: form.author_name.trim(),
          rating: form.rating,
          body: form.body.trim(),
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
        className="rounded-2xl p-6 text-center"
        style={{ background: "var(--cream)", border: "1px solid var(--line)" }}
      >
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ background: "var(--sage-2)", color: "var(--ink)" }}
        >
          ♥
        </div>
        <h3 className="font-serif text-xl" style={{ color: "var(--ink)" }}>
          Thank you!
        </h3>
        <p className="mt-1.5 text-sm" style={{ color: "var(--ink-2)" }}>
          Your review has been sent to {venueName}. Once they approve it, it&apos;ll appear here for
          other couples to see.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.99]"
        style={{ border: "1.5px solid var(--poppy)", color: "var(--poppy)" }}
      >
        ★ Leave a review
      </button>
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
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl bg-white p-5"
      style={{ border: "1px solid var(--line)" }}
    >
      <h3 className="font-serif text-xl" style={{ color: "var(--ink)" }}>
        Share your experience
      </h3>

      <div>
        <label style={labelStyle}>Your name *</label>
        <input
          value={form.author_name}
          onChange={(e) => set("author_name", e.target.value)}
          placeholder="Alex & Sam"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Rating *</label>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={form.rating >= n}
              onClick={() => set("rating", n)}
              className="text-2xl leading-none transition-transform hover:scale-110"
              style={{ color: form.rating >= n ? "var(--poppy)" : "var(--line)", background: "none", padding: 0 }}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Your review *</label>
        <textarea
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          placeholder={`We had the most magical day at ${venueName}…`}
          rows={4}
          required
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--poppy-deep)" }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-lg px-6 py-3 font-medium text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          style={{ background: "var(--poppy)" }}
        >
          {status === "sending" ? "Sending…" : "Submit review"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm hover:opacity-60"
          style={{ color: "var(--ink-2)" }}
        >
          Cancel
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--ink-2)" }}>
        Reviews are checked by {venueName} before appearing publicly.
      </p>
    </form>
  );
}
