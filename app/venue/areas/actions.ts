"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// Service-role client for media_assets writes (RLS-restricted table). Every call
// below first confirms the target area is visible to the user via RLS, so this
// stays scoped to areas the venue admin actually owns.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function addAreaImages(areaId: string, urls: string[]) {
  const supabase = await createClient();
  const { data: area } = await supabase.from("venue_areas").select("id, venue_id").eq("id", areaId).single();
  if (!area) throw new Error("Area not found");
  const rows = (urls || []).filter(Boolean).map((url) => ({
    venue_id: area.venue_id as string,
    owner_type: "area",
    owner_id: areaId,
    kind: "photo",
    url,
  }));
  if (rows.length) {
    const { error } = await admin().from("media_assets").insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/venue/areas");
}

export async function deleteAreaImage(mediaId: string) {
  const supabase = await createClient();
  const sb = admin();
  const { data: m } = await sb.from("media_assets").select("id, owner_id, owner_type").eq("id", mediaId).single();
  if (!m || m.owner_type !== "area") throw new Error("Image not found");
  // Confirm the owning area is visible to this user before deleting.
  const { data: area } = await supabase.from("venue_areas").select("id").eq("id", m.owner_id as string).single();
  if (!area) throw new Error("Forbidden");
  const { error } = await sb.from("media_assets").delete().eq("id", mediaId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function addArea(venueId: string, formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name required");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const rawGroup = (formData.get("group_id") as string) || "";
  const group_id = rawGroup && rawGroup !== "none" ? rawGroup : null;
  const { data, error } = await supabase
    .from("venue_areas")
    .insert({
      venue_id: venueId,
      name,
      slug,
      area_kind: (formData.get("area_kind") as string) || "extra",
      description: (formData.get("description") as string) || null,
      group_id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (data) {
    // An explicit per-day-type price wins; the single "Hire fee" fills in any day types left blank.
    const hire = Number(formData.get("price_hire") || 0);
    const mg = Number(formData.get("price_mg") || 0) || hire;
    const farewell = Number(formData.get("price_farewell") || 0) || hire;

    // Seasonal wedding-day prices arrive as `price_wedding_season_<seasonId>`.
    // If none are present, fall back to a single null-season wedding row.
    const rows: { area_id: string; day_type: string; price: number; season_id: string | null }[] = [
      { area_id: data.id, day_type: "mg", price: mg, season_id: null },
      { area_id: data.id, day_type: "farewell", price: farewell, season_id: null },
    ];
    const seasonalEntries = Array.from(formData.entries())
      .filter(([k]) => k.startsWith("price_wedding_season_"))
      .map(([k, v]) => ({ seasonId: k.slice("price_wedding_season_".length), price: Number(v || 0) || hire }));
    if (seasonalEntries.length) {
      for (const e of seasonalEntries) rows.push({ area_id: data.id, day_type: "wedding", price: e.price, season_id: e.seasonId });
      // Null-season fallback equal to the first season so legacy readers still resolve.
      rows.push({ area_id: data.id, day_type: "wedding", price: seasonalEntries[0].price, season_id: null });
    } else {
      const wedding = Number(formData.get("price_wedding") || 0) || hire;
      rows.push({ area_id: data.id, day_type: "wedding", price: wedding, season_id: null });
    }
    const { error: priceError } = await supabase.from("area_pricing").insert(rows);
    if (priceError) throw new Error(priceError.message);
  }
  revalidatePath("/venue/areas");
}

export async function deleteArea(areaId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("venue_areas").delete().eq("id", areaId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function toggleAreaActive(areaId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("venue_areas").update({ active }).eq("id", areaId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function updateArea(areaId: string, formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name required");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const { error } = await supabase
    .from("venue_areas")
    .update({
      name,
      slug,
      area_kind: (formData.get("area_kind") as string) || "extra",
      description: (formData.get("description") as string) || null,
    })
    .eq("id", areaId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

// Season-aware single-price upsert. mg/farewell always pass seasonId=null;
// wedding passes a season_id when the venue has seasons (one row per season), or
// null for the legacy single-price fallback. The unique index is
// (area_id, day_type, coalesce(season_id, zero-uuid)) — Postgres can't ON CONFLICT
// on a COALESCE expression directly, so we delete-then-insert the matching row.
export async function updateAreaPrice(areaId: string, dayType: string, seasonId: string | null, formData: FormData) {
  const supabase = await createClient();
  const price = Number(formData.get("price") || 0);
  const sid = dayType === "wedding" ? (seasonId && seasonId !== "none" ? seasonId : null) : null;
  let del = supabase.from("area_pricing").delete().eq("area_id", areaId).eq("day_type", dayType);
  del = sid === null ? del.is("season_id", null) : del.eq("season_id", sid);
  const { error: delError } = await del;
  if (delError) throw new Error(delError.message);
  const { error } = await supabase.from("area_pricing").insert({ area_id: areaId, day_type: dayType, price, season_id: sid });
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

// Bulk version of updateAreaPrice — commits every price field on the Areas page
// at once (the sticky "Save changes" bar). Each item is a delete-then-insert of
// the matching (area_id, day_type, season_id) row, same as the single-field save.
export async function saveAllAreaPrices(
  items: { areaId: string; dayType: string; seasonId: string | null; price: number }[],
) {
  const supabase = await createClient();
  for (const it of items) {
    if (!it.areaId || !it.dayType) continue;
    const sid = it.dayType === "wedding" ? (it.seasonId && it.seasonId !== "none" ? it.seasonId : null) : null;
    const price = Number.isFinite(it.price) ? it.price : 0;
    let del = supabase.from("area_pricing").delete().eq("area_id", it.areaId).eq("day_type", it.dayType);
    del = sid === null ? del.is("season_id", null) : del.eq("season_id", sid);
    const { error: delError } = await del;
    if (delError) throw new Error(delError.message);
    const { error } = await supabase.from("area_pricing").insert({ area_id: it.areaId, day_type: it.dayType, price, season_id: sid });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/venue/areas");
}

export async function assignAreaGroup(areaId: string, groupId: string | null) {
  const supabase = await createClient();
  const group_id = groupId && groupId !== "none" ? groupId : null;
  const { error } = await supabase.from("venue_areas").update({ group_id }).eq("id", areaId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

/* ── Sub-category groups (venue_area_groups) ───────────────────────────── */

export async function addAreaGroup(venueId: string, formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name required");
  const included = (formData.get("included") as string) === "true";
  const location = (formData.get("location") as string) === "offsite" ? "offsite" : "venue";
  // Offsite spaces are inherently paid/extra — never included.
  const effIncluded = location === "offsite" ? false : included;
  const sort = Number(formData.get("sort_order") || 0);
  const { error } = await supabase.from("venue_area_groups").insert({
    venue_id: venueId, name, included: effIncluded, location, sort_order: sort,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function updateAreaGroup(groupId: string, formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name required");
  const included = (formData.get("included") as string) === "true";
  const location = (formData.get("location") as string) === "offsite" ? "offsite" : "venue";
  const effIncluded = location === "offsite" ? false : included;
  const { error } = await supabase
    .from("venue_area_groups")
    .update({ name, included: effIncluded, location })
    .eq("id", groupId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function deleteAreaGroup(groupId: string) {
  const supabase = await createClient();
  // Detach areas first so they survive as ungrouped (group_id → null).
  const { error: detachError } = await supabase.from("venue_areas").update({ group_id: null }).eq("group_id", groupId);
  if (detachError) throw new Error(detachError.message);
  const { error } = await supabase.from("venue_area_groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

/* ── Venue seasons (venue_seasons) ─────────────────────────────────────── */

function clampMonth(v: unknown) {
  const n = Math.round(Number(v || 0));
  if (!Number.isFinite(n) || n < 1 || n > 12) throw new Error("Month must be 1–12");
  return n;
}
function clampDay(v: unknown) {
  const n = Math.round(Number(v || 0));
  if (!Number.isFinite(n) || n < 1 || n > 31) throw new Error("Day must be 1–31");
  return n;
}

export async function addSeason(venueId: string, formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name required");
  const sort = Number(formData.get("sort_order") || 0);
  const { error } = await supabase.from("venue_seasons").insert({
    venue_id: venueId,
    name,
    start_month: clampMonth(formData.get("start_month")),
    start_day: clampDay(formData.get("start_day")),
    end_month: clampMonth(formData.get("end_month")),
    end_day: clampDay(formData.get("end_day")),
    sort_order: sort,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function updateSeason(seasonId: string, formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name required");
  const { error } = await supabase
    .from("venue_seasons")
    .update({
      name,
      start_month: clampMonth(formData.get("start_month")),
      start_day: clampDay(formData.get("start_day")),
      end_month: clampMonth(formData.get("end_month")),
      end_day: clampDay(formData.get("end_day")),
    })
    .eq("id", seasonId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

export async function deleteSeason(seasonId: string) {
  const supabase = await createClient();
  // Remove the seasonal wedding-price rows tied to this season first.
  const { error: priceErr } = await supabase.from("area_pricing").delete().eq("season_id", seasonId);
  if (priceErr) throw new Error(priceErr.message);
  const { error } = await supabase.from("venue_seasons").delete().eq("id", seasonId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

// Quick-add 4 sensible SA seasons (venue can rename/adjust). Southern-hemisphere
// calendar: Summer Dec–Feb (wraps year-end), Autumn Mar–May, Winter Jun–Aug,
// Spring Sep–Nov.
export async function quickAddSASeasons(venueId: string) {
  const supabase = await createClient();
  const presets = [
    { name: "Summer", start_month: 12, start_day: 1, end_month: 2, end_day: 28, sort_order: 0 },
    { name: "Autumn", start_month: 3, start_day: 1, end_month: 5, end_day: 31, sort_order: 1 },
    { name: "Winter", start_month: 6, start_day: 1, end_month: 8, end_day: 31, sort_order: 2 },
    { name: "Spring", start_month: 9, start_day: 1, end_month: 11, end_day: 30, sort_order: 3 },
  ];
  const { error } = await supabase.from("venue_seasons").insert(presets.map((p) => ({ venue_id: venueId, ...p })));
  if (error) throw new Error(error.message);
  revalidatePath("/venue/areas");
}

// Lightweight fetch of the venue's groups + seasons for the onboarding wizard
// (the Areas page loads them server-side; the wizard pulls them on mount).
export async function getVenueGroupsAndSeasons(venueId: string) {
  const supabase = await createClient();
  const [{ data: groups }, { data: seasons }] = await Promise.all([
    supabase.from("venue_area_groups").select("id, name, included, location, sort_order").eq("venue_id", venueId).order("sort_order"),
    supabase.from("venue_seasons").select("id, name, start_month, start_day, end_month, end_day, sort_order").eq("venue_id", venueId).order("sort_order"),
  ]);
  return { groups: groups ?? [], seasons: seasons ?? [] };
}
