"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentVenue } from "@/lib/venue/current";

// Commission owed once a supplier is booked. Fixed = the flat amount agreed with
// the venue; percent = a share of the supplier's agreed booking value.
function computeCommission(commissionType: string | null, commissionValue: number, bookingValue: number): number {
  const val = Number(commissionValue) || 0;
  if (commissionType === "fixed") return Math.round(val * 100) / 100;
  const bv = Number(bookingValue) || 0;
  return Math.round((val / 100) * bv * 100) / 100;
}

// Venue confirms a supplier introduction converted to a booking. Records the
// supplier's agreed price (booking_value, needed for percent commission) and the
// commission the venue is now owed — Venuely is the ledger; the venue invoices
// the supplier directly. Owner/venue-member gated, with a venue_id match so a
// venue can only touch its own intros.
export async function markSupplierIntroBooked(id: string, weddingId: string, slug: string, bookingValue: number) {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: intro, error: fetchErr } = await supabase
    .from("supplier_intros")
    .select("id, venue_id, commission_type, commission_value")
    .eq("id", id)
    .eq("wedding_id", weddingId)
    .single();
  if (fetchErr || !intro) throw new Error("Intro not found");
  if (intro.venue_id !== venue.id) throw new Error("Not your venue");

  const bv = Number(bookingValue) || 0;
  if (intro.commission_type === "percent" && bv <= 0) {
    throw new Error("Enter the supplier's booking value to calculate the percentage commission.");
  }
  const commissionAmount = computeCommission(intro.commission_type, Number(intro.commission_value), bv);

  const { error } = await supabase
    .from("supplier_intros")
    .update({
      status: "booked",
      booking_value: bv > 0 ? bv : null,
      commission_amount: commissionAmount,
      booked_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// Venue marks an introduction lost / declined (no commission).
export async function markSupplierIntroDeclined(id: string, weddingId: string, slug: string) {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: intro, error: fetchErr } = await supabase
    .from("supplier_intros")
    .select("id, venue_id")
    .eq("id", id)
    .eq("wedding_id", weddingId)
    .single();
  if (fetchErr || !intro) throw new Error("Intro not found");
  if (intro.venue_id !== venue.id) throw new Error("Not your venue");

  const { error } = await supabase
    .from("supplier_intros")
    .update({ status: "declined", commission_amount: null, booked_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}
