// Airbnb-style contact-info redaction for mediated supplier messaging.
// Deterministic regexes only (no LLM): emails, URLs/domains, social handles and
// phone numbers are replaced with a placeholder in the displayed copy; the
// caller keeps the original (raw_body) for the venue. Redaction stops once a
// thread is booked — that's the caller's decision, not this function's.

const PLACEHOLDER = "[hidden — shared once booked]";

type Hit = "email" | "link" | "social" | "phone";
const REASONS: Record<Hit, string> = {
  email: "email address hidden",
  link: "link hidden",
  social: "social handle hidden",
  phone: "phone number hidden",
};
const REASON_ORDER: Hit[] = ["email", "link", "social", "phone"];

// Generic words that can trail a platform mention without being a handle
// ("my facebook page", "instagram account") — never redact these.
const STOPWORDS = new Set([
  "me", "my", "us", "on", "at", "is", "and", "or", "the", "a", "an", "it",
  "page", "profile", "account", "group", "dm", "chat", "story", "post",
  "you", "your", "for", "to", "of", "in", "if", "with", "via", "too", "also",
]);

// Bare-domain TLDs are a fixed list so "e.g." / file names / abbreviations
// never trip the link rule.
const TLD =
  "(?:com|net|org|io|me|info|biz|co\\.za|org\\.za|web\\.za|africa|co|online|site|store|shop|app|dev|xyz|cc|tv|wedding|studio|photography|events|design)";

export function redactContacts(text: string): { body: string; flagged: boolean; reason: string | null } {
  const hits = new Set<Hit>();
  let out = String(text ?? "");

  // 1) Emails first, so the @domain tail can't later read as a social handle.
  out = out.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, () => {
    hits.add("email");
    return PLACEHOLDER;
  });

  // 2) URLs / domains: explicit scheme, www., or bare domain on a known TLD.
  out = out.replace(/\bhttps?:\/\/[^\s<>"']+/gi, () => { hits.add("link"); return PLACEHOLDER; });
  out = out.replace(/\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"']*)?/gi, () => { hits.add("link"); return PLACEHOLDER; });
  out = out.replace(
    new RegExp(`\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.${TLD}\\b(?:\\/[^\\s<>"']*)?`, "gi"),
    () => { hits.add("link"); return PLACEHOLDER; },
  );

  // 3) Social: platform mention followed by a handle-ish token…
  out = out.replace(
    /\b(?:instagram|insta|facebook|telegram|tiktok|snapchat|wechat|twitter)\b\s*(?:me\s+)?(?:on\s+|at\s+|is\s+)?[:\-]?\s*@?([a-z0-9][a-z0-9_.]{2,30})\b/gi,
    (m, name: string) => {
      if (STOPWORDS.has(name.toLowerCase())) return m;
      hits.add("social");
      return PLACEHOLDER;
    },
  );
  // …or a bare @handle (emails were already removed above).
  out = out.replace(/(^|[\s,;:({\[])@[a-z0-9][a-z0-9_.]{1,30}/gi, (_m, pre: string) => {
    hits.add("social");
    return pre + PLACEHOLDER;
  });

  // 4) Phones last (URLs containing digits are already gone). Require 7+
  //    digits after stripping separators so ordinary prices ("R12 000") and
  //    dates survive; skip money (preceded by R / decimal comma) and dates.
  out = out.replace(/\+?\d[\d\s().\-]{4,}\d/g, (m, offset: number, s: string) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 7) return m;
    const prev = offset > 0 ? s[offset - 1] : "";
    if (prev === "R" || prev === "r") return m; // "R1 200 000" = money
    if (/,\d{2}\b/.test(m)) return m; // "1 200 000,50" decimal-comma money
    if (/^\d{1,4}[.\-]\d{1,2}[.\-]\d{1,4}$/.test(m.trim())) return m; // 2026-06-11 style date
    hits.add("phone");
    return PLACEHOLDER;
  });

  const flagged = hits.size > 0;
  const reason = flagged
    ? REASON_ORDER.filter((h) => hits.has(h)).map((h) => REASONS[h]).join(" · ")
    : null;
  return { body: out, flagged, reason };
}
