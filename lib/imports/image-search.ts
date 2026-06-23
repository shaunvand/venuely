// Server-side helper: find ONE image URL matching a query for bulk imports.
// Prefers Pexels (200 req/hr + 20k/month free — far higher than Unsplash's
// 50/hr demo cap, which used to silently starve large imports), falling back to
// Unsplash when no Pexels key is configured. Returns null on no key / no match.

// Some hosts/CDNs 403 a non-browser UA — send a browser one to be safe.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function pexelsPool(q: string, n: number): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", q);
    url.searchParams.set("per_page", String(Math.min(80, Math.max(1, n))));
    url.searchParams.set("orientation", "landscape");
    const res = await fetch(url, { headers: { Authorization: key, "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json() as { photos?: Array<{ src?: { landscape?: string; large?: string; medium?: string } }> };
    return (data.photos ?? []).map((p) => p.src?.large ?? p.src?.landscape ?? p.src?.medium).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

async function unsplashPool(q: string, n: number): Promise<string[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", q);
    url.searchParams.set("per_page", String(Math.min(30, Math.max(1, n))));
    url.searchParams.set("content_filter", "high");
    const res = await fetch(url, { headers: { "Authorization": `Client-ID ${key}`, "Accept-Version": "v1", "User-Agent": UA } });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Array<{ urls?: { regular?: string } }> };
    return (data.results ?? []).map((r) => r.urls?.regular).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

// A POOL of candidate image URLs for a query — lets the caller pick a UNIQUE one
// per item (no more "same photo on 78 items" when many share a generic query).
export async function searchImagePool(query: string, n = 15): Promise<string[]> {
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  const pool = await pexelsPool(q, n);
  return pool.length ? pool : await unsplashPool(q, n);
}

export async function searchOneImage(query: string): Promise<string | null> {
  return (await searchImagePool(query, 1))[0] ?? null;
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
