import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/billing/yoco";
import { createClient } from "@supabase/supabase-js";

// Service-role client (bypasses RLS for backend writes)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// In-process dedupe of recently seen webhook ids. Yoco may retry/replay the same
// delivery (same `webhook-id` header / event `id`); without a persisted events
// table we keep a bounded LRU-ish set so an immediate replay short-circuits and
// never re-runs the venue status flip twice. State-conditional updates below are
// the durable backstop for replays that arrive after a server restart.
const processedIds = new Set<string>();
const PROCESSED_CAP = 1000;

function rememberId(id: string): void {
  if (processedIds.size >= PROCESSED_CAP) {
    // Drop the oldest insertion (Set preserves insertion order).
    const oldest = processedIds.values().next().value;
    if (oldest !== undefined) processedIds.delete(oldest);
  }
  processedIds.add(id);
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const ok = await verifyWebhook(request.headers, raw);
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let event: { id?: string; type?: string; payload?: { metadata?: Record<string, string>; customerId?: string; amount?: number; currency?: string; status?: string; [k: string]: unknown } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  // Idempotency key: prefer the signed `webhook-id` header, fall back to the
  // event body id. Same delivery seen twice in this process is a no-op.
  const eventId: string | null = request.headers.get("webhook-id") ?? event?.id ?? null;
  if (eventId && processedIds.has(eventId)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const venueId = event?.payload?.metadata?.venue_id;

  if (event.type === "payment.succeeded" && venueId) {
    const supabase = adminClient();
    // Conditional update: only flip if not already active. Makes a replayed
    // succeeded event (even across a restart) a no-op rather than a second write.
    await supabase
      .from("venues")
      .update({ subscription_status: "active", yoco_customer_id: event.payload?.customerId ?? null })
      .eq("id", venueId)
      .neq("subscription_status", "active");
  }
  if (event.type === "payment.failed" && venueId) {
    const supabase = adminClient();
    await supabase
      .from("venues")
      .update({ subscription_status: "past_due" })
      .eq("id", venueId)
      .neq("subscription_status", "past_due");
  }

  if (eventId) rememberId(eventId);

  return NextResponse.json({ received: true });
}
