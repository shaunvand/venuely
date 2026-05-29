"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { loadRules, computeTotals, applyMarkup, platformFee, type Charge, type Payment, type Computed } from "@/lib/billing/compute";
import { whatsappUrl } from "@/lib/whatsapp";

type WeddingState = {
  rentalSelections?: Record<string, { sel?: boolean; qty?: number; mg?: boolean; wed?: boolean; fb?: boolean }>;
  catalogueSelections?: Record<string, { sel?: boolean; mg?: boolean; wed?: boolean; fb?: boolean }>;
  roomAssignments?: Record<string, string[]>;
  suppliers?: Array<{ id: number; name: string; category?: string; status?: string; price?: string; fromVendorId?: string }>;
};

function parseMoney(s: string | undefined | null): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Rebuild a wedding's live charges the same way the venue/couple proforma does
// (see app/venue/weddings/[slug]/page.tsx). Used to recompute the platform fee
// authoritatively at invoice time rather than trusting client-bound totals.
async function buildWeddingCharges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  weddingId: string,
): Promise<{ grandTotal: number; feeRate: number; totals: Computed }> {
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, guest_count, wedding_state, area_selections")
    .eq("id", weddingId)
    .single();
  if (!wedding) throw new Error("Wedding not found");

  const { data: venue } = await supabase
    .from("venues")
    .select("platform_fee_rate")
    .eq("id", venueId)
    .single();
  const feeRate = Number((venue as { platform_fee_rate?: number } | null)?.platform_fee_rate ?? 0.01);

  const state = (wedding.wedding_state ?? {}) as WeddingState;
  const rules = await loadRules(supabase, venueId);

  const [rentalsRes, cataRes, accomRes, vendorsRes, areasRes, areaPricingRes, paymentsRes, chargesRes] = await Promise.all([
    supabase.from("rental_items").select("id, name, price, commission_value, commission_type, item_code, cost_treatment").eq("venue_id", venueId),
    supabase.from("catalogue_items").select("id, name, price, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("accommodation_rooms").select("id, name, price_per_night, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("vendor_partners").select("id, name, vendor_type, price_from, commission_value, commission_type, cost_treatment").eq("venue_id", venueId),
    supabase.from("venue_areas").select("id, name, slug, area_kind").eq("venue_id", venueId).eq("active", true),
    supabase.from("area_pricing").select("area_id, day_type, price"),
    supabase.from("payment_ledger").select("id, amount, direction, kind, paid_at").eq("wedding_id", weddingId),
    supabase.from("wedding_charges").select("id, kind, label, qty, unit_price, amount, is_refundable, day_type").eq("wedding_id", weddingId),
  ]);

  const rentalMap = new Map((rentalsRes.data ?? []).map((r) => [r.id, r]));
  const cataMap = new Map((cataRes.data ?? []).map((c) => [c.id, c]));
  const accomMap = new Map((accomRes.data ?? []).map((r) => [r.id, r]));
  const vendorMap = new Map((vendorsRes.data ?? []).map((v) => [v.id, v]));
  const areas = areasRes.data ?? [];
  const areaPriceMap: Record<string, Record<string, number>> = {};
  (areaPricingRes.data ?? []).forEach((p) => {
    areaPriceMap[p.area_id] = areaPriceMap[p.area_id] || {};
    areaPriceMap[p.area_id][p.day_type] = Number(p.price);
  });

  const charges: Charge[] = [];

  // Rentals
  for (const [code, v] of Object.entries(state.rentalSelections ?? {})) {
    if (!v.sel) continue;
    const item = rentalMap.get(code); if (!item) continue;
    const dayCount = [v.mg, v.wed, v.fb].filter(Boolean).length || 1;
    const qty = v.qty ?? 1;
    const baseUnit = Number(item.price);
    const unit = applyMarkup(baseUnit, item.commission_value, item.commission_type);
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    const units = qty * dayCount;
    charges.push({ kind: "rental", label: item.name, qty: units, unit_price: unit, amount: included ? 0 : unit * units, base_amount: included ? 0 : baseUnit * units, is_refundable: false });
  }

  // Catalogue (per-head)
  const guestCount = wedding.guest_count ?? 0;
  for (const [code, v] of Object.entries(state.catalogueSelections ?? {})) {
    if (!v.sel && !v.mg && !v.wed && !v.fb) continue;
    const item = cataMap.get(code); if (!item) continue;
    const dayCount = [v.mg, v.wed, v.fb].filter(Boolean).length || 1;
    const baseUnit = Number(item.price);
    const unit = applyMarkup(baseUnit, item.commission_value, item.commission_type);
    const included = (item as { cost_treatment?: string }).cost_treatment === "included";
    const units = dayCount * guestCount;
    charges.push({ kind: "catalogue", label: item.name, qty: units, unit_price: unit, amount: included ? 0 : unit * units, base_amount: included ? 0 : baseUnit * units, is_refundable: false });
  }

  // Accommodation
  for (const [roomId, names] of Object.entries(state.roomAssignments ?? {})) {
    const room = accomMap.get(roomId); if (!room || !names.length) continue;
    const baseUnit = Number(room.price_per_night);
    const unit = applyMarkup(baseUnit, room.commission_value, room.commission_type);
    const included = (room as { cost_treatment?: string }).cost_treatment === "included";
    charges.push({ kind: "accommodation", label: room.name, qty: 1, unit_price: unit, amount: included ? 0 : unit, base_amount: included ? 0 : baseUnit, is_refundable: false });
  }

  // Vendor partners selected
  (state.suppliers ?? []).forEach((s) => {
    if (s.status !== "booked" && !parseMoney(s.price)) return;
    const v = s.fromVendorId ? vendorMap.get(s.fromVendorId) : null;
    const fallback = v ? applyMarkup(Number(v.price_from ?? 0), v.commission_value, v.commission_type) : 0;
    const cost = parseMoney(s.price) || fallback;
    const included = v && (v as { cost_treatment?: string }).cost_treatment === "included";
    // Base = the supplier's price_from before markup when this is a known partner
    // priced off its catalogue entry. A manually keyed price (parseMoney) carries
    // no separable commission, so its base equals the charged amount.
    const baseCost = v && !parseMoney(s.price) ? Number(v.price_from ?? 0) : cost;
    if (cost > 0) charges.push({ kind: "vendor", label: s.name, qty: 1, unit_price: cost, amount: included ? 0 : cost, base_amount: included ? 0 : baseCost, is_refundable: false });
  });

  // Areas (paid extras only)
  const selectedAreas = (wedding.area_selections ?? []) as Array<{ area_id: string; day_type: string }>;
  selectedAreas.forEach((sel) => {
    const a = areas.find((x) => x.id === sel.area_id);
    const price = areaPriceMap[sel.area_id]?.[sel.day_type] ?? 0;
    if (a && price > 0) charges.push({ kind: "area", label: a.name, qty: 1, unit_price: price, amount: price, is_refundable: false });
  });

  // Manual charges (from wedding_charges table)
  (chargesRes.data ?? []).forEach((c) => {
    charges.push({
      id: c.id,
      kind: c.kind as Charge["kind"],
      label: c.label,
      qty: Number(c.qty),
      unit_price: Number(c.unit_price),
      amount: Number(c.amount),
      is_refundable: c.is_refundable,
      day_type: c.day_type,
    });
  });

  // Breakage deposit (rule)
  if (rules.breakage_deposit > 0) {
    charges.push({ kind: "breakage", label: "Refundable breakage deposit", qty: 1, unit_price: rules.breakage_deposit, amount: rules.breakage_deposit, is_refundable: true });
  }

  const payments = (paymentsRes.data ?? []).map((p) => ({
    id: p.id, amount: Number(p.amount), direction: p.direction as "in" | "out", kind: p.kind, paid_at: p.paid_at,
  })) as Payment[];

  const totals = computeTotals(rules, charges, payments);
  return { grandTotal: totals.grand_total, feeRate, totals };
}

// Lightweight salted hash. The base salt comes from a server-only env var
// (falls back to a fixed string in dev). When a per-wedding `portalSalt` is
// supplied it is folded in too, so rotating a wedding's salt invalidates every
// old vy_portal_<id> cookie (which stored the previous hash). Must stay in
// lock-step with the same helper in app/[wedding]/route.ts and lib/portal/access.ts.
function hashPassword(plain: string, portalSalt?: string | null): string {
  const base = process.env.PORTAL_PASSWORD_SALT ?? "venuely-portal-v1";
  const salt = portalSalt ? `${base}::${portalSalt}` : base;
  return createHash("sha256").update(`${salt}::${plain}`).digest("hex");
}

// A short, friendly, unambiguous password (no 0/O/1/l/I) for couples who don't
// already have one set. e.g. "petal-7421".
function friendlyPassword(): string {
  const words = ["petal", "ivory", "amber", "olive", "coral", "willow", "fern", "dahlia", "marble", "linen"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = 1000 + Math.floor(Math.random() * 9000);
  return `${word}-${num}`;
}

// Turn "Alex & Sam Smith" → "AlexAndSamSmithWedding".
// Strips non-alphanumerics, joins words, appends "Wedding" suffix.
function pascalSlug(couples: string): string {
  const cleaned = couples
    .replace(/&/g, " And ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const camel = cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return `${camel}Wedding`;
}

async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  while (true) {
    const { data } = await supabase.from("weddings").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}${n++}`;
  }
}

export async function createWedding(venueId: string, _venueSlug: string, formData: FormData) {
  const supabase = await createClient();
  const couples = (formData.get("couple_names") as string).trim();
  const explicit = (formData.get("slug") as string || "").trim();

  const base = explicit ? explicit.replace(/[^a-zA-Z0-9]/g, "") : pascalSlug(couples);
  const slug = await uniqueSlug(supabase, base);

  const guestStr = formData.get("guest_count") as string;
  const statusStr = (formData.get("status") as string)?.trim() || "inquiry";
  const passwordStr = (formData.get("portal_password") as string)?.trim() || "";
  const { data, error } = await supabase
    .from("weddings")
    .insert({
      venue_id: venueId,
      slug,
      couple_names: couples,
      wedding_date: (formData.get("wedding_date") as string) || null,
      guest_count: guestStr ? Number(guestStr) : null,
      status: statusStr,
      portal_password_hash: passwordStr ? hashPassword(passwordStr) : null,
    })
    .select("slug")
    .single();

  if (error) throw new Error(`Could not create wedding: ${error.message}`);
  revalidatePath("/venue/weddings");
  if (data) redirect(`/venue/weddings/${data.slug}`);
}

export async function updateWeddingBasics(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const guestStr = formData.get("guest_count") as string;
  const budgetStr = formData.get("total_budget") as string;
  const patch: Record<string, unknown> = {
    couple_names: (formData.get("couple_names") as string)?.trim(),
    wedding_date: (formData.get("wedding_date") as string) || null,
    guest_count: guestStr ? Number(guestStr) : null,
    total_budget: budgetStr ? Number(budgetStr) : null,
    status: (formData.get("status") as string) || "inquiry",
    notes: (formData.get("notes") as string) || null,
  };
  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function setPortalPassword(weddingId: string, slug: string, formData: FormData) {
  const supabase = await createClient();
  const pw = (formData.get("password") as string || "").trim();
  // Hash with the wedding's current per-wedding salt (if it has one from a prior
  // rotation) so the gate — which prefers portal_salt — keeps matching.
  const { data: wed } = await supabase.from("weddings").select("portal_salt").eq("id", weddingId).single();
  const portalSalt = (wed as { portal_salt?: string | null } | null)?.portal_salt ?? null;
  const patch = { portal_password_hash: pw ? hashPassword(pw, portalSalt) : null };
  const { error } = await supabase.from("weddings").update(patch).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// -----------------------------------------------------------------------------
// Couple invite & delivery + link lifecycle.
// -----------------------------------------------------------------------------

const RESEND_API = "https://api.resend.com/emails";

// Build the public origin (https://venuely.co.za) from x-forwarded-* so links
// never leak the internal Render dyno address.
async function publicOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "venuely.co.za";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export type SendPortalInviteResult = {
  ok: boolean;
  url: string;
  whatsappUrl: string | null;
  passwordSet: boolean;
  password?: string;          // only returned when freshly auto-generated
  emailSent: boolean;
  reason?: string;
};

// Ensure the couple has a way in, record the invite, and (best-effort) email them.
//  - If no portal password is set, auto-generate a friendly one and store its hash.
//  - Insert a wedding_invites row with a random token, 30-day expiry.
//  - Email the portal link + access code via the Resend fetch pattern (env-gated).
//  - Persist couple_email on the wedding.
export async function sendPortalInvite(
  weddingId: string,
  slug: string,
  opts: { email?: string; whatsapp?: string },
): Promise<SendPortalInviteResult> {
  const supabase = await createClient();
  const email = (opts.email ?? "").trim();
  const whatsapp = (opts.whatsapp ?? "").trim();

  const { data: wed, error: wErr } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, portal_password_hash, portal_salt, venue:venues(name)")
    .eq("id", weddingId)
    .single();
  if (wErr || !wed) throw new Error(wErr?.message ?? "Wedding not found");

  const venueName = (wed as unknown as { venue: { name: string } | null }).venue?.name ?? "your venue";
  const portalSalt = (wed as { portal_salt?: string | null }).portal_salt ?? null;

  // 1) Ensure an access code exists.
  let generatedPassword: string | undefined;
  let passwordSet = !!(wed as { portal_password_hash?: string | null }).portal_password_hash;
  if (!passwordSet) {
    generatedPassword = friendlyPassword();
    const { error: pErr } = await supabase
      .from("weddings")
      .update({ portal_password_hash: hashPassword(generatedPassword, portalSalt) })
      .eq("id", weddingId);
    if (pErr) throw new Error(pErr.message);
    passwordSet = true;
  }

  // 2) Record the invite (random token, 30-day expiry).
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("wedding_invites").insert({
    wedding_id: weddingId,
    email: email || null,
    role: "couple",
    token,
    expires_at: expiresAt,
    status: "sent",
  });

  // 3) Persist the couple email when supplied.
  if (email) {
    await supabase.from("weddings").update({ couple_email: email }).eq("id", weddingId);
  }

  const origin = await publicOrigin();
  const url = `${origin}/${slug}`;

  // 4) Compose the WhatsApp share link (returned to the client for one-tap share).
  const waMessage = generatedPassword
    ? `Hi! Your ${venueName} wedding planning portal is ready 💍\n\n${url}\nAccess code: ${generatedPassword}`
    : `Hi! Your ${venueName} wedding planning portal is ready 💍\n\n${url}`;
  const wa = whatsapp ? whatsappUrl(whatsapp, waMessage) : null;

  // 5) Email the couple (env-gated — never throws at build/import time).
  let emailSent = false;
  if (process.env.RESEND_API_KEY && email) {
    const codeBlock = generatedPassword
      ? `<p style="margin:0 0 8px;color:#57534e">Your access code:</p>
         <p style="font-size:22px;font-weight:600;letter-spacing:1px;margin:0 0 20px;color:#FA523C">${generatedPassword}</p>`
      : `<p style="margin:0 0 20px;color:#57534e">Use the access code your venue gave you to sign in.</p>`;
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#FFF6F0;border-radius:16px;padding:36px">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#FA523C;font-weight:600">Venuely</div>
        <h1 style="font-family:Georgia,serif;font-size:26px;color:#1c1917;margin:8px 0 4px">Your wedding portal is ready</h1>
        <p style="color:#57534e;margin:0 0 24px">Hi ${(wed as { couple_names: string }).couple_names}, ${venueName} has set up your personal planning portal.</p>
        <a href="${url}" style="display:inline-block;background:#FA523C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;margin:0 0 24px">Open your portal →</a>
        ${codeBlock}
        <p style="color:#8a9a86;font-size:13px;margin:24px 0 0;border-top:1px solid #FFC6AD;padding-top:16px">
          Or paste this link into your browser:<br><span style="color:#57534e;word-break:break-all">${url}</span>
        </p>
      </div>`;
    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Venuely <hello@venuely.co.za>",
          to: email,
          subject: `Your ${venueName} wedding portal is ready`,
          html,
        }),
      });
      emailSent = res.ok;
    } catch {
      emailSent = false; // non-fatal — the link + code are still usable
    }
  }

  revalidatePath(`/venue/weddings/${slug}`);
  return {
    ok: true,
    url,
    whatsappUrl: wa,
    passwordSet,
    password: generatedPassword,
    emailSent,
    reason: !process.env.RESEND_API_KEY ? "email_not_configured" : (!email ? "no_email" : undefined),
  };
}

// Rotate portal access: assign a NEW per-wedding portal_salt so every previously
// issued vy_portal_<id> cookie stops matching. If an explicit new password is
// supplied we re-hash it under the new salt; otherwise we clear the password so
// the next sendPortalInvite generates (and surfaces) a fresh access code — the
// only way to reveal a new code to the venue, since a bare form action can't
// return one to the UI.
export async function rotatePortalAccess(weddingId: string, slug: string, formData?: FormData) {
  const supabase = await createClient();
  const newSalt = randomBytes(12).toString("hex");

  const supplied = (formData?.get("password") as string | null)?.trim() || "";
  const nextHash: string | null = supplied ? hashPassword(supplied, newSalt) : null;

  const { error } = await supabase
    .from("weddings")
    .update({ portal_salt: newSalt, portal_password_hash: nextHash })
    .eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// Remove a couple member from the wedding (revokes auth-based access; the
// can_access_wedding RLS no longer matches that user).
export async function revokeCoupleAccess(weddingId: string, userId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("wedding_members")
    .delete()
    .eq("wedding_id", weddingId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

// NOTE: total/feeRate are still in the signature so the [slug] page's bound
// call keeps compiling, but they are NOT trusted — the invoice total and the
// platform fee are recomputed server-side from the wedding's live charges and
// the venue's authoritative platform_fee_rate. This prevents a tampered client
// form from understating (or inflating) the fee owed.
export async function markInvoiced(weddingId: string, slug: string, _total?: number, _feeRate?: number) {
  const supabase = await createClient();

  const { data: wed } = await supabase.from("weddings").select("venue_id").eq("id", weddingId).single();
  if (!wed?.venue_id) throw new Error("Wedding not found");

  const { grandTotal, feeRate, totals } = await buildWeddingCharges(supabase, wed.venue_id as string, weddingId);
  // invoice_total snapshots what the couple pays (the gross grand_total), but the
  // platform fee is rate × platform_fee_base (= grand_total − venue commission).
  // Venuely never taxes the venue's commission; the venue keeps 100% of it.
  const fee = platformFee(totals, feeRate);

  const { error } = await supabase.from("weddings").update({
    invoiced_at: new Date().toISOString(),
    invoice_total: grandTotal,
    platform_fee_owed: fee,
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function markCouplePaid(weddingId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({
    couple_paid_at: new Date().toISOString(),
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}

export async function markPlatformFeePaid(weddingId: string, slug: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("weddings").update({
    platform_fee_paid_at: new Date().toISOString(),
  }).eq("id", weddingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/venue/weddings/${slug}`);
}
