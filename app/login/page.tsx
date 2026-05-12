"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/";
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
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
      setMsg(error ? error.message : "Check your inbox for the magic link.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
      } else {
        router.push(redirect);
        router.refresh();
      }
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Sign in to Venuely</h1>

      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`px-3 py-1 rounded ${mode === "password" ? "bg-black text-white" : "bg-gray-100"}`}
        >
          Venue staff
        </button>
        <button
          type="button"
          onClick={() => setMode("magic")}
          className={`px-3 py-1 rounded ${mode === "magic" ? "bg-black text-white" : "bg-gray-100"}`}
        >
          Couple (email link)
        </button>
      </div>

      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />

      {mode === "password" && (
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
      >
        {loading ? "..." : mode === "magic" ? "Send link" : "Sign in"}
      </button>

      {msg && <p className="text-sm text-gray-600">{msg}</p>}

      <p className="text-sm text-gray-500">
        No account? <Link href="/signup" className="underline">Sign up</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
