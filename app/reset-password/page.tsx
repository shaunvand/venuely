"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function LockIcon() {
  return <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden><rect x="4" y="11" width="16" height="9" rx="2" {...ICON} /><path d="M8 11V8a4 4 0 018 0v3" {...ICON} /></svg>;
}
function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" {...ICON} />
      <circle cx="12" cy="12" r="2.5" {...ICON} />
      {off && <path d="M4 4l16 16" {...ICON} />}
    </svg>
  );
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

// Landed on from the recovery-email link via /auth/callback?redirect=/reset-password —
// the callback's code exchange leaves the user signed in, so updateUser works here.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMsg("Those passwords don't match.");
      return;
    }
    setLoading(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg(error.message);
      setLoading(false);
    } else {
      setDone(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1200);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--cream)" }}>
      <div className="w-full max-w-md">
        <Wordmark />
        <div className="mt-9 anim-fade-up">
          <h1 className="vy-h1" style={{ fontSize: "2rem" }}>Choose a new password</h1>

          {checking ? (
            <p className="text-sm mt-4" style={{ color: "var(--ink-2)" }}>Checking your link…</p>
          ) : done ? (
            <p className="text-sm mt-4" style={{ color: "#1f5d3e" }}>
              Password updated ✓ — taking you to your dashboard…
            </p>
          ) : !hasSession ? (
            <div className="mt-4">
              <p className="text-sm" style={{ color: "#a3210e" }}>
                This reset link has expired or was already used.
              </p>
              <p className="text-sm mt-3" style={{ color: "var(--ink-2)" }}>
                <Link href="/forgot-password" className="font-semibold underline" style={{ color: "var(--poppy)" }}>
                  Request a new reset link
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>
                Minimum 8 characters. You&apos;ll be signed in once it&apos;s saved.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-2)" }}><LockIcon /></span>
                  <input type={showPw ? "text" : "password"} required minLength={8} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className="vy-input" style={{ paddingLeft: "2.5rem", paddingRight: "2.75rem", paddingTop: "0.7rem", paddingBottom: "0.7rem" }} />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 press" style={{ color: "var(--ink-2)" }}>
                    <EyeIcon off={showPw} />
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-2)" }}><LockIcon /></span>
                  <input type={showPw ? "text" : "password"} required minLength={8} placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="vy-input" style={{ paddingLeft: "2.5rem", paddingTop: "0.7rem", paddingBottom: "0.7rem" }} />
                </div>
                <button type="submit" disabled={loading} className="vy-btn vy-btn-primary w-full justify-center" style={{ padding: "0.8rem 1rem", fontSize: "0.95rem" }}>
                  {loading ? "…" : "Save new password"}
                </button>
              </form>
              {msg && <p className="text-sm mt-4" style={{ color: "#a3210e" }}>{msg}</p>}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
