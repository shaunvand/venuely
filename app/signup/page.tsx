"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function UserIcon() {
  return <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden><circle cx="12" cy="8" r="3.5" {...ICON} /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" {...ICON} /></svg>;
}
function MailIcon() {
  return <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" {...ICON} /><path d="M3 7l9 6 9-6" {...ICON} /></svg>;
}
function LockIcon() {
  return <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden><rect x="4" y="11" width="16" height="9" rx="2" {...ICON} /><path d="M8 11V8a4 4 0 018 0v3" {...ICON} /></svg>;
}
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" {...ICON} />
      <circle cx="12" cy="12" r="3" {...ICON} />
      {off && <path d="M4 4l16 16" {...ICON} />}
    </svg>
  );
}

function Wordmark() {
  return (
    <div className="text-center anim-fade-up">
      <Link href="/" className="inline-block font-serif leading-none" style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.04em", fontSize: "clamp(2.6rem, 7vw, 3.6rem)" }}>
        Venuely.
      </Link>
      <div className="mt-1.5 text-center" style={{ color: "var(--ink-2)", textTransform: "uppercase", letterSpacing: "0.26em", fontWeight: 600, fontSize: "0.72rem" }}>
        Weddings Made Easy
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center justify-center gap-3 mt-8" aria-hidden style={{ color: "var(--sage)" }}>
      <span className="h-px w-16" style={{ background: "var(--line)" }} />
      <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M12 21s-7-4.5-9.5-9A5 5 0 0112 5a5 5 0 019.5 7C19 16.5 12 21 12 21z" fill="currentColor" opacity="0.65" /></svg>
      <span className="h-px w-16" style={{ background: "var(--line)" }} />
    </div>
  );
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: { full_name: fullName },
      },
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
    } else if (data.user) {
      router.push(`/signup/check-email?email=${encodeURIComponent(email)}&name=${encodeURIComponent(fullName)}`);
    }
  }

  const fieldWrap = "relative";
  const inputStyle: React.CSSProperties = { paddingLeft: "2.5rem", paddingTop: "0.7rem", paddingBottom: "0.7rem" };

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--cream)" }}>
      <div className="w-full max-w-md">
        <Wordmark />

        <form onSubmit={handleSubmit} className="mt-9 anim-fade-up">
          <h1 className="vy-h1" style={{ fontSize: "2.1rem" }}>List your venue on Venuely</h1>
          <p className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>
            For wedding-venue owners and managers. No monthly fee — we take 0.5% of wedding spend when couples book through your portal. Couples get invited by you afterwards.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="vy-label">Your full name</label>
              <div className={fieldWrap}>
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-2)" }}><UserIcon /></span>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="vy-input" style={inputStyle} placeholder="Jane Smith" />
              </div>
            </div>

            <div>
              <label className="vy-label">Work email</label>
              <div className={fieldWrap}>
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-2)" }}><MailIcon /></span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="vy-input" style={inputStyle} placeholder="you@yourvenue.co.za" />
              </div>
            </div>

            <div>
              <label className="vy-label">Password</label>
              <div className={fieldWrap}>
                <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-2)" }}><LockIcon /></span>
                <input type={showPw ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="vy-input" style={{ ...inputStyle, paddingRight: "2.75rem" }} placeholder="Min 8 characters" />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 press" style={{ color: "var(--ink-2)" }}>
                  <EyeIcon off={showPw} />
                </button>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="vy-btn vy-btn-primary w-full justify-center mt-5" style={{ padding: "0.8rem 1rem", fontSize: "0.95rem" }}>
            {loading ? "…" : "Get started"}
          </button>

          {msg && <p className="text-sm mt-4" style={{ color: "#a3210e" }}>{msg}</p>}

          <p className="text-sm mt-4" style={{ color: "var(--ink-2)" }}>
            Already have a Venuely account?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "var(--poppy)" }}>Sign in</Link>
          </p>
        </form>

        <Divider />

        <p className="text-xs text-center mt-6 max-w-sm mx-auto leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Couples: you don&apos;t sign up here. Your venue will email you an invitation with a private portal link.
        </p>
      </div>
    </main>
  );
}
