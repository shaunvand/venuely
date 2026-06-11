import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { redactContacts } from "@/lib/messaging/redact";

export const runtime = "nodejs";

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// "Sarah & Tom Smith" → "Sarah & Tom" — suppliers only ever see first names.
function firstNames(coupleNames: string | null | undefined): string {
  const parts = String(coupleNames || "").split(/\s*(?:&|\+|\band\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  const firsts = parts.map((p) => p.split(/\s+/)[0]).filter(Boolean);
  return firsts.join(" & ") || "the couple";
}

const THREAD_COLS = "id, venue_id, wedding_id, supplier_name, status, couple_unread";

async function threadByToken(db: ReturnType<typeof admin>, token: string) {
  if (!token || !/^[0-9a-f]{16,}$/i.test(token)) return null;
  const { data } = await db.from("message_threads").select(THREAD_COLS).eq("reply_token", token).maybeSingle();
  return data;
}

// Supplier side of the mediated chat. The reply_token in the URL is the only
// credential (unknown token = 404, never an existence hint). The supplier never
// sees raw_body or the couple's email/phone — first names only.

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = admin();
  const thread = await threadByToken(db, token);
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [{ data: venue }, { data: wedding }, { data: messages }] = await Promise.all([
    db.from("venues").select("name").eq("id", thread.venue_id).single(),
    db.from("weddings").select("couple_names, wedding_date").eq("id", thread.wedding_id).single(),
    db.from("thread_messages")
      .select("id, sender, body, flagged, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    thread: {
      supplierName: thread.supplier_name,
      venueName: venue?.name ?? null,
      coupleNames: firstNames(wedding?.couple_names),
      weddingDate: wedding?.wedding_date ?? null,
      status: thread.status,
      messages: (messages ?? []).map((m) => ({
        id: m.id, sender: m.sender, body: m.body, flagged: m.flagged, createdAt: m.created_at,
      })),
    },
  });
}

// POST { text } — supplier reply: redacted unless booked, bumps couple_unread.
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = admin();
  const thread = await threadByToken(db, token);
  if (!thread) return NextResponse.json({ error: "not found" }, { status: 404 });

  let b: { text?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const text = (b?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const booked = thread.status === "booked";
  const red = booked ? { body: text, flagged: false, reason: null } : redactContacts(text);

  const { data: msg, error } = await db.from("thread_messages").insert({
    thread_id: thread.id,
    venue_id: thread.venue_id,
    sender: "supplier",
    body: red.body,
    raw_body: red.flagged ? text : null,
    flagged: red.flagged,
    flag_reason: red.reason,
  }).select("id, sender, body, flagged, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("message_threads").update({
    couple_unread: (Number(thread.couple_unread) || 0) + 1,
    last_message_at: msg.created_at,
  }).eq("id", thread.id);

  return NextResponse.json({
    ok: true,
    message: { id: msg.id, sender: msg.sender, body: msg.body, flagged: msg.flagged, createdAt: msg.created_at },
  });
}
