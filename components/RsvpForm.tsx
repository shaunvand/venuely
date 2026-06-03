"use client";

import { useEffect, useState } from "react";

type Data = {
  guest: { full_name: string; rsvp_status: string | null; party_size: number | null; dietary: string | null; rsvp_message: string | null; plus_one: boolean | null; imageUrl: string | null };
  wedding: { couple_names: string; wedding_date: string | null; wedding_end_date: string | null; settings: Settings };
  venue: { name: string | null; region: string | null; address: string | null; theme: Record<string, unknown> | null; logo: string | null } | null;
};
type Settings = { headline?: string; message?: string; accent?: string; primary?: string; cover?: string; deadline?: string; allowPhoto?: boolean; allowParty?: boolean; thankYou?: string; font?: string };

const fmtDate = (s: string | null) => { if (!s) return ""; const d = new Date(`${s.slice(0, 10)}T00:00:00`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };

// White-label guest RSVP page. The couple customises the look (headline/message/
// colours/cover/photo toggle) in their portal; this renders against that and the
// venue's branding, then writes the response straight back to the guest list.
export function RsvpForm({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [party, setParty] = useState("1");
  const [dietary, setDietary] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/rsvp/${token}`).then((r) => r.ok ? r.json() : Promise.reject()).then((j: Data) => {
      setData(j);
      setStatus(j.guest.rsvp_status || "");
      setParty(String(j.guest.party_size || 1));
      setDietary(j.guest.dietary || "");
      setMessage(j.guest.rsvp_message || "");
      if (j.guest.rsvp_status) setDone(true);
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [token]);

  if (loading) return <Center>Loading…</Center>;
  if (notFound || !data) return <Center>This RSVP link isn&apos;t valid. Please check with the couple.</Center>;

  const s = data.wedding.settings || {};
  const theme = (data.venue?.theme || {}) as Record<string, string>;
  const primary = s.primary || theme.primary || "#FA523C";
  const accent = s.accent || theme.accent || "#8a9a86";
  const cover = s.cover || theme.cover || null;
  const couple = data.wedding.couple_names || "Our wedding";
  const headline = s.headline || `${couple}`;
  const dateLabel = fmtDate(data.wedding.wedding_date);

  async function submit() {
    if (!status) return;
    setSaving(true);
    const fd = new FormData();
    fd.append("rsvp_status", status);
    fd.append("party_size", party);
    fd.append("dietary", dietary);
    fd.append("rsvp_message", message);
    if (file) fd.append("image", file);
    const r = await fetch(`/api/rsvp/${token}`, { method: "POST", body: fd });
    setSaving(false);
    if (r.ok) setDone(true);
  }

  const field: React.CSSProperties = { width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, padding: "10px 12px", fontSize: 14, marginTop: 6 };
  const choice = (val: string, label: string, emoji: string) => (
    <button onClick={() => setStatus(val)} style={{ flex: 1, padding: "12px 8px", borderRadius: 12, border: `2px solid ${status === val ? primary : "rgba(0,0,0,0.12)"}`, background: status === val ? `${primary}14` : "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14, color: "#1c1917" }}>
      <div style={{ fontSize: 22 }}>{emoji}</div>{label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FFF8F3", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 56px" }}>
        {/* Hero */}
        <div style={{ position: "relative", borderRadius: 0, overflow: "hidden", margin: "0 -16px 24px", height: cover ? 240 : 150, background: cover ? `center/cover no-repeat url(${cover})` : `linear-gradient(135deg, ${primary}, ${accent})`, display: "flex", alignItems: "flex-end" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.45))" }} />
          <div style={{ position: "relative", color: "#fff", padding: 24 }}>
            {data.venue?.logo && <img src={data.venue.logo} alt="" style={{ height: 36, marginBottom: 8 }} />}
            <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", opacity: 0.9 }}>You&apos;re invited</div>
            <h1 style={{ fontFamily: "Georgia,serif", fontSize: 34, margin: "4px 0 0", lineHeight: 1.1 }}>{headline}</h1>
            {dateLabel && <div style={{ marginTop: 6, opacity: 0.95 }}>{dateLabel}{data.venue?.name ? ` · ${data.venue.name}` : ""}</div>}
          </div>
        </div>

        {done ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 44 }}>{status === "declined" ? "💌" : "🎉"}</div>
            <h2 style={{ fontFamily: "Georgia,serif", fontSize: 24, margin: "8px 0" }}>{s.thankYou || (status === "declined" ? "Thank you for letting us know" : "Thank you for your RSVP!")}</h2>
            <p style={{ color: "#57534e" }}>Hi {data.guest.full_name.split(" ")[0]}, your response has been sent to {couple}.</p>
            <button onClick={() => setDone(false)} style={{ marginTop: 12, background: "transparent", border: "none", color: primary, fontWeight: 600, cursor: "pointer" }}>Change my response</button>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid rgba(0,0,0,0.06)", display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 20 }}>Hi {data.guest.full_name.split(" ")[0]} 👋</div>
              {s.message && <p style={{ color: "#57534e", marginTop: 6, whiteSpace: "pre-wrap" }}>{s.message}</p>}
              {s.deadline && <p style={{ color: primary, fontSize: 13, fontWeight: 600, marginTop: 6 }}>Please respond by {fmtDate(s.deadline)}</p>}
            </div>

            <div>
              <label style={{ fontWeight: 600, fontSize: 14 }}>Will you join us?</label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {choice("attending", "Joyfully accept", "💛")}
                {choice("tentative", "Maybe", "🤔")}
                {choice("declined", "Can't make it", "😢")}
              </div>
            </div>

            {status && status !== "declined" && (
              <>
                {(s.allowParty || data.guest.plus_one) && (
                  <div><label style={{ fontWeight: 600, fontSize: 14 }}>How many in your party?</label><input type="number" min={1} max={20} value={party} onChange={(e) => setParty(e.target.value)} style={field} /></div>
                )}
                <div><label style={{ fontWeight: 600, fontSize: 14 }}>Dietary requirements <span style={{ color: "#a0a0a0", fontWeight: 400 }}>(optional)</span></label><input value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="e.g. vegetarian, halal, nut allergy" style={field} /></div>
                {s.allowPhoto && (
                  <div><label style={{ fontWeight: 600, fontSize: 14 }}>Share a photo or memory <span style={{ color: "#a0a0a0", fontWeight: 400 }}>(optional)</span></label><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ ...field, padding: 8 }} /></div>
                )}
              </>
            )}

            <div><label style={{ fontWeight: 600, fontSize: 14 }}>A note to the couple <span style={{ color: "#a0a0a0", fontWeight: 400 }}>(optional)</span></label><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Send your love…" style={{ ...field, resize: "vertical" }} /></div>

            <button onClick={submit} disabled={!status || saving} style={{ background: status ? primary : "#ccc", color: "#fff", border: "none", borderRadius: 999, padding: "13px", fontWeight: 700, fontSize: 15, cursor: status ? "pointer" : "not-allowed" }}>
              {saving ? "Sending…" : "Send my RSVP"}
            </button>
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#b0a99f" }}>Powered by Venuely</div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif", color: "#57534e", padding: 24, textAlign: "center", background: "#FFF8F3" }}>{children}</div>;
}
