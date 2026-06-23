"use client";

import { useState } from "react";

// Curated, wedding-venue-appropriate palette. Couples skew toward deep, elegant
// tones — these are the safe, on-brand starting points; the hex field + native
// picker still allow anything.
const PRESETS: { name: string; hex: string }[] = [
  { name: "Deep Green", hex: "#0A4A3A" },
  { name: "Forest", hex: "#1F5D3E" },
  { name: "Sage", hex: "#5F8B6A" },
  { name: "Eucalyptus", hex: "#2F6E5A" },
  { name: "Navy", hex: "#243B53" },
  { name: "Slate Blue", hex: "#3D5A80" },
  { name: "Plum", hex: "#6D3B5E" },
  { name: "Burgundy", hex: "#7B2D3A" },
  { name: "Terracotta", hex: "#C0623F" },
  { name: "Poppy", hex: "#FA523C" },
  { name: "Dusty Rose", hex: "#C98B8B" },
  { name: "Ochre", hex: "#B8893A" },
  { name: "Taupe", hex: "#9C8466" },
  { name: "Charcoal", hex: "#2B2B2B" },
];

function normHex(v: string): string {
  let s = (v || "").trim();
  if (s && !s.startsWith("#")) s = "#" + s;
  // Expand #abc → #aabbcc
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = "#" + s.slice(1).split("").map((c) => c + c).join("");
  return s.toUpperCase();
}
function isValid(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}
// Black or white text for legibility on the chosen colour (relative luminance).
function readableOn(hex: string): string {
  if (!isValid(hex)) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L > 0.6 ? "#1c1917" : "#ffffff";
}

export function BrandColourField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [color, setColor] = useState(normHex(defaultValue) || "#0A4A3A");
  const valid = isValid(color);
  const fg = readableOn(color);
  const safe = valid ? color : "#0A4A3A";

  return (
    <div className="space-y-3">
      {/* The value the form actually submits. */}
      <input type="hidden" name={name} value={color} />

      {/* Live preview — exactly how it reads on a couple-portal header + button. */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line, #ece7e1)" }}>
        <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ background: safe }}>
          <span className="font-serif text-sm" style={{ color: fg, fontWeight: 700 }}>Your venue</span>
          <span className="text-[11px] px-3 py-1 rounded-full" style={{ background: fg, color: safe, fontWeight: 600 }}>
            Message venue
          </span>
        </div>
        <div className="px-4 py-2 bg-white flex items-center gap-2">
          <span className="text-xs text-stone-500">Buttons &amp; links:</span>
          <span className="text-xs font-semibold" style={{ color: safe }}>Start planning →</span>
        </div>
      </div>

      {/* Curated palette */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = color.toUpperCase() === p.hex.toUpperCase();
          return (
            <button
              key={p.hex}
              type="button"
              onClick={() => setColor(p.hex)}
              title={`${p.name} · ${p.hex}`}
              aria-label={p.name}
              className="w-8 h-8 rounded-full transition"
              style={{
                background: p.hex,
                outline: active ? "2px solid #1c1917" : "1px solid rgba(0,0,0,0.12)",
                outlineOffset: active ? 2 : 0,
                boxShadow: active ? "0 0 0 3px #fff inset" : "none",
              }}
            />
          );
        })}
      </div>

      {/* Native picker + hex field */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="color"
          value={safe}
          onChange={(e) => setColor(e.target.value.toUpperCase())}
          className="h-10 w-12 border rounded cursor-pointer p-0.5"
          title="Pick any colour"
        />
        <div className="flex items-center border rounded px-2 py-1.5 bg-white" style={{ borderColor: valid ? "var(--line, #d6d3d1)" : "#dc2626" }}>
          <span className="text-stone-400 text-sm font-mono">#</span>
          <input
            type="text"
            value={color.replace(/^#/, "")}
            onChange={(e) => setColor(normHex(e.target.value))}
            spellCheck={false}
            maxLength={7}
            className="w-20 text-sm font-mono uppercase outline-none bg-transparent"
            aria-label="Hex colour"
          />
        </div>
        {!valid && <span className="text-xs text-red-600">Enter a 6-digit hex like 0A4A3A</span>}
      </div>

      <p className="text-xs text-stone-500">
        Used on couple portal headers, buttons and links. Pick a preset or set your exact brand hex.
      </p>
    </div>
  );
}
