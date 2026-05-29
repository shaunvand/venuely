"use server";

// Pricing model is "1% of wedding spend, no monthly fee, no contract".
// The old flat-fee Yoco subscription flow (MONTHLY_R / startSubscription) was
// removed — there is no recurring charge to start. Platform fees are tallied
// per-booking in /admin/billing and settled out-of-band (recurring/commission
// collection via Paystack is a later wave). No exports remain by design.

export {};
