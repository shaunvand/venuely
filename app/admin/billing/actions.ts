"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createCheckout, getYocoConfig } from "@/lib/billing/yoco";

const MONTHLY_R = 1499;

export async function startSubscription(venueId: string, venueSlug: string) {
  const cfg = getYocoConfig();
  if (!cfg.live) {
    // Stub flow: redirect to /admin/billing?stub=1 so the UI can show a message.
    redirect(`/admin/billing?stub=${venueSlug}`);
  }

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;

  const result = await createCheckout({
    amount: MONTHLY_R * 100, // cents
    successUrl: `${base}/admin/billing?ok=${venueSlug}`,
    cancelUrl: `${base}/admin/billing?cancelled=${venueSlug}`,
    metadata: { venue_id: venueId },
  });

  if ("error" in result) redirect(`/admin/billing?err=${encodeURIComponent(result.error)}`);
  redirect(result.checkoutUrl);
}
