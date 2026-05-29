import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { setEnquiryStatus, convertEnquiry } from "./actions";

type EnquiryRow = {
  id: string;
  couple_name: string | null;
  email: string | null;
  phone: string | null;
  event_date: string | null;
  guest_count: number | null;
  message: string | null;
  status: "new" | "quoted" | "booked" | "lost";
  source: string | null;
  wedding_id: string | null;
  created_at: string;
};

const COLUMNS: { key: EnquiryRow["status"]; label: string; accent: string }[] = [
  { key: "new", label: "New", accent: "var(--poppy)" },
  { key: "quoted", label: "Quoted", accent: "#C99A3B" },
  { key: "booked", label: "Booked", accent: "#2f6b4b" },
  { key: "lost", label: "Lost", accent: "var(--ink-2)" },
];

export default async function VenueEnquiries() {
  // Layout already gates, but gate explicitly here too (defence in depth).
  await requireRole(["venue_admin", "owner"]);
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: enquiriesRaw } = await supabase
    .from("enquiries")
    .select("id, couple_name, email, phone, event_date, guest_count, message, status, source, wedding_id, created_at")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false });

  const enquiries = (enquiriesRaw ?? []) as EnquiryRow[];
  const byStatus = (s: EnquiryRow["status"]) => enquiries.filter((e) => e.status === s);

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Pipeline</div>
        <h1 className="vy-h1 mt-1">Enquiries at {venue.name}</h1>
        <p className="text-stone-600 text-sm mt-1">
          Leads from your public listing land here. Move them through the pipeline, then convert a
          won lead into the couple&apos;s private portal.
        </p>
      </header>

      {enquiries.length === 0 ? (
        <div className="vy-empty">
          No enquiries yet. When your venue is listed publicly, leads from{" "}
          <span className="font-mono">/v/{venue.slug}</span> will appear here.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4 items-start">
          {COLUMNS.map((col) => {
            const items = byStatus(col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: col.accent }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {col.label}
                  </span>
                  <span className="text-xs" style={{ color: "var(--ink-2)" }}>
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div
                    className="rounded-xl px-3 py-6 text-center text-xs"
                    style={{ border: "1px dashed var(--line)", background: "var(--bone)", color: "var(--ink-2)" }}
                  >
                    —
                  </div>
                ) : (
                  items.map((e) => (
                    <EnquiryCard key={e.id} enquiry={e} accent={col.accent} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EnquiryCard({ enquiry: e, accent }: { enquiry: EnquiryRow; accent: string }) {
  const allMoves: { to: EnquiryRow["status"]; label: string }[] = [
    { to: "new", label: "New" },
    { to: "quoted", label: "Quoted" },
    { to: "lost", label: "Lost" },
  ];
  const moves = allMoves.filter((m) => m.to !== e.status);

  return (
    <div
      className="relative rounded-2xl bg-white p-4 space-y-2.5"
      style={{ border: "1px solid var(--line)" }}
    >
      <span aria-hidden className="absolute left-0 top-3 bottom-3 w-1 rounded-r-md" style={{ background: accent }} />
      <div className="pl-2">
        <div className="font-serif text-base leading-tight" style={{ color: "var(--ink)", fontWeight: 700 }}>
          {e.couple_name || "Unnamed enquiry"}
        </div>
        <div className="text-xs mt-0.5 space-y-0.5" style={{ color: "var(--ink-2)" }}>
          {e.email && (
            <div className="truncate">
              <a href={`mailto:${e.email}`} className="hover:underline">{e.email}</a>
            </div>
          )}
          {e.phone && <div>{e.phone}</div>}
          <div>
            {e.event_date ? new Date(e.event_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "Date TBC"}
            {e.guest_count != null ? ` · ${e.guest_count} guests` : ""}
          </div>
        </div>

        {e.message && (
          <p
            className="text-xs mt-2 leading-relaxed rounded-lg p-2 line-clamp-4"
            style={{ background: "var(--cream)", color: "var(--ink-2)" }}
          >
            {e.message}
          </p>
        )}

        <div className="text-[10px] mt-2" style={{ color: "var(--ink-2)" }}>
          {new Date(e.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
          {e.source ? ` · ${e.source}` : ""}
        </div>

        {/* Actions */}
        <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-1.5" style={{ borderColor: "var(--line)" }}>
          {e.wedding_id ? (
            <Link
              href="/venue/weddings"
              className="rounded-full px-3 py-1 text-[11px] font-medium"
              style={{ background: "var(--leaf)", color: "#1f5d3e", border: "1px solid #c2dbcf" }}
            >
              ✓ Portal created
            </Link>
          ) : (
            <form action={convertEnquiry.bind(null, e.id)}>
              <button
                type="submit"
                className="rounded-full px-3 py-1 text-[11px] font-medium text-white transition hover:opacity-90"
                style={{ background: "var(--poppy)" }}
              >
                → Convert to portal
              </button>
            </form>
          )}

          {moves.map((m) => (
            <form key={m.to} action={setEnquiryStatus.bind(null, e.id, m.to)}>
              <button
                type="submit"
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-stone-100"
                style={{ border: "1px solid var(--line)", color: "var(--ink-2)" }}
              >
                {m.label}
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
