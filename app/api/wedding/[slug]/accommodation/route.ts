import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import { applyMarkup } from "@/lib/billing/compute";

export const runtime = "nodejs";

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const ad = admin();
  const [{ data: wedding }, { data: rooms }, { data: media }] = await Promise.all([
    ad.from("weddings").select("wedding_state").eq("id", access.wedding.id).single(),
    ad.from("accommodation_rooms")
      .select("id, name, room_type, tier, sleeps, ideal_sleeps, max_sleeps, price_per_night, description, image_url, hero_image_url, floor_plan_url, amenities, bridal_suite, parent_room_id, bed_config, commission_value, commission_type, active, sort_order")
      .eq("venue_id", access.wedding.venue_id)
      .eq("active", true)
      .order("sort_order"),
    ad.from("media_assets")
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

  const state = (wedding?.wedding_state ?? {}) as { roomAssignments?: Record<string, string[]>; guests?: string[] };
  return NextResponse.json({
    rooms: enriched,
    roomAssignments: state.roomAssignments ?? {},
    guests: state.guests ?? [],
  });
}
