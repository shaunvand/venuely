"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { INVENTORY_TABLES, INVENTORY_PATHS, defaultsFor, type InventoryType } from "@/lib/inventory/schemas";

// Tables a Smart Import can write into — same set the commit route stamps with import_batch_id.
const IMPORTABLE_TABLES = ["catalogue_items", "rental_items", "accommodation_rooms", "vendor_partners"] as const;

async function client() {
  return await createClient();
}

// Every inventory mutation must also refresh the /venue/inventory hub — its
// per-section counts (and the seating seat total) read the same tables, so
// revalidating only the editor page left the hub showing stale numbers.
function revalidateInventory(type: InventoryType) {
  revalidatePath(INVENTORY_PATHS[type]);
  revalidatePath("/venue/inventory");
}

export async function bulkDelete(type: InventoryType, ids: string[]) {
  if (!ids.length) return;
  const supabase = await client();
  const { error } = await supabase.from(INVENTORY_TABLES[type]).delete().in("id", ids);
  if (error) throw new Error(error.message);
  revalidateInventory(type);
}

export async function bulkSetActive(type: InventoryType, ids: string[], active: boolean) {
  if (!ids.length) return;
  const supabase = await client();
  const { error } = await supabase.from(INVENTORY_TABLES[type]).update({ active }).in("id", ids);
  if (error) throw new Error(error.message);
  revalidateInventory(type);
}

export async function bulkSetPrice(type: InventoryType, ids: string[], price: number) {
  if (!ids.length || !Number.isFinite(price)) return;
  const supabase = await client();
  const col = type === "accommodation" ? "price_per_night"
    : (type === "catalogue" || type === "rentals") ? "price"
    : "price_from";
  const { error } = await supabase.from(INVENTORY_TABLES[type]).update({ [col]: price }).in("id", ids);
  if (error) throw new Error(error.message);
  revalidateInventory(type);
}

export async function bulkSetCommission(type: InventoryType, ids: string[], value: number, commissionType: "fixed" | "percent") {
  if (!ids.length || !Number.isFinite(value)) return;
  const supabase = await client();
  const { error } = await supabase.from(INVENTORY_TABLES[type])
    .update({ commission_value: value, commission_type: commissionType })
    .in("id", ids);
  if (error) throw new Error(error.message);
  revalidateInventory(type);
}

export async function bulkSetCostTreatment(type: InventoryType, ids: string[], treatment: "included" | "extra") {
  if (!ids.length) return;
  const supabase = await client();
  const { error } = await supabase.from(INVENTORY_TABLES[type])
    .update({ cost_treatment: treatment })
    .in("id", ids);
  if (error) throw new Error(error.message);
  revalidateInventory(type);
}

export async function updateItem(type: InventoryType, id: string, patch: Record<string, unknown>) {
  const supabase = await client();
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    safe[k] = v;
  }
  // commission_* are NOT NULL with DB defaults; a blank edit sends null → would
  // 500. Coerce to the column default so the update succeeds.
  if (safe.commission_value === null || safe.commission_value === "") safe.commission_value = 0;
  if (safe.commission_type === null || safe.commission_type === "") safe.commission_type = "fixed";
  const { error } = await supabase.from(INVENTORY_TABLES[type]).update(safe).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateInventory(type);
}

export async function addItem(type: InventoryType, venueId: string, patch: Record<string, unknown>) {
  const supabase = await client();
  const defaults = defaultsFor(type);
  const row: Record<string, unknown> = { ...defaults, ...patch, venue_id: venueId };
  // Drop blank fields so each column's DB default applies — crucial for NOT NULL
  // columns with defaults (commission_value=0, commission_type='fixed', etc.),
  // which an explicit null would violate (a silent 500 on "Add item").
  for (const k of Object.keys(row)) {
    if ((row[k] === null || row[k] === "") && k !== "venue_id") delete row[k];
  }
  const { error } = await supabase.from(INVENTORY_TABLES[type]).insert(row);
  if (error) throw new Error(error.message);
  revalidateInventory(type);
}

// Reverse a single Smart Import commit: delete every row that carries this batch id
// across all importable tables. RLS already confines writes to the caller's venue;
// the explicit venue_id filter is belt-and-braces. Returns rows removed per table.
export async function undoImport(venueId: string, batchId: string) {
  if (!venueId || !batchId) return { deleted: 0 };
  const supabase = await client();
  let deleted = 0;
  for (const table of IMPORTABLE_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("import_batch_id", batchId)
      .eq("venue_id", venueId)
      .select("id");
    if (error) throw new Error(error.message);
    if (data) deleted += data.length;
  }
  for (const path of new Set(Object.values(INVENTORY_PATHS))) revalidatePath(path);
  revalidatePath("/venue/inventory");
  return { deleted };
}

export async function bulkInsert(type: InventoryType, venueId: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return { inserted: 0 };
  const supabase = await client();
  const defaults = defaultsFor(type);
  const payload = rows.map((r, i) => ({ ...defaults, ...r, venue_id: venueId, sort_order: i }));
  const { error } = await supabase.from(INVENTORY_TABLES[type]).insert(payload);
  if (error) throw new Error(error.message);
  revalidateInventory(type);
  return { inserted: payload.length };
}
