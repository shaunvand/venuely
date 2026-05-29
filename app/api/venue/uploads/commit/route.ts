import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { INVENTORY_TABLES, defaultsFor, type InventoryType } from "@/lib/inventory/schemas";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Item = { category: string; data: Record<string, unknown> };

// Tables that carry an item_code column → eligible for dedupe UPSERT on (venue_id, item_code).
const ITEM_CODE_TABLES = new Set(["catalogue_items", "rental_items"]);

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
        return ensureRequired(type, merged);
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
        // onConflict updates the matching row; we can't cheaply tell added vs updated,
        // so count upserts as "updated" (conservative — they may overwrite existing rows).
        const { error } = await admin.from(table).upsert(upsertRows, { onConflict: "venue_id,item_code" });
        if (error) bump(table, { failed: upsertRows.length, error: error.message });
        else { bump(table, { updated: upsertRows.length }); catSaved += upsertRows.length; }
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
