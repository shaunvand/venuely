import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

export const runtime = "nodejs";

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Couple-side "Request introduction": logs a supplier_intro row (the paper trail
// that snapshots the venue's commission terms), so the venue stays in the loop and
// can later mark the supplier booked + record the commission it's owed.
//
// POST  → create (idempotent per wedding+vendor): body
//   { vendor_id?, supplier_name, supplier_type?, supplier_email?, supplier_phone?,
//     commission_type: 'percent'|'fixed', commission_value }
// Gated by portalAccess(slug); always scoped to access.wedding (venue_id + wedding_id).
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }
  const b = body as {
    vendor_id?: string | null;
    supplier_name?: string;
    supplier_type?: string | null;
    supplier_email?: string | null;
    supplier_phone?: string | null;
    commission_type?: string | null;
    commission_value?: number | string | null;
  };

  const supplierName = (b.supplier_name ?? "").trim();
  if (!supplierName) return NextResponse.json({ error: "supplier_name required" }, { status: 400 });

  const commissionType = b.commission_type === "fixed" ? "fixed" : "percent";
  const commissionValue = Number(b.commission_value);
  const vendorId = b.vendor_id || null;

  const ad = admin();

  // Idempotent: if an intro for this wedding+vendor already exists, return it so a
  // re-tap (or a reload that re-fires) doesn't create duplicate paper-trail rows.
  if (vendorId) {
    const { data: existing } = await ad
      .from("supplier_intros")
      .select("*")
      .eq("wedding_id", access.wedding.id)
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (existing) return NextResponse.json({ intro: existing, existed: true });
  }

  const { data: row, error } = await ad
    .from("supplier_intros")
    .insert({
      venue_id: access.wedding.venue_id,
      wedding_id: access.wedding.id,
      vendor_id: vendorId,
      supplier_name: supplierName,
      supplier_type: b.supplier_type || null,
      supplier_email: b.supplier_email || null,
      supplier_phone: b.supplier_phone || null,
      commission_type: commissionType,
      commission_value: Number.isFinite(commissionValue) ? commissionValue : 0,
      status: "intro_requested",
      intro_sent_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ intro: row, existed: false });
}
