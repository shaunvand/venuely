"use client";

import { useState } from "react";
import { inviteManager, type InviteManagerResult } from "./actions";

// Client wrapper around the inviteManager server action so we can surface the
// generated join link (handy when email isn't configured) and a friendly
// status without a full page navigation.
export function InviteManagerForm() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<InviteManagerResult | null>(null);
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    const fd = new FormData();
    fd.set("email", email);
    try {
      const r = await inviteManager(fd);
      setResult(r);
      if (r.ok) setEmail("");
    } catch (err) {
      setResult({ ok: false, url: "", emailSent: false, error: (err as Error).message || "Something went wrong." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="vy-card">
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="vy-label" htmlFor="invite-email">Invite a manager</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="manager@yourvenue.co.za"
            className="vy-input"
            required
          />
        </div>
        <button type="submit" disabled={pending} className="vy-btn vy-btn-primary disabled:opacity-60">
          {pending ? "Sending…" : "Send invite"}
        </button>
      </form>

      {result && (
        <div className="mt-3 text-sm">
          {result.ok ? (
            <div
              className="rounded-lg p-3"
              style={{ background: "var(--cream)", color: "var(--ink-2)" }}
            >
              {result.emailSent ? (
                <p>Invitation emailed. They&apos;ll join your venue team once they accept it.</p>
              ) : (
                <p>
                  Invite created
                  {result.reason === "email_not_configured" ? " (email isn't set up yet — share this link)" : ""}:
                </p>
              )}
              {!result.emailSent && result.url && (
                <code className="block mt-1.5 break-all text-xs" style={{ color: "var(--poppy)" }}>
                  {result.url}
                </code>
              )}
            </div>
          ) : (
            <p style={{ color: "#b03a2e" }}>{result.error || "Could not send the invite."}</p>
          )}
        </div>
      )}
    </div>
  );
}
