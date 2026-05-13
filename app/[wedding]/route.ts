import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";

const RESERVED = new Set([
  "admin", "venue", "portal", "dashboard", "login", "signup",
  "auth", "onboarding", "api", "favicon.ico", "wedding-portal",
  "_next", "robots.txt", "sitemap.xml",
]);

let _templateCache: string | null = null;
function readTemplate(): string {
  if (_templateCache) return _templateCache;
  const p = path.join(process.cwd(), "templates", "wedding-portal.html");
  _templateCache = fs.readFileSync(p, "utf8");
  return _templateCache;
}

type Catalogue = { id: string; category: string; name: string; description: string | null; sort_order: number };
type Rental    = { id: string; category: string; name: string; description: string | null; price: number; stock_total: number; sort_order: number };
type Room      = { id: string; name: string; room_type: string | null; sleeps: number; description: string | null; sort_order: number; price_per_night: number };

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
      rate: Number(r.price), rateType: r.stock_total > 1 ? "perUnit" : "flat",
      maxQty: r.stock_total, repl: 0,
    })),
    RENTAL_CATS: [...new Set(rentals.map((r) => r.category))],
    ACCOMMODATION: rooms.map((r) => ({
      id: r.id, name: r.name, type: r.room_type ?? "Room",
      sleeps: r.sleeps, bedrooms: 1,
      description: r.description ?? "",
      amenities: [],
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", `/${rawSlug}`);
    return NextResponse.redirect(url);
  }

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, wedding_state, venue:venues(id, name, slug)")
    .eq("slug", rawSlug)
    .maybeSingle();
  if (!wedding) return new NextResponse("Wedding portal not found.", { status: 404 });

  const venue = (wedding as unknown as { venue: { id: string; name: string; slug: string } | null }).venue;
  const venueId = venue?.id;

  // Pull venue inventory in parallel.
  const [{ data: catRaw }, { data: rentRaw }, { data: roomRaw }] = await Promise.all([
    supabase.from("catalogue_items").select("id, category, name, description, sort_order").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("rental_items").select("id, category, name, description, price, stock_total, sort_order").eq("venue_id", venueId).eq("active", true).order("sort_order"),
    supabase.from("accommodation_rooms").select("id, name, room_type, sleeps, description, sort_order, price_per_night").eq("venue_id", venueId).eq("active", true).order("sort_order"),
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
  window.VENUE_CATALOGUE_ITEMS = ${JSON.stringify(shaped.CATALOGUE_ITEMS)};
  window.VENUE_CATALOGUE_CATS  = ${JSON.stringify(shaped.CATALOGUE_CATS)};
  window.VENUE_RENTAL_ITEMS    = ${JSON.stringify(shaped.RENTAL_ITEMS)};
  window.VENUE_RENTAL_CATS     = ${JSON.stringify(shaped.RENTAL_CATS)};
  window.VENUE_ACCOMMODATION   = ${JSON.stringify(shaped.ACCOMMODATION)};
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
