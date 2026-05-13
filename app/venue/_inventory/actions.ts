"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { INVENTORY_TABLES, INVENTORY_PATHS, defaultsFor, type InventoryType } from "@/lib/inventory/schemas";

async function client() {
  return await createClient();
}

export async function bulkDelete(type: InventoryType, ids: string[]) {
  if (!ids.length) return;
  const supabase = await client();
  await supabase.from(INVENTORY_TABLES[type]).delete().in("id", ids);
  revalidatePath(INVENTORY_PATHS[type]);
}

export async function bulkSetActive(type: InventoryType, ids: string[], active: boolean) {
  if (!ids.length) return;
  const supabase = await client();
  await supabase.from(INVENTORY_TABLES[type]).update({ active }).in("id", ids);
  revalidatePath(INVENTORY_PATHS[type]);
}

export async function bulkSetPrice(type: InventoryType, ids: string[], price: number) {
  if (!ids.length || !Number.isFinite(price)) return;
  const supabase = await client();
  const col = type === "accommodation" ? "price_per_night" : "price";
  await supabase.from(INVENTORY_TABLES[type]).update({ [col]: price }).in("id", ids);
  revalidatePath(INVENTORY_PATHS[type]);
}

export async function updateItem(type: InventoryType, id: string, patch: Record<string, unknown>) {
  const supabase = await client();
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    safe[k] = v;
  }
  await supabase.from(INVENTORY_TABLES[type]).update(safe).eq("id", id);
  revalidatePath(INVENTORY_PATHS[type]);
}

export async function addItem(type: InventoryType, venueId: string, patch: Record<string, unknown>) {
  const supabase = await client();
  const defaults = defaultsFor(type);
  const row = { ...defaults, ...patch, venue_id: venueId };
  const { error } = await supabase.from(INVENTORY_TABLES[type]).insert(row);
  if (error) throw new Error(error.message);
  revalidatePath(INVENTORY_PATHS[type]);
}

export async function bulkInsert(type: InventoryType, venueId: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return { inserted: 0 };
  const supabase = await client();
  const defaults = defaultsFor(type);
  const payload = rows.map((r, i) => ({ ...defaults, ...r, venue_id: venueId, sort_order: i }));
  const { error } = await supabase.from(INVENTORY_TABLES[type]).insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath(INVENTORY_PATHS[type]);
  return { inserted: payload.length };
}
