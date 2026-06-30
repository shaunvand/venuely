import Link from "next/link";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { SmartImportPanel } from "@/components/SmartImportPanel";

export const dynamic = "force-dynamic";

// ONE inventory hub: every "thing in your venue" couples can choose, under a
// single mental model (with the same Included-vs-Extra language everywhere),
// instead of six separate near-identical pages. Each card links to its editor.
export default async function VenueInventoryHub() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const [cat, rent, area, room, table] = await Promise.all([
    supabase.from("catalogue_items").select("id, cost_treatment", { count: "exact" }).eq("venue_id", venue.id),
    supabase.from("rental_items").select("id, cost_treatment", { count: "exact" }).eq("venue_id", venue.id),
    supabase.from("venue_areas").select("id, area_kind", { count: "exact" }).eq("venue_id", venue.id),
    supabase.from("accommodation_rooms").select("id, cost_treatment", { count: "exact" }).eq("venue_id", venue.id),
    supabase.from("venue_tables").select("id, seats, quantity", { count: "exact" }).eq("venue_id", venue.id),
  ]);

  const incExt = (rows: { cost_treatment?: string | null }[] | null) => {
    const list = rows ?? [];
    const inc = list.filter((r) => r.cost_treatment === "included").length;
    return { inc, ext: list.length - inc };
  };
  const c = incExt(cat.data as { cost_treatment?: string | null }[] | null);
  const r = incExt(rent.data as { cost_treatment?: string | null }[] | null);
  const m = incExt(room.data as { cost_treatment?: string | null }[] | null);
  const areaRows = (area.data ?? []) as { area_kind?: string | null }[];
  const areaInc = areaRows.filter((a) => a.area_kind === "main").length;

  // Seating: a row is a table layout with a quantity; couples plan on the SEATS.
  // Surface the seat capacity (not just the layout count) so a save is visible.
  const tableRows = (table.data ?? []) as { seats?: number | null; quantity?: number | null }[];
  const totalTables = tableRows.reduce((s, t) => s + (Number(t.quantity) || 1), 0);
  const totalSeats = tableRows.reduce((s, t) => s + (Number(t.seats) || 0) * (Number(t.quantity) || 1), 0);

  const cards = [
    { href: "/venue/catalogue", title: "Catalogue", desc: "Menus, packages and per-head items couples tick by day.", count: cat.count ?? 0, split: `${c.inc} included · ${c.ext} extra` },
    { href: "/venue/rentals", title: "Rentals & stock", desc: "Hire items — chairs, linen, décor, equipment.", count: rent.count ?? 0, split: `${r.inc} included · ${r.ext} extra` },
    { href: "/venue/areas", title: "Spaces & areas", desc: "Ceremony, reception and optional paid spaces.", count: area.count ?? 0, split: `${areaInc} included · ${(area.count ?? 0) - areaInc} extra` },
    { href: "/venue/accommodation", title: "Accommodation", desc: "On-site rooms couples assign their guests to.", count: room.count ?? 0, split: `${m.inc} included · ${m.ext} extra` },
    { href: "/venue/seating", title: "Seating & tables", desc: "Table layouts couples build their seating plan on.", count: totalSeats, split: `${totalTables} table${totalTables === 1 ? "" : "s"} · ${totalSeats} seat${totalSeats === 1 ? "" : "s"}` },
  ];

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Your venue</div>
        <h1 className="vy-h1 mt-1">Inventory</h1>
        <p className="text-stone-600 text-sm mt-1 max-w-2xl">
          Everything couples can choose for their day, in one place. Each item is either{" "}
          <strong>Included</strong> in your venue price or a paid <strong>Extra</strong> — set that per item inside each section.
        </p>
      </header>

      <SmartImportPanel venueId={venue.id} title="Smart Import your whole venue" blurb="Upload a PDF, Excel, Word or CSV (price lists, stock lists, rooming sheets) and Smart Import sorts everything into the right section — you review before it saves." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="vy-card hover:shadow-md transition-shadow flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg" style={{ fontWeight: 700 }}>{card.title}</h2>
              <span className="text-2xl font-serif" style={{ color: "var(--poppy)", fontWeight: 700 }}>{card.count}</span>
            </div>
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>{card.desc}</p>
            <div className="mt-auto pt-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>{card.split}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
