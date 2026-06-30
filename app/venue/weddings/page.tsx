import { headers } from "next/headers";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { createWedding, setPortalPassword, markCouplePaid, deleteWedding, updateWeddingStatus } from "./actions";
import { WeddingRowActions } from "@/components/WeddingRowActions";
import { WeddingsTable, type WeddingRow } from "@/components/WeddingsTable";
import { SaveButton } from "@/components/SaveButton";
import { BookingsCalendar } from "@/components/BookingsCalendar";
import { computeWeddingsProgress } from "@/lib/venue/progress";

export default async function VenueWeddings({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; end?: string }>;
}) {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const sp = await searchParams;
  const prefillDate = (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)) ? sp.date : "";
  const prefillEnd = (sp.end && /^\d{4}-\d{2}-\d{2}$/.test(sp.end)) ? sp.end : "";
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "venuely.co.za";
  const proto = h.get("x-forwarded-proto") || "https";
  const base = `${proto}://${host}`;

  const { data: weddings } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, wedding_end_date, guest_count, status, portal_password_hash, invoiced_at, couple_paid_at, area_selections")
    .eq("venue_id", venue.id)
    .order("wedding_date", { ascending: false });

  // Planning progress + health per wedding (guests, rooms, timeline, selections,
  // checklist, payments — see lib/venue/progress.ts).
  const progressMap = await computeWeddingsProgress(
    supabase,
    (weddings ?? []).map((w) => ({ id: w.id as string, area_selections: w.area_selections })),
  );

  const rows: WeddingRow[] = (weddings ?? []).map((w) => ({
    id: w.id as string,
    couple: w.couple_names as string,
    date: (w.wedding_date as string | null) ?? null,
    endDate: (w.wedding_end_date as string | null) ?? null,
    guests: w.guest_count == null ? null : Number(w.guest_count),
    status: String(w.status ?? "inquiry"),
    progressPct: progressMap.get(w.id as string)?.pct ?? 0,
    health: progressMap.get(w.id as string)?.health ?? "risk",
    missing: progressMap.get(w.id as string)?.missing ?? [],
    portalShort: `${host}/${w.slug}`,
    portalFull: `${base}/${w.slug}`,
    actions: (
      <WeddingRowActions
        portalUrl={`${base}/${w.slug}`}
        slug={w.slug as string}
        passwordSet={!!w.portal_password_hash}
        invoicedAt={w.invoiced_at as string | null}
        couplePaidAt={w.couple_paid_at as string | null}
        coupleNames={w.couple_names as string}
        setPasswordAction={setPortalPassword.bind(null, w.id as string, w.slug as string)}
        markCouplePaidAction={markCouplePaid.bind(null, w.id as string, w.slug as string)}
        deleteAction={deleteWedding.bind(null, w.id as string, w.slug as string)}
      />
    ),
  }));

  return (
    <div className="space-y-8 anim-fade-up">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="vy-eyebrow">Customers</div>
          <h1 className="vy-h1 mt-1">Weddings at {venue.name}</h1>
          <p className="text-stone-600 text-sm mt-1">
            Add a booked couple to generate their private portal URL.
          </p>
          {prefillDate && (
            <p className="text-sm mt-2 font-medium" style={{ color: "var(--poppy)" }}>
              New wedding for {prefillDate}{prefillEnd ? ` → ${prefillEnd}` : ""} — just add the couple below.
            </p>
          )}
        </div>
        <a href="#add-wedding" className="vy-btn vy-btn-primary">+ Add wedding</a>
      </header>

      {/* Bookings calendar at a glance — every wedding on the month grid (multi-day
          spans included). Clicking a day jumps to that wedding. */}
      <BookingsCalendar
        bookings={(weddings ?? []).map((w) => ({
          slug: w.slug as string,
          couple_names: w.couple_names as string,
          wedding_date: w.wedding_date as string,
          wedding_end_date: (w.wedding_end_date as string | null) ?? null,
          status: String(w.status ?? "inquiry"),
        }))}
        weddingHref="/venue/weddings"
      />

      {/* Add-wedding form — laid out per the dashboard mock: 3-column rows with
          inline hints, submit bottom-right. */}
      <form id="add-wedding" action={createWedding.bind(null, venue.id, venue.slug)} className="vy-card grid gap-x-5 gap-y-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="vy-label">Couple names</label>
          <input name="couple_names" required placeholder="e.g. Alex & Sam" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Guests</label>
          <input name="guest_count" type="number" min="0" placeholder="e.g. 120" className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">URL slug (optional)</label>
          <input name="slug" placeholder="auto-generated" className="vy-input font-mono text-sm" />
          <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>Leave blank to auto-generate</p>
        </div>

        <div className="space-y-1">
          <label className="vy-label">Start date</label>
          <input name="wedding_date" type="date" defaultValue={prefillDate} className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">End date <span style={{ color: "var(--ink-2)", fontWeight: 400 }}>(multi-day — optional)</span></label>
          <input name="wedding_end_date" type="date" defaultValue={prefillEnd} className="vy-input" />
        </div>
        <div className="space-y-1">
          <label className="vy-label">Status</label>
          <select name="status" defaultValue="inquiry" className="vy-select">
            <option value="inquiry">Inquiry</option>
            <option value="provisional">Provisional</option>
            <option value="booked">Booked</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="md:col-span-2 space-y-1">
          <label className="vy-label">Portal password (optional)</label>
          <input name="portal_password" type="text" placeholder="Leave blank for Supabase login access" className="vy-input" autoComplete="off" />
          <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>Couples will use this password to access their private portal.</p>
        </div>
        <div className="flex items-end justify-end">
          <SaveButton label="Add wedding" savedLabel="Added ✓" className="vy-btn vy-btn-primary" />
        </div>
      </form>

      {!rows.length ? (
        <div className="vy-empty">No weddings yet — add one above to generate the couple&apos;s portal URL.</div>
      ) : (
        <WeddingsTable rows={rows} onSetStatus={updateWeddingStatus} />
      )}
    </div>
  );
}
