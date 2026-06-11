import { createClient as createAdmin } from "@supabase/supabase-js";
import { SupplierThreadChat } from "@/components/SupplierThreadChat";

export const dynamic = "force-dynamic";

// Tokenised supplier chat page — the reply_token in the URL is the only
// credential (no login). Initial load fetches server-side with the service-role
// client; the client component only talks to /api/supplier/thread/[token] to send.

function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null;
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// "Sarah & Tom Smith" → "Sarah & Tom" — suppliers only ever see first names.
function firstNames(coupleNames: string | null | undefined): string {
  const parts = String(coupleNames || "").split(/\s*(?:&|\+|\band\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  const firsts = parts.map((p) => p.split(/\s+/)[0]).filter(Boolean);
  return firsts.join(" & ") || "the couple";
}

function Expired() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#FFF6F0", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", border: "1px solid rgba(0,0,0,0.06)", maxWidth: 440, width: "100%" }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 900, fontSize: 24, color: "#1c1917", marginBottom: 12 }}>Venuely<span style={{ color: "#FA523C" }}>.</span></div>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, margin: "0 0 8px", color: "#1c1917" }}>This link has expired</h1>
        <p style={{ color: "#57534e", fontSize: 14, margin: 0 }}>
          This conversation link is no longer valid — it may have been mistyped or replaced.
          Check your most recent Venuely email for a fresh link.
        </p>
      </div>
    </div>
  );
}

export default async function SupplierThreadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = admin();
  if (!db || !/^[0-9a-f]{16,}$/i.test(token)) return <Expired />;

  const { data: thread } = await db.from("message_threads")
    .select("id, venue_id, wedding_id, supplier_name, status")
    .eq("reply_token", token).maybeSingle();
  if (!thread) return <Expired />;

  const [{ data: venue }, { data: wedding }, { data: messages }] = await Promise.all([
    db.from("venues").select("name").eq("id", thread.venue_id).single(),
    db.from("weddings").select("couple_names, wedding_date").eq("id", thread.wedding_id).single(),
    db.from("thread_messages")
      .select("id, sender, body, flagged, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <SupplierThreadChat
      token={token}
      thread={{
        supplierName: thread.supplier_name,
        venueName: venue?.name ?? null,
        coupleNames: firstNames(wedding?.couple_names),
        weddingDate: wedding?.wedding_date ?? null,
        status: thread.status,
        messages: (messages ?? []).map((m) => ({
          id: m.id, sender: m.sender, body: m.body, flagged: m.flagged, createdAt: m.created_at,
        })),
      }}
    />
  );
}
