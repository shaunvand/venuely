"use client";

// "Add to calendar" buttons for the couple. The .ics download (works with Apple,
// Google import, Outlook) also carries the run-sheet; the Google/Outlook links are
// quick one-tap adds of the wedding day itself.
const compact = (d: string) => d.slice(0, 10).replace(/-/g, "");
function addDay(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + 1));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function AddToCalendar({ slug, title, location, weddingDate, weddingEndDate, primary, accent }: {
  slug: string; title: string; location: string; weddingDate: string | null; weddingEndDate: string | null; primary: string; accent: string;
}) {
  if (!weddingDate) return null;
  const start = compact(weddingDate);
  const endExcl = addDay(weddingEndDate || weddingDate);
  const text = encodeURIComponent(`💍 ${title}`);
  const loc = encodeURIComponent(location);
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${endExcl}&location=${loc}&details=${encodeURIComponent("Your wedding day — via Venuely")}`;
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${text}&startdt=${weddingDate.slice(0, 10)}&enddt=${(weddingEndDate || weddingDate).slice(0, 10)}&allday=true&location=${loc}`;

  const btn = (bg: string, color: string, border?: string): React.CSSProperties => ({ background: bg, color, border: border || "none", borderRadius: 999, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <a href={`/api/wedding/${slug}/calendar`} style={btn(primary, "#fff")}>📅 Add to calendar (.ics)</a>
      <a href={google} target="_blank" rel="noreferrer" style={btn("#fff", primary, `1px solid ${primary}`)}>Google</a>
      <a href={outlook} target="_blank" rel="noreferrer" style={btn("#fff", accent, `1px solid ${accent}`)}>Outlook</a>
    </div>
  );
}
