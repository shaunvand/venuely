import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Create a "space" — a category (venue_area_groups) holding one or more sub-areas
// (venue_areas), each Included (area_kind main, price 0) or a Separate cost
// (area_kind extra, with a wedding-day price). Done over fetch (not a server
// action) on purpose: the onboarding wizard must NOT route-refresh on every add,
// or its local step/progress state resets. RLS scopes every write to the caller's
// venue, so the authed server client is sufficient.

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

type AreaIn = { name?: string; pricing?: string; price?: number | string | null };

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const venueId = String(body?.venue_id ?? "");
    if (!venueId) return NextResponse.json({ error: "Missing venue_id" }, { status: 400 });

    // Confirm membership (or platform owner) — RLS will also enforce this on write.
    const [{ data: member }, { data: profile }] = await Promise.all([
      supabase.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle(),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (!member && profile?.role !== "owner") return NextResponse.json({ error: "Not your venue" }, { status: 403 });

    const category = String(body?.category ?? "").trim();
    const location = String(body?.location) === "offsite" ? "offsite" : "venue";
    const areas: AreaIn[] = Array.isArray(body?.areas) ? body.areas : [];
    const named = areas.filter((a) => String(a?.name ?? "").trim());
    if (!named.length) return NextResponse.json({ error: "No areas to add" }, { status: 400 });

    // Find-or-create the category group (case-insensitive by name).
    let groupId: string | null = null;
    if (category) {
      const { data: existing } = await supabase
        .from("venue_area_groups").select("id, name").eq("venue_id", venueId);
      const match = (existing ?? []).find((g) => String(g.name).toLowerCase() === category.toLowerCase());
      if (match) {
        groupId = match.id as string;
      } else {
        // Offsite spaces are inherently paid — never group-level included.
        const included = location === "offsite" ? false : named.every((a) => a.pricing !== "separate");
        const { data: g, error: gErr } = await supabase
          .from("venue_area_groups")
          .insert({ venue_id: venueId, name: category, included, location, sort_order: (existing?.length ?? 0) })
          .select("id").single();
        if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
        groupId = g?.id ?? null;
      }
    }

    const addedNames: string[] = [];
    for (const a of named) {
      const name = String(a.name).trim();
      const separate = a.pricing === "separate";
      const { data: area, error: aErr } = await supabase
        .from("venue_areas")
        .insert({ venue_id: venueId, name, slug: slugify(name), area_kind: separate ? "extra" : "main", group_id: groupId })
        .select("id").single();
      if (aErr) return NextResponse.json({ error: aErr.message, added: addedNames }, { status: 500 });
      if (area) {
        const wedding = separate ? (Number(String(a.price ?? "").replace(/[^\d.]/g, "")) || 0) : 0;
        const { error: pErr } = await supabase.from("area_pricing").insert([
          { area_id: area.id, day_type: "wedding", price: wedding, season_id: null },
          { area_id: area.id, day_type: "mg", price: 0, season_id: null },
          { area_id: area.id, day_type: "farewell", price: 0, season_id: null },
        ]);
        if (pErr) return NextResponse.json({ error: pErr.message, added: addedNames }, { status: 500 });
        addedNames.push(name);
      }
    }

    return NextResponse.json({ ok: true, added: addedNames, group_id: groupId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
