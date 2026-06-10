import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { importPlacesPhotos } from "@/lib/venue/places-photos";

export const runtime = "nodejs";
export const maxDuration = 120;

// Pull a venue's own photos from Google Places and add them to the "Your Venue"
// gallery. These are the real photos of that specific property (far more
// relevant than stock), keyed off the google_place_id we captured at onboarding.
//
// The heavy lifting (Google lookup → download → vision classify → upload) lives
// in lib/venue/places-photos.ts so it can also be triggered automatically during
// onboarding. This route just authorises the caller and delegates.

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

export async function POST(req: NextRequest) {
  try {
    const { venue_id } = await req.json();
    const venueId = String(venue_id || "").trim();
    if (!venueId || !/^[a-zA-Z0-9-]+$/.test(venueId))
      return NextResponse.json({ error: "Missing or invalid venue_id" }, { status: 400 });

    const gate = await authVenue(venueId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const result = await importPlacesPhotos(venueId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.errorStatus ?? 500 });
    }

    const { error: _e, errorStatus: _s, ...body } = result;
    void _e; void _s;
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
