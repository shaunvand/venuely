import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// Per-wedding reminder settings: cadence (interval days), customisable RSVP +
// payment reminder templates, guest-contribution toggle/default, and the couple's
// payment instructions (e.g. their banking details for guest contributions).
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const KEYS = new Set(["intervalDays", "rsvpTemplate", "paymentTemplate", "paymentInstructions", "guestContributions", "defaultGuestAmount", "autoRsvpReminders", "autoPaymentReminders"]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const { data } = await admin().from("weddings").select("reminder_settings").eq("id", access.wedding.id).single();
  return NextResponse.json({ ok: true, settings: data?.reminder_settings ?? {} });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!KEYS.has(k)) continue;
    if (k === "guestContributions" || k === "autoRsvpReminders" || k === "autoPaymentReminders") clean[k] = !!v;
    else if (k === "intervalDays" || k === "defaultGuestAmount") clean[k] = v === "" || v == null ? 0 : Number(v);
    else clean[k] = v === "" ? null : v;
  }
  const { error } = await admin().from("weddings").update({ reminder_settings: clean }).eq("id", access.wedding.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: clean });
}
