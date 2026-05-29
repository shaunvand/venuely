"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function toNumOrNull(v: FormDataEntryValue | null): number | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

type SeedItem = { name?: string; description?: string | null; price_zar?: number | null; category?: string | null };
type SeedRoom = { name?: string; description?: string | null; sleeps?: number | null; price_per_night_zar?: number | null; room_type?: string | null };
type SeedPayload = { catalogue?: SeedItem[]; rentals?: SeedItem[]; accommodation?: SeedRoom[] };

export async function setupVenue(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const slug = (formData.get("slug") as string)?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!name || !slug) throw new Error("Venue name and slug are required.");

  const address  = (formData.get("address") as string || "").trim() || null;
  const region   = (formData.get("address_region") as string || "").trim() || null;
  const lat      = toNumOrNull(formData.get("address_lat"));
  const lng      = toNumOrNull(formData.get("address_lng"));
  const placeId  = (formData.get("address_place_id") as string || "").trim() || null;
  const mapsUrl  = (formData.get("address_maps_url") as string || "").trim() || null;
  const contactEmail = (formData.get("contact_email") as string || "").trim() || null;
  const contactPhone = (formData.get("contact_phone") as string || "").trim() || null;
  const logoUrl      = (formData.get("logo_url") as string || "").trim() || null;
  const description  = (formData.get("description") as string || "").trim() || null;

  let seed: SeedPayload = {};
  const rawSeed = (formData.get("seed_payload") as string || "").trim();
  if (rawSeed) { try { seed = JSON.parse(rawSeed); } catch { seed = {}; } }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let attemptSlug = slug;
  let venue: { id: string; slug: string } | null = null;
  let lastErr: { message?: string; code?: string } | null = null;
  for (let i = 0; i < 6; i++) {
    const { data, error } = await admin
      .from("venues")
      .insert({
        slug: attemptSlug,
        name,
        description,
        region,
        address,
        latitude: lat,
        longitude: lng,
        google_place_id: placeId,
        google_maps_url: mapsUrl,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        branding_logo_url: logoUrl,
        subscription_status: "trialing",
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id, slug")
      .single();
    if (data) { venue = data; break; }
    lastErr = error;
    if (error?.code === "23505") {
      attemptSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      continue;
    }
    break;
  }
  if (!venue) throw new Error(`Could not create venue: ${lastErr?.message ?? "unknown"}`);

  const { error: mErr } = await admin
    .from("venue_members")
    .insert({ venue_id: venue.id, user_id: user.id, is_primary: true });
  if (mErr) throw new Error(`Could not link membership: ${mErr.message}`);

  const cat = (seed.catalogue ?? []).filter((i) => i.name?.trim());
  if (cat.length) {
    await admin.from("catalogue_items").insert(cat.map((i, idx) => ({
      venue_id: venue.id,
      category: (i.category || "menu").toString().toLowerCase(),
      name: i.name!.trim(),
      description: i.description ?? null,
      price: i.price_zar ?? 0,
      price_unit: "per_person",
      sort_order: idx,
    })));
  }
  const ren = (seed.rentals ?? []).filter((i) => i.name?.trim());
  if (ren.length) {
    await admin.from("rental_items").insert(ren.map((i, idx) => ({
      venue_id: venue.id,
      category: (i.category || "furniture").toString().toLowerCase(),
      name: i.name!.trim(),
      description: i.description ?? null,
      price: i.price_zar ?? 0,
      stock_total: 1,
      sort_order: idx,
    })));
  }
  const acc = (seed.accommodation ?? []).filter((r) => r.name?.trim());
  if (acc.length) {
    await admin.from("accommodation_rooms").insert(acc.map((r, idx) => ({
      venue_id: venue.id,
      name: r.name!.trim(),
      room_type: r.room_type ?? null,
      sleeps: r.sleeps ?? 2,
      price_per_night: r.price_per_night_zar ?? 0,
      description: r.description ?? null,
      sort_order: idx,
    })));
  }

  redirect("/venue");
}
