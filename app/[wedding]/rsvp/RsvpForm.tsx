"use client";

import { useState } from "react";

export function RsvpForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [attending, setAttending] = useState<"yes" | "no">("yes");
  const [meal, setMeal] = useState("");
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/wedding/${encodeURIComponent(slug)}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          attending: attending === "yes",
          meal: meal.trim() || null,
          plus_one: plusOne,
          plus_one_name: plusOne ? (plusOneName.trim() || null) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Something went wrong.");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">💌</div>
        <h2 className="text-xl" style={{ fontFamily: "var(--font-serif)" }}>Thank you, {name.trim()}!</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
          {attending === "yes"
            ? "Your RSVP is in — we can't wait to celebrate with you."
            : "Thanks for letting us know — you'll be missed!"}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="First & last name"
          className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base outline-none focus:border-[var(--poppy)]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium">Will you be attending?</label>
        <div className="grid grid-cols-2 gap-2">
          {(["yes", "no"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAttending(v)}
              className="rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
              style={
                attending === v
                  ? { background: "var(--poppy)", color: "#fff", borderColor: "var(--poppy)" }
                  : { background: "#fff", color: "var(--ink-2)", borderColor: "#d6d3d1" }
              }
            >
              {v === "yes" ? "Joyfully accept" : "Regretfully decline"}
            </button>
          ))}
        </div>
      </div>

      {attending === "yes" && (
        <>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Meal choice <span className="font-normal text-stone-400">(optional)</span></label>
            <input
              value={meal}
              onChange={(e) => setMeal(e.target.value)}
              placeholder="e.g. Chicken, Vegetarian, no allergies"
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base outline-none focus:border-[var(--poppy)]"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={plusOne}
                onChange={(e) => setPlusOne(e.target.checked)}
                className="h-4 w-4 accent-[var(--poppy)]"
              />
              I&apos;m bringing a plus one
            </label>
            {plusOne && (
              <input
                value={plusOneName}
                onChange={(e) => setPlusOneName(e.target.value)}
                placeholder="Plus one's name (optional)"
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base outline-none focus:border-[var(--poppy)]"
              />
            )}
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full rounded-full px-6 py-3.5 text-base font-semibold text-white transition-opacity disabled:opacity-60"
        style={{ background: "var(--poppy)" }}
      >
        {status === "saving" ? "Sending…" : "Send RSVP"}
      </button>
    </form>
  );
}
