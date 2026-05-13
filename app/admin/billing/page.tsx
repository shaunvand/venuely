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
      <header>
        <div className="vy-eyebrow">Subscriptions</div>
        <h1 className="vy-h1 mt-1">Billing</h1>
      </header>

      <div className="vy-card-hero flex items-center justify-between">
        <div>
          <div className="vy-eyebrow">Per venue</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-4xl">R{MONTHLY_R}</span>
            <span className="text-stone-500">/ month</span>
          </div>
          <div className="text-xs text-stone-500 mt-1">14-day free trial · cancel anytime</div>
        </div>
        <div>
          <span className={`vy-tag ${yoco.live ? "vy-tag-active" : "vy-tag-paused"}`}>
            Yoco {yoco.live ? "live" : "not configured"}
          </span>
          {!yoco.live && (
            <div className="text-xs text-stone-500 mt-2 max-w-xs text-right">
              Set <code className="bg-stone-100 px-1 rounded">YOCO_SECRET_KEY</code> on Render.
            </div>
          )}
        </div>
      </div>

      {!venues?.length ? (
        <div className="vy-empty">No venues yet.</div>
      ) : (
        <div className="vy-card p-0 overflow-hidden">
          <table className="vy-table">
            <thead>
              <tr>
                <th>Venue</th>
                <th>Status</th>
                <th>Trial ends</th>
                <th>Yoco customer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td><div className="font-medium">{v.name}</div></td>
                  <td>
                    <span className={`vy-tag ${v.subscription_status === "active" ? "vy-tag-active" : v.subscription_status === "trialing" ? "vy-tag-trial" : "vy-tag-soft"}`}>
                      {v.subscription_status}
                    </span>
                  </td>
                  <td>{v.trial_ends_at?.slice(0, 10) ?? "—"}</td>
                  <td className="font-mono text-xs">{v.yoco_customer_id ?? "—"}</td>
                  <td className="text-right">
                    {v.subscription_status !== "active" && (
                      <form action={startSubscription.bind(null, v.id, v.slug)}>
                        <button className="vy-btn vy-btn-secondary">Start subscription</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
