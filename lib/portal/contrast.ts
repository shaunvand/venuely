// Pick a legible foreground (near-black or white) for text/icons sitting on an
// arbitrary venue brand colour, so a light brand primary doesn't render white
// text that's unreadable. Uses WCAG relative luminance.
export function readableOn(bg: string | null | undefined): string {
  const hex = String(bg ?? "").trim();
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Contrast vs white vs black; pick the higher-contrast foreground.
  const cWhite = 1.05 / (L + 0.05);
  const cBlack = (L + 0.05) / 0.05;
  return cBlack >= cWhite ? "#1c1917" : "#ffffff";
}
