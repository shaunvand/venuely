"use client";

import { useState, useTransition } from "react";
import { markSupplierIntroBooked, markSupplierIntroDeclined, sendSupplierCommissionInvoice } from "@/app/venue/weddings/[slug]/actions";

export type SupplierIntro = {
  id: string;
  supplier_name: string;
  supplier_type: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  commission_type: "percent" | "fixed";
  commission_value: number;
  status: "intro_requested" | "booked" | "declined";
  booking_value: number | null;
  commission_amount: number | null;
  intro_sent_at: string | null;
  booked_at: string | null;
  commission_invoiced_at: string | null;
};

const rZA = (n: number | null | undefined) =>
  `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;

const commissionTerms = (i: SupplierIntro) =>
  i.commission_type === "fixed" ? `${rZA(i.commission_value)} fixed` : `${Number(i.commission_value) || 0}%`;

const STATUS: Record<SupplierIntro["status"], { label: string; bg: string; text: string }> = {
  intro_requested: { label: "Intro requested", bg: "var(--cream)", text: "var(--poppy-deep)" },
  booked: { label: "Booked", bg: "#dcf3e6", text: "#1a7f4b" },
  declined: { label: "Lost", bg: "#f1efee", text: "var(--ink-2)" },
};

// Venue-side ledger panel for supplier introductions. Venuely tracks the
// commission owed; the venue invoices the supplier. Booking a percent-commission
// supplier needs the agreed booking value; fixed commission is the flat amount.
export function SupplierIntrosPanel({ intros, weddingId, slug }: {
  intros: SupplierIntro[]; weddingId: string; slug: string;
}) {
  const [pending, startTransition] = useTransition();
  const [bookingRow, setBookingRow] = useState<SupplierIntro | null>(null);
  const [bookingValue, setBookingValue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const totalDue = intros
    .filter((i) => i.status === "booked" && !i.commission_invoiced_at)
    .reduce((s, i) => s + (Number(i.commission_amount) || 0), 0);

  function confirmBooking(intro: SupplierIntro) {
    if (intro.commission_type === "fixed") {
      runBooked(intro.id, 0);
    } else {
      setErr(null);
      setBookingValue("");
      setBookingRow(intro);
    }
  }

  function runBooked(id: string, value: number) {
    setErr(null);
    startTransition(async () => {
      try {
        await markSupplierIntroBooked(id, weddingId, slug, value);
        setBookingRow(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not mark booked");
      }
    });
  }

  function runDeclined(id: string) {
    setErr(null);
    startTransition(async () => {
      try {
        await markSupplierIntroDeclined(id, weddingId, slug);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not update");
      }
    });
  }

  function runInvoice(id: string) {
    setErr(null);
    startTransition(async () => {
      try {
        await sendSupplierCommissionInvoice(id, slug);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not send invoice");
      }
    });
  }

  if (intros.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        No supplier introductions yet. When the couple taps &ldquo;Request introduction&rdquo; on a recommended
        supplier in their portal, it appears here so you can track the commission you&apos;re owed.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Venuely tracks what you&apos;re owed — you invoice each supplier directly.
        </p>
        {totalDue > 0 && (
          <span className="text-sm font-medium" style={{ color: "var(--poppy-deep)" }}>
            {rZA(totalDue)} commission to invoice
          </span>
        )}
      </div>

      {err && <div className="text-sm" style={{ color: "#b42318" }}>{err}</div>}

      <ul className="space-y-2">
        {intros.map((i) => {
          const st = STATUS[i.status];
          return (
            <li key={i.id} className="rounded-lg px-3 py-2.5" style={{ border: "1px solid var(--line)", background: "#fff" }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {i.supplier_name}
                    {i.supplier_type && <span className="ml-2 text-xs" style={{ color: "var(--ink-2)" }}>· {i.supplier_type}</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
                    Commission terms: {commissionTerms(i)}
                    {i.status === "booked" && i.booking_value != null && <> · on booking of {rZA(i.booking_value)}</>}
                  </div>
                  {i.status === "booked" && (
                    <div className="text-xs mt-1" style={{ color: "#1a7f4b" }}>
                      Commission due {rZA(i.commission_amount)} — invoice the supplier for this.
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.text }}>
                  {st.label}
                </span>
              </div>

              {i.status === "intro_requested" && (
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  <button onClick={() => confirmBooking(i)} disabled={pending} className="vy-btn vy-btn-primary text-xs">
                    Mark booked
                  </button>
                  <button onClick={() => runDeclined(i.id)} disabled={pending} className="vy-btn vy-btn-secondary text-xs">
                    Decline / lost
                  </button>
                </div>
              )}

              {i.status === "booked" && Number(i.commission_amount) > 0 && (
                <div className="flex gap-2 mt-2.5 flex-wrap items-center">
                  {i.commission_invoiced_at ? (
                    <span className="text-xs font-medium" style={{ color: "#1a7f4b" }}>✓ Commission invoice sent</span>
                  ) : (
                    <button onClick={() => runInvoice(i.id)} disabled={pending || !i.supplier_email} className="vy-btn vy-btn-primary text-xs" title={!i.supplier_email ? "No supplier email on file" : undefined}>
                      {pending ? "Sending…" : `Send invoice (${rZA(i.commission_amount)})`}
                    </button>
                  )}
                  {!i.supplier_email && !i.commission_invoiced_at && <span className="text-[11px]" style={{ color: "#b42318" }}>No supplier email on file</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Booking-value prompt for percent commission */}
      {bookingRow && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => !pending && setBookingRow(null)}>
          <div onClick={(e) => e.stopPropagation()} className="vy-card" style={{ width: "min(420px,100%)" }}>
            <div className="vy-eyebrow">Mark booked</div>
            <h3 className="vy-h2 mt-1 mb-2">{bookingRow.supplier_name}</h3>
            <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
              Enter the supplier&apos;s agreed booking value. Your {Number(bookingRow.commission_value) || 0}% commission is calculated from it.
            </p>
            <label className="vy-label">Booking value (R)</label>
            <input
              type="number" min="0" step="0.01" autoFocus value={bookingValue}
              onChange={(e) => setBookingValue(e.target.value)}
              placeholder="e.g. 25000" className="vy-input"
            />
            {Number(bookingValue) > 0 && (
              <div className="text-xs mt-2" style={{ color: "var(--poppy-deep)" }}>
                Commission: {rZA((Number(bookingRow.commission_value) || 0) / 100 * Number(bookingValue))}
              </div>
            )}
            {err && <div className="text-sm mt-2" style={{ color: "#b42318" }}>{err}</div>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setBookingRow(null)} disabled={pending} className="vy-btn vy-btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => runBooked(bookingRow.id, Number(bookingValue))}
                disabled={pending || !(Number(bookingValue) > 0)}
                className="vy-btn vy-btn-primary text-sm"
              >
                {pending ? "Saving…" : "Confirm booked"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
