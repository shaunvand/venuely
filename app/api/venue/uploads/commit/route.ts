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
    const { data: member } = await auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle();
    if (!member) return NextResponse.json({ error: "Not your venue" }, { status: 403 });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const byCategory: Record<string, Array<Record<string, unknown>>> = {};
    for (const it of items) {
      if (!it.category || !it.data?.name) continue;
      (byCategory[it.category] = byCategory[it.category] || []).push(it.data);
    }

    const summary: Record<string, number> = {};
    for (const [cat, rows] of Object.entries(byCategory)) {
      const type = cat as InventoryType;
      const table = INVENTORY_TABLES[type];
      if (!table) continue;
      const defaults = defaultsFor(type);
      const payload = rows.map((r, idx) => {
        const out: Record<string, unknown> = { ...defaults, ...r, venue_id: venueId, sort_order: idx };
        // For vendor types, ensure vendor_type is set (defaultsFor handles it).
        if (isVendorType(type)) {
          // No-op — vendor_type comes from defaults; just strip foreign keys.
        }
        return out;
      });
      const { error } = await admin.from(table).insert(payload);
      if (error) return NextResponse.json({ error: `Insert into ${table} failed: ${error.message}` }, { status: 500 });
      summary[cat] = payload.length;
    }

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
