import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// Public guest RSVP endpoint. The rsvp_token (unguessable uuid) IS the auth — it
// scopes every read/write to exactly one guest. No portal password needed, so a
// guest can respond from the invite link. Service role (RLS hides guests).
export const runtime = "nodejs";
const BUCKET = "wedding-files";
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safe = (n: string) => (n || "photo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);

async function load(token: string) {
  if (!UUID.test(token)) return null;
  const db = admin();
  const { data: guest } = await db.from("guests")
    .select("id, wedding_id, full_name, rsvp_status, party_size, dietary, rsvp_message, rsvp_image_url, plus_one")
    .eq("rsvp_token", token).single();
  if (!guest) return null;
  const { data: wedding } = await db.from("weddings").select("id, couple_names, wedding_date, wedding_end_date, rsvp_settings, venue_id").eq("id", guest.wedding_id).single();
  const { data: venue } = wedding ? await db.from("venues").select("name, region, address, portal_theme, portal_template, branding_logo_url").eq("id", wedding.venue_id).single() : { data: null };
  return { db, guest, wedding, venue };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ld = await load(token);
  if (!ld || !ld.wedding) return NextResponse.json({ error: "not found" }, { status: 404 });
  let imageUrl: string | null = null;
  if (ld.guest.rsvp_image_url) {
    const { data: s } = await ld.db.storage.from(BUCKET).createSignedUrl(ld.guest.rsvp_image_url, 3600);
    imageUrl = s?.signedUrl ?? null;
  }
  return NextResponse.json({
    ok: true,
    guest: { full_name: ld.guest.full_name, rsvp_status: ld.guest.rsvp_status, party_size: ld.guest.party_size, dietary: ld.guest.dietary, rsvp_message: ld.guest.rsvp_message, plus_one: ld.guest.plus_one, imageUrl },
    wedding: { couple_names: ld.wedding.couple_names, wedding_date: ld.wedding.wedding_date, wedding_end_date: ld.wedding.wedding_end_date, settings: ld.wedding.rsvp_settings ?? {} },
    venue: ld.venue ? { name: ld.venue.name, region: ld.venue.region, address: ld.venue.address, theme: ld.venue.portal_theme, template: ld.venue.portal_template, logo: ld.venue.branding_logo_url } : null,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ld = await load(token);
  if (!ld || !ld.wedding) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { db, guest } = ld;

  const ct = req.headers.get("content-type") || "";
  let status = "", party = "", dietary = "", message = "";
  let imagePath: string | null = null;

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    status = String(form.get("rsvp_status") ?? "");
    party = String(form.get("party_size") ?? "");
    dietary = String(form.get("dietary") ?? "");
    message = String(form.get("rsvp_message") ?? "");
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "image too large (max 10MB)" }, { status: 413 });
      const path = `rsvp/${guest.wedding_id}/${token}-${safe(file.name)}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType: file.type || "image/jpeg", upsert: true });
      if (!error) imagePath = path;
    }
  } else {
    const b = (await req.json().catch(() => ({}))) as Record<string, string>;
    status = b.rsvp_status ?? ""; party = b.party_size ?? ""; dietary = b.dietary ?? ""; message = b.rsvp_message ?? "";
  }

  const allowed = new Set(["attending", "declined", "tentative"]);
  const update: Record<string, unknown> = { responded_at: new Date().toISOString() };
  if (allowed.has(status)) update.rsvp_status = status;
  if (party !== "") update.party_size = Number(party) || 1;
  if (dietary !== "") update.dietary = dietary;
  if (message !== "") update.rsvp_message = message;
  if (imagePath) update.rsvp_image_url = imagePath;

  const { error } = await db.from("guests").update(update).eq("id", guest.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
