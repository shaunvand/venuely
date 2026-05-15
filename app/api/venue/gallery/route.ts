import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export const VENUE_LOCATIONS = [
  "Outside",
  "Gardens",
  "Ceremony",
  "Reception",
  "Bar",
  "Interior",
  "Accommodation",
  "Other",
] as const;

async function authVenue(venueId: string) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };
  const [{ data: member }, { data: profile }] = await Promise.all([
    auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle(),
    auth.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!member && profile?.role !== "owner") return { ok: false as const, status: 403, error: "Not your venue" };
  return { ok: true as const };
}

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Upload one or more files (images or videos) to the venue gallery.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const venueId = String(form.get("venue_id") || "").trim();
    const category = String(form.get("category") || "Other").trim() || "Other";
    if (!venueId || !/^[a-zA-Z0-9-]+$/.test(venueId))
      return NextResponse.json({ error: "Missing or invalid venue_id" }, { status: 400 });

    const gate = await authVenue(venueId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ error: "No files" }, { status: 400 });

    const sb = admin();
    const inserted: Array<{ id: string; url: string }> = [];
    for (const file of files) {
      const isVideo = (file.type || "").startsWith("video/");
      const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `gallery/${venueId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await sb.storage.from("venue-media").upload(path, buf, {
        contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
        upsert: false,
      });
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      const { data: pub } = sb.storage.from("venue-media").getPublicUrl(path);
      const { data: row, error: insErr } = await sb
        .from("media_assets")
        .insert({
          venue_id: venueId,
          owner_type: "venue",
          owner_id: venueId,
          kind: isVideo ? "video" : "photo",
          url: pub.publicUrl,
          label: file.name,
          category,
        })
        .select("id, url")
        .single();
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      inserted.push(row as { id: string; url: string });
    }
    return NextResponse.json({ ok: true, inserted });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// Update an asset's location category.
export async function PATCH(req: NextRequest) {
  try {
    const { id, venue_id, category } = await req.json();
    if (!id || !venue_id) return NextResponse.json({ error: "Missing id or venue_id" }, { status: 400 });
    const gate = await authVenue(String(venue_id));
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const { error } = await admin()
      .from("media_assets")
      .update({ category: String(category || "Other") })
      .eq("id", id)
      .eq("venue_id", venue_id)
      .eq("owner_type", "venue");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// Remove an asset from the gallery (DB row only; storage object left in place).
export async function DELETE(req: NextRequest) {
  try {
    const { id, venue_id } = await req.json();
    if (!id || !venue_id) return NextResponse.json({ error: "Missing id or venue_id" }, { status: 400 });
    const gate = await authVenue(String(venue_id));
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const { error } = await admin()
      .from("media_assets")
      .delete()
      .eq("id", id)
      .eq("venue_id", venue_id)
      .eq("owner_type", "venue");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
