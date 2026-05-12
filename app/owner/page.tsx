import { createClient } from "@/lib/supabase/server";

export default async function OwnerDashboard() {
  const supabase = await createClient();
  const { count: venueCount } = await supabase
    .from("venues")
    .select("*", { count: "exact", head: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Owner Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded p-4">
          <div className="text-sm text-gray-500">Venues</div>
          <div className="text-3xl font-semibold">{venueCount ?? 0}</div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm text-gray-500">MRR (ZAR)</div>
          <div className="text-3xl font-semibold">R0</div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm text-gray-500">Trial venues</div>
          <div className="text-3xl font-semibold">0</div>
        </div>
      </div>
    </div>
  );
}
