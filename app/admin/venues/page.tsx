import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerVenues() {
  const supabase = await createClient();
  const { data: venues } = await supabase
    .from("venues")
    .select("id, slug, name, region, address, subscription_status, trial_ends_at, created_at")
    .order("created_at");

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="vy-eyebrow">Customers</div>
          <h1 className="vy-h1 mt-1">Venues</h1>
        </div>
        <Link href="/venue" className="vy-btn vy-btn-secondary">Open admin →</Link>
      </header>

      {!venues?.length ? (
        <div className="vy-empty">No venues signed up yet.</div>
      ) : (
        <div className="vy-card p-0 overflow-hidden">
          <table className="vy-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Region</th>
                <th>Status</th>
                <th>Trial ends</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="font-medium">{v.name}</div>
                    {v.address && <div className="text-xs text-stone-500 mt-0.5">{v.address}</div>}
                  </td>
                  <td className="font-mono text-xs">{v.slug}</td>
                  <td>{v.region ?? "—"}</td>
                  <td><Tag status={v.subscription_status} /></td>
                  <td>{v.trial_ends_at?.slice(0, 10) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tag({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "vy-tag vy-tag-active"
      : status === "trialing"
      ? "vy-tag vy-tag-trial"
      : status === "past_due"
      ? "vy-tag vy-tag-paused"
      : "vy-tag vy-tag-soft";
  return <span className={cls}>{status}</span>;
}
