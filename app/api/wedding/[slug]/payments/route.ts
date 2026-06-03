import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// Couple-facing payment summary. Couple -> venue: invoiced total, amount paid
// (payment_ledger 'in'), balance, deposit/balance due dates + a payment history.
// Guest -> couple: collected vs outstanding from guests.amount_due/amount_paid.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const db = admin();

  const { data: w } = await db.from("weddings").select("id, invoice_total, deposit_due_at, balance_due_at, venue_id").eq("id", access.wedding.id).single();
  const { data: venue } = w?.venue_id ? await db.from("venues").select("name, bank_account_name, bank_name, bank_account_number, bank_branch_code").eq("id", w.venue_id).single() : { data: null };
  const { data: ledger } = await db.from("payment_ledger").select("id, amount, direction, kind, paid_at").eq("wedding_id", access.wedding.id).order("paid_at", { ascending: false });
  const { data: guests } = await db.from("guests").select("amount_due, amount_paid, rsvp_status").eq("wedding_id", access.wedding.id);

  const paidIn = (ledger ?? []).filter((p) => p.direction === "in").reduce((s, p) => s + Number(p.amount || 0), 0);
  const invoiced = Number(w?.invoice_total || 0);
  const guestDue = (guests ?? []).reduce((s, g) => s + Number(g.amount_due || 0), 0);
  const guestPaid = (guests ?? []).reduce((s, g) => s + Number(g.amount_paid || 0), 0);

  return NextResponse.json({
    ok: true,
    venue: { name: venue?.name ?? null, bank: venue ? { name: venue.bank_account_name, bank: venue.bank_name, number: venue.bank_account_number, branch: venue.bank_branch_code } : null },
    toVenue: { invoiced, paid: paidIn, balance: Math.max(0, invoiced - paidIn), depositDue: w?.deposit_due_at ?? null, balanceDue: w?.balance_due_at ?? null, payments: ledger ?? [] },
    fromGuests: { due: guestDue, paid: guestPaid, outstanding: Math.max(0, guestDue - guestPaid) },
  });
}
