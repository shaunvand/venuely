"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addPayment(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
  const { error } = await supabase.from("payment_ledger").insert({
    wedding_id: weddingId,
    amount,
    direction: (formData.get("direction") as string) || "in",
    kind: (formData.get("kind") as string) || "payment",
    method: (formData.get("method") as string) || null,
    reference: (formData.get("reference") as string) || null,
    paid_at: (formData.get("paid_at") as string) || new Date().toISOString(),
    notes: (formData.get("notes") as string) || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function deletePayment(paymentId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("payment_ledger").delete().eq("id", paymentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function addCharge(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const qty = Number(formData.get("qty") || 1);
  const unitPrice = Number(formData.get("unit_price") || 0);
  const { error } = await supabase.from("wedding_charges").insert({
    wedding_id: weddingId,
    kind: (formData.get("kind") as string) || "custom",
    label: (formData.get("label") as string) || "Custom charge",
    qty, unit_price: unitPrice, amount: qty * unitPrice,
    is_refundable: formData.get("is_refundable") === "on",
    is_auto: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function deleteCharge(chargeId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("wedding_charges").delete().eq("id", chargeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}
