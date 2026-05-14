import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = await createClient();
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, venue_id, wedding_state")
    .eq("slug", slug)
    .single();
  if (!wedding) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      .in("kind", ["photo","floorplan"])
      .order("sort_order"),
  ]);

  const mediaByOwner: Record<string, Array<{ url: string; kind: string; label: string | null }>> = {};
  (media ?? []).forEach((m) => {
    if (!m.owner_id) return;
    (mediaByOwner[m.owner_id] = mediaByOwner[m.owner_id] || []).push({ url: m.url, kind: m.kind, label: m.label });
  });

  const enriched = (rooms ?? []).map((r) => {
    const cm = Number(r.commission_value ?? 0);
    const priceShown = !cm ? Number(r.price_per_night)
      : r.commission_type === "percent"
        ? Math.round((Number(r.price_per_night) * (1 + cm / 100)) * 100) / 100
        : Math.round((Number(r.price_per_night) + cm) * 100) / 100;
    return {
      ...r,
      price_per_night: priceShown,
      gallery: mediaByOwner[r.id] ?? [],
    };
  });

  const state = (wedding.wedding_state ?? {}) as { roomAssignments?: Record<string, string[]>; guests?: string[] };
  return NextResponse.json({
    rooms: enriched,
    roomAssignments: state.roomAssignments ?? {},
    guests: state.guests ?? [],
  });
}
