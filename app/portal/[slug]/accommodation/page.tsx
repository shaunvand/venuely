import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AccommodationGrid } from "@/components/AccommodationGrid";
import { applyMarkup } from "@/lib/billing/compute";

export default async function CoupleAccommodation({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, venue_id, wedding_state, venue:venues(id, name)")
    .eq("slug", slug)
    .single();
  if (!wedding) notFound();

  const [{ data: rooms }, { data: media }] = await Promise.all([
    supabase
      .from("accommodation_rooms")
      .select("id, name, room_type, tier, sleeps, ideal_sleeps, max_sleeps, price_per_night, description, image_url, hero_image_url, floor_plan_url, amenities, bridal_suite, parent_room_id, bed_config, commission_value, commission_type, active, sort_order")
      .eq("venue_id", wedding.venue_id)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("media_assets")
      .select("id, owner_id, kind, url, label, sort_order")
      .in("kind", ["photo", "floorplan"])
      .order("sort_order"),
  ]);

  const mediaByOwner: Record<string, Array<{ url: string; kind: string; label: string | null }>> = {};
  (media ?? []).forEach((m) => {
    if (!m.owner_id) return;
    (mediaByOwner[m.owner_id] = mediaByOwner[m.owner_id] || []).push({ url: m.url, kind: m.kind, label: m.label });
  });

  const enriched = (rooms ?? []).map((r) => ({
    ...r,
    price_per_night: applyMarkup(Number(r.price_per_night), r.commission_value as number | null, r.commission_type as string | null),
    gallery: mediaByOwner[r.id] ?? [],
  }));

  const state = (wedding.wedding_state ?? {}) as { roomAssignments?: Record<string, string[]>; guests?: string[] };
  const venue = (wedding as unknown as { venue: { name: string } | null }).venue;

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-500">{venue?.name}</div>
            <h1 className="font-serif text-2xl mt-0.5">Accommodation for {wedding.couple_names}</h1>
          </div>
          <Link href={`/${wedding.slug}`} className="text-sm text-stone-600 hover:text-stone-900">← Back to portal</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <AccommodationGrid
          rooms={enriched as Parameters<typeof AccommodationGrid>[0]["rooms"]}
          guests={state.guests ?? []}
          initialAssignments={state.roomAssignments ?? {}}
          weddingSlug={wedding.slug}
        />
      </div>
    </main>
  );
}
