"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentVenue } from "@/lib/venue/current";
import { sendEmail } from "@/lib/notifications";

// Commission owed once a supplier is booked. Fixed = the flat amount agreed with
// the venue; percent = a share of the supplier's agreed booking value.
function computeCommission(commissionType: string | null, commissionValue: number, bookingValue: number): number {
  const val = Number(commissionValue) || 0;
  if (commissionType === "fixed") return Math.round(val * 100) / 100;
  const bv = Number(bookingValue) || 0;
  return Math.round((val / 100) * bv * 100) / 100;
}

// Venue confirms a supplier introduction converted to a booking. Records the
// supplier's agreed price (booking_value, needed for percent commission) and the
// commission the venue is now owed — Venuely is the ledger; the venue invoices
// the supplier directly. Owner/venue-member gated, with a venue_id match so a
// venue can only touch its own intros.
export async function markSupplierIntroBooked(id: string, weddingId: string, slug: string, bookingValue: number) {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: intro, error: fetchErr } = await supabase
    .from("supplier_intros")
    .select("id, venue_id, commission_type, commission_value")
    .eq("id", id)
    .eq("wedding_id", weddingId)
    .single();
  if (fetchErr || !intro) throw new Error("Intro not found");
  if (intro.venue_id !== venue.id) throw new Error("Not your venue");

  const bv = Number(bookingValue) || 0;
  if (intro.commission_type === "percent" && bv <= 0) {
    throw new Error("Enter the supplier's booking value to calculate the percentage commission.");
  }
  const commissionAmount = computeCommission(intro.commission_type, Number(intro.commission_value), bv);

  const { error } = await supabase
    .from("supplier_intros")
    .update({
      status: "booked",
      booking_value: bv > 0 ? bv : null,
      commission_amount: commissionAmount,
      booked_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// Venue marks an introduction lost / declined (no commission).
export async function markSupplierIntroDeclined(id: string, weddingId: string, slug: string) {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: intro, error: fetchErr } = await supabase
    .from("supplier_intros")
    .select("id, venue_id")
    .eq("id", id)
    .eq("wedding_id", weddingId)
    .single();
  if (fetchErr || !intro) throw new Error("Intro not found");
  if (intro.venue_id !== venue.id) throw new Error("Not your venue");

  const { error } = await supabase
    .from("supplier_intros")
    .update({ status: "declined", commission_amount: null, booked_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// Email the booked supplier a commission invoice (venue's EFT details) and mark
// it invoiced so the Overview "commission to invoice" alert clears.
export async function sendSupplierCommissionInvoice(introId: string, slug: string) {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: intro } = await supabase
    .from("supplier_intros")
    .select("id, supplier_name, supplier_email, commission_amount, booking_value, status")
    .eq("id", introId).eq("venue_id", venue.id).single();
  if (!intro) throw new Error("Intro not found");
  if (intro.status !== "booked") throw new Error("Supplier isn't booked yet");
  const amount = Number(intro.commission_amount) || 0;
  if (amount <= 0) throw new Error("No commission to invoice");
  if (!intro.supplier_email) throw new Error("No email on file for this supplier");

  const { data: v } = await supabase.from("venues")
    .select("name, contact_email, bank_name, bank_account_name, bank_account_number, bank_branch_code, bank_swift, vat_number, company_reg")
    .eq("id", venue.id).single();
  const b = (v ?? {}) as Record<string, string | null>;

  const rZA = (n: number) => `R${Math.round(Number(n) || 0).toLocaleString("en-ZA")}`;
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const ref = `COM-${String(introId).slice(0, 6).toUpperCase()}`;
  const bankRow = (k: string, val: string | null) => val ? `<tr><td style="color:#57534e;padding:2px 12px 2px 0">${k}</td><td style="text-align:right;font-weight:600">${esc(val)}</td></tr>` : "";
  const idLine = [b.vat_number ? `VAT ${esc(b.vat_number)}` : "", b.company_reg ? `Reg ${esc(b.company_reg)}` : ""].filter(Boolean).join(" · ");
  const bookingLine = Number(intro.booking_value) > 0 ? ` on a booking value of ${rZA(Number(intro.booking_value))}` : "";
  const venueName = esc(b.name || venue.name || "the venue");
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
      <div style="background:#1c1917;color:#fff;padding:20px 24px"><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.8">${venueName}</div><div style="font-size:24px;font-weight:700">Commission invoice</div>${idLine ? `<div style="font-size:11px;opacity:.7;margin-top:4px">${idLine}</div>` : ""}</div>
      <div style="height:3px;background:#FA523C;font-size:0;line-height:3px">&nbsp;</div>
      <div style="padding:24px">
        <p style="margin:0 0 16px;color:#57534e">Hi ${esc(intro.supplier_name)}, thanks for the booking${bookingLine}. This is the agreed referral commission due to ${venueName}.</p>
        <div style="display:flex;justify-content:space-between;background:#FFF6F0;border-radius:8px;padding:14px 16px;margin-bottom:16px">
          <span style="font-weight:600">Commission due</span><span style="font-weight:700">${rZA(amount)}</span>
        </div>
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#FA523C;font-weight:700;margin-bottom:6px">Pay by EFT</div>
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          ${bankRow("Account name", b.bank_account_name)}${bankRow("Bank", b.bank_name)}${bankRow("Account no.", b.bank_account_number)}${bankRow("Branch code", b.bank_branch_code)}${bankRow("SWIFT", b.bank_swift)}
          <tr><td style="color:#57534e;padding:2px 12px 2px 0">Reference</td><td style="text-align:right;font-weight:600">${ref}</td></tr>
        </table>
        ${!b.bank_account_number ? `<p style="color:#b42318;font-size:12px;margin-top:10px">Add your banking details in Billing so they appear here.</p>` : ""}
      </div>
    </div>`;
  const res = await sendEmail(intro.supplier_email, `Commission invoice from ${b.name || "your venue"}`, html, { replyTo: b.contact_email ?? null });
  if (!res.sent) throw new Error(res.reason === "no_api_key" ? "Email isn't configured yet — can't send the invoice." : "Could not send the invoice email — try again.");

  // Only stamp as invoiced once the email actually went out.
  await supabase.from("supplier_intros").update({ commission_invoiced_at: new Date().toISOString() }).eq("id", introId).eq("venue_id", venue.id);
  revalidatePath(`/venue/weddings/${slug}`);
  revalidatePath("/venue");
}
