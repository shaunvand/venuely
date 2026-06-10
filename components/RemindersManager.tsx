"use client";

import { useEffect, useState } from "react";
import { useLoading } from "@/components/LoadingProvider";

type Settings = {
  rsvpSubject?: string; rsvpTemplate?: string; rsvpIntervalDays?: number; autoRsvpReminders?: boolean;
  paymentSubject?: string; paymentTemplate?: string; paymentIntervalDays?: number; autoPaymentReminders?: boolean;
  paymentInstructions?: string; guestContributions?: boolean;
};

const FREQ = [{ label: "Weekly", days: 7 }, { label: "Fortnightly", days: 14 }, { label: "Monthly", days: 30 }];
const freqOf = (d: number | undefined) => FREQ.find((f) => f.days === d)?.label ?? "Custom";

// Couples manage their own reminder emails: edit the RSVP + payment reminder copy
// (AI can draft it), choose how often they auto-send, and send one now. Saves to
// weddings.reminder_settings; the cron honours the same toggles + interval.
export function RemindersManager({ slug, primary, accent, heading, cardRadius }: {
  slug: string; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [s, setS] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const overlay = useLoading();

  useEffect(() => { fetch(`/api/wedding/${slug}/reminders-config`).then((r) => r.json()).then((j) => setS(j.settings ?? {})).finally(() => setLoading(false)); }, [slug]);

  async function save(next: Settings) {
    setS(next);
    await fetch(`/api/wedding/${slug}/reminders-config`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    setSaved(true); setTimeout(() => setSaved(false), 1400);
  }
  async function aiDraft(kind: "rsvp" | "payment") {
    setDrafting(kind);
    overlay.show("Drafting your reminder…", { messages: ["Writing your reminder…", "Polishing the wording…"] });
    try {
      const r = await fetch(`/api/wedding/${slug}/draft-reminder`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) });
      const j = await r.json();
      if (j.ok) { save(kind === "rsvp" ? { ...s, rsvpSubject: j.subject, rsvpTemplate: j.body } : { ...s, paymentSubject: j.subject, paymentTemplate: j.body }); overlay.complete("Drafted ✓"); }
      else overlay.hide();
    } catch (e) { overlay.hide(); throw e; } finally { setDrafting(null); }
  }
  async function sendNow(kind: "rsvp" | "payment") {
    setSending(kind);
    overlay.show("Sending your reminders…");
    try {
      const r = await fetch(`/api/wedding/${slug}/remind`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) });
      const j = await r.json();
      if (j.ok) { overlay.complete(`Sent ${j.sent} ✓`); alert(`Sent ${j.sent} ${kind === "rsvp" ? "RSVP" : "payment"} reminder(s) by email.`); }
      else { overlay.hide(); alert(j.error || "Could not send"); }
    } catch (e) { overlay.hide(); throw e; } finally { setSending(null); }
  }

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, padding: 16, ...extra });
  const field: React.CSSProperties = { width: "100%", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "8px 10px", fontSize: 13.5, marginTop: 4 };
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#44403c" };

  if (loading) return <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading…</span>;

  // Plain render function (NOT a component) so the inputs don't remount/lose focus.
  const reminderCard = (props: {
    title: string; sub: string; kind: "rsvp" | "payment"; placeholders: string;
    enabled: boolean; onEnable: (v: boolean) => void; interval: number | undefined; onInterval: (d: number) => void;
    subject: string; onSubject: (v: string) => void; bodyVal: string; onBody: (v: string) => void;
  }) => {
    return (
      <div style={card()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700 }}>{props.title}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={props.enabled} onChange={(e) => props.onEnable(e.target.checked)} /> Auto-send</label>
        </div>
        <p style={{ fontSize: 12.5, color: "#57534e", margin: "0 0 10px" }}>{props.sub}</p>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 12.5 }}>Send every:</span>
          {FREQ.map((f) => (
            <button key={f.label} onClick={() => props.onInterval(f.days)} style={{ border: `1px solid ${props.interval === f.days ? primary : "rgba(0,0,0,0.15)"}`, background: props.interval === f.days ? primary : "#fff", color: props.interval === f.days ? "#fff" : "#57534e", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{f.label}</button>
          ))}
          <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>or every <input type="number" min={1} value={props.interval ?? 30} onChange={(e) => props.onInterval(Number(e.target.value))} style={{ ...field, width: 64, marginTop: 0, padding: "4px 8px" }} /> days</label>
        </div>

        <div><span style={label}>Subject</span><input value={props.subject} onChange={(e) => props.onSubject(e.target.value)} onBlur={() => save(s)} placeholder="Email subject" style={field} /></div>
        <div style={{ marginTop: 8 }}><span style={label}>Email message</span><textarea value={props.bodyVal} onChange={(e) => props.onBody(e.target.value)} onBlur={() => save(s)} rows={4} placeholder="Write your reminder, or tap ✨ AI draft" style={{ ...field, resize: "vertical" }} /></div>
        <div style={{ fontSize: 11, color: "#a0a0a0", marginTop: 4 }}>Placeholders: {props.placeholders}</div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => aiDraft(props.kind)} disabled={drafting === props.kind} style={{ background: accent, color: "#fff", border: "none", borderRadius: 999, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>{drafting === props.kind ? "Drafting…" : "✨ AI draft"}</button>
          <button onClick={() => sendNow(props.kind)} disabled={sending === props.kind} style={{ border: `1px solid ${primary}`, background: "#fff", color: primary, borderRadius: 999, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>{sending === props.kind ? "Sending…" : "Send now"}</button>
          <span style={{ fontSize: 11.5, color: "#8a8a8a", alignSelf: "center" }}>Frequency: {freqOf(props.interval)}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Reminders</h2>
          <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Write your reminder emails (let AI draft them), choose how often they auto-send, or send one now.</div>
        </div>
        {saved && <span style={{ fontSize: 12, color: "#1a7f4b" }}>Saved ✓</span>}
      </div>

      {reminderCard({
        title: "RSVP reminders", kind: "rsvp", placeholders: "{name}, {couple}, {link}",
        sub: "Nudges guests who were invited but haven't responded yet.",
        enabled: !!s.autoRsvpReminders, onEnable: (v) => save({ ...s, autoRsvpReminders: v }),
        interval: s.rsvpIntervalDays, onInterval: (d) => save({ ...s, rsvpIntervalDays: d }),
        subject: s.rsvpSubject ?? "", onSubject: (v) => setS({ ...s, rsvpSubject: v }),
        bodyVal: s.rsvpTemplate ?? "", onBody: (v) => setS({ ...s, rsvpTemplate: v }),
      })}

      {reminderCard({
        title: "Payment reminders", kind: "payment", placeholders: "{name}, {couple}, {amount}",
        sub: "Nudges attending guests who still owe a contribution. (Enable Guest contributions in the Payments tab.)",
        enabled: !!s.autoPaymentReminders, onEnable: (v) => save({ ...s, autoPaymentReminders: v }),
        interval: s.paymentIntervalDays, onInterval: (d) => save({ ...s, paymentIntervalDays: d }),
        subject: s.paymentSubject ?? "", onSubject: (v) => setS({ ...s, paymentSubject: v }),
        bodyVal: s.paymentTemplate ?? "", onBody: (v) => setS({ ...s, paymentTemplate: v }),
      })}

      <div style={card()}>
        <span style={label}>Payment instructions (your banking details — shown in payment reminders)</span>
        <textarea value={s.paymentInstructions ?? ""} onChange={(e) => setS({ ...s, paymentInstructions: e.target.value })} onBlur={(e) => save({ ...s, paymentInstructions: e.target.value })} rows={2} placeholder="e.g. EFT to Standard Bank · Acc 123… · Ref: your name" style={{ ...field, resize: "vertical" }} />
      </div>

      <p style={{ fontSize: 11.5, color: "#a0a0a0", margin: 0 }}>Tip: edits save automatically. Auto-send runs on your chosen frequency once your venue has reminders switched on. Use &ldquo;Send now&rdquo; any time.</p>
    </div>
  );
}
