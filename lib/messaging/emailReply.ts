// Reply-by-email plumbing for supplier messaging.
//
// Outbound supplier notifications set reply_to to a per-thread address,
// reply+<reply_token>@<INBOUND_REPLY_DOMAIN>. The token (not the sender address)
// is what routes an inbound reply to its thread, so it always lands with the
// right couple even if the supplier replies from a different mailbox.
// INBOUND_REPLY_DOMAIN is the Resend receiving domain (the account's
// *.resend.app domain, or a custom MX'd subdomain); reply-by-email is dormant
// until it's set.

export function inboundReplyDomain(): string | null {
  return process.env.INBOUND_REPLY_DOMAIN?.trim() || null;
}

// Email local parts max out at 64 chars (RFC 5321) and reply_token is 64 hex,
// so the address carries only the first 32 hex chars (128 bits — still
// unguessable); inbound lookup prefix-matches reply_token on it.
export const REPLY_TOKEN_ADDR_LEN = 32;

export function replyAddressFor(replyToken: string): string | null {
  const domain = inboundReplyDomain();
  return domain ? `reply+${replyToken.slice(0, REPLY_TOKEN_ADDR_LEN)}@${domain}` : null;
}

// Pull the thread token out of an inbound recipient list.
export function tokenFromRecipients(to: Array<string | null | undefined>): string | null {
  for (const addr of to) {
    const m = /(?:^|<|\s)reply\+([a-f0-9]{16,})@/i.exec(String(addr ?? ""));
    if (m) return m[1].toLowerCase();
  }
  return null;
}

// Strip quoted history and signatures from an email reply so only the supplier's
// fresh text enters the thread. Heuristic, biased toward cutting too much rather
// than leaking a long quoted chain into the chat.
const REPLY_CUT_PATTERNS: RegExp[] = [
  /^\s*On .{4,120} wrote:\s*$/im,                  // Gmail/Apple "On <date>, <name> wrote:"
  /^\s*Op .{4,120} schreef .*$/im,                 // Dutch/Afrikaans clients
  /^\s*-{2,}\s*Original Message\s*-{2,}/im,        // Outlook
  /^\s*_{6,}\s*$/m,                                 // Outlook divider
  /^\s*From:\s.+$/m,                                // forwarded header block
  /^\s*Sent from my (iPhone|iPad|Samsung|Huawei|Galaxy)/im,
  /^\s*--\s*$/m,                                    // RFC signature delimiter
];

export function stripQuotedReply(text: string): string {
  let body = text.replace(/\r\n/g, "\n");
  let cut = body.length;
  for (const re of REPLY_CUT_PATTERNS) {
    const m = re.exec(body);
    if (m && m.index < cut) cut = m.index;
  }
  body = body.slice(0, cut);
  // Drop ">"-quoted lines that survived (some clients omit the "On … wrote:" line).
  body = body.split("\n").filter((l) => !/^\s*>/.test(l)).join("\n");
  return body.trim();
}

// Last-resort plain text when a reply has no text part.
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
