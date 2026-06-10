// Server-side helper: find ONE image URL matching a query for bulk imports.
// Prefers Pexels (200 req/hr + 20k/month free — far higher than Unsplash's
// 50/hr demo cap, which used to silently starve large imports), falling back to
// Unsplash when no Pexels key is configured. Returns null on no key / no match.

async function pexelsOne(q: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", q);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "landscape");
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) return null;
    const data = await res.json() as { photos?: Array<{ src?: { landscape?: string; large?: string; medium?: string } }> };
    const src = data.photos?.[0]?.src;
    return src?.landscape ?? src?.large ?? src?.medium ?? null;
  } catch {
    return null;
  }
}

async function unsplashOne(q: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", q);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("content_filter", "high");
    const res = await fetch(url, {
      headers: { "Authorization": `Client-ID ${key}`, "Accept-Version": "v1" },
    });
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ urls?: { regular?: string } }> };
    return data.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

export async function searchOneImage(query: string): Promise<string | null> {
  const q = query.trim().slice(0, 120);
  if (!q) return null;
  return (await pexelsOne(q)) ?? (await unsplashOne(q));
}

// Concurrency-limited parallel map. Keeps the provider under its rate cap on
// big imports (Pexels 200/hr, Unsplash 50/hr). Each item is wrapped in its own
// try/catch so a single rejection can't fail the whole batch — a failed item
// simply yields null and the rest keep going.
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<Array<R | null>> {
  const out: Array<R | null> = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch {
        out[idx] = null; // failed item → skip, don't sink the batch
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
