import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { applyMarkup } from "@/lib/billing/compute";
import { resolveTheme as resolvePortalTheme, resolveTemplate as resolvePortalTemplate } from "@/lib/portal/templates";

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
          const res = NextResponse.redirect(`${publicOrigin(request)}/p/${rawSlug}`);
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

  // Access granted → serve the new templated couple portal (/p/<slug>). The
  // legacy static-HTML build below is retained but no longer reached.
  return NextResponse.redirect(`${publicOrigin(request)}/p/${rawSlug}`);

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
    const res = NextResponse.redirect(`${publicOrigin(request)}/p/${rawSlug}`, { status: 303 });
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
