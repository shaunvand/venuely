import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import { AccommodationGrid } from "@/components/AccommodationGrid";
import { applyMarkup } from "@/lib/billing/compute";
import { ConfirmBookings } from "./ConfirmBookings";

// Each physical room is one bookable unit per night.
const ROOM_CAPACITY = 1;

export default async function CoupleAccommodation({ params }: { params: Promise<{ wedding: string }> }) {
  const { wedding: slug } = await params;
  const access = await portalAccess(slug);
  if (!access.ok) {
    if (access.status === 404) notFound();
    // For 401/403 send them back to the main portal which handles the password prompt.
    redirect(`/${slug}`);
  }

  const ad = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const [{ data: wedding }, { data: rooms }, { data: media }] = await Promise.all([
    ad.from("weddings").select("id, slug, couple_names, wedding_date, venue_id, wedding_state, venue:venues(id, name)").eq("id", access.wedding.id).single(),
    ad.from("accommodation_rooms")
      .select("id, name, room_type, tier, sleeps, ideal_sleeps, max_sleeps, price_per_night, description, image_url, hero_image_url, floor_plan_url, amenities, bridal_suite, parent_room_id, bed_config, commission_value, commission_type, active, sort_order")
      .eq("venue_id", access.wedding.venue_id)
      .eq("active", true)
      .order("sort_order"),
    ad.from("media_assets").select("id, owner_id, kind, url, label, sort_order").eq("venue_id", access.wedding.venue_id).in("kind", ["photo", "floorplan"]).order("sort_order"),
  ]);
  if (!wedding) notFound();

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

  // --- Remaining-capacity model for the wedding date -----------------------
  // A booking covers the wedding date when check_in <= date < check_out.
  // Count OTHER weddings' bookings per room to compute what's still free.
  const weddingDate = String(wedding.wedding_date ?? "").slice(0, 10) || null;
  const roomIds = (rooms ?? []).map((r) => r.id);
  const remainingByRoom: Record<string, number> = {};
  roomIds.forEach((id) => (remainingByRoom[id] = ROOM_CAPACITY));
  if (weddingDate && roomIds.length > 0) {
    const { data: clashRows } = await ad
      .from("accommodation_bookings")
      .select("room_id, wedding_id")
      .in("room_id", roomIds)
      .lte("check_in", weddingDate)
      .gt("check_out", weddingDate);
    const used: Record<string, number> = {};
    (clashRows ?? []).forEach((r) => {
      if (r.wedding_id === wedding.id) return; // our own holds don't count against us
      used[r.room_id] = (used[r.room_id] ?? 0) + 1;
    });
    roomIds.forEach((id) => {
      remainingByRoom[id] = Math.max(0, ROOM_CAPACITY - (used[id] ?? 0));
    });
  }

  const assignments = state.roomAssignments ?? {};
  const roomCaps = (rooms ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    remaining: remainingByRoom[r.id] ?? ROOM_CAPACITY,
    capacity: ROOM_CAPACITY,
    assigned: (assignments[r.id] ?? []).length,
  }));

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

        <ConfirmBookings
          weddingSlug={wedding.slug}
          weddingDate={weddingDate}
          initialRooms={roomCaps}
        />
      </div>
    </main>
  );
}
