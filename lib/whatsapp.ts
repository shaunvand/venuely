// Build a wa.me deep link.
// Strips spaces / parens / dashes; auto-adds country code 27 (South Africa) if the user
// dropped the leading 0 or omitted the country code.
export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  let digits = String(phone).replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = "27" + digits.slice(1);              // 0824... → 27824...
  if (digits.length === 9 && !digits.startsWith("27")) digits = "27" + digits; // 824... → 27824...
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function bookingNotificationMessage(opts: {
  venueName: string;
  coupleNames: string;
  weddingDate: string | null;
  itemLabel: string;
  contactName?: string | null;
}): string {
  const greeting = opts.contactName ? `Hi ${opts.contactName},` : "Hi there,";
  const date = opts.weddingDate ? new Date(opts.weddingDate).toLocaleDateString("en-ZA", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "TBD";
  return `${greeting}

This is ${opts.venueName} confirming a wedding booking:

· Couple: ${opts.coupleNames}
· Date: ${date}
· Booked: ${opts.itemLabel}

Could you confirm receipt and let me know your next steps? Thanks!`;
}
