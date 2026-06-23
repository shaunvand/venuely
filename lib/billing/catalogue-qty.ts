// How a catalogue item's billable quantity is derived — respecting price_unit and
// reading thresholds written into the item name (Pat Busch lists fees like
// "...for more than 90 pax" and "Additional guests over 120"). This stops flat
// venue extras from being multiplied by the guest count, scales true per-head
// items by the actual confirmed guest count, and only applies threshold fees when
// the guest count crosses them.

export type QtyBasis = "per_person" | "per_day" | "flat" | "conditional" | "tier_overage";

export type QtyResult = {
  units: number;          // billable quantity (× unit price = line amount)
  basis: QtyBasis;
  perUnitNote: string;    // short human label, e.g. "per guest", "flat", "guests over 120", "only if > 90 guests"
  applies: boolean;       // false when a conditional fee's threshold isn't met (units 0)
};

const THRESHOLD_RE = /(?:over|more than|exceeding|above|greater than|in excess of|>)\s*(\d{2,4})/i;
const PER_DAY_RE = /per\s*day|\/\s*day|daily/i;

export function catalogueQuantity(opts: { name: string; priceUnit?: string | null; guests: number; days: number }): QtyResult {
  const name = String(opts.name ?? "");
  const unit = String(opts.priceUnit ?? "").toLowerCase();
  const guests = Math.max(0, Math.round(Number(opts.guests) || 0));
  const days = Math.max(1, Math.round(Number(opts.days) || 1));
  const perDay = unit === "per_day" || PER_DAY_RE.test(name);
  const dayMult = perDay ? days : 1;
  const th = name.match(THRESHOLD_RE);
  const threshold = th ? Number(th[1]) : null;

  if (unit === "per_person") {
    if (threshold != null) {
      const over = Math.max(0, guests - threshold);
      return { units: over * dayMult, basis: "tier_overage", perUnitNote: `guests over ${threshold}`, applies: over > 0 };
    }
    return { units: guests * dayMult, basis: "per_person", perUnitNote: perDay ? "per guest / day" : "per guest", applies: guests > 0 };
  }

  // fixed / per_day / unknown
  if (threshold != null) {
    const on = guests > threshold;
    return { units: on ? dayMult : 0, basis: "conditional", perUnitNote: `only if > ${threshold} guests${perDay ? " · per day" : ""}`, applies: on };
  }
  return { units: dayMult, basis: perDay ? "per_day" : "flat", perUnitNote: perDay ? "per day" : "flat fee", applies: true };
}
