import { createClient } from "@/lib/supabase/server";
import { getYocoConfig } from "@/lib/billing/yoco";
import { startSubscription } from "./actions";

const MONTHLY_R = 1499;

export default async function OwnerBilling() {
  const supabase = await createClient();
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, slug, subscription_status, trial_ends_at, yoco_customer_id")
    .order("created_at");

  const yoco = getYocoConfig();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <div className="text-sm text-gray-600">
        Plan: R{MONTHLY_R}/mo per venue · Yoco {yoco.live ? "live" : <span className="text-amber-600">not configured (set YOCO_SECRET_KEY)</span>}
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr><th>Venue</th><th>Status</th><th>Trial ends</th><th>Yoco customer</th><th></th></tr>
        </thead>
        <tbody>
          {venues?.map((v) => (
            <tr key={v.id} className="border-t">
              <td className="py-2">{v.name}</td>
              <td>{v.subscription_status}</td>
              <td>{v.trial_ends_at?.slice(0, 10) ?? "—"}</td>
              <td className="font-mono text-xs">{v.yoco_customer_id ?? "—"}</td>
              <td>
                {v.subscription_status !== "active" && (
                  <form action={startSubscription.bind(null, v.id, v.slug)}>
                    <button className="text-blue-600 hover:underline text-xs">start subscription</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {!venues?.length && <tr><td colSpan={5} className="py-4 text-gray-500">No venues yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
