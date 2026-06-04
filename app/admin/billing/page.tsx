import { createClient } from "@/lib/supabase/server";

export default async function OwnerBilling() {
  const supabase = await createClient();
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, slug, platform_fee_rate, platform_fee_active, created_at")
    .order("created_at");

  // Compute fees owed per venue from confirmed wedding selections.
  // For each venue: sum (booked weddings total_budget) × platform_fee_rate.
  const venueIds = (venues ?? []).map((v) => v.id);
  let weddingsByVenue: Record<string, { total: number; booked: number; pending: number }> = {};
  if (venueIds.length) {
    const { data: weds } = await supabase
      .from("weddings")
      .select("venue_id, status, total_budget, platform_fee_owed, platform_fee_paid_at")
      .in("venue_id", venueIds);
    weddingsByVenue = (weds ?? []).reduce((acc, w) => {
      const k = w.venue_id as string;
      acc[k] = acc[k] || { total: 0, booked: 0, pending: 0 };
      const budget = Number(w.total_budget ?? 0);
      acc[k].total += budget;
      if (w.platform_fee_paid_at) acc[k].booked += Number(w.platform_fee_owed ?? 0);
      else acc[k].pending += Number(w.platform_fee_owed ?? 0);
      return acc;
    }, {} as Record<string, { total: number; booked: number; pending: number }>);
  }

  // Per-venue enquiry funnel so the founder sees lead flow next to revenue.
  // Reads the wave-3 enquiries table; an empty / missing table yields zeros
  // (we read .data ?? [], never throw).
  type Funnel = { new: number; quoted: number; booked: number; lost: number };
  const enquiriesByVenue: Record<string, Funnel> = {};
  if (venueIds.length) {
    const { data: enqs } = await supabase
      .from("enquiries")
      .select("venue_id, status")
      .in("venue_id", venueIds);
    (enqs ?? []).forEach((e) => {
      const k = e.venue_id as string;
      const f = (enquiriesByVenue[k] = enquiriesByVenue[k] || { new: 0, quoted: 0, booked: 0, lost: 0 });
      const s = e.status as keyof Funnel;
      if (s in f) f[s] += 1;
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="vy-eyebrow">Revenue</div>
        <h1 className="vy-h1 mt-1">Platform fees</h1>
        <p className="text-stone-600 text-sm mt-1">
          0.5% of wedding spend, billed per booking. No flat subscription.
        </p>
      </header>

      <div className="vy-card-hero flex items-center justify-between">
        <div>
          <div className="vy-eyebrow">Pricing model</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-serif text-4xl">0.5%</span>
            <span className="text-stone-500">of wedding spend</span>
          </div>
          <div className="text-xs text-stone-500 mt-1">Per-venue rate adjustable below · no monthly fee</div>
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
                <th>Rate</th>
                <th>Status</th>
                <th>Wedding spend (R)</th>
                <th>Fees collected</th>
                <th>Fees outstanding</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => {
                const stats = weddingsByVenue[v.id as string] || { total: 0, booked: 0, pending: 0 };
                const rate = Number(v.platform_fee_rate ?? 0.005);
                return (
                  <tr key={v.id}>
                    <td><div className="font-medium">{v.name}</div></td>
                    <td>{(rate * 100).toFixed(2)}%</td>
                    <td>
                      <span className={`vy-tag ${v.platform_fee_active ? "vy-tag-active" : "vy-tag-soft"}`}>
                        {v.platform_fee_active ? "active" : "waived"}
                      </span>
                    </td>
                    <td>R{stats.total.toLocaleString()}</td>
                    <td>R{stats.booked.toLocaleString()}</td>
                    <td>{stats.pending > 0 ? <span className="text-amber-700">R{stats.pending.toLocaleString()}</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {venues?.length ? (
        <section className="space-y-3">
          <div>
            <div className="vy-eyebrow">Lead flow</div>
            <h2 className="vy-h2 mt-1">Enquiry funnel per venue</h2>
            <p className="text-stone-600 text-sm mt-1">
              Where each venue&apos;s leads sit in the pipeline — from new enquiry to booked.
            </p>
          </div>
          <div className="vy-card p-0 overflow-hidden">
            <table className="vy-table">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>New</th>
                  <th>Quoted</th>
                  <th>Booked</th>
                  <th>Lost</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => {
                  const f = enquiriesByVenue[v.id as string] || { new: 0, quoted: 0, booked: 0, lost: 0 };
                  const total = f.new + f.quoted + f.booked + f.lost;
                  return (
                    <tr key={v.id}>
                      <td><div className="font-medium">{v.name}</div></td>
                      <td>{f.new}</td>
                      <td>{f.quoted}</td>
                      <td>{f.booked > 0 ? <span className="text-emerald-700">{f.booked}</span> : 0}</td>
                      <td>{f.lost > 0 ? <span className="text-stone-400">{f.lost}</span> : 0}</td>
                      <td className="font-medium">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
