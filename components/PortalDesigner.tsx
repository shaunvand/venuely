"use client";

import { useRef, useState, useTransition } from "react";
import {
  PORTAL_TEMPLATE_LIST,
  resolveTemplate,
  type PortalTemplateId,
  type PortalTheme,
  type TemplateTokens,
} from "@/lib/portal/templates";
import { saveVenuePortalDesign } from "@/app/venue/your-venue/actions";

export function PortalDesigner({
  venueId,
  venueName,
  website,
  heroUrl,
  initialTemplate,
  initialTheme,
  initiallySaved = false,
}: {
  venueId: string;
  venueName: string;
  website: string | null;
  heroUrl: string | null;
  initialTemplate: PortalTemplateId;
  initialTheme: PortalTheme;
  initiallySaved?: boolean;
}) {
  const [template, setTemplate] = useState<PortalTemplateId>(initialTemplate);
  const [primary, setPrimary] = useState(initialTheme.primary);
  const [accent, setAccent] = useState(initialTheme.accent);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialTheme.logoUrl ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialTheme.coverUrl ?? null);
  const [pulling, setPulling] = useState(false);
  const [pulled, setPulled] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saved, setSaved] = useState(initiallySaved);
  const [isPending, startTransition] = useTransition();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const tokens = resolveTemplate(template);
  // What the preview shows: the venue's chosen cover, else the first gallery photo.
  const previewCover = coverUrl ?? heroUrl;

  const COVER_MAX_MB = 5;

  function pickCover() {
    coverInputRef.current?.click();
  }

  async function uploadCover(file: File) {
    if (!file.type.startsWith("image/")) { setMsg("Cover must be an image file."); return; }
    if (file.size > COVER_MAX_MB * 1024 * 1024) { setMsg(`Cover image is too large — keep it under ${COVER_MAX_MB} MB.`); return; }
    setMsg(null);
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok && j.ok) setCoverUrl(j.url);
      else setMsg(`Cover upload failed: ${j.error ?? "unknown"}`);
    } finally {
      setCoverUploading(false);
    }
  }

  // Pull an image straight off the venue's own website (og:image / hero) as an
  // alternative to uploading — for the cover and the logo alike.
  async function imageFromWebsite(apply: (url: string) => void, setBusy: (b: boolean) => void) {
    if (!website) { setMsg("Add your website URL in Settings first."); return; }
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/venue/site-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: website, venue_id: venueId }),
      });
      const j = await res.json();
      if (res.ok && j.ok && j.url) { apply(j.url); setMsg("Image pulled from your website ✓ — replace it any time."); }
      else setMsg(`Couldn't find a usable image on your site${j.error ? ` (${j.error})` : ""} — try uploading one.`);
    } catch {
      setMsg("Couldn't reach your website — try uploading instead.");
    } finally {
      setBusy(false);
    }
  }

  async function pullColours() {
    setPulling(true);
    setMsg(null);
    setPulled([]);
    try {
      const res = await fetch("/api/venue/brand-extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: website }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error || "Couldn't read the site."); return; }
      const colors: string[] = j.colors || [];
      setPulled(colors);
      if (colors[0]) setPrimary(colors[0]);
      if (colors[1]) setAccent(colors[1]);
      setMsg(colors.length ? `Found ${colors.length} colour${colors.length === 1 ? "" : "s"} from ${j.site} — click a swatch to apply.` : "No clear brand colours found — set them manually.");
    } catch {
      setMsg("Couldn't reach the website.");
    } finally {
      setPulling(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok && j.ok) setLogoUrl(j.url);
      else setMsg(`Logo upload failed: ${j.error ?? "unknown"}`);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await saveVenuePortalDesign({ template, primary, accent, logoUrl, coverUrl });
        setMsg("Design saved ✓");
        setSaved(true);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <section className="vy-card space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="vy-eyebrow">Couple portal</div>
          <h2 className="vy-h2 mt-1 flex items-center gap-2 flex-wrap">
            {venueName} Couple Portal
            {saved && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--leaf)", color: "#1f5d3e" }}>Saved ✓</span>}
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--ink-2)" }}>
            Preview how your couples experience your venue — pick a template and set your brand below; it saves for every booking.
          </p>
        </div>
        <button onClick={save} disabled={isPending} className="vy-btn vy-btn-primary">
          {isPending ? "Saving…" : "Save design"}
        </button>
      </div>

      {/* ---- Preview first — exactly what couples get ---- */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="vy-label">What couples see</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--cream)", color: "var(--ink-2)" }}>updates as you edit</span>
        </div>
        <PortalPreview tokens={tokens} primary={primary} accent={accent} logoUrl={logoUrl} venueName={venueName} coverUrl={previewCover} onEditCover={pickCover} editLabel={coverUploading ? "Uploading…" : "Change cover photo"} />
      </div>

      <div className="space-y-6">
          {/* Template picker — underneath the preview */}
          <div>
            <div className="vy-label mb-2">Template</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PORTAL_TEMPLATE_LIST.map((t) => {
                const active = t.id === template;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className="text-left rounded-xl p-3 transition"
                    style={{
                      border: active ? `2px solid ${primary}` : "1px solid var(--line)",
                      background: active ? "var(--cream)" : "#fff",
                    }}
                    title={t.blurb}
                  >
                    <TemplateGlyph tokens={t} primary={primary} accent={accent} />
                    <div className="text-sm font-medium mt-2">{t.name}</div>
                    <div className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--ink-2)" }}>{t.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand: colours / logo / cover — side by side beneath the templates */}
          <div className="grid md:grid-cols-3 gap-6 items-start">
          {/* Colours */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="vy-label">Brand colours</span>
              <button
                type="button"
                onClick={pullColours}
                disabled={pulling}
                className="text-xs hover:underline disabled:opacity-50"
                style={{ color: "var(--poppy)" }}
                title={website ? `Read colours from ${website}` : "Add a website in Settings to use this"}
              >
                {pulling ? "Reading site…" : "✨ Pull from website"}
              </button>
            </div>
            <div className="flex gap-3">
              <ColorField label="Primary" value={primary} onChange={setPrimary} />
              <ColorField label="Accent" value={accent} onChange={setAccent} />
            </div>
            {pulled.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {pulled.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPrimary(c)}
                    title={`Use ${c} as primary`}
                    className="w-6 h-6 rounded-full border"
                    style={{ background: c, borderColor: "var(--line)" }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Logo */}
          <div>
            <div className="vy-label mb-2">Logo</div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden" style={{ border: "1px solid var(--line)", background: "var(--bone)" }}>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--ink-2)" }}>none</span>
                )}
              </div>
              <label className="vy-btn vy-btn-secondary cursor-pointer">
                {uploading ? "Uploading…" : logoUrl ? "Replace" : "Upload logo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
              </label>
              {website && (
                <button type="button" disabled={uploading} onClick={() => imageFromWebsite(setLogoUrl, setUploading)} className="text-xs hover:underline" style={{ color: "var(--poppy)" }}>
                  ✨ From website
                </button>
              )}
              {logoUrl && (
                <button type="button" onClick={() => setLogoUrl(null)} className="text-xs hover:underline" style={{ color: "var(--ink-2)" }}>Remove</button>
              )}
            </div>
          </div>

          {/* Cover photo — the hero image at the top of the couple portal */}
          <div>
            <div className="vy-label mb-2">Cover photo</div>
            <button
              type="button"
              onClick={pickCover}
              className="w-full rounded-xl p-3 text-center transition hover:bg-[color:var(--cream)]"
              style={{ border: "1.5px dashed var(--line)" }}
            >
              {coverUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl} alt="cover" className="w-full aspect-[16/9] object-cover rounded-lg mb-2" />
                  <span className="text-xs" style={{ color: "var(--poppy)" }}>{coverUploading ? "Uploading…" : "Click to replace"}</span>
                </>
              ) : (
                <>
                  <div className="text-2xl">🖼️</div>
                  <div className="text-sm font-medium mt-1">{coverUploading ? "Uploading…" : "Upload a cover photo"}</div>
                </>
              )}
              <div className="text-[10px] mt-1 leading-snug" style={{ color: "var(--ink-2)" }}>
                Recommended <strong>1600 × 900&nbsp;px</strong> · <strong>16:9</strong> landscape · JPG/PNG · max <strong>{COVER_MAX_MB}&nbsp;MB</strong>
              </div>
            </button>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} />
            <div className="flex items-center gap-3 mt-1.5">
              {website && (
                <button type="button" disabled={coverUploading} onClick={() => imageFromWebsite(setCoverUrl, setCoverUploading)} className="text-xs hover:underline" style={{ color: "var(--poppy)" }}>
                  ✨ Use a photo from my website
                </button>
              )}
              {coverUrl && (
                <button type="button" onClick={() => setCoverUrl(null)} className="text-xs hover:underline" style={{ color: "var(--ink-2)" }}>
                  Remove cover (use first gallery photo)
                </button>
              )}
            </div>
          </div>
          </div>

          {msg && <p className="text-xs" style={{ color: msg.includes("✓") ? "#1f5d3e" : "var(--poppy)" }}>{msg}</p>}
      </div>
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex-1">
      <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--ink-2)" }}>{label}</span>
      <span className="flex items-center gap-2 border rounded-full pl-1 pr-3 py-1" style={{ borderColor: "var(--line)" }}>
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#FA523C"} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded-full border-0 bg-transparent cursor-pointer" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-xs font-mono bg-transparent outline-none" />
      </span>
    </label>
  );
}

// Tiny visual glyph for the template thumbnail (hero bar + tabs + button).
function TemplateGlyph({ tokens, primary, accent }: { tokens: TemplateTokens; primary: string; accent: string }) {
  return (
    <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--line)", background: tokens.surface }}>
      <div className="h-7" style={{ background: `linear-gradient(120deg, ${primary}, ${accent})` }} />
      <div className="flex gap-1 p-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 flex-1" style={{ background: i === 0 ? primary : "var(--line)", borderRadius: tokens.buttonRadius === "999px" ? "999px" : tokens.buttonRadius === "0.25rem" ? "1px" : "3px" }} />
        ))}
      </div>
      <div className="px-1.5 pb-1.5">
        <span className="inline-block text-[7px] px-1.5 py-0.5" style={{ background: tokens.buttonStyle === "solid" ? primary : "transparent", color: tokens.buttonStyle === "solid" ? "#fff" : primary, border: tokens.buttonStyle === "outline" ? `1px solid ${primary}` : "none", borderRadius: tokens.buttonRadius, fontFamily: tokens.headingFont }}>Aa</span>
      </div>
    </div>
  );
}

// Full mock couple portal rendered against the chosen template + theme.
function PortalPreview({
  tokens, primary, accent, logoUrl, venueName, coverUrl, onEditCover, editLabel = "Change cover photo",
}: {
  tokens: TemplateTokens;
  primary: string;
  accent: string;
  logoUrl: string | null;
  venueName: string;
  coverUrl: string | null;
  onEditCover?: () => void;
  editLabel?: string;
}) {
  // The live couple portal renders in the Venuely brand type system regardless of
  // template token fonts (Fraunces serif headings, Satoshi body, 16px cards, pill
  // buttons) — the preview must show exactly that, not a token-driven variant.
  const headingStyle: React.CSSProperties = { fontFamily: "'Fraunces', Georgia, serif", fontStyle: "normal" };
  const cardRadius = 16;
  const btn: React.CSSProperties = { background: primary, color: "#fff", borderRadius: 999 };

  const heroImg = coverUrl
    ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(120deg, ${primary}, ${accent})` };

  // NB: no `title` attr here — the native tooltip doubled up with CoverEditHint.
  const coverProps = onEditCover
    ? { onClick: onEditCover, role: "button" as const, tabIndex: 0, className: "" }
    : {};
  const coverEditClass = onEditCover ? "group cursor-pointer" : "";

  // Miniature of the REAL couple portal (sidebar + cover hero + progress strip +
  // stat cards + right rail) so what the venue previews is what couples get.
  const NAV = ["Overview", "Our Venue", "Guest List", "Accommodation", "Timeline", "Payments"];
  const CHIPS: Array<[string, boolean]> = [["Venue", true], ["Rooms", true], ["Catering", true], ["Guests", false], ["Timeline", false], ["Pay", false]];

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid var(--line)", background: "#FBF7F2", fontFamily: "'Satoshi', system-ui, sans-serif" }}>
      <div className="grid" style={{ gridTemplateColumns: "108px 1fr 132px" }}>
        {/* MINI SIDEBAR — mirrors the portal's left nav */}
        <div className="p-2.5" style={{ background: "#fff", borderRight: "1px solid var(--line)" }}>
          <div className="mb-2.5 px-1">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-5 max-w-[88px] object-contain" />
            ) : (
              <span className="text-[10px] font-semibold leading-tight block" style={{ ...headingStyle, color: "var(--ink)" }}>{venueName}</span>
            )}
          </div>
          <div className="space-y-0.5">
            {NAV.map((t, i) => (
              <div key={t} className="text-[9px] px-1.5 py-1 truncate" style={{ borderRadius: 999, background: i === 0 ? `${primary}1a` : "transparent", color: i === 0 ? primary : "var(--ink-2)", fontWeight: i === 0 ? 700 : 500 }}>{t}</div>
            ))}
            <div className="text-[9px] px-1.5 pt-1" style={{ color: "var(--ink-2)" }}>+ 12 more…</div>
          </div>
        </div>

        {/* MAIN — cover hero, progress strip, stat cards */}
        <div className="p-2.5 space-y-2.5 min-w-0">
          <div {...coverProps} className={`relative h-[104px] overflow-hidden ${coverEditClass}`} style={{ ...(heroImg as React.CSSProperties), borderRadius: cardRadius }}>
            {coverUrl && <div className="absolute inset-0" style={{ background: "linear-gradient(transparent 30%, rgba(0,0,0,0.6))" }} />}
            <div className="absolute bottom-2 left-2.5 right-2.5">
              <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.9)" }}>Wedding portal</div>
              <div className="text-[17px] leading-tight text-white" style={{ ...headingStyle, fontStyle: "italic" }}>Adam &amp; Eve</div>
              <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.92)" }}>{venueName} · 14 Dec 2025 · 112 days to go</div>
            </div>
            {onEditCover && <CoverEditHint label={editLabel} />}
          </div>

          {/* Wedding Progress strip — exactly like the live overview */}
          <div className="p-2.5" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: cardRadius }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold" style={{ ...headingStyle, color: "var(--ink)" }}>Wedding Progress</span>
              <span className="text-[11px] font-bold" style={{ color: "var(--ink)" }}>52%</span>
            </div>
            <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "#efe7e0" }}>
              <div className="h-full rounded-full" style={{ width: "52%", background: primary }} />
            </div>
            <div className="grid grid-cols-6 gap-1 mt-2">
              {CHIPS.map(([label, done]) => (
                <div key={label} className="text-center">
                  <div className="w-5 h-5 rounded-full mx-auto flex items-center justify-center text-[7px] font-bold" style={{ background: done ? "#e8f1ea" : "#fbf1e7", color: done ? "#1a7f4b" : "#c07c10" }}>{done ? "✓" : "○"}</div>
                  <div className="text-[7px] mt-0.5 truncate" style={{ color: "var(--ink-2)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stat cards row */}
          <div className="grid grid-cols-2 gap-2">
            {[["Guests", "32 confirmed"], ["Accommodation", "12 / 40 rooms"]].map(([eb, v]) => (
              <div key={eb} className="p-2" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: cardRadius }}>
                <div className="text-[8px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>{eb}</div>
                <div className="text-[11px] font-semibold" style={{ ...headingStyle, color: "var(--ink)" }}>{v}</div>
              </div>
            ))}
          </div>
          <button className="text-[10px] px-2.5 py-1 font-medium" style={btn}>Start planning</button>
        </div>

        {/* MINI RIGHT RAIL — countdown + next up, like the live overview */}
        <div className="p-2.5 space-y-2" style={{ borderLeft: "1px solid var(--line)" }}>
          <div className="p-2 text-center text-white" style={{ background: "#5F8B6A", borderRadius: cardRadius }}>
            <div className="text-[7px] uppercase tracking-wider opacity-90">Your wedding day</div>
            <div className="text-xl leading-none my-0.5" style={headingStyle}>112</div>
            <div className="text-[7px] uppercase tracking-wider opacity-90">days to go</div>
          </div>
          <div className="p-2" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: cardRadius }}>
            <div className="text-[9px] font-semibold" style={{ ...headingStyle, color: "var(--ink)" }}>Next Up</div>
            {["Assign rooms", "Guest list", "Pay invoice"].map((t) => (
              <div key={t} className="text-[8px] mt-1 px-1.5 py-1 truncate" style={{ border: "1px solid var(--line)", borderRadius: 7, color: "var(--ink-2)" }}>{t} ›</div>
            ))}
          </div>
          <div className="p-2" style={{ background: "#fbf1e7", borderRadius: cardRadius }}>
            <div className="text-[9px] font-semibold" style={{ ...headingStyle, color: "var(--ink)" }}>Need help?</div>
            <div className="mt-1 text-center text-[8px] font-bold text-white px-1 py-1 rounded-full" style={{ background: primary }}>Message your venue</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoverEditHint({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.35)" }}>
      <span className="text-xs font-medium text-white px-3 py-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.6)" }}>📷 {label}</span>
    </div>
  );
}

