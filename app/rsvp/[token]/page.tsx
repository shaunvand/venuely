import { createClient as createAdmin } from "@supabase/supabase-js";
import { RsvpForm } from "@/components/RsvpForm";

export const dynamic = "force-dynamic";

// Public, white-label RSVP page. The form fetches its data client-side from
// /api/rsvp/[token] (the token is the only credential). This shell additionally:
//  - validates the token server-side so a bad link gets a clear message;
//  - supports one-tap links from invite emails: ?response=attending|declined
//    records that response immediately and shows a confirmation state.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null;
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const page: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif", padding: 24, background: "#FFF8F3" };
const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", border: "1px solid rgba(0,0,0,0.06)", maxWidth: 440, width: "100%" };

function InvalidLink() {
  return (
    <div style={page}>
      <div style={cardStyle}>
        <div style={{ fontSize: 40 }}>🔗</div>
        <h1 style={{ fontFamily: "Georgia,serif", fontSize: 22, margin: "10px 0 6px", color: "#1c1917" }}>This link isn&apos;t valid</h1>
        <p style={{ color: "#57534e", fontSize: 14, margin: 0 }}>This RSVP link doesn&apos;t match an invitation — it may have been mistyped or replaced. Please check with the couple for a fresh link.</p>
      </div>
    </div>
  );
}

function Confirmation({ name, response, token }: { name: string; response: "attending" | "declined"; token: string }) {
  const attending = response === "attending";
  return (
    <div style={page}>
      <div style={cardStyle}>
        <div style={{ fontSize: 44 }}>{attending ? "🎉" : "💌"}</div>
        <h1 style={{ fontFamily: "Georgia,serif", fontSize: 24, margin: "10px 0 6px", color: "#1c1917" }}>{attending ? "You're in!" : "Thank you for letting us know"}</h1>
        <p style={{ color: "#57534e", fontSize: 14 }}>
          Hi {name.split(" ")[0]}, we&apos;ve recorded your response: <b>{attending ? "joyfully accepting" : "regretfully declining"}</b>.
        </p>
        <a href={`/rsvp/${token}`} style={{ display: "inline-block", marginTop: 10, color: "#FA523C", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
          {attending ? "Add dietary needs, party size or a note →" : "Change my response →"}
        </a>
      </div>
    </div>
  );
}

export default async function RsvpPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const raw = Array.isArray(sp.response) ? sp.response[0] : sp.response;
  const response = raw === "attending" || raw === "declined" ? raw : null;

  const db = admin();
  if (db) {
    // Validate the token server-side so a bad link gets a clear message instead
    // of an empty shell.
    if (!UUID.test(token)) return <InvalidLink />;
    const { data: guest } = await db.from("guests").select("id, full_name").eq("rsvp_token", token).maybeSingle();
    if (!guest) return <InvalidLink />;

    // One-tap accept/decline from the invite email: record it and confirm.
    if (response) {
      const { error } = await db.from("guests")
        .update({ rsvp_status: response, responded_at: new Date().toISOString() })
        .eq("id", guest.id);
      if (!error) return <Confirmation name={guest.full_name} response={response} token={token} />;
    }
  }

  // Full form (also the fallback when the service key is absent — the form
  // itself surfaces invalid tokens via /api/rsvp/[token]).
  return <RsvpForm token={token} />;
}
