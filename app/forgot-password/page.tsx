"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function MailIcon() {
  return <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" {...ICON} /><path d="M3 7l9 6 9-6" {...ICON} /></svg>;
}

function Wordmark() {
  return (
    <div className="text-center anim-fade-up">
      <Link href="/" className="inline-block font-serif leading-none" style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.04em", fontSize: "clamp(3.5rem, 9vw, 5.5rem)" }}>
        Venuely.
      </Link>
      <div className="mt-2 text-center" style={{ color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.28em", fontWeight: 600, fontSize: "0.8rem" }}>
        Weddings Made Easy
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect=/reset-password`,
    });
    setLoading(false);
    if (error) {
      // Rate limits etc. — anything but enumeration-safe success.
      setMsg(error.message);
    } else {
      // Supabase succeeds whether or not the account exists — keep it that way.
      setSent(true);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--cream)" }}>
      <div className="w-full max-w-md">
        <Wordmark />
        <div className="mt-9 anim-fade-up">
          <h1 className="vy-h1" style={{ fontSize: "2rem" }}>Reset your password</h1>

          {sent ? (
            <div className="mt-5">
              <p className="text-sm leading-relaxed" style={{ color: "#1f5d3e" }}>
                If an account exists for <span className="font-semibold">{email}</span>, a reset link is on its way.
                Open it on this device to choose a new password.
              </p>
              <p className="text-sm mt-4" style={{ color: "var(--ink-2)" }}>
                Nothing arriving? Check spam, or{" "}
                <button type="button" onClick={() => setSent(false)} className="font-semibold underline press" style={{ color: "var(--poppy)" }}>
                  try a different email
                </button>.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>
                Enter the email you signed up with and we&apos;ll send you a link to choose a new password.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-2)" }}><MailIcon /></span>
                  <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="vy-input" style={{ paddingLeft: "2.5rem", paddingTop: "0.7rem", paddingBottom: "0.7rem" }} />
                </div>
                <button type="submit" disabled={loading} className="vy-btn vy-btn-primary w-full justify-center" style={{ padding: "0.8rem 1rem", fontSize: "0.95rem" }}>
                  {loading ? "…" : "Send reset link"}
                </button>
              </form>
              {msg && <p className="text-sm mt-4" style={{ color: "#a3210e" }}>{msg}</p>}
            </>
          )}

          <p className="text-sm mt-6" style={{ color: "var(--ink-2)" }}>
            Remembered it?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "var(--poppy)" }}>Sign in</Link>
            {" "}· New here?{" "}
            <Link href="/signup" className="font-semibold" style={{ color: "var(--poppy)" }}>Sign up</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
