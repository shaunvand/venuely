// Minimal iCalendar (RFC 5545) builder. No deps. Used for "Add to calendar"
// downloads (couple wedding day + run sheet) and the venue's subscribable feed.

export type IcsEvent = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  // all-day: pass {date:'YYYY-MM-DD'} (end exclusive handled here);
  // timed: pass {start:Date|string, end?:Date|string} as floating local time.
  date?: string;
  endDate?: string; // inclusive end date for multi-day all-day events
  start?: string;   // 'YYYY-MM-DDTHH:mm' floating local
  end?: string;
  stamp: string;    // ISO timestamp to use for DTSTAMP (pass in; keeps this pure)
};

function esc(s: string) {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function dateOnly(d: string) { return d.slice(0, 10).replace(/-/g, ""); }
function addDay(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + 1));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
}
function floating(s: string) { return s.replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15); } // YYYYMMDDTHHmmss-ish
function stampUtc(iso: string) { return iso.replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15) + "Z"; }

// Fold long lines to 75 octets per RFC 5545.
function fold(line: string) {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) { out.push((i === 0 ? "" : " ") + line.slice(i, i + 74)); i += 74; }
  return out.join("\r\n");
}

function vevent(e: IcsEvent): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stampUtc(e.stamp)}`];
  if (e.date) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.date)}`);
    lines.push(`DTEND;VALUE=DATE:${addDay(e.endDate || e.date)}`); // DTEND exclusive
  } else if (e.start) {
    lines.push(`DTSTART:${floating(e.start)}`);
    if (e.end) lines.push(`DTEND:${floating(e.end)}`);
  }
  lines.push(`SUMMARY:${esc(e.summary)}`);
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
  lines.push("END:VEVENT");
  return lines;
}

export function buildIcs(name: string, events: IcsEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Venuely//Weddings//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(name)}`,
    ...events.flatMap(vevent), "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
