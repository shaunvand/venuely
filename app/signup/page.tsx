"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  // Team-invite token (a manager being added to a venue). It must ride along on the
  // confirmation email's callback URL so /auth/callback can redeem it — otherwise the
  // invitee lands in onboarding and creates a duplicate venue.
  const venueInvite = params.get("venue_invite");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setAlreadyRegistered(false);
    const supabase = createClient();

    let callbackUrl = `${window.location.origin}/auth/callback?next=/dashboard`;
    if (venueInvite) callbackUrl += `&venue_invite=${encodeURIComponent(venueInvite)}`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl,
        data: { full_name: fullName },
      },
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
    } else if (data.user && data.user.identities?.length === 0) {
      // Supabase returns an obfuscated user with no identities when the email is
      // already registered — don't send them to check-email (no email is coming).
      setAlreadyRegistered(true);
      setLoading(false);
    } else if (data.user) {
      const qs = new URLSearchParams({ email, name: fullName });
      if (venueInvite) qs.set("venue_invite", venueInvite);
      router.push(`/signup/check-email?${qs.toString()}`);
    } else {
      setLoading(false);
      setMsg("Something went wrong — please try again.");
    }
  }

  const fieldWrap = "relative";
  const inputStyle: React.CSSProperties = { paddingLeft: "2.5rem", paddingTop: "0.7rem", paddingBottom: "0.7rem" };

  return (
    <>
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
          {alreadyRegistered && (
            <p className="text-sm mt-4" style={{ color: "#a3210e" }}>
              You already have an account —{" "}
              <Link href="/login" className="font-semibold underline" style={{ color: "var(--poppy)" }}>sign in instead</Link>
              {" "}or{" "}
              <Link href="/forgot-password" className="font-semibold underline" style={{ color: "var(--poppy)" }}>reset your password</Link>.
            </p>
          )}

          <p className="text-sm mt-4" style={{ color: "var(--ink-2)" }}>
            Already have a Venuely account?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "var(--poppy)" }}>Sign in</Link>
            {" "}·{" "}
            <Link href="/forgot-password" className="font-semibold" style={{ color: "var(--poppy)" }}>Forgot password?</Link>
          </p>
        </form>

        <p className="text-xs text-center mt-8 max-w-sm mx-auto leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Couples: you don&apos;t sign up here. Your venue will email you an invitation with a private portal link.
        </p>
    </>
  );
}

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--cream)" }}>
      <div className="w-full max-w-md">
        <Wordmark />
        {/* useSearchParams (venue_invite passthrough) requires a Suspense boundary. */}
        <Suspense fallback={<div className="mt-9" style={{ color: "var(--ink-2)" }}>Loading…</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </main>
  );
}
