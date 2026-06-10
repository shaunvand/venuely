"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentVenue } from "@/lib/venue/current";
import { createWeddingRecord } from "@/app/venue/weddings/actions";

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

// Convert a won enquiry into a full couple portal.
// createWeddingRecord inserts the weddings row and returns its id + slug
// directly (no redirect, no id-set diffing — race-free even when two weddings
// are created concurrently). We link enquiry.wedding_id to that exact id, set
// status='booked', then redirect the venue admin to the new wedding.
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

  const fd = new FormData();
  fd.set("couple_names", enquiry.couple_name?.trim() || "New couple");
  if (enquiry.event_date) fd.set("wedding_date", String(enquiry.event_date));
  if (enquiry.guest_count != null) fd.set("guest_count", String(enquiry.guest_count));
  fd.set("status", "booked");

  const created = await createWeddingRecord(venue.id, fd);

  await supabase
    .from("enquiries")
    .update({ wedding_id: created.id, status: "booked" })
    .eq("id", enquiryId)
    .eq("venue_id", venue.id);

  revalidatePath("/venue/enquiries");
  revalidatePath("/venue/weddings");
  redirect(`/venue/weddings/${created.slug}`);
}
