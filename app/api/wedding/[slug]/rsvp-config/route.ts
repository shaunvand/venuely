import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// Couple reads/writes the white-label RSVP-site settings (headline, message,
// colours, cover, deadline, toggles). Portal-gated; service-role write.
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
const KEYS = new Set(["headline", "message", "accent", "primary", "cover", "deadline", "allowPhoto", "allowParty", "thankYou", "font"]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const { data } = await admin().from("weddings").select("rsvp_settings").eq("id", access.wedding.id).single();
  return NextResponse.json({ ok: true, settings: data?.rsvp_settings ?? {} });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!KEYS.has(k)) continue;
    if (k === "allowPhoto" || k === "allowParty") clean[k] = !!v;
    else clean[k] = v === "" ? null : v;
  }
  const { error } = await admin().from("weddings").update({ rsvp_settings: clean }).eq("id", access.wedding.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: clean });
}
