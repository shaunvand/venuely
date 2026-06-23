import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { InventoryManager } from "@/components/InventoryManager";
import { BulkUploader } from "@/components/BulkUploader";
import { INVENTORY_FIELDS } from "@/lib/inventory/schemas";

export default async function VenueRentals({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showIncluded = view !== "extras";
  const showExtras = view !== "included";
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("rental_items")
    .select("id, category, name, description, price, stock_total, active, image_url, cost_treatment, commission_value, commission_type")
    .eq("venue_id", venue.id)
    .order("category")
    .order("sort_order");

  const all = (items ?? []) as Array<Record<string, unknown> & { id: string }>;
  const included = all.filter((i) => i.cost_treatment === "included");
  const extras = all.filter((i) => i.cost_treatment !== "included");

  const fields = INVENTORY_FIELDS.rentals.map((f) => ({
    key: f.key, label: f.label, type: f.type, options: f.options ?? null, required: !!f.required,
  }));

  return (
    <div className="space-y-10">
      <header>
        <div className="vy-eyebrow">Marketplace · rentals</div>
        <h1 className="vy-h1 mt-1">Rentals</h1>
        <p className="text-stone-600 text-sm mt-1">
          Split into what&apos;s included in the venue price vs. paid extras. Couples pick quantity + days; totals tally automatically.
        </p>
      </header>

      {/* Missed the rentals step in setup? Re-open Smart Import here. Collapsed
          by default so it doesn't crowd the lists once stock exists. */}
      <details className="rounded-2xl group" style={{ border: "1px solid var(--line)", background: "var(--cream)" }}>
        <summary className="cursor-pointer select-none list-none px-5 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: "var(--peach)" }}>📄</span>
          <span className="flex-1 min-w-0">
            <span className="font-serif text-lg block leading-tight" style={{ fontWeight: 700 }}>Import your venue stock &amp; rentals</span>
            <span className="text-sm" style={{ color: "var(--ink-2)" }}>Missed this in setup? Upload a PDF, Excel, Word or CSV of your stock and we&apos;ll add them for you.</span>
          </span>
          <span className="text-xs flex-shrink-0" style={{ color: "var(--poppy)" }}>
            <span className="group-open:hidden">Open ▾</span>
            <span className="hidden group-open:inline">Close ▴</span>
          </span>
        </summary>
        <div className="px-5 pb-5 pt-1">
          <BulkUploader venueId={venue.id} />
        </div>
      </details>

      {showIncluded && (
        <details open className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none py-2">
            <span className="text-[10px] transition-transform group-open:rotate-90">▶</span>
            <h2 className="text-lg font-semibold">Included in venue price</h2>
            <span className="vy-tag vy-tag-soft">{included.length}</span>
          </summary>
          <div className="mt-3">
            <InventoryManager
              type="rentals"
              venueId={venue.id}
              items={included}
              fields={fields}
              priceColumn="price"
              showExtraColumns
            />
          </div>
        </details>
      )}

      {showExtras && (
        <details open className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none py-2">
            <span className="text-[10px] transition-transform group-open:rotate-90">▶</span>
            <h2 className="text-lg font-semibold">Paid extras</h2>
            <span className="vy-tag vy-tag-soft">{extras.length}</span>
          </summary>
          <div className="mt-3">
            <InventoryManager
              type="rentals"
              venueId={venue.id}
              items={extras}
              fields={fields}
              priceColumn="price"
              showExtraColumns
            />
          </div>
        </details>
      )}
    </div>
  );
}
