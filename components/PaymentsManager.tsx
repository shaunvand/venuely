"use client";

import { useEffect, useState } from "react";

type Payment = { id: string; amount: number; direction: string; kind: string | null; paid_at: string | null };
type ToVenue = { invoiced: number; paid: number; balance: number; depositDue: string | null; balanceDue: string | null; payments: Payment[] };
type FromGuests = { due: number; paid: number; outstanding: number };
type Guest = { id: string; full_name: string; email: string | null; phone: string | null; rsvp_status: string | null; amount_due: number | null; amount_paid: number | null };
type Settings = { guestContributions?: boolean; defaultGuestAmount?: number; paymentTemplate?: string; paymentInstructions?: string; intervalDays?: number; autoPaymentReminders?: boolean; autoRsvpReminders?: boolean };

const rZA = (n: number) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;
const fmtDate = (s: string | null) => (s ? new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—");

// Couple's money view: what they owe the venue (read-only, from the venue's ledger)
// + optional guest contributions they collect, with reminders.
export function PaymentsManager({ slug, primary, accent, heading, cardRadius }: {
  slug: string; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [toVenue, setToVenue] = useState<ToVenue | null>(null);
  const [fromGuests, setFromGuests] = useState<FromGuests | null>(null);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [venueBank, setVenueBank] = useState<{ name: string | null; bank: string | null; number: string | null; branch: string | null } | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [reminding, setReminding] = useState(false);

  function loadAll() {
    return Promise.all([
      fetch(`/api/wedding/${slug}/payments`).then((r) => r.json()).then((j) => { setToVenue(j.toVenue); setFromGuests(j.fromGuests); setVenueName(j.venue?.name ?? null); setVenueBank(j.venue?.bank ?? null); }),
      fetch(`/api/wedding/${slug}/guests`).then((r) => r.json()).then((j) => setGuests(j.guests ?? [])),
      fetch(`/api/wedding/${slug}/reminders-config`).then((r) => r.json()).then((j) => setSettings(j.settings ?? {})),
    ]);
  }
  useEffect(() => { loadAll().finally(() => setLoading(false)); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSettings(next: Settings) {
    setSettings(next);
    await fetch(`/api/wedding/${slug}/reminders-config`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  async function patchGuest(id: string, patch: Record<string, unknown>) {
    setGuests((gs) => gs.map((g) => g.id === id ? { ...g, ...patch } : g));
    await fetch(`/api/wedding/${slug}/guests`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
  }
  async function applyDefaultToAll() {
    const amt = Number(settings.defaultGuestAmount || 0);
    const targets = guests.filter((g) => g.rsvp_status === "attending");
    setGuests((gs) => gs.map((g) => g.rsvp_status === "attending" ? { ...g, amount_due: amt } : g));
    await Promise.all(targets.map((g) => fetch(`/api/wedding/${slug}/guests`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: g.id, amount_due: amt }) })));
    await loadAll();
  }
  async function remindUnpaid() {
    setReminding(true);
    const r = await fetch(`/api/wedding/${slug}/payment-remind`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    const j = await r.json(); setReminding(false);
    await loadAll();
    if (j.ok) alert(`Reminders sent to ${j.sent} guest(s) by email.${j.results?.some((x: { whatsapp: string | null }) => x.whatsapp) ? " WhatsApp links are available per guest." : ""}`);
  }

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius, ...extra });
  const field: React.CSSProperties = { border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "7px 10px", fontSize: 13.5 };
  const stat = (label: string, value: string, color?: string) => (
    <div style={card({ padding: "14px 16px" })}><div style={{ ...heading, fontSize: 22, color: color || "#1c1917" }}>{value}</div><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#8a8a8a" }}>{label}</div></div>
  );

  if (loading) return <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading…</span>;
  const owing = guests.filter((g) => Number(g.amount_due || 0) > Number(g.amount_paid || 0));

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Payments</h2>
        <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Track what you owe {venueName || "your venue"} and any contributions you&apos;re collecting from guests.</div>
      </div>

      {/* Couple -> venue */}
      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700, marginBottom: 10 }}>Your payments to {venueName || "the venue"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          {stat("Invoiced", rZA(toVenue?.invoiced || 0))}
          {stat("Paid", rZA(toVenue?.paid || 0), "#1a7f4b")}
          {stat("Balance", rZA(toVenue?.balance || 0), primary)}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12.5, color: "#57534e", flexWrap: "wrap" }}>
          <span>Deposit due: <b>{fmtDate(toVenue?.depositDue || null)}</b></span>
          <span>Balance due: <b>{fmtDate(toVenue?.balanceDue || null)}</b></span>
        </div>
        {venueBank && (venueBank.number || venueBank.name) && (
          <div style={{ marginTop: 12, padding: 12, background: "#FFF8F3", borderRadius: 10, fontSize: 12.5, color: "#44403c" }}>
            <b>Pay by EFT to:</b> {venueBank.name}{venueBank.bank ? ` · ${venueBank.bank}` : ""}{venueBank.number ? ` · Acc ${venueBank.number}` : ""}{venueBank.branch ? ` · Branch ${venueBank.branch}` : ""}
          </div>
        )}
        {toVenue?.payments && toVenue.payments.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11.5, color: "#8a8a8a", marginBottom: 4 }}>Payment history</div>
            {toVenue.payments.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <span>{fmtDate(p.paid_at)} · {p.kind || p.direction}</span><span style={{ fontWeight: 600, color: p.direction === "in" ? "#1a7f4b" : "#57534e" }}>{p.direction === "in" ? "+" : "−"}{rZA(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11.5, color: "#a0a0a0", marginTop: 10 }}>Payments are recorded by {venueName || "the venue"} as they receive them. {venueName || "Your venue"} sends deposit &amp; balance reminders automatically.</p>
      </div>

      {/* Guest contributions */}
      <div style={card({ padding: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700 }}>Guest contributions</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={!!settings.guestContributions} onChange={(e) => saveSettings({ ...settings, guestContributions: e.target.checked })} /> Enable</label>
        </div>

        {!settings.guestContributions ? (
          <p style={{ fontSize: 13, color: "#57534e", margin: 0 }}>Turn this on if you&apos;re collecting money from guests (e.g. for accommodation or a contribution). You can set an amount per guest, track who&apos;s paid, and send reminders.</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 12 }}>
              {stat("Expected", rZA(fromGuests?.due || 0))}
              {stat("Collected", rZA(fromGuests?.paid || 0), "#1a7f4b")}
              {stat("Outstanding", rZA(fromGuests?.outstanding || 0), primary)}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>Default per guest:</span>
              <input type="number" value={settings.defaultGuestAmount ?? ""} onChange={(e) => setSettings({ ...settings, defaultGuestAmount: Number(e.target.value) })} onBlur={(e) => saveSettings({ ...settings, defaultGuestAmount: Number(e.target.value) })} placeholder="0" style={{ ...field, width: 100 }} />
              <button onClick={applyDefaultToAll} style={{ border: `1px solid ${primary}`, background: "#fff", color: primary, borderRadius: 999, padding: "7px 14px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Apply to attending</button>
              <button onClick={remindUnpaid} disabled={reminding || owing.length === 0} style={{ background: accent, color: "#fff", border: "none", borderRadius: 999, padding: "7px 14px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>{reminding ? "Sending…" : `✉ Remind ${owing.length} unpaid`}</button>
            </div>

            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              {guests.length === 0 ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>No guests yet.</span> : guests.map((g) => {
                const due = Number(g.amount_due || 0), paid = Number(g.amount_paid || 0);
                const settled = due > 0 && paid >= due;
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, flexWrap: "wrap" }}>
                    <span style={{ flex: 1, minWidth: 120, fontSize: 13.5 }}>{g.full_name}{g.rsvp_status === "attending" ? "" : <span style={{ color: "#a0a0a0", fontSize: 11 }}> · {g.rsvp_status || "no reply"}</span>}</span>
                    <label style={{ fontSize: 11.5, color: "#8a8a8a" }}>Due <input type="number" defaultValue={due || ""} onBlur={(e) => patchGuest(g.id, { amount_due: Number(e.target.value) })} style={{ ...field, width: 80, padding: "4px 8px" }} /></label>
                    <label style={{ fontSize: 11.5, color: "#8a8a8a" }}>Paid <input type="number" defaultValue={paid || ""} onBlur={(e) => patchGuest(g.id, { amount_paid: Number(e.target.value) })} style={{ ...field, width: 80, padding: "4px 8px" }} /></label>
                    {settled ? <span style={{ fontSize: 11.5, color: "#1a7f4b", fontWeight: 700 }}>✓ Paid</span> : <button onClick={() => patchGuest(g.id, { amount_paid: due })} disabled={due === 0} style={{ border: "1px solid rgba(0,0,0,0.15)", background: "#fff", borderRadius: 8, padding: "4px 9px", cursor: "pointer", fontSize: 11.5 }}>Mark paid</button>}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div><span style={{ fontSize: 12.5, fontWeight: 600 }}>Payment instructions (your banking details, shown in reminders)</span><textarea value={settings.paymentInstructions ?? ""} onChange={(e) => setSettings({ ...settings, paymentInstructions: e.target.value })} onBlur={(e) => saveSettings({ ...settings, paymentInstructions: e.target.value })} rows={2} placeholder="e.g. EFT to Standard Bank · Acc 123… · Ref: your name" style={{ ...field, width: "100%", resize: "vertical", marginTop: 4 }} /></div>
              <div><span style={{ fontSize: 12.5, fontWeight: 600 }}>Reminder message <span style={{ color: "#a0a0a0", fontWeight: 400 }}>(use {"{name}"}, {"{couple}"}, {"{amount}"})</span></span><textarea value={settings.paymentTemplate ?? ""} onChange={(e) => setSettings({ ...settings, paymentTemplate: e.target.value })} onBlur={(e) => saveSettings({ ...settings, paymentTemplate: e.target.value })} rows={2} placeholder="Hi {name}, a friendly reminder for your contribution towards {couple}'s wedding. Outstanding: {amount}." style={{ ...field, width: "100%", resize: "vertical", marginTop: 4 }} /></div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><input type="checkbox" checked={!!settings.autoPaymentReminders} onChange={(e) => saveSettings({ ...settings, autoPaymentReminders: e.target.checked })} /> Auto-remind unpaid guests</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>every <input type="number" value={settings.intervalDays ?? 30} onChange={(e) => setSettings({ ...settings, intervalDays: Number(e.target.value) })} onBlur={(e) => saveSettings({ ...settings, intervalDays: Number(e.target.value) })} style={{ ...field, width: 60, padding: "4px 8px" }} /> days</label>
                {saved && <span style={{ fontSize: 12, color: "#1a7f4b" }}>Saved ✓</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
