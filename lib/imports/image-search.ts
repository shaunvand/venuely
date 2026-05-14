// Server-side helper: search Unsplash for ONE image matching the query.
// Returns the regular-sized URL of the top hit, or null if no key / no match.

export async function searchOneImage(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const q = query.trim().slice(0, 120);
  if (!q) return null;
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

// Concurrency-limited parallel map. Keeps Unsplash under 50/hr demo cap on big imports.
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
