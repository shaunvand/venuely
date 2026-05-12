import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = data?.role ?? null;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-4xl font-semibold">Venuely</h1>
        <p className="text-gray-600">
          The wedding-venue platform for South Africa.
        </p>

        {!user ? (
          <div className="flex gap-3 justify-center">
            <Link href="/login" className="px-4 py-2 bg-black text-white rounded">Sign in</Link>
            <Link href="/signup" className="px-4 py-2 border rounded">Sign up</Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Signed in as <span className="font-mono">{user.email}</span> · role: <b>{role || "unknown"}</b>
            </p>
            <div className="flex gap-3 justify-center">
              {role === "owner" && <Link href="/owner" className="px-4 py-2 bg-black text-white rounded">Owner</Link>}
              {(role === "owner" || role === "venue_admin") && <Link href="/venue" className="px-4 py-2 border rounded">Venue</Link>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
