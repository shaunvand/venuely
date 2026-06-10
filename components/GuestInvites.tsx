"use client";

import { useEffect, useRef, useState } from "react";
import { useLoading } from "@/components/LoadingProvider";

type Guest = { id: string; full_name: string; email: string | null; phone: string | null; rsvp_status: string | null; rsvp_token: string; invited_at: string | null; responded_at: string | null; party_size: number | null };
type Settings = { headline?: string; message?: string; accent?: string; primary?: string; cover?: string; deadline?: string; allowPhoto?: boolean; allowParty?: boolean; thankYou?: string };

const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  attending: { t: "Attending", c: "#1a7f4b" }, declined: { t: "Declined", c: "#b42318" },
  tentative: { t: "Maybe", c: "#b7791f" }, pending: { t: "No reply", c: "#8a8a8a" },
};

// Couple's RSVP control centre: customise the white-label invite site, bulk-import
// guests from a spreadsheet, send invites by email / WhatsApp, and watch responses
// flow back into the guest list live.
export function GuestInvites({ slug, primary, accent, heading, cardRadius }: {
  slug: string; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [settings, setSettings] = useState<Settings>({});
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [sendingAll, setSendingAll] = useState(false);
  const [origin, setOrigin] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const overlay = useLoading();

  function loadGuests() { return fetch(`/api/wedding/${slug}/guests`).then((r) => r.json()).then((j) => setGuests(j.guests ?? [])); }
  useEffect(() => {
    setOrigin(window.location.origin);
    Promise.all([
      fetch(`/api/wedding/${slug}/rsvp-config`).then((r) => r.json()).then((j) => setSettings(j.settings ?? {})),
      loadGuests(),
    ]).finally(() => setLoading(false));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSettings(next: Settings) {
    setSettings(next);
    await fetch(`/api/wedding/${slug}/rsvp-config`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    setSavedAt(true); setTimeout(() => setSavedAt(false), 1500);
  }
  const set = (k: keyof Settings, v: unknown) => saveSettings({ ...settings, [k]: v });

  async function importFile(f: File | null) {
    if (!f) return;
    setImporting(true); setImportMsg("");
    overlay.show("Importing your guest list…", { messages: ["Reading your file…", "Matching the columns…", "Adding your guests…"] });
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch(`/api/wedding/${slug}/guests/import`, { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok) { setImportMsg(`✓ Imported ${j.imported} guests`); await loadGuests(); overlay.complete(`Imported ${j.imported} ✓`); }
      else { setImportMsg(j.error || "import failed"); overlay.hide(); }
    } catch (e) {
      overlay.hide();
      setImportMsg(e instanceof Error ? e.message : "import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sendInvites(guestIds?: string[], onlyUninvited?: boolean) {
    setSendingAll(true);
    // A single-guest send (from the row "Invite" button) is quick; only show the
    // overlay for the bulk "email all uninvited" action.
    const bulk = !guestIds;
    if (bulk) overlay.show("Emailing your guests…");
    try {
      const r = await fetch(`/api/wedding/${slug}/invite`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(guestIds ? { guestIds } : { onlyUninvited }) });
      const j = await r.json();
      if (j.ok) await loadGuests();
      if (bulk) overlay.complete("Sent ✓");
      return j.results as Array<{ id: string; whatsapp: string | null }> | undefined;
    } catch (e) {
      if (bulk) overlay.hide();
      throw e;
    } finally {
      setSendingAll(false);
    }
  }

  async function sendOne(g: Guest) {
    const results = await sendInvites([g.id]);
    const wa = results?.find((x) => x.id === g.id)?.whatsapp;
    if (wa) window.open(wa, "_blank");
  }

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, ...extra });
  const field: React.CSSProperties = { width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "8px 10px", fontSize: 13.5, marginTop: 4 };
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#44403c" };

  const counts = { total: guests.length, replied: guests.filter((g) => g.responded_at).length, attending: guests.filter((g) => g.rsvp_status === "attending").length, invited: guests.filter((g) => g.invited_at).length };
  if (loading) return <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading…</span>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Invites &amp; RSVP</h2>
        <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Design your invite page, import your guests, send invites, and track replies as they come in.</div>
      </div>

      {/* Live counts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        {[["Guests", counts.total], ["Invited", counts.invited], ["Replied", counts.replied], ["Attending", counts.attending]].map(([k, v]) => (
          <div key={k} style={card({ padding: "12px 14px" })}><div style={{ ...heading, fontSize: 24 }}>{v}</div><div style={{ fontSize: 11.5, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: 1 }}>{k}</div></div>
        ))}
      </div>

      {/* Customise the white-label invite site */}
      <div style={card({ padding: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700 }}>Your invite page</div>
          {savedAt && <span style={{ fontSize: 12, color: "#1a7f4b" }}>Saved ✓</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <div><span style={label}>Headline</span><input value={settings.headline ?? ""} onChange={(e) => setSettings({ ...settings, headline: e.target.value })} onBlur={(e) => set("headline", e.target.value)} placeholder="e.g. Sarah & Tom" style={field} /></div>
          <div><span style={label}>RSVP deadline</span><input type="date" value={settings.deadline ?? ""} onChange={(e) => set("deadline", e.target.value)} style={field} /></div>
          <div><span style={label}>Cover image URL</span><input value={settings.cover ?? ""} onChange={(e) => setSettings({ ...settings, cover: e.target.value })} onBlur={(e) => set("cover", e.target.value)} placeholder="https://…" style={field} /></div>
          <div><span style={label}>Accent colour</span><input type="color" value={settings.primary ?? "#FA523C"} onChange={(e) => set("primary", e.target.value)} style={{ ...field, height: 38, padding: 4 }} /></div>
        </div>
        <div style={{ marginTop: 12 }}><span style={label}>Message to guests</span><textarea value={settings.message ?? ""} onChange={(e) => setSettings({ ...settings, message: e.target.value })} onBlur={(e) => set("message", e.target.value)} rows={3} placeholder="We can't wait to celebrate with you…" style={{ ...field, resize: "vertical" }} /></div>
        <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={!!settings.allowParty} onChange={(e) => set("allowParty", e.target.checked)} /> Ask party size</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={!!settings.allowPhoto} onChange={(e) => set("allowPhoto", e.target.checked)} /> Let guests upload a photo</label>
        </div>
        {guests[0] && <a href={`${origin}/rsvp/${guests[0].rsvp_token}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 12, fontSize: 13, color: accent, fontWeight: 600 }}>Preview invite page ↗</a>}
      </div>

      {/* Import */}
      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700, marginBottom: 6 }}>Add guests from a spreadsheet</div>
        <p style={{ fontSize: 12.5, color: "#57534e", margin: "0 0 10px" }}>Upload an Excel or CSV file with columns for <b>Name</b>, <b>Email</b> and/or <b>WhatsApp/Phone</b>. We&apos;ll match the columns automatically.</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => importFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} disabled={importing} style={{ background: primary, color: "#fff", border: "none", borderRadius: 999, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13.5 }}>{importing ? "Importing…" : "⬆ Upload guest list"}</button>
        {importMsg && <span style={{ marginLeft: 10, fontSize: 12.5, color: importMsg.startsWith("✓") ? "#1a7f4b" : "#b42318" }}>{importMsg}</span>}
      </div>

      {/* Guests + send */}
      <div style={card({ padding: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700 }}>Guests ({guests.length})</div>
          <button onClick={() => sendInvites(undefined, true)} disabled={sendingAll || guests.length === 0} style={{ background: accent, color: "#fff", border: "none", borderRadius: 999, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>{sendingAll ? "Sending…" : "✉ Email all uninvited"}</button>
        </div>
        {guests.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "#8a8a8a", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 10 }}>No guests yet — import a list or add them in the Guests tab.</div> : (
          <div style={{ display: "grid", gap: 6 }}>
            {guests.map((g) => {
              const st = STATUS_LABEL[g.rsvp_status || "pending"] || STATUS_LABEL.pending;
              const link = `${origin}/rsvp/${g.rsvp_token}`;
              return (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{g.full_name}{g.party_size && g.party_size > 1 ? ` +${g.party_size - 1}` : ""}</div>
                    <div style={{ fontSize: 11.5, color: "#8a8a8a" }}>{g.email || g.phone || "no contact"}{g.invited_at ? " · invited" : ""}</div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: st.c, background: `${st.c}18`, borderRadius: 999, padding: "3px 10px" }}>{st.t}</span>
                  <button onClick={() => navigator.clipboard.writeText(link)} title="Copy RSVP link" style={{ border: "1px solid rgba(0,0,0,0.15)", background: "#fff", borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 12 }}>🔗</button>
                  <button onClick={() => sendOne(g)} style={{ border: `1px solid ${primary}`, background: "#fff", color: primary, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Invite</button>
                </div>
              );
            })}
          </div>
        )}
        <p style={{ fontSize: 11.5, color: "#a0a0a0", marginTop: 10 }}>&ldquo;Invite&rdquo; emails the guest (if they have an email) and opens a WhatsApp message (if they have a number). Replies appear here automatically.</p>
      </div>
    </div>
  );
}
