// Venue-defined seasons (recurring yearly date ranges) + seasonal wedding-day
// price resolution. Decisions: seasons are venue-defined; the season affects the
// WEDDING-day price only (mg/farewell keep a single price). A season can wrap the
// year-end (start month/day after end month/day, e.g. Dec→Feb).

export type Season = {
  id: string;
  name: string;
  start_month: number; start_day: number;
  end_month: number; end_day: number;
  sort_order?: number;
};

const md = (month: number, day: number) => month * 100 + day;

// Which venue season contains the given ISO date (yyyy-mm-dd)? Recurring yearly,
// wrap-around aware. Returns the first match by sort_order, or null.
export function seasonForDate(seasons: Season[], iso: string | null | undefined): Season | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).slice(0, 10));
  if (!m) return null;
  const cur = md(Number(m[2]), Number(m[3]));
  const ordered = [...seasons].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const s of ordered) {
    const start = md(s.start_month, s.start_day);
    const end = md(s.end_month, s.end_day);
    const inRange = start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
    if (inRange) return s;
  }
  return null;
}

// area_pricing rows for an area: day_type ('mg'|'wedding'|'farewell'|'any') +
// optional season_id. Resolve the price for a day type, choosing the seasonal
// wedding price when a season applies, else the null-season fallback.
export type AreaPriceRow = { area_id: string; day_type: string; price: number | string; season_id?: string | null };

export function resolveAreaPrice(
  rows: AreaPriceRow[],
  areaId: string,
  dayType: string,
  seasonId: string | null,
): number {
  const forArea = rows.filter((r) => r.area_id === areaId && r.day_type === dayType);
  if (dayType === "wedding" && seasonId) {
    const seasonal = forArea.find((r) => r.season_id === seasonId);
    if (seasonal) return Number(seasonal.price) || 0;
  }
  // Fallback: the non-seasonal (null season) row.
  const fallback = forArea.find((r) => r.season_id == null);
  if (fallback) return Number(fallback.price) || 0;
  // Last resort: any row for the day type (handles legacy single-price data).
  return Number(forArea[0]?.price) || 0;
}

// Build a per-(area,day_type) price map resolved for the wedding's season — a
// drop-in replacement for the old `areaPriceMap[area][day_type]` shape.
export function buildAreaPriceMap(
  rows: AreaPriceRow[],
  seasons: Season[],
  weddingDateIso: string | null | undefined,
): Record<string, Record<string, number>> {
  const season = seasonForDate(seasons, weddingDateIso);
  const seasonId = season?.id ?? null;
  const areaIds = Array.from(new Set(rows.map((r) => r.area_id)));
  const out: Record<string, Record<string, number>> = {};
  for (const areaId of areaIds) {
    out[areaId] = {
      mg: resolveAreaPrice(rows, areaId, "mg", seasonId),
      wedding: resolveAreaPrice(rows, areaId, "wedding", seasonId),
      farewell: resolveAreaPrice(rows, areaId, "farewell", seasonId),
    };
  }
  return out;
}
