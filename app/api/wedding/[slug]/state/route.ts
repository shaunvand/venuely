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

export async function GET(_request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const { data, error } = await admin()
    .from("weddings")
    .select("id, slug, wedding_state, wedding_state_updated_at")
    .eq("id", access.wedding.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, request);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }

  const ad = admin();

  // Support two shapes: full replace { ...state } OR partial patch { patch: { roomAssignments: ... } }
  let nextState: Record<string, unknown>;
  if ("patch" in body && typeof (body as { patch?: unknown }).patch === "object") {
    const { data: existing } = await ad
      .from("weddings")
      .select("wedding_state")
      .eq("id", access.wedding.id)
      .single();
    const current = (existing?.wedding_state ?? {}) as Record<string, unknown>;
    nextState = { ...current, ...(body as { patch: Record<string, unknown> }).patch };
  } else {
    nextState = body as Record<string, unknown>;
  }

  const { data, error } = await ad
    .from("weddings")
    .update({ wedding_state: nextState, wedding_state_updated_at: new Date().toISOString() })
    .eq("id", access.wedding.id)
    .select("wedding_state_updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated_at: data.wedding_state_updated_at });
}
