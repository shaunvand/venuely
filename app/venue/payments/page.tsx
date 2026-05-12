import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";

export default async function VenuePayments() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, due_date, paid_date, status, description, wedding:weddings(couple_names, slug)")
    .eq("weddings.venue_id", venue.id)
    .order("due_date");

  const total = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const paid = (payments ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Payments · {venue.name}</h1>
        <div className="text-right text-sm">
          <div>Total: <b>R{total.toLocaleString()}</b></div>
          <div>Paid: <b className="text-green-600">R{paid.toLocaleString()}</b></div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th>Wedding</th><th>Amount</th><th>Due</th><th>Paid</th><th>Status</th><th>Description</th></tr>
        </thead>
        <tbody>
          {payments?.map((p) => (
            <tr key={p.id} className="border-t">
              {/* @ts-expect-error joined row */}
              <td className="py-2">{p.wedding?.couple_names}</td>
              <td>R{Number(p.amount).toLocaleString()}</td>
              <td>{p.due_date}</td>
              <td>{p.paid_date}</td>
              <td>{p.status}</td>
              <td>{p.description}</td>
            </tr>
          ))}
          {!payments?.length && <tr><td colSpan={6} className="py-4 text-gray-500">No payments yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
