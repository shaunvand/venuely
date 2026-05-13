import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";

// Reserved top-level paths that must NOT be treated as wedding slugs.
// (Next.js routes them via static files first, but if a slug happens to
// match one of these we 404 to avoid leaking auth surfaces.)
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

  // Slug match is case-sensitive in the DB; allow either exact or lowercased lookup.
  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, venue:venues(name, slug)")
    .eq("slug", rawSlug)
    .maybeSingle();

  if (!wedding) return new NextResponse("Wedding portal not found.", { status: 404 });

  // Build inline init script — gives the static portal the per-wedding data
  // up-front before app.js runs.
  const venue = (wedding as unknown as { venue: { name: string; slug: string } | null }).venue;
  const initScript = `
<script>
  window.WEDDING_SLUG = ${JSON.stringify(wedding.slug)};
  window.WEDDING_ID = ${JSON.stringify(wedding.id)};
  window.WEDDING_COUPLE = ${JSON.stringify(wedding.couple_names)};
  window.WEDDING_DATE = ${JSON.stringify(wedding.wedding_date)};
  window.WEDDING_VENUE_NAME = ${JSON.stringify(venue?.name ?? null)};
  window.WEDDING_VENUE_SLUG = ${JSON.stringify(venue?.slug ?? null)};
</script>
`;

  let html = readTemplate();
  // Insert init script before app.js so the global is set first.
  html = html.replace(
    /<script src="\/wedding-portal\/app\.js"/,
    `${initScript}<script src="/wedding-portal/app.js"`
  );

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
