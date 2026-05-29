import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// Public review-submission endpoint for the venue directory ( /v/[slug] ).
// Inserts a `reviews` row as status='pending' — it does NOT appear on the
// public listing until a venue member publishes it (moderation in /venue/team).
//
// Uses the service-role client so the insert is reliable (anon insert is also
// permitted by RLS), but re-validates the venue is real + publicly listed
// before writing — never trust the client-supplied venue_id blindly.

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type ReviewBody = {
  venue_id?: string;
  author_name?: string;
  rating?: number | string;
  body?: string;
  wedding_id?: string | null;
};

export async function POST(request: NextRequest) {
  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const venueId = (body.venue_id || "").trim();
  const authorName = (body.author_name || "").trim();
  const reviewBody = (body.body || "").trim();
  const rating = Number(body.rating);

  if (!venueId || !authorName || !reviewBody) {
    return NextResponse.json(
      { ok: false, error: "name, review text and venue are required" },
      { status: 400 }
    );
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, error: "rating must be 1–5" }, { status: 400 });
  }
  if (reviewBody.length > 2000) {
    return NextResponse.json({ ok: false, error: "review is too long" }, { status: 400 });
  }

  const supabase = admin();

  // Confirm the venue exists and is publicly listed before accepting the review.
  const { data: venue } = await supabase
    .from("venues")
    .select("id, listed")
    .eq("id", venueId)
    .maybeSingle();

  if (!venue || (venue as { listed?: boolean }).listed !== true) {
    return NextResponse.json({ ok: false, error: "venue not found" }, { status: 404 });
  }

  const { data: review, error } = await supabase
    .from("reviews")
    .insert({
      venue_id: venueId,
      author_name: authorName.slice(0, 120),
      rating,
      body: reviewBody,
      status: "pending",
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, review });
}
