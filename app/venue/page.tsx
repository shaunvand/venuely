import Link from "next/link";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { computeSetupSteps } from "@/lib/venue/setup";
import { applyMarkup } from "@/lib/billing/compute";
import { WelcomeImportModal } from "@/components/WelcomeImportModal";
import { BookingsCalendar } from "@/components/BookingsCalendar";

type Commish = { commission_value: number | null; commission_type: string | null };
type Priced = { price?: number | string | null; price_per_night?: number | string | null; price_from?: number | string | null } & Commish & { active?: boolean | null };

function commissionOf(row: Priced): number {
  const base = Number(row.price ?? row.price_per_night ?? row.price_from ?? 0);
  if (!base) return 0;
  const marked = applyMarkup(base, row.commission_value ?? 0, row.commission_type);
  return Math.max(0, marked - base);
}

function fmtRand(n: number): string {
  return `R${Math.round(n).toLocaleString("en-ZA")}`;
}

export default async function VenueOverview() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { doneCount, totalCount, pct, counts } = await computeSetupSteps(supabase, venue);
  const todayIso = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [
    { data: upcoming },
    { data: recentWeddings },
    { data: allWeddings },
    { data: paySum },
    { data: rentalRows },
    { data: roomRows },
    { data: vendorRows },
  ] = await Promise.all([
    supabase.from("weddings").select("id, slug, couple_names, wedding_date").eq("venue_id", venue.id).gte("wedding_date", todayIso).order("wedding_date").limit(5),
    supabase.from("weddings").select("id, slug, couple_names, wedding_date").eq("venue_id", venue.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("weddings").select("slug, couple_names, wedding_date").eq("venue_id", venue.id),
    supabase.from("payments").select("amount, status, due_date, paid_date, wedding:weddings!inner(id, slug, couple_names, venue_id)").eq("wedding.venue_id", venue.id),
    supabase.from("rental_items").select("price, commission_value, commission_type, active, stock_total").eq("venue_id", venue.id),
    supabase.from("accommodation_rooms").select("price_per_night, commission_value, commission_type, active").eq("venue_id", venue.id),
    supabase.from("vendor_partners").select("price_from, commission_value, commission_type, active").eq("venue_id", venue.id),
  ]);

  type Pay = { amount: number | string; status: string | null; due_date: string | null; paid_date: string | null; wedding: { id: string; slug: string; couple_names: string } | null };
  const payments = (paySum ?? []).map((p) => {
    const w = (p as { wedding?: unknown }).wedding;
    const single = Array.isArray(w) ? (w[0] ?? null) : (w ?? null);
    return { ...p, wedding: single } as Pay;
  });
  const collected = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount || 0), 0);
  const invoiced = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const outstanding = invoiced - collected;
  const overdue = payments.filter((p) => p.status !== "paid" && p.due_date && p.due_date < todayIso);
  const overdueTotal = overdue.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Commission potential — what the venue earns at full utilisation across all active items.
  const commissionRentals = (rentalRows ?? []).filter((r) => r.active !== false).reduce((s, r) => s + commissionOf(r as Priced) * Number((r as { stock_total?: number }).stock_total ?? 1), 0);
  const commissionRooms = (roomRows ?? []).filter((r) => r.active !== false).reduce((s, r) => s + commissionOf(r as Priced), 0);
  const commissionVendors = (vendorRows ?? []).filter((r) => r.active !== false).reduce((s, r) => s + commissionOf(r as Priced), 0);
  const commissionTotal = commissionRentals + commissionRooms + commissionVendors;

  // Revenue bars — invoiced + collected per month, last 6 months including current.
  const monthBuckets: { label: string; key: string; invoiced: number; collected: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({
      label: d.toLocaleDateString("en-ZA", { month: "short" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      invoiced: 0,
      collected: 0,
    });
  }
  payments.forEach((p) => {
    const dateStr = p.paid_date || p.due_date;
    if (!dateStr) return;
    const k = dateStr.slice(0, 7);
    const b = monthBuckets.find((m) => m.key === k);
    if (!b) return;
    b.invoiced += Number(p.amount || 0);
    if (p.status === "paid") b.collected += Number(p.amount || 0);
  });
  const maxBar = Math.max(1, ...monthBuckets.map((b) => Math.max(b.invoiced, b.collected)));

  // Bookings per upcoming month, next 6 months.
  const bookingBuckets: { label: string; key: string; count: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    bookingBuckets.push({
      label: d.toLocaleDateString("en-ZA", { month: "short" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      count: 0,
    });
  }
  (allWeddings ?? []).forEach((w) => {
    if (!w.wedding_date) return;
    const k = String(w.wedding_date).slice(0, 7);
    const b = bookingBuckets.find((m) => m.key === k);
    if (b) b.count++;
  });
  const maxBookings = Math.max(1, ...bookingBuckets.map((b) => b.count));

  // Notifications.
  const within30 = (upcoming ?? []).filter((w) => w.wedding_date && w.wedding_date <= in30);
  const lowStockRentals = (rentalRows ?? []).filter((r) => Number((r as { stock_total?: number }).stock_total ?? 0) > 0 && Number((r as { stock_total?: number }).stock_total ?? 0) <= 2 && r.active !== false);
  const notifications: { tone: "warn" | "info" | "success"; icon: string; msg: React.ReactNode; href?: string }[] = [];
  overdue.slice(0, 5).forEach((p) => {
    notifications.push({
      tone: "warn",
      icon: "⚠",
      msg: <>Overdue: {fmtRand(Number(p.amount))} from <strong>{p.wedding?.couple_names ?? "wedding"}</strong> · due {p.due_date}</>,
      href: p.wedding ? `/venue/weddings/${p.wedding.slug}` : "/venue/payments",
    });
  });
  within30.slice(0, 3).forEach((w) => {
    const days = Math.max(0, Math.round((new Date(w.wedding_date).getTime() - now.getTime()) / 86400000));
    notifications.push({
      tone: "info",
      icon: "📅",
      msg: <><strong>{w.couple_names}</strong> wedding in {days} day{days === 1 ? "" : "s"}</>,
      href: `/venue/weddings/${w.slug}`,
    });
  });
  if (pct < 100) {
    notifications.push({
      tone: "info",
      icon: "✓",
      msg: <>Setup {pct}% complete — {totalCount - doneCount} step{totalCount - doneCount === 1 ? "" : "s"} left</>,
      href: "/venue/setup",
    });
  }
  if (commissionTotal === 0 && (counts.rentals > 0 || counts.rooms > 0)) {
    notifications.push({
      tone: "info",
      icon: "💡",
      msg: <>No commission set on your rentals or accommodation — add markup to earn on bookings</>,
      href: "/venue/rentals",
    });
  }
  if (lowStockRentals.length) {
    notifications.push({
      tone: "warn",
      icon: "📦",
      msg: <>{lowStockRentals.length} rental item{lowStockRentals.length === 1 ? "" : "s"} running low on stock</>,
      href: "/venue/rentals",
    });
  }

  // Nudge if the setup checklist isn't complete OR they haven't run Smart Import yet
  // (empty catalogue + rentals + rooms = no import has happened). The modal itself
  // applies a 24-hour cooldown so it isn't shown on every page view.
  const venueEmpty = counts.catalogue === 0 && counts.rentals === 0 && counts.rooms === 0;
  const showWelcome = pct < 100 || venueEmpty;

  const stats = [
    { label: "Upcoming weddings", value: (upcoming?.length ?? 0).toString(), sub: `${counts.weddings} total`, href: "/venue/weddings", accent: "var(--poppy)" },
    { label: "Commission potential", value: fmtRand(commissionTotal), sub: "across active items", href: "/venue/rentals", accent: "var(--sage)" },
    { label: "Payments collected", value: fmtRand(collected), sub: `of ${fmtRand(invoiced)} invoiced`, href: "/venue/payments", accent: "var(--poppy)" },
    { label: "Outstanding", value: fmtRand(outstanding), sub: overdue.length ? `${overdue.length} overdue` : "All paid up", href: "/venue/payments", accent: overdue.length ? "var(--poppy)" : "var(--sage)" },
    { label: "Accommodation rooms", value: counts.rooms.toString(), sub: counts.rooms ? "Active" : "Add your first", href: "/venue/accommodation", accent: "var(--sage)" },
    { label: "Catalogue + rentals", value: (counts.catalogue + counts.rentals).toString(), sub: `${counts.catalogue} included · ${counts.rentals} extras`, href: "/venue/catalogue", accent: "var(--sage)" },
  ];

  const payRatio = invoiced ? collected / invoiced : 0;
  const donutCirc = 2 * Math.PI * 36;

  return (
    <div className="space-y-10">
      {showWelcome && <WelcomeImportModal venueId={venue.id} venueName={venue.name} />}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="vy-eyebrow">Welcome to Venuely</div>
          <h1 className="vy-h1 mt-1">{venue.name}</h1>
          {(venue.address || venue.region) && (
            <p className="text-stone-600 text-sm mt-1">
              {venue.address ?? venue.region}
              {venue.google_maps_url && (
                <a href={venue.google_maps_url} target="_blank" rel="noopener noreferrer" className="ml-2 hover:underline" style={{ color: "var(--poppy)" }}>↗ Maps</a>
              )}
            </p>
          )}
        </div>

        <Link href="/venue/setup" className="vy-card flex items-center gap-3 hover:shadow-md transition-shadow" style={{ padding: "0.55rem 0.9rem" }}>
          <div className="relative w-9 h-9">
            <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--poppy)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 2 * Math.PI * 15} ${2 * Math.PI * 15}`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">{pct}%</span>
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>Setup checklist</div>
            <div className="text-sm font-medium">{doneCount} of {totalCount} done →</div>
          </div>
        </Link>
      </header>

      {/* Top row — current-month calendar on the left, headline stats stacked on the right */}
      <div className="grid lg:grid-cols-2 gap-4 items-stretch">
        <div>
          <BookingsCalendar
            bookings={(allWeddings ?? []) as { slug: string; couple_names: string; wedding_date: string }[]}
            months={1}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 content-start">
          {stats.slice(0, 4).map((s) => (
            <Link key={s.label} href={s.href} className="vy-stat hover:shadow-md transition-shadow relative overflow-hidden">
              <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: s.accent }} />
              <div className="vy-stat-label">{s.label}</div>
              <div className="vy-stat-value" style={{ color: s.accent }}>{s.value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--ink-2)" }}>{s.sub}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Remaining stats — secondary row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.slice(4).map((s) => (
          <Link key={s.label} href={s.href} className="vy-stat hover:shadow-md transition-shadow relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: s.accent }} />
            <div className="vy-stat-label">{s.label}</div>
            <div className="vy-stat-value" style={{ color: s.accent }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--ink-2)" }}>{s.sub}</div>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue bars */}
        <section className="vy-card lg:col-span-2">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="vy-eyebrow">Revenue · last 6 months</div>
              <h2 className="vy-h2 mt-1">Invoiced vs collected</h2>
            </div>
            <div className="flex items-center gap-4 text-xs" style={{ color: "var(--ink-2)" }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--peach)" }} /> Invoiced</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--poppy)" }} /> Collected</span>
            </div>
          </div>
          <div className="flex items-end gap-3 h-44 px-1">
            {monthBuckets.map((b) => (
              <div key={b.key} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end gap-1 h-36">
                  <div className="flex-1 rounded-t-md transition-all" title={`Invoiced ${fmtRand(b.invoiced)}`} style={{ height: `${(b.invoiced / maxBar) * 100}%`, background: "var(--peach)", minHeight: b.invoiced > 0 ? "4px" : "0" }} />
                  <div className="flex-1 rounded-t-md transition-all" title={`Collected ${fmtRand(b.collected)}`} style={{ height: `${(b.collected / maxBar) * 100}%`, background: "var(--poppy)", minHeight: b.collected > 0 ? "4px" : "0" }} />
                </div>
                <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>{b.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Donut */}
        <section className="vy-card flex flex-col">
          <div className="vy-eyebrow">Payments</div>
          <h2 className="vy-h2 mt-1 mb-3">{Math.round(payRatio * 100)}% collected</h2>
          <div className="relative w-40 h-40 mx-auto">
            <svg viewBox="0 0 100 100" className="w-40 h-40 -rotate-90">
              <circle cx="50" cy="50" r="36" fill="none" stroke="var(--peach)" strokeWidth="14" />
              <circle cx="50" cy="50" r="36" fill="none" stroke="var(--poppy)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${payRatio * donutCirc} ${donutCirc}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-serif text-lg leading-tight">{fmtRand(collected)}</div>
              <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>of {fmtRand(invoiced)}</div>
            </div>
          </div>
          <div className="mt-4 text-xs space-y-1" style={{ color: "var(--ink-2)" }}>
            <div className="flex justify-between"><span>Outstanding</span><span style={{ color: "var(--ink)", fontWeight: 600 }}>{fmtRand(outstanding)}</span></div>
            {overdue.length > 0 && (
              <div className="flex justify-between"><span>Overdue</span><span style={{ color: "var(--poppy)", fontWeight: 600 }}>{fmtRand(overdueTotal)}</span></div>
            )}
          </div>
        </section>
      </div>

      {/* Commission breakdown + bookings calendar + notifications */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Commission */}
        <section className="vy-card">
          <div className="vy-eyebrow">Commission</div>
          <h2 className="vy-h2 mt-1 mb-1">{fmtRand(commissionTotal)}</h2>
          <p className="text-xs mb-4" style={{ color: "var(--ink-2)" }}>Earned at full utilisation across active items</p>
          {commissionTotal > 0 ? (
            <div className="space-y-3">
              {[
                { label: "Rentals", v: commissionRentals, c: "var(--poppy)" },
                { label: "Accommodation", v: commissionRooms, c: "var(--sage)" },
                { label: "Partner vendors", v: commissionVendors, c: "var(--peach)" },
              ].map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "var(--ink-2)" }}>{r.label}</span>
                    <span className="font-medium tabular-nums">{fmtRand(r.v)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--line)" }}>
                    <div className="h-full rounded-full" style={{ width: `${commissionTotal ? (r.v / commissionTotal) * 100 : 0}%`, background: r.c }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="vy-empty text-left text-xs">
              No commission configured yet.{" "}
              <Link href="/venue/rentals" className="underline" style={{ color: "var(--poppy)" }}>Set commission on rentals</Link>.
            </div>
          )}
        </section>

        {/* Bookings */}
        <section className="vy-card">
          <div className="vy-eyebrow">Bookings · next 6 months</div>
          <h2 className="vy-h2 mt-1 mb-4">{(allWeddings ?? []).filter((w) => w.wedding_date >= todayIso).length} upcoming</h2>
          <div className="flex items-end gap-2 h-32">
            {bookingBuckets.map((b) => (
              <div key={b.key} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="text-[10px] tabular-nums font-medium" style={{ color: b.count ? "var(--poppy)" : "var(--ink-2)" }}>{b.count || ""}</div>
                <div className="w-full rounded-t-md" style={{ height: `${(b.count / maxBookings) * 90}%`, background: b.count ? "var(--poppy)" : "var(--line)", minHeight: "4px" }} />
                <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>{b.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className="vy-card">
          <div className="flex items-baseline justify-between">
            <div className="vy-eyebrow">Notifications</div>
            {notifications.length > 0 && <span className="vy-tag vy-tag-soft">{notifications.length}</span>}
          </div>
          <div className="mt-3 space-y-2">
            {notifications.length === 0 ? (
              <div className="vy-empty text-xs">You&apos;re all caught up ✓</div>
            ) : notifications.slice(0, 6).map((n, i) => (
              <Link
                key={i}
                href={n.href ?? "#"}
                className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs hover:bg-[color:var(--cream)] transition-colors"
                style={{ border: "1px solid var(--line)" }}
              >
                <span
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px]"
                  style={{ background: n.tone === "warn" ? "var(--peach)" : n.tone === "success" ? "var(--leaf)" : "var(--sage-2)" }}
                >
                  {n.icon}
                </span>
                <span className="flex-1 pt-0.5 leading-relaxed">{n.msg}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Bookings calendar — booked dates highlighted, hover shows couple name */}
      <BookingsCalendar bookings={(allWeddings ?? []) as { slug: string; couple_names: string; wedding_date: string }[]} />

      {/* Upcoming weddings list */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="vy-h2">Upcoming weddings</h2>
          <Link href="/venue/weddings" className="text-sm hover:underline" style={{ color: "var(--poppy)" }}>View all →</Link>
        </div>
        {upcoming && upcoming.length > 0 ? (
          <div className="vy-card divide-y" style={{ padding: 0 }}>
            {upcoming.map((w) => {
              const days = Math.round((new Date(w.wedding_date).getTime() - now.getTime()) / 86400000);
              return (
                <Link key={w.id} href={`/venue/weddings/${w.slug}`} className="flex items-center justify-between px-4 py-3 hover:bg-[color:var(--cream)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[15px]">{w.couple_names}</div>
                    <div className="text-xs" style={{ color: "var(--ink-2)" }}>
                      {new Date(w.wedding_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full"
                      style={{ background: days <= 30 ? "var(--peach)" : "var(--cream)", color: days <= 30 ? "var(--poppy-deep)" : "var(--ink-2)" }}
                    >
                      {days <= 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}
                    </span>
                    <span style={{ color: "var(--poppy)" }}>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="vy-empty">
            No upcoming weddings.{" "}
            <Link href="/venue/weddings" className="underline" style={{ color: "var(--poppy)" }}>Add one</Link>.
          </div>
        )}
      </section>

      {/* Recently added */}
      {recentWeddings && recentWeddings.length > 0 && counts.weddings > (upcoming?.length ?? 0) && (
        <section>
          <h2 className="vy-h2 mb-3">Recently added</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {recentWeddings.slice(0, 4).map((w) => (
              <Link key={w.id} href={`/venue/weddings/${w.slug}`} className="vy-card hover:shadow-md transition-shadow">
                <div className="font-medium text-[15px]">{w.couple_names}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
                  {new Date(w.wedding_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
