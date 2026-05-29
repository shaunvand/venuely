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

// Shared money formatter for reminder messages — rands, no decimals, grouped.
function rands(amount: number): string {
  return `R${Math.round(Number(amount) || 0).toLocaleString("en-ZA")}`;
}

// Friendly due-date phrasing; falls back to "soon" when no date is set.
function duePhrase(dueDate: string | null | undefined): string {
  if (!dueDate) return "soon";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return "soon";
  return `by ${d.toLocaleDateString("en-ZA", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`;
}

export function depositReminderMessage(opts: {
  venueName: string;
  coupleNames: string;
  amount: number;
  dueDate?: string | null;
}): string {
  return `Hi ${opts.coupleNames},

A friendly reminder from ${opts.venueName} 💍

To secure your wedding date, your deposit of ${rands(opts.amount)} is due ${duePhrase(opts.dueDate)}.

You can pay via EFT or card — reply here if you'd like our banking details or a payment link. Thank you!`;
}

export function balanceReminderMessage(opts: {
  venueName: string;
  coupleNames: string;
  amount: number;
  dueDate?: string | null;
}): string {
  return `Hi ${opts.coupleNames},

A friendly reminder from ${opts.venueName} 💍

The remaining balance on your wedding of ${rands(opts.amount)} is due ${duePhrase(opts.dueDate)}.

Reply here if you'd like our banking details or a payment link, or to arrange anything else. Thank you!`;
}
