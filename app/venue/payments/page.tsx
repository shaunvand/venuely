import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";

// Real receipts live in payment_ledger (one row per payment in / refund out,
// written by the wedding ledger UI + the Paystack webhook). The old `payments`
// table is dead — nothing inserts into it.
type LedgerRow = {
  id: string;
  amount: number | string;
  direction: "in" | "out" | string;
  kind: string | null;
  method: string | null;
  reference: string | null;
  paid_at: string | null;
  notes: string | null;
  wedding: { couple_names: string; slug: string } | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export default async function VenuePayments() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: weddings } = await supabase
    .from("weddings")
    .select("id")
    .eq("venue_id", venue.id);
  const ids = (weddings ?? []).map((w) => w.id);

  const { data: ledgerRaw } = ids.length
    ? await supabase
        .from("payment_ledger")
        .select("id, amount, direction, kind, method, reference, paid_at, notes, wedding:weddings(couple_names, slug)")
        .in("wedding_id", ids)
        .order("paid_at", { ascending: false })
    : { data: [] };

  // The wedding join can come back as an object or a 1-element array depending on
  // relationship inference — normalise to a single object.
  const payments: LedgerRow[] = (ledgerRaw ?? []).map((p) => {
    const w = (p as { wedding?: unknown }).wedding;
    const single = Array.isArray(w) ? (w[0] ?? null) : (w ?? null);
    return { ...(p as object), wedding: single } as LedgerRow;
  });

  const signed = (p: LedgerRow) => (p.direction === "out" ? -1 : 1) * Number(p.amount || 0);
  const totalIn = payments.filter((p) => p.direction !== "out").reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalOut = payments.filter((p) => p.direction === "out").reduce((s, p) => s + Number(p.amount || 0), 0);
  const net = totalIn - totalOut;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Payments · {venue.name}</h1>
        <div className="text-right text-sm">
          <div>Received: <b className="text-green-600">R{totalIn.toLocaleString()}</b></div>
          {totalOut > 0 && <div>Refunded: <b className="text-amber-700">R{totalOut.toLocaleString()}</b></div>}
          <div>Net: <b>R{net.toLocaleString()}</b></div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th>Wedding</th><th>Amount</th><th>Date</th><th>Type</th><th>Method</th><th>Reference / notes</th></tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="py-2">{p.wedding?.couple_names}</td>
              <td className={p.direction === "out" ? "text-amber-700" : undefined}>
                {p.direction === "out" ? "−" : ""}R{Math.abs(signed(p)).toLocaleString()}
              </td>
              <td>{fmtDate(p.paid_at)}</td>
              <td className="capitalize">{p.kind ?? "payment"}{p.direction === "out" ? " (out)" : ""}</td>
              <td>{p.method}</td>
              <td>{[p.reference, p.notes].filter(Boolean).join(" · ")}</td>
            </tr>
          ))}
          {!payments.length && <tr><td colSpan={6} className="py-4 text-gray-500">No payments recorded yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
