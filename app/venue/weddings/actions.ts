"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

function hashPassword(plain: string): string {
  // Lightweight salted hash: salt comes from a server-only env var, falls back to a fixed string in dev.
  const salt = process.env.PORTAL_PASSWORD_SALT ?? "venuely-portal-v1";
  return createHash("sha256").update(`${salt}::${plain}`).digest("hex");
}

// Turn "Alex & Sam Smith" → "AlexAndSamSmithWedding".
// Strips non-alphanumerics, joins words, appends "Wedding" suffix.
function pascalSlug(couples: string): string {
  const cleaned = couples
    .replace(/&/g, " And ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const camel = cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return `${camel}Wedding`;
}

async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  while (true) {
    const { data } = await supabase.from("weddings").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}${n++}`;
  }
}

export async function createWedding(venueId: string, _venueSlug: string, formData: FormData) {
  const supabase = await createClient();
  const couples = (formData.get("couple_names") as string).trim();
  const explicit = (formData.get("slug") as string || "").trim();

  const base = explicit ? explicit.replace(/[^a-zA-Z0-9]/g, "") : pascalSlug(couples);
  const slug = await uniqueSlug(supabase, base);

  const guestStr = formData.get("guest_count") as string;
  const { data, error } = await supabase
    .from("weddings")
    .insert({
      venue_id: venueId,
      slug,
      couple_names: couples,
      wedding_date: (formData.get("wedding_date") as string) || null,
      guest_count: guestStr ? Number(guestStr) : null,
    })
    .select("slug")
    .single();

  if (error) throw new Error(`Could not create wedding: ${error.message}`);
  revalidatePath("/venue/weddings");
  if (data) redirect(`/venue/weddings/${data.slug}`);
}

export async function updateWeddingBasics(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const guestStr = formData.get("guest_count") as string;
  const budgetStr = formData.get("total_budget") as string;
  const patch: Record<string, unknown> = {
    couple_names: (formData.get("couple_names") as string)?.trim(),
    wedding_date: (formData.get("wedding_date") as string) || null,
    guest_count: guestStr ? Number(guestStr) : null,
    total_budget: budgetStr ? Number(budgetStr) : null,
    status: (formData.get("status") as string) || "inquiry",
    notes: (formData.get("notes") as string) || null,
  };
  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function setPortalPassword(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const pw = (formData.get("password") as string || "").trim();
  const patch = { portal_password_hash: pw ? hashPassword(pw) : null };
  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function markInvoiced(weddingId: string, slug: string, total: number, feeRate: number) {
  const supabase = await createClient();
  const fee = Math.round(total * feeRate * 100) / 100;
  const { error } = await supabase.from("weddings").update({
    invoiced_at: new Date().toISOString(),
    invoice_total: total,
    platform_fee_owed: fee,
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function markCouplePaid(weddingId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({
    couple_paid_at: new Date().toISOString(),
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function markPlatformFeePaid(weddingId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({
    platform_fee_paid_at: new Date().toISOString(),
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}
