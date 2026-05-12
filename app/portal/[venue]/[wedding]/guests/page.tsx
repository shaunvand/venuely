import { getPortalContext } from "@/lib/portal/context";
import { createClient } from "@/lib/supabase/server";
import { addGuest, deleteGuest } from "./actions";

export default async function GuestList({ params }: { params: Promise<{ venue: string; wedding: string }> }) {
  const { venue: vSlug, wedding: wSlug } = await params;
  const { wedding } = await getPortalContext(vSlug, wSlug);
  const supabase = await createClient();
  const { data: guests } = await supabase
    .from("guests")
    .select("id, full_name, email, rsvp_status, dietary, plus_one, table_number")
    .eq("wedding_id", wedding.id)
    .order("created_at", { ascending: true });

  const counts = {
    total: guests?.length ?? 0,
    attending: guests?.filter((g) => g.rsvp_status === "attending").length ?? 0,
    pending: guests?.filter((g) => g.rsvp_status === "pending").length ?? 0,
    declined: guests?.filter((g) => g.rsvp_status === "declined").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Guest List</h1>

      <div className="grid grid-cols-4 gap-4 text-center">
        <Stat label="Total" value={counts.total} />
        <Stat label="Attending" value={counts.attending} />
        <Stat label="Pending" value={counts.pending} />
        <Stat label="Declined" value={counts.declined} />
      </div>

      <form action={addGuest.bind(null, wedding.id)} className="flex gap-2">
        <input name="full_name" required placeholder="Guest name" className="border rounded px-3 py-2 flex-1" />
        <input name="email" type="email" placeholder="email (optional)" className="border rounded px-3 py-2" />
        <button className="px-4 py-2 bg-black text-white rounded">Add</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th>Name</th><th>Email</th><th>RSVP</th><th>Dietary</th><th>Table</th><th></th></tr>
        </thead>
        <tbody>
          {guests?.map((g) => (
            <tr key={g.id} className="border-t">
              <td className="py-2">{g.full_name}</td>
              <td>{g.email}</td>
              <td>{g.rsvp_status}</td>
              <td>{g.dietary || "—"}</td>
              <td>{g.table_number || "—"}</td>
              <td>
                <form action={deleteGuest.bind(null, g.id, wedding.id)}>
                  <button className="text-red-600 text-xs hover:underline">delete</button>
                </form>
              </td>
            </tr>
          ))}
          {!guests?.length && (
            <tr><td colSpan={6} className="py-4 text-gray-500">No guests yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded p-3">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
