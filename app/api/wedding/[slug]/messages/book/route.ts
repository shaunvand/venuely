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

// Same commission math as markSupplierIntroBooked in app/venue/weddings/[slug]/actions.ts.
function computeCommission(commissionType: string | null, commissionValue: number, bookingValue: number): number {
  const val = Number(commissionValue) || 0;
  if (commissionType === "fixed") return Math.round(val * 100) / 100;
  const bv = Number(bookingValue) || 0;
  return Math.round((val / 100) * bv * 100) / 100;
}

// POST { threadId, bookingValue? } — couple marks the supplier booked. From here
// redaction stops, contact details unlock on both sides, and the linked
// supplier_intro records the booking + commission owed to the venue.
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  let b: { threadId?: string; bookingValue?: number | string | null };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  if (!b?.threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });

  const db = admin();
  const { data: thread } = await db.from("message_threads")
    .select("id, venue_id, intro_id, status")
    .eq("id", b.threadId).eq("wedding_id", access.wedding.id).maybeSingle();
  if (!thread) return NextResponse.json({ error: "thread not found" }, { status: 404 });

  const nowIso = new Date().toISOString();
  const { error: threadErr } = await db.from("message_threads").update({ status: "booked" }).eq("id", thread.id);
  if (threadErr) return NextResponse.json({ error: threadErr.message }, { status: 500 });

  if (thread.intro_id) {
    const { data: intro } = await db.from("supplier_intros")
      .select("id, commission_type, commission_value")
      .eq("id", thread.intro_id).maybeSingle();
    if (intro) {
      const bv = Number(b.bookingValue) || 0;
      await db.from("supplier_intros").update({
        status: "booked",
        booking_value: bv > 0 ? bv : null,
        commission_amount: computeCommission(intro.commission_type, Number(intro.commission_value), bv),
        booked_at: nowIso,
      }).eq("id", intro.id);
    }
  }

  if (thread.status !== "booked") {
    await db.from("thread_messages").insert({
      thread_id: thread.id,
      venue_id: thread.venue_id,
      sender: "system",
      body: "🎉 Marked as booked — contact details are now visible to both sides.",
    });
    await db.from("message_threads").update({ last_message_at: nowIso }).eq("id", thread.id);
  }

  return NextResponse.json({ ok: true });
}
