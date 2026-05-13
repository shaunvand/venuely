"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

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
    } else if (data.user) {
      setOk(true);
      setMsg("Check your inbox to confirm your email. Once confirmed you'll land in your new venue dashboard.");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5">
        <Link href="/" className="block"><Logo /></Link>

        <div>
          <h1 className="font-serif text-3xl">List your venue on Venuely</h1>
          <p className="text-stone-600 text-sm mt-2">
            For wedding-venue owners and managers. 14-day free trial — no card. Couples get invited by you afterwards.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Your full name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Jane Smith"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Work email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="you@yourvenue.co.za"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Min 8 characters"
          />
        </div>

        <button
          type="submit"
          disabled={loading || ok}
          className="w-full bg-stone-900 text-white rounded py-2.5 font-medium disabled:opacity-50"
        >
          {loading ? "..." : ok ? "Check your email" : "Start free trial"}
        </button>

        {msg && (
          <p className={`text-sm ${ok ? "text-emerald-700" : "text-red-600"}`}>{msg}</p>
        )}

        <p className="text-sm text-stone-500">
          Already have a Venuely account? <Link href="/login" className="underline">Sign in</Link>
        </p>
        <p className="text-xs text-stone-400">
          Couples: you don&apos;t sign up here. Your venue will email you an invitation with a private portal link.
        </p>
      </form>
    </main>
  );
}
