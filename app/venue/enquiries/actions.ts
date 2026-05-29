"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentVenue } from "@/lib/venue/current";
import { createWedding } from "@/app/venue/weddings/actions";

type EnquiryStatus = "new" | "quoted" | "booked" | "lost";
const STATUSES: EnquiryStatus[] = ["new", "quoted", "booked", "lost"];

// Move a lead through the pipeline. Scoped to the caller's current venue so a
// venue admin can only touch their own enquiries (RLS also enforces this).
export async function setEnquiryStatus(enquiryId: string, status: string) {
  const next = STATUSES.includes(status as EnquiryStatus) ? (status as EnquiryStatus) : null;
  if (!next) throw new Error("Invalid status");

  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { error } = await supabase
    .from("enquiries")
    .update({ status: next })
    .eq("id", enquiryId)
    .eq("venue_id", venue.id);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/enquiries");
}

// A redirect() thrown inside a Server Action surfaces as an error whose
// `digest` is "NEXT_REDIRECT;<type>;<url>;<status>;". We parse the URL so we
// can link the freshly-created wedding back to this enquiry, then re-throw the
// same error to let Next perform the navigation.
function redirectUrlFromError(err: unknown): string | null {
  if (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string"
  ) {
    const digest = (err as { digest: string }).digest;
    if (digest.startsWith("NEXT_REDIRECT")) {
      const parts = digest.split(";");
      // NEXT_REDIRECT ; <type> ; <url> ; <status> ;
      return parts[2] ?? null;
    }
  }
  return null;
}

// Convert a won enquiry into a full couple portal.
// Reuses the existing createWedding action (which inserts the weddings row and
// redirects to /venue/weddings/<slug>). We capture that redirect, look up the
// wedding it just created, link enquiry.wedding_id + set status='booked', then
// re-throw so the venue admin lands on the new wedding.
export async function convertEnquiry(enquiryId: string) {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: enquiry } = await supabase
    .from("enquiries")
    .select("id, venue_id, couple_name, email, phone, event_date, guest_count, wedding_id, status")
    .eq("id", enquiryId)
    .eq("venue_id", venue.id)
    .maybeSingle();
  if (!enquiry) throw new Error("Enquiry not found");
  if (enquiry.wedding_id) {
    // Already converted — nothing to do.
    revalidatePath("/venue/enquiries");
    return;
  }

  // Snapshot existing wedding ids so we can identify the one createWedding adds.
  const { data: before } = await supabase
    .from("weddings")
    .select("id")
    .eq("venue_id", venue.id);
  const beforeIds = new Set((before ?? []).map((w) => w.id as string));

  const fd = new FormData();
  fd.set("couple_names", enquiry.couple_name?.trim() || "New couple");
  if (enquiry.event_date) fd.set("wedding_date", String(enquiry.event_date));
  if (enquiry.guest_count != null) fd.set("guest_count", String(enquiry.guest_count));
  fd.set("status", "booked");

  let thrown: unknown = null;
  try {
    // createWedding inserts the row, then redirect()s (throws NEXT_REDIRECT).
    await createWedding(venue.id, venue.slug, fd);
  } catch (err) {
    thrown = err;
  }

  // Find the wedding createWedding just created (the new id not in beforeIds),
  // even if its internal redirect threw.
  const { data: after } = await supabase
    .from("weddings")
    .select("id, created_at")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false });
  const created = (after ?? []).find((w) => !beforeIds.has(w.id as string));

  if (created) {
    await supabase
      .from("enquiries")
      .update({ wedding_id: created.id, status: "booked" })
      .eq("id", enquiryId)
      .eq("venue_id", venue.id);
  }

  revalidatePath("/venue/enquiries");

  // Re-throw the redirect (if any) so navigation to the new wedding happens.
  // redirect() must be outside the try/catch — re-throwing here satisfies that.
  if (thrown) {
    if (redirectUrlFromError(thrown)) throw thrown;
    // A real (non-redirect) failure from createWedding — surface it.
    throw thrown;
  }
}
