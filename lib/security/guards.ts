// Shared security guards for API routes:
//  - requireVenueMember / requireUser: auth gates mirroring the membership check
//    used by uploads/commit + bank-extract (venue_members row OR platform owner).
//  - assertSafeUrl / safeFetch: SSRF guard for any fetch of a user-supplied URL.
//  - isAllowedImageType / imageExtForMime: raster-image MIME allowlist (no SVG).

import { createClient as createServerClient } from "@/lib/supabase/server";

export type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

// Caller must be signed in. No venue ownership required — for routes whose
// payload carries no venue_id (image-search, import, inventory/parse).
export async function requireUser(): Promise<GuardResult> {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true, userId: user.id };
}

// Caller must be signed in AND a member of `venueId` (or a platform owner).
// Mirrors the gate in app/api/venue/uploads/commit/route.ts.
export async function requireVenueMember(venueId: string): Promise<GuardResult> {
  if (!venueId || !String(venueId).trim()) {
    return { ok: false, status: 400, error: "Missing venue_id" };
  }
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const [{ data: member }, { data: profile }] = await Promise.all([
    auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle(),
    auth.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!member && profile?.role !== "owner") {
    return { ok: false, status: 403, error: "Not your venue" };
  }
  return { ok: true, userId: user.id };
}

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

function isBlockedHost(hostRaw: string): boolean {
  // URL.hostname keeps brackets around IPv6 literals — strip them, plus any
  // trailing dot ("localhost." is still localhost).
  const host = hostRaw.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;

  // IPv4 dotted-quad (the WHATWG URL parser normalises hex/octal/integer hosts
  // like 0x7f000001 to dotted-decimal before we ever see them).
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0) return true;                      // 0.0.0.0/8 ("this network")
    if (a === 127) return true;                    // loopback
    if (a === 10) return true;                     // private
    if (a === 169 && b === 254) return true;       // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true;       // private
    return false;
  }
  // A bare numeric host that somehow escaped URL normalisation — block it.
  if (/^(?:0x[0-9a-f]+|\d+)$/.test(host)) return true;

  // IPv6.
  if (host.includes(":")) {
    if (host === "::" || host === "::1") return true;       // unspecified / loopback
    if (/^fe[89ab]/.test(host)) return true;                 // link-local fe80::/10
    if (/^f[cd]/.test(host)) return true;                    // unique-local fc00::/7
    const mapped = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/); // v4-mapped
    if (mapped) return isBlockedHost(mapped[1]);
    return false;
  }
  return false;
}

// Validate a user-supplied URL BEFORE fetching it. Throws on anything that
// isn't plain http/https to a public host. Returns the parsed URL.
export function assertSafeUrl(url: string | URL): URL {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : url;
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error("URL points to a private or local address");
  }
  return parsed;
}

// fetch() wrapper that never auto-follows redirects: every Location hop is
// re-validated with assertSafeUrl (max 3 hops) so a public URL can't bounce
// us into 169.254.x / localhost.
export async function safeFetch(url: string | URL, init?: RequestInit, maxRedirects = 3): Promise<Response> {
  let current = assertSafeUrl(url);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current.toString(), { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      if (hop === maxRedirects) throw new Error("Too many redirects");
      let nextUrl: URL;
      try { nextUrl = new URL(loc, current); } catch { throw new Error("Invalid redirect URL"); }
      current = assertSafeUrl(nextUrl);
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

// ---------------------------------------------------------------------------
// Image MIME allowlist
// ---------------------------------------------------------------------------

// Raster images only — SVG is deliberately excluded (scriptable / XSS vector
// when served from a public bucket).
const ALLOWED_IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function normaliseMime(mime: string | null | undefined): string {
  return String(mime ?? "").toLowerCase().split(";")[0].trim();
}

export function isAllowedImageType(mime: string | null | undefined): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_EXT_BY_MIME, normaliseMime(mime));
}

// File extension derived from the VALIDATED MIME type — never from the
// attacker-controlled filename. Returns null for disallowed types.
export function imageExtForMime(mime: string | null | undefined): string | null {
  return ALLOWED_IMAGE_EXT_BY_MIME[normaliseMime(mime)] ?? null;
}
