"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function MailIcon() {
  return <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" {...ICON} /><path d="M3 7l9 6 9-6" {...ICON} /></svg>;
}
function LockIcon() {
  return <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden><rect x="4" y="11" width="16" height="9" rx="2" {...ICON} /><path d="M8 11V8a4 4 0 018 0v3" {...ICON} /></svg>;
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

const TRUST = [
  { title: "Secure & reliable", body: "Your data is safe with enterprise-grade security.", icon: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" {...ICON} /><path d="M9 12l2 2 4-4" {...ICON} /></> },
  { title: "Built for venues", body: "Manage bookings, events, and enquiries all in one beautiful place.", icon: <><rect x="3" y="4" width="18" height="17" rx="2" {...ICON} /><path d="M3 9h18M8 2v4M16 2v4" {...ICON} /></> },
  { title: "Loved by venues", body: "Join hundreds of venues delivering unforgettable weddings.", icon: <path d="M12 3l2.6 5.6 6 .8-4.4 4.1 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z" {...ICON} /> },
];

function TrustBar() {
  return (
    <footer className="border-t mt-12" style={{ borderColor: "var(--line)", background: "rgba(255,255,255,0.4)" }}>
      <div className="max-w-3xl mx-auto px-6 py-8 grid sm:grid-cols-3 gap-6">
        {TRUST.map((t) => (
          <div key={t.title} className="flex flex-col items-center text-center sm:items-start sm:text-left gap-2">
            <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--peach)", color: "var(--poppy-deep)" }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>{t.icon}</svg>
            </span>
            <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{t.title}</div>
            <div className="text-xs leading-relaxed" style={{ color: "var(--ink-2)" }}>{t.body}</div>
          </div>
        ))}
      </div>
    </footer>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Only honour same-origin path redirects ("/foo", not "//evil.com" or "https://…").
  const rawRedirect = params.get("redirect") || "/dashboard";
  const redirect = /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : "/dashboard";
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(() =>
    params.get("error") === "callback_failed"
      ? { tone: "error", text: "That link expired or was already used — sign in or request a new one." }
      : null
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const supabase = createClient();

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          // Login must never mint a new (venue-less) user — that's signup's job.
          shouldCreateUser: false,
        },
      });
      if (error) {
        // With shouldCreateUser:false, Supabase rejects unknown emails with a
        // "Signups not allowed…" / user-not-found style error.
        const noAccount = /signups? not allowed|user not found|otp_disabled/i.test(`${error.message} ${error.code ?? ""}`);
        setMsg({ tone: "error", text: noAccount ? "No account found for that email — sign up first." : error.message });
      } else {
        setMsg({ tone: "info", text: "Check your inbox for the magic link." });
      }
      setLoading(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ tone: "error", text: error.message });
        setLoading(false);
      } else {
        // Keep the button disabled while we navigate — don't re-enable and invite
        // a double submit during the route transition.
        router.push(redirect);
        router.refresh();
      }
    }
  }

  const seg = (active: boolean): React.CSSProperties =>
    active
      ? { background: "var(--ink)", color: "#fff" }
      : { background: "transparent", color: "var(--ink-2)" };

  return (
    <div className="mt-10 anim-fade-up">
      <h1 className="vy-h1" style={{ fontSize: "2rem" }}>Sign in to Venuely</h1>
      <p className="text-sm mt-2 max-w-md" style={{ color: "var(--ink-2)" }}>
        Venues use a password. Couples should use the magic-link option after their venue invites them.
      </p>

      {/* Segmented toggle */}
      <div className="inline-flex gap-1 p-1 rounded-full mt-5" style={{ background: "var(--bone)", border: "1px solid var(--line)" }}>
        <button type="button" onClick={() => setMode("password")} className="px-4 py-1.5 rounded-full text-sm font-medium transition press" style={seg(mode === "password")}>
          Venue staff
        </button>
        <button type="button" onClick={() => setMode("magic")} className="px-4 py-1.5 rounded-full text-sm font-medium transition press" style={seg(mode === "magic")}>
          Couple (email link)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-2)" }}><MailIcon /></span>
          <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="vy-input" style={{ paddingLeft: "2.5rem", paddingTop: "0.7rem", paddingBottom: "0.7rem" }} />
        </div>

        {mode === "password" && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-2)" }}><LockIcon /></span>
            <input type="password" required placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className="vy-input" style={{ paddingLeft: "2.5rem", paddingTop: "0.7rem", paddingBottom: "0.7rem" }} />
          </div>
        )}

        <button type="submit" disabled={loading} className="vy-btn vy-btn-primary w-full justify-center" style={{ padding: "0.8rem 1rem", fontSize: "0.95rem" }}>
          {loading ? "…" : mode === "magic" ? "Send magic link" : "Sign in"}
        </button>
      </form>

      {msg && (
        <p className="text-sm mt-4" style={{ color: msg.tone === "error" ? "#a3210e" : "#1f5d3e" }}>
          {msg.text}
        </p>
      )}

      <p className="text-sm mt-4" style={{ color: "var(--ink-2)" }}>
        No account?{" "}
        <Link href="/signup" className="font-semibold" style={{ color: "var(--poppy)" }}>Sign up</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--cream)" }}>
      <div className="flex-1 w-full max-w-md mx-auto px-6 pt-14 pb-6">
        <Wordmark />
        <Suspense fallback={<div className="mt-10" style={{ color: "var(--ink-2)" }}>Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
      <TrustBar />
    </main>
  );
}
