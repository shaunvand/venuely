import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerVenues() {
  const supabase = await createClient();
  const { data: venues } = await supabase
    .from("venues")
    .select("id, slug, name, region, subscription_status, trial_ends_at, created_at")
    .order("created_at");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-semibold">Venues</h1>
        <Link href="/venue" className="text-sm text-blue-600 hover:underline">
          Open admin →
        </Link>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Region</th>
            <th>Status</th>
            <th>Trial ends</th>
          </tr>
        </thead>
        <tbody>
          {venues?.map((v) => (
            <tr key={v.id} className="border-t">
              <td className="py-2 font-medium">{v.name}</td>
              <td className="font-mono text-xs">{v.slug}</td>
              <td>{v.region}</td>
              <td>{v.subscription_status}</td>
              <td>{v.trial_ends_at?.slice(0, 10) ?? "—"}</td>
            </tr>
          ))}
          {!venues?.length && (
            <tr>
              <td colSpan={5} className="py-4 text-gray-500">
                No venues yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
