"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/dashboard";
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
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
        },
      });
      setMsg(error ? { tone: "error", text: error.message } : { tone: "info", text: "Check your inbox for the magic link." });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ tone: "error", text: error.message });
      } else {
        router.push(redirect);
        router.refresh();
      }
    }
    setLoading(false);
  }

  const tab = (active: boolean): React.CSSProperties =>
    active
      ? { background: "var(--poppy)", color: "#fff", borderColor: "var(--poppy)" }
      : { background: "#fff", color: "var(--ink-2)", borderColor: "var(--line)" };

  return (
    <div className="w-full max-w-md anim-fade-up">
      {/* Brand lockup */}
      <Link href="/" className="flex items-center gap-2.5 mb-6 justify-center">
        <LogoMark size={34} />
        <span className="font-serif text-2xl" style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}>
          Venuely.
        </span>
      </Link>

      <div className="vy-card" style={{ padding: "1.6rem 1.6rem 1.8rem" }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h1 className="vy-h1" style={{ fontSize: "1.9rem" }}>Sign in to Venuely</h1>
            <p className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>
              Venues use a password. Couples should use the magic-link option after their venue invites them.
            </p>
          </div>

          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setMode("password")}
              className="px-4 py-1.5 rounded-full font-medium border transition press"
              style={tab(mode === "password")}
            >
              Venue staff
            </button>
            <button
              type="button"
              onClick={() => setMode("magic")}
              className="px-4 py-1.5 rounded-full font-medium border transition press"
              style={tab(mode === "magic")}
            >
              Couple (email link)
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="vy-label">Email</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="vy-input"
              />
            </div>

            {mode === "password" && (
              <div>
                <label className="vy-label">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="vy-input"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="vy-btn vy-btn-primary w-full justify-center"
            style={{ padding: "0.7rem 1rem", fontSize: "0.95rem" }}
          >
            {loading ? "…" : mode === "magic" ? "Send magic link" : "Sign in"}
          </button>

          {msg && (
            <div
              role={msg.tone === "error" ? "alert" : "status"}
              className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
              style={
                msg.tone === "error"
                  ? { background: "#fde2dd", color: "#a3210e", border: "1px solid var(--line)" }
                  : { background: "var(--leaf)", color: "#1f5d3e", border: "1px solid var(--line)" }
              }
            >
              <span className="leading-none mt-0.5">{msg.tone === "error" ? "⚠" : "✓"}</span>
              <span className="flex-1">{msg.text}</span>
            </div>
          )}

          <p className="text-sm pt-1" style={{ color: "var(--ink-2)" }}>
            No account?{" "}
            <Link href="/signup" className="font-medium" style={{ color: "var(--poppy)" }}>
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(180deg, #FCE7DA 0%, var(--cream) 360px)" }}
    >
      <Suspense fallback={<div style={{ color: "var(--ink-2)" }}>Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
