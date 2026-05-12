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

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const ok = await verifyWebhook(request.headers, raw);
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  const event = JSON.parse(raw);
  const venueId = event?.payload?.metadata?.venue_id;

  if (event.type === "payment.succeeded" && venueId) {
    const supabase = adminClient();
    await supabase
      .from("venues")
      .update({ subscription_status: "active", yoco_customer_id: event.payload?.customerId ?? null })
      .eq("id", venueId);
  }
  if (event.type === "payment.failed" && venueId) {
    const supabase = adminClient();
    await supabase.from("venues").update({ subscription_status: "past_due" }).eq("id", venueId);
  }

  return NextResponse.json({ received: true });
}
