import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { applyMarkup } from "@/lib/billing/compute";

function hashPassword(plain: string): string {
  const salt = process.env.PORTAL_PASSWORD_SALT ?? "venuely-portal-v1";
  return createHash("sha256").update(`${salt}::${plain}`).digest("hex");
}

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
  <form method="GET" action="/${slug}">
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
type Catalogue = { id: string; category: string; name: string; description: string | null; sort_order: number };
type Rental    = { id: string; category: string; name: string; description: string | null; price: number; stock_total: number; sort_order: number } & Commish;
type Room      = { id: string; name: string; room_type: string | null; sleeps: number; description: string | null; sort_order: number; price_per_night: number } & Commish;

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
    })),
    CATALOGUE_CATS: [...new Set(catalogue.map((c) => c.category))],
    RENTAL_ITEMS: rentals.map((r) => ({
      code: r.id, name: r.name, desc: r.description ?? "", cat: r.category,
      rate: applyMarkup(Number(r.price), r.commission_value, r.commission_type),
      rateType: r.stock_total > 1 ? "perUnit" : "flat",
      maxQty: r.stock_total, repl: 0,
    })),
    RENTAL_CATS: [...new Set(rentals.map((r) => r.category))],
    ACCOMMODATION: rooms.map((r) => ({
      id: r.id, name: r.name, type: r.room_type ?? "Room",
      sleeps: r.sleeps, bedrooms: 1,
      description: r.description ?? "",
      amenities: [],
      pricePerNight: applyMarkup(Number(r.price_per_night), r.commission_value, r.commission_type),
    })),
  };
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ wedding: string }> }
) {
  const { wedding: rawSlug } = await ctx.params;
  if (RESERVED.has(rawSlug)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();

  // Fetch the wedding (no auth required to look up — auth/password gate below).
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, wedding_state, portal_password_hash, venue:venues(id, name, slug, description, directions, website, included_items, contact_email, contact_phone, google_maps_url)")
    .eq("slug", rawSlug)
    .maybeSingle();
  if (!wedding) return new NextResponse("Wedding portal not found.", { status: 404 });

  const expectedHash = (wedding as unknown as { portal_password_hash: string | null }).portal_password_hash;

  // Access logic:
  //  - If a portal password is set → that password is the gate; no Supabase Auth needed.
  //  - If no password set → fall back to Supabase Auth login.
  if (expectedHash) {
    const cookieName = `vy_portal_${wedding.id}`;
    const cookieValue = request.cookies.get(cookieName)?.value;
    if (cookieValue !== expectedHash) {
      const supplied = request.nextUrl.searchParams.get("p");
      if (supplied && hashPassword(supplied) === expectedHash) {
        const cleanUrl = request.nextUrl.clone();
        cleanUrl.searchParams.delete("p");
        const res = NextResponse.redirect(cleanUrl);
        res.cookies.set(cookieName, expectedHash, {
          httpOnly: true, sameSite: "lax", secure: true,
          maxAge: 60 * 60 * 24 * 30, path: `/${rawSlug}`,
        });
        return res;
      }
      const err = supplied ? "Incorrect password — try again." : undefined;
      return new NextResponse(passwordGateHtml(rawSlug, wedding.couple_names, err), {
        status: 200, headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", `/${rawSlug}`);
      return NextResponse.redirect(url);
    }
  }

  const venue = (wedding as unknown as {
    venue: {
      id: string; name: string; slug: string;
      description: string | null; directions: string | null; website: string | null;
      included_items: unknown; contact_email: string | null; contact_phone: string | null;
      google_maps_url: string | null;
    } | null
  }).venue;
  const venueId = venue?.id;

  // Pull venue inventory in parallel.
  const [{ data: catRaw }, { data: rentRaw }, { data: roomRaw }, { data: vendorRaw }, { data: galleryRaw }, { data: areaRaw }] = await Promise.all([
    supabase.from("catalogue_items").select("id, category, name, description, sort_order").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("rental_items").select("id, category, name, description, price, stock_total, sort_order, commission_value, commission_type").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("accommodation_rooms").select("id, name, room_type, sleeps, description, sort_order, price_per_night, commission_value, commission_type").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("vendor_partners").select("id, vendor_type, name, description, contact_email, contact_phone, website_url, price_from, image_url, commission_value, commission_type").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("media_assets").select("url, label, kind, category, sort_order").eq("venue_id", venueId).eq("owner_type", "venue").in("kind", ["photo", "video", "hero"]).order("sort_order"),
    supabase.from("venue_areas").select("name, description, sort_order").eq("venue_id", venueId).eq("active", true).order("sort_order"),
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
  window.WEDDING_INITIAL_STATE = ${JSON.stringify(wState)};
  window.WEDDING_USE_SERVER    = true;
</script>
`;

  let html = readTemplate();
  html = html.replace(
    /<script src="\/wedding-portal\/app\.js"/,
    `${initScript}<script src="/wedding-portal/app.js"`
  );

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
