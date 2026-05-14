import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { INVENTORY_TABLES, defaultsFor, isVendorType, type InventoryType } from "@/lib/inventory/schemas";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Item = { category: string; data: Record<string, unknown> };

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

    const summary: Record<string, number> = {};
    for (const [cat, rows] of Object.entries(byCategory)) {
      const type = cat as InventoryType;
      const table = INVENTORY_TABLES[type];
      if (!table) { skipped.push({ reason: `unknown category ${cat}` }); continue; }
      const defaults = defaultsFor(type);
      const payload = rows.map((r, idx) => {
        const merged: Record<string, unknown> = { ...defaults, ...r, venue_id: venueId, sort_order: idx };
        if (isVendorType(type)) {
          // No-op — vendor_type comes from defaults.
        }
        return ensureRequired(type, merged);
      });
      const { error } = await admin.from(table).insert(payload);
      if (error) {
        return NextResponse.json({
          error: `Insert into ${table} failed: ${error.message}`,
          first_row_sample: payload[0],
        }, { status: 500 });
      }
      summary[cat] = payload.length;
    }

    return NextResponse.json({ ok: true, summary, skipped: skipped.length ? skipped : undefined });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
