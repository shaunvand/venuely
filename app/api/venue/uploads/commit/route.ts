import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { INVENTORY_TABLES, defaultsFor, type InventoryType } from "@/lib/inventory/schemas";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Item = { category: string; data: Record<string, unknown> };

// Tables that carry an item_code column → eligible for dedupe on (venue_id, item_code).
const ITEM_CODE_TABLES = new Set(["catalogue_items", "rental_items"]);

// Columns that actually exist per table. The AI parser can emit fields that don't
// belong on a given table (e.g. contact_email on a rental, item_code on a room);
// we strip anything not listed so PostgREST doesn't reject the whole batch.
const ALLOWED_COLS: Record<string, Set<string>> = {
  catalogue_items: new Set(["venue_id", "category", "name", "description", "price", "price_unit", "image_url", "active", "sort_order", "commission_value", "commission_type", "item_code", "cost_treatment", "event_part", "import_batch_id"]),
  rental_items: new Set(["venue_id", "category", "name", "description", "price", "stock_total", "image_url", "active", "sort_order", "commission_value", "commission_type", "item_code", "cost_treatment", "import_batch_id"]),
  accommodation_rooms: new Set(["venue_id", "name", "room_type", "tier", "sleeps", "ideal_sleeps", "max_sleeps", "bridal_suite", "amenities", "price_per_night", "description", "image_url", "hero_image_url", "floor_plan_url", "active", "sort_order", "commission_value", "commission_type", "cost_treatment", "contact_name", "contact_phone", "contact_email", "website_url", "address", "import_batch_id"]),
  vendor_partners: new Set(["venue_id", "vendor_type", "name", "description", "price_from", "image_url", "active", "sort_order", "commission_value", "commission_type", "cost_treatment", "contact_name", "contact_phone", "contact_email", "website_url", "import_batch_id"]),
};
function stripToColumns(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const allow = ALLOWED_COLS[table];
  if (!allow) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (allow.has(k)) out[k] = v;
  return out;
}

type DestResult = { added: number; updated: number; failed: number; error?: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const venueId = (body.venue_id as string)?.trim();
    const items = (body.items ?? []) as Item[];
    if (!venueId) return NextResponse.json({ error: "Missing venue_id" }, { status: 400 });

    // Auth check via server client — venue admins only.
    const auth = await createServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [{ data: member }, { data: profile }] = await Promise.all([
      auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle(),
      auth.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (!member && profile?.role !== "owner") return NextResponse.json({ error: "Not your venue" }, { status: 403 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fields that are NOT NULL in the DB and must always be filled.
    function ensureRequired(type: InventoryType, row: Record<string, unknown>): Record<string, unknown> {
      const out = { ...row };
      if (type === "catalogue") {
        if (!String(out.category ?? "").trim()) out.category = "Menu";
        if (out.price == null || out.price === "") out.price = 0;
        if (!String(out.price_unit ?? "").trim()) out.price_unit = "fixed";
      } else if (type === "rentals") {
        if (!String(out.category ?? "").trim()) out.category = "Decor";
        if (out.price == null || out.price === "") out.price = 0;
        if (out.stock_total == null || out.stock_total === "") out.stock_total = 1;
      } else if (type === "accommodation") {
        if (out.price_per_night == null || out.price_per_night === "") out.price_per_night = 0;
        if (out.sleeps == null || out.sleeps === "") out.sleeps = 2;
      }
      return out;
    }

    const byCategory: Record<string, Array<Record<string, unknown>>> = {};
    const skipped: Array<{ reason: string; name?: string }> = [];
    for (const it of items) {
      if (!it.category) { skipped.push({ reason: "no category" }); continue; }
      const name = String(it.data?.name ?? "").trim();
      if (!name) { skipped.push({ reason: "no name" }); continue; }
      (byCategory[it.category] = byCategory[it.category] || []).push(it.data);
    }

    // One batch id per commit — stamped on every row so undoImport can reverse it.
    const importBatchId = randomUUID();

    // Backward-compatible flat count for the existing client copy, plus a richer
    // per-destination breakdown so the client can show "24 added, 3 updated, …".
    const summary: Record<string, number> = {};
    const results: Record<string, DestResult> = {};

    function bump(table: string, patch: Partial<DestResult>) {
      const r = results[table] ?? { added: 0, updated: 0, failed: 0 };
      results[table] = {
        added: r.added + (patch.added ?? 0),
        updated: r.updated + (patch.updated ?? 0),
        failed: r.failed + (patch.failed ?? 0),
        error: patch.error ?? r.error,
      };
    }

    for (const [cat, rows] of Object.entries(byCategory)) {
      const type = cat as InventoryType;
      const table = INVENTORY_TABLES[type];
      if (!table) { skipped.push({ reason: `unknown category ${cat}` }); continue; }
      const defaults = defaultsFor(type);
      const payload = rows.map((r, idx) => {
        const merged: Record<string, unknown> = {
          ...defaults, ...r, venue_id: venueId, sort_order: idx, import_batch_id: importBatchId,
        };
        return stripToColumns(table, ensureRequired(type, merged));
      });

      // Rows with an item_code on a dedupe-capable table UPSERT on (venue_id,item_code)
      // so re-importing the same sheet updates rather than duplicates. Everything else
      // inserts fresh. Per category we keep going even if one branch fails.
      const canUpsert = ITEM_CODE_TABLES.has(table);
      const insertRows = canUpsert ? payload.filter((p) => !String(p.item_code ?? "").trim()) : payload;
      // Collapse duplicate item_codes WITHIN this batch (last wins) — Postgres rejects a
      // single UPSERT that touches the same conflict target twice.
      const upsertByCode = new Map<string, Record<string, unknown>>();
      if (canUpsert) {
        for (const p of payload) {
          const code = String(p.item_code ?? "").trim();
          if (code) upsertByCode.set(code, p);
        }
      }
      const upsertRows = [...upsertByCode.values()];

      let catSaved = 0;
      if (upsertRows.length) {
        // Dedupe in code (the partial unique index on (venue_id,item_code) can't be an
        // ON CONFLICT target via PostgREST): look up existing codes → UPDATE those,
        // INSERT the rest. Re-importing the same sheet updates instead of duplicating.
        const codes = upsertRows.map((p) => String(p.item_code).trim());
        const { data: existing } = await admin.from(table).select("id, item_code").eq("venue_id", venueId).in("item_code", codes);
        const idByCode = new Map((existing ?? []).map((e) => [String((e as { item_code: string }).item_code), (e as { id: string }).id]));
        const toUpdate = upsertRows.filter((p) => idByCode.has(String(p.item_code).trim()));
        const toInsert = upsertRows.filter((p) => !idByCode.has(String(p.item_code).trim()));
        for (const p of toUpdate) {
          const id = idByCode.get(String(p.item_code).trim())!;
          const { error } = await admin.from(table).update(p).eq("id", id);
          if (error) bump(table, { failed: 1, error: error.message });
          else { bump(table, { updated: 1 }); catSaved += 1; }
        }
        if (toInsert.length) {
          const { error } = await admin.from(table).insert(toInsert);
          if (error) bump(table, { failed: toInsert.length, error: error.message });
          else { bump(table, { added: toInsert.length }); catSaved += toInsert.length; }
        }
      }
      if (insertRows.length) {
        const { error } = await admin.from(table).insert(insertRows);
        if (error) bump(table, { failed: insertRows.length, error: error.message });
        else { bump(table, { added: insertRows.length }); catSaved += insertRows.length; }
      }

      summary[cat] = catSaved;
    }

    const anySaved = Object.values(results).some((r) => r.added + r.updated > 0);
    const anyFailed = Object.values(results).some((r) => r.failed > 0);
    return NextResponse.json({
      ok: anySaved || !anyFailed,
      summary,
      results,
      import_batch_id: importBatchId,
      skipped: skipped.length ? skipped : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
