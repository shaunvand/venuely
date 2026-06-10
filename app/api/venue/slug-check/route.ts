import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!slug) return NextResponse.json({ taken: false, suggestions: [] });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const candidates = [
    `${slug}-venue`,
    `${slug}-za`,
    `${slug}-wedding`,
    `${slug}-${new Date().getFullYear()}`,
    `the-${slug}`,
  ];

  // The `slug%` prefix query covers the typed slug, its suffixed candidates and the
  // random fallbacks — but NOT prefixed candidates like `the-<slug>`, so check those
  // explicitly too. Otherwise a taken `the-<slug>` gets suggested as available.
  const prefixed = candidates.filter((c) => !c.startsWith(slug));
  const { data: existing } = await admin
    .from("venues")
    .select("slug")
    .or([`slug.ilike.${slug}%`, ...prefixed.map((c) => `slug.eq.${c}`)].join(","));

  const taken = new Set((existing ?? []).map((r) => r.slug));
  const isTaken = taken.has(slug);

  const suggestions: string[] = [];
  if (isTaken) {
    for (const c of candidates) {
      if (!taken.has(c) && !suggestions.includes(c)) suggestions.push(c);
      if (suggestions.length >= 4) break;
    }
    while (suggestions.length < 4) {
      const rand = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
      if (!taken.has(rand) && !suggestions.includes(rand)) suggestions.push(rand);
    }
  }

  return NextResponse.json({ taken: isTaken, suggestions });
}
