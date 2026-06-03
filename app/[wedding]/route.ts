import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { applyMarkup } from "@/lib/billing/compute";
import { resolveTheme as resolvePortalTheme } from "@/lib/portal/templates";

// Salted hash. Folds in the per-wedding portal_salt when present so a rotated
// salt invalidates old cookies. Must stay in lock-step with the helper in
// app/venue/weddings/actions.ts.
function hashPassword(plain: string, portalSalt?: string | null): string {
  const base = process.env.PORTAL_PASSWORD_SALT ?? "venuely-portal-v1";
  const salt = portalSalt ? `${base}::${portalSalt}` : base;
  return createHash("sha256").update(`${salt}::${plain}`).digest("hex");
}

// Service-role client for writing the access log (RLS only permits service-role
// inserts). Returns null when the key is absent so logging is best-effort and
// never crashes the page.
function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null;
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Build redirects from the PUBLIC host (x-forwarded-*), not request.nextUrl, which
// on Render is the internal origin (localhost:10000) and would leak into Location.
function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

async function logAccess(weddingId: string, via: "password" | "member"): Promise<void> {
  const ad = admin();
  if (!ad) return;
  try {
    await ad.from("portal_access_log").insert({ wedding_id: weddingId, via });
  } catch {
    // Access logging is best-effort — never block the grant on a log failure.
  }
}

// -----------------------------------------------------------------------------
// Per-slug brute-force throttle (in-memory, bounded). Resets on cold start.
// Not a substitute for a real rate-limiter, just a cheap speed bump.
// -----------------------------------------------------------------------------
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000;     // 5 minutes
const _attempts = new Map<string, { count: number; first: number }>();

function tooManyAttempts(slug: string): boolean {
  const now = Date.now();
  const e = _attempts.get(slug);
  if (!e) return false;
  if (now - e.first > WINDOW_MS) { _attempts.delete(slug); return false; }
  return e.count >= MAX_ATTEMPTS;
}
function recordAttempt(slug: string): void {
  const now = Date.now();
  const e = _attempts.get(slug);
  if (!e || now - e.first > WINDOW_MS) { _attempts.set(slug, { count: 1, first: now }); return; }
  e.count += 1;
  // Bound the map so a flood of distinct slugs can't grow it without limit.
  if (_attempts.size > 5000) _attempts.clear();
}
function clearAttempts(slug: string): void { _attempts.delete(slug); }

function passwordGateHtml(slug: string, couple: string, error?: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Enter password — Venuely</title>
<style>
  body{font-family:Georgia,serif;background:#f5efe6;color:#2d2a26;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}
  .card{background:#fff;border-radius:14px;padding:40px;max-width:420px;width:100%;box-shadow:0 12px 40px rgba(45,74,58,0.08)}
  h1{font-size:24px;margin:0 0 6px;color:#2d4a3a}
  p{margin:0 0 22px;color:#7a6f63;font-size:14px;font-family:system-ui,sans-serif}
  input{width:100%;padding:12px 14px;border:1px solid #d8d0c0;border-radius:8px;font-size:15px;box-sizing:border-box;font-family:system-ui,sans-serif}
  button{margin-top:14px;width:100%;padding:12px 14px;border:none;border-radius:8px;background:#2d4a3a;color:#fff;font-size:15px;cursor:pointer;font-family:system-ui,sans-serif}
  button:hover{background:#1f3528}
  .err{color:#b91c1c;font-size:13px;margin-top:10px;font-family:system-ui,sans-serif}
</style></head>
<body><div class="card">
  <h1>${couple.replace(/[<>&"]/g, "")}</h1>
  <p>This wedding portal is password-protected. Enter the password your venue gave you.</p>
  <form method="POST" action="/${slug}">
    <input type="password" name="p" autofocus placeholder="Password" required />
    <button type="submit">Unlock portal</button>
    ${error ? `<div class="err">${error}</div>` : ""}
  </form>
</div></body></html>`;
}

const RESERVED = new Set([
  "admin", "venue", "portal", "dashboard", "login", "signup",
  "auth", "onboarding", "api", "favicon.ico", "wedding-portal",
  "_next", "robots.txt", "sitemap.xml", "brand", "docs", "logout", "booking",
]);

let _templateCache: string | null = null;
function readTemplate(): string {
  if (_templateCache) return _templateCache;
  const p = path.join(process.cwd(), "templates", "wedding-portal.html");
  _templateCache = fs.readFileSync(p, "utf8");
  return _templateCache;
}

type Commish = { commission_value?: number | null; commission_type?: string | null };
type Catalogue = { id: string; category: string; name: string; description: string | null; sort_order: number; image_url: string | null };
type Rental    = { id: string; category: string; name: string; description: string | null; price: number; stock_total: number; sort_order: number; image_url: string | null } & Commish;
type Room      = { id: string; name: string; room_type: string | null; sleeps: number; description: string | null; sort_order: number; price_per_night: number; floor_plan_url: string | null; hero_image_url: string | null; image_url: string | null } & Commish;

// applyMarkup imported from @/lib/billing/compute — single source of truth

// Translate venue inventory (Supabase rows) into the shape the static app.js expects.
function shapeForApp(
  catalogue: Catalogue[],
  rentals: Rental[],
  rooms: Room[],
) {
  return {
    CATALOGUE_ITEMS: catalogue.map((c) => ({
      code: c.id, name: c.name, desc: c.description ?? "", cat: c.category, type: "included",
      img: c.image_url ?? null,
    })),
    CATALOGUE_CATS: [...new Set(catalogue.map((c) => c.category))],
    RENTAL_ITEMS: rentals.map((r) => ({
      code: r.id, name: r.name, desc: r.description ?? "", cat: r.category,
      rate: applyMarkup(Number(r.price), r.commission_value, r.commission_type),
      rateType: r.stock_total > 1 ? "perUnit" : "flat",
      maxQty: r.stock_total, repl: 0,
      img: r.image_url ?? null,
    })),
    RENTAL_CATS: [...new Set(rentals.map((r) => r.category))],
    ACCOMMODATION: rooms.map((r) => ({
      id: r.id, name: r.name, type: r.room_type ?? "Room",
      sleeps: r.sleeps, bedrooms: 1,
      description: r.description ?? "",
      amenities: [],
      pricePerNight: applyMarkup(Number(r.price_per_night), r.commission_value, r.commission_type),
      floorPlan: r.floor_plan_url ?? null,
      img: r.hero_image_url ?? r.image_url ?? null,
    })),
  };
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ wedding: string }> }
) {
  const { wedding: rawSlug } = await ctx.params;
  if (RESERVED.has(rawSlug)) return new NextResponse("Not found", { status: 404 });

  // Service-role for the wedding lookup + venue inventory: an anonymous couple has
  // no session and weddings/inventory RLS would hide the row. The password/auth
  // gate below is the real authorisation check.
  const supabase = admin() ?? (await createClient());

  // Fetch the wedding (no auth required to look up — auth/password gate below).
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, wedding_state, portal_password_hash, portal_salt, venue:venues(id, name, slug, description, directions, website, included_items, contact_email, contact_phone, google_maps_url, portal_template, portal_theme, branding_logo_url)")
    .eq("slug", rawSlug)
    .maybeSingle();
  if (!wedding) return new NextResponse("Wedding portal not found.", { status: 404 });

  const expectedHash = (wedding as unknown as { portal_password_hash: string | null }).portal_password_hash;
  const portalSalt = (wedding as unknown as { portal_salt: string | null }).portal_salt;

  // Access logic:
  //  - If a portal password is set → that password is the gate; no Supabase Auth needed.
  //  - If no password set → fall back to Supabase Auth login.
  if (expectedHash) {
    const cookieName = `vy_portal_${wedding.id}`;
    const cookieValue = request.cookies.get(cookieName)?.value;
    if (cookieValue === expectedHash) {
      // Already authenticated via cookie — log the open. (No-op without service key.)
      await logAccess(wedding.id, "password");
    } else {
      // Backward-compatible ?p= grant (older links). The preferred path is the
      // POST handler below; GET ?p= is kept so existing emails/QRs still work.
      const supplied = request.nextUrl.searchParams.get("p");
      if (supplied) {
        if (tooManyAttempts(rawSlug)) {
          return new NextResponse(passwordGateHtml(rawSlug, wedding.couple_names, "Too many attempts — wait a few minutes and try again."), {
            status: 429, headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        // Use the per-wedding salt when present, else the legacy base salt.
        if (hashPassword(supplied, portalSalt) === expectedHash) {
          clearAttempts(rawSlug);
          await logAccess(wedding.id, "password");
          const res = NextResponse.redirect(`${publicOrigin(request)}/${rawSlug}`);
          res.cookies.set(cookieName, expectedHash, {
            httpOnly: true, sameSite: "lax", secure: true,
            maxAge: 60 * 60 * 24 * 30, path: "/", // site-wide so it reaches /api/paystack/checkout; cookie name is wedding-scoped (vy_portal_<id>)
          });
          return res;
        }
        recordAttempt(rawSlug);
      }
      const err = supplied ? "Incorrect password — try again." : undefined;
      return new NextResponse(passwordGateHtml(rawSlug, wedding.couple_names, err), {
        status: 200, headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  } else {
    // No portal password → fall back to Supabase Auth. getUser() needs the
    // cookie-aware client (the data client above is service-role, no session).
    const ssr = await createClient();
    const { data: { user } } = await ssr.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${publicOrigin(request)}/login?redirect=${encodeURIComponent(`/${rawSlug}`)}`);
    }
    // Authenticated member/owner/venue-staff grant.
    await logAccess(wedding.id, "member");
  }

  const venue = (wedding as unknown as {
    venue: {
      id: string; name: string; slug: string;
      description: string | null; directions: string | null; website: string | null;
      included_items: unknown; contact_email: string | null; contact_phone: string | null;
      google_maps_url: string | null;
      portal_template: string | null; portal_theme: unknown; branding_logo_url: string | null;
    } | null
  }).venue;
  const venueId = venue?.id;

  // Pull venue inventory in parallel.
  const [{ data: catRaw }, { data: rentRaw }, { data: roomRaw }, { data: vendorRaw }, { data: galleryRaw }, { data: areaRaw }, { data: floorplanRaw }] = await Promise.all([
    supabase.from("catalogue_items").select("id, category, name, description, sort_order, image_url").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("rental_items").select("id, category, name, description, price, stock_total, sort_order, commission_value, commission_type, image_url").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("accommodation_rooms").select("id, name, room_type, sleeps, description, sort_order, price_per_night, floor_plan_url, hero_image_url, image_url, commission_value, commission_type").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("vendor_partners").select("id, vendor_type, name, description, contact_email, contact_phone, website_url, price_from, image_url, commission_value, commission_type").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("media_assets").select("url, label, kind, category, sort_order").eq("venue_id", venueId).eq("owner_type", "venue").in("kind", ["photo", "video", "hero"]).order("sort_order"),
    supabase.from("venue_areas").select("name, description, sort_order").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    // Floor-plan / layout images live as media_assets with kind='floorplan'. Kept
    // out of the photo gallery query above so the "Our Venue" gallery stays photos
    // only; surfaced on the new Floor Plans tab via window.VENUE_FLOORPLANS.
    supabase.from("media_assets").select("url, label, category, sort_order").eq("venue_id", venueId).eq("owner_type", "venue").eq("kind", "floorplan").order("sort_order"),
  ]);

  const shaped = shapeForApp((catRaw ?? []) as Catalogue[], (rentRaw ?? []) as Rental[], (roomRaw ?? []) as Room[]);
  const wState = (wedding as unknown as { wedding_state: object }).wedding_state ?? {};

  const initScript = `
<script>
  window.WEDDING_SLUG    = ${JSON.stringify(wedding.slug)};
  window.WEDDING_ID      = ${JSON.stringify(wedding.id)};
  window.WEDDING_COUPLE  = ${JSON.stringify(wedding.couple_names)};
  window.WEDDING_DATE    = ${JSON.stringify(wedding.wedding_date)};
  window.WEDDING_VENUE   = ${JSON.stringify({ id: venue?.id, name: venue?.name, slug: venue?.slug })};
  window.VENUE_DESCRIPTION = ${JSON.stringify(venue?.description ?? null)};
  window.VENUE_DIRECTIONS  = ${JSON.stringify(venue?.directions ?? null)};
  window.VENUE_WEBSITE     = ${JSON.stringify(venue?.website ?? null)};
  window.VENUE_INCLUDED    = ${JSON.stringify(Array.isArray(venue?.included_items) ? venue?.included_items : [])};
  window.VENUE_CONTACT     = ${JSON.stringify({ email: venue?.contact_email ?? null, phone: venue?.contact_phone ?? null })};
  window.VENUE_MAP_URL     = ${JSON.stringify(venue?.google_maps_url ?? null)};
  window.VENUE_AREAS       = ${JSON.stringify((areaRaw ?? []).map((a) => {
    const aa = a as Record<string, unknown>;
    return { name: aa.name ?? "", description: aa.description ?? "" };
  }))};
  window.VENUE_CATALOGUE_ITEMS = ${JSON.stringify(shaped.CATALOGUE_ITEMS)};
  window.VENUE_CATALOGUE_CATS  = ${JSON.stringify(shaped.CATALOGUE_CATS)};
  window.VENUE_RENTAL_ITEMS    = ${JSON.stringify(shaped.RENTAL_ITEMS)};
  window.VENUE_RENTAL_CATS     = ${JSON.stringify(shaped.RENTAL_CATS)};
  window.VENUE_ACCOMMODATION   = ${JSON.stringify(shaped.ACCOMMODATION)};
  window.VENUE_ACCOMMODATION_LINK = ${JSON.stringify(`/booking/${wedding.slug}/accommodation`)};
  window.VENUE_VENDORS         = ${JSON.stringify((vendorRaw ?? []).map((v) => {
    const vv = v as Record<string, unknown>;
    return {
      ...vv,
      price_from: vv.price_from == null ? null : applyMarkup(Number(vv.price_from), vv.commission_value as number | null, vv.commission_type as string | null),
    };
  }))};
  window.VENUE_GALLERY = ${JSON.stringify(
    (galleryRaw ?? [])
      .filter((g) => /\.(jpe?g|png|webp|gif|avif|heic|mp4|mov|webm|m4v)(\?|$)/i.test(String((g as Record<string, unknown>).url)))
      .map((g) => {
        const gg = g as Record<string, unknown>;
        return { src: gg.url, kind: gg.kind, category: gg.category ?? "Other", label: gg.label ?? "" };
      })
  )};
  window.VENUE_FLOORPLANS = ${JSON.stringify(
    (floorplanRaw ?? [])
      .filter((g) => /\.(jpe?g|png|webp|gif|avif|heic|svg)(\?|$)/i.test(String((g as Record<string, unknown>).url)))
      .map((g) => {
        const gg = g as Record<string, unknown>;
        return { src: gg.url, category: gg.category ?? "Floor plan", label: gg.label ?? "" };
      })
  )};
  window.WEDDING_INITIAL_STATE = ${JSON.stringify(wState)};
  window.WEDDING_USE_SERVER    = true;
</script>
`;

  let html = readTemplate();
  html = html.replace(
    /<script src="\/wedding-portal\/app\.js"/,
    `${initScript}<script src="/wedding-portal/app.js"`
  );

  // Apply the venue's chosen portal theme (set in Your Venue → portal designer):
  // remap the portal's brand CSS variables to the venue's primary/accent and swap
  // the header logo, so the couple portal matches the design the venue configured.
  const theme = resolvePortalTheme(venue?.portal_theme);
  const themePrimary = theme.primary;
  const themeAccent = theme.accent;
  const themeLogo = theme.logoUrl || venue?.branding_logo_url || null;
  const themeStyle = `<style id="vy-venue-theme">`
    + `:root{--forest:${themePrimary} !important;--gold:${themeAccent} !important;--gold-light:${themeAccent} !important;--sage:${themeAccent}33 !important;}`
    // The hero gradient is hardcoded green in the base CSS — repaint it in the venue's primary.
    + `header{background:linear-gradient(155deg,${themePrimary} 0%,${themePrimary} 55%,${themeAccent} 130%) !important;}`
    // Drop the billing (Committed) + checklist (Tasks done) stat cards from the couple dashboard.
    + `#dashStats>*:nth-child(3),#dashStats>*:nth-child(4){display:none !important;}`
    + `</style>`;
  html = html.replace("</head>", `${themeStyle}</head>`);
  if (themeLogo) {
    html = html.replace(/(<img class="header-logo" src=")[^"]*(")/, `$1${themeLogo}$2`);
  }

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Preferred password-gate path: the unlock form POSTs here. On success we set
// the cookie and 303-redirect to the GET portal (cookie now matches). On
// failure we re-render the gate. Keeps the GET ?p= path working for old links.
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ wedding: string }> }
) {
  const { wedding: rawSlug } = await ctx.params;
  if (RESERVED.has(rawSlug)) return new NextResponse("Not found", { status: 404 });

  // Service-role for the wedding lookup + venue inventory: an anonymous couple has
  // no session and weddings/inventory RLS would hide the row. The password/auth
  // gate below is the real authorisation check.
  const supabase = admin() ?? (await createClient());
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, couple_names, portal_password_hash, portal_salt")
    .eq("slug", rawSlug)
    .maybeSingle();
  if (!wedding) return new NextResponse("Wedding portal not found.", { status: 404 });

  const expectedHash = (wedding as unknown as { portal_password_hash: string | null }).portal_password_hash;
  const portalSalt = (wedding as unknown as { portal_salt: string | null }).portal_salt;

  // No password set → there's nothing to POST; bounce to the GET (auth) flow.
  if (!expectedHash) {
    return NextResponse.redirect(`${publicOrigin(request)}/${rawSlug}`, { status: 303 });
  }

  if (tooManyAttempts(rawSlug)) {
    return new NextResponse(passwordGateHtml(rawSlug, wedding.couple_names, "Too many attempts — wait a few minutes and try again."), {
      status: 429, headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  let supplied = "";
  try {
    const form = await request.formData();
    supplied = String(form.get("p") ?? "").trim();
  } catch {
    supplied = "";
  }

  if (supplied && hashPassword(supplied, portalSalt) === expectedHash) {
    clearAttempts(rawSlug);
    await logAccess(wedding.id, "password");
    const res = NextResponse.redirect(`${publicOrigin(request)}/${rawSlug}`, { status: 303 });
    res.cookies.set(`vy_portal_${wedding.id}`, expectedHash, {
      httpOnly: true, sameSite: "lax", secure: true,
      maxAge: 60 * 60 * 24 * 30, path: "/", // site-wide so it reaches /api/paystack/checkout; cookie name is wedding-scoped (vy_portal_<id>)
    });
    return res;
  }

  recordAttempt(rawSlug);
  const err = supplied ? "Incorrect password — try again." : "Enter your access code.";
  return new NextResponse(passwordGateHtml(rawSlug, wedding.couple_names, err), {
    status: 200, headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
