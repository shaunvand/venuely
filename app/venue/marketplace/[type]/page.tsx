import { notFound } from "next/navigation";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { InventoryManager } from "@/components/InventoryManager";
import { INVENTORY_FIELDS, VENDOR_LABELS, VENDOR_DB_VALUE, isVendorType } from "@/lib/inventory/schemas";

export default async function VendorPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isVendorType(type)) notFound();

  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("vendor_partners")
    .select("id, name, description, contact_email, contact_phone, website_url, price_from, image_url, active")
    .eq("venue_id", venue.id)
    .eq("vendor_type", VENDOR_DB_VALUE[type])
    .order("sort_order");

  const label = VENDOR_LABELS[type];

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Marketplace · partner vendors</div>
        <h1 className="vy-h1 mt-1">{label}</h1>
        <p className="text-stone-600 text-sm mt-1">
          Vendors you trust and recommend to your couples. They&apos;ll see these on their portal as approved partners.
        </p>
      </header>

      <InventoryManager
        type={type}
        venueId={venue.id}
        items={(items ?? []) as Array<Record<string, unknown> & { id: string }>}
        fields={INVENTORY_FIELDS[type].map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? null, required: !!f.required }))}
        priceColumn="price_from"
      />
    </div>
  );
}
