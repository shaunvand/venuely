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

const SAMPLE_TABS = ["Overview", "Catalogue", "Guests", "Timeline", "Budget"];

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
  const [minimized, setMinimized] = useState(initiallySaved);
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

  // Saved state — the section becomes the full live preview with one button to
  // jump back into editing / pick another template. Editing collapses it again.
  if (minimized) {
    return (
      <section className="vy-card space-y-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="vy-eyebrow">Couple portal</div>
            <h2 className="vy-h2 mt-1 flex items-center gap-2">
              {tokens.name} template
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--leaf)", color: "#1f5d3e" }}>Saved ✓</span>
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--ink-2)" }}>This is how each couple&apos;s dashboard will look when you add their wedding.</p>
          </div>
          <button type="button" onClick={() => { setMsg(null); setMinimized(false); }} className="vy-btn vy-btn-secondary">
            ✎ Edit or change template
          </button>
        </div>
        <PortalPreview tokens={tokens} primary={primary} accent={accent} logoUrl={logoUrl} venueName={venueName} coverUrl={previewCover} onEditCover={() => { setMsg(null); setMinimized(false); }} />
      </section>
    );
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
        setMinimized(true);
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
          <h2 className="vy-h2 mt-1">Design the dashboard couples receive</h2>
          <p className="text-sm mt-1" style={{ color: "var(--ink-2)" }}>
            Pick a template, set your brand colours and logo, and preview the portal each couple gets when you add their wedding.
          </p>
        </div>
        <button onClick={save} disabled={isPending} className="vy-btn vy-btn-primary">
          {isPending ? "Saving…" : "Save design"}
        </button>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* ---- Controls ---- */}
        <div className="space-y-5">
          {/* Template picker */}
          <div>
            <div className="vy-label mb-2">Template</div>
            <div className="grid grid-cols-2 gap-2">
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
            {coverUrl && (
              <button type="button" onClick={() => setCoverUrl(null)} className="text-xs hover:underline mt-1" style={{ color: "var(--ink-2)" }}>
                Remove cover (use first gallery photo)
              </button>
            )}
          </div>

          {msg && <p className="text-xs" style={{ color: msg.includes("✓") ? "#1f5d3e" : "var(--poppy)" }}>{msg}</p>}
        </div>

        {/* ---- Preview ---- */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="vy-label">What couples see</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--cream)", color: "var(--ink-2)" }}>updates as you edit</span>
          </div>
          <PortalPreview tokens={tokens} primary={primary} accent={accent} logoUrl={logoUrl} venueName={venueName} coverUrl={previewCover} onEditCover={pickCover} editLabel={coverUploading ? "Uploading…" : "Change cover photo"} />
        </div>
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

// Tiny visual glyph for the template thumbnail — shows the surface, the hero
// shape (full-bleed / matted plate / split block / arch) and the nav style so
// the four templates read as genuinely different at a glance.
function TemplateGlyph({ tokens, primary, accent }: { tokens: TemplateTokens; primary: string; accent: string }) {
  const grad = `linear-gradient(120deg, ${primary}, ${accent})`;
  return (
    <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--line)", background: tokens.surface }}>
      {/* hero shape */}
      {tokens.heroStyle === "framed" ? (
        <div className="p-1">
          <div className="h-6" style={{ border: "1px solid #1c1917", padding: 1.5 }}>
            <div className="w-full h-full" style={{ background: grad }} />
          </div>
        </div>
      ) : tokens.heroStyle === "split" ? (
        <div className="h-7 grid grid-cols-2">
          <div style={{ background: primary }} />
          <div style={{ background: grad }} />
        </div>
      ) : tokens.heroStyle === "arch" ? (
        <div className="pt-1.5 flex justify-center">
          <div style={{ width: "55%", height: 22, borderRadius: "999px 999px 4px 4px", background: grad }} />
        </div>
      ) : (
        <div className="h-7" style={{ background: grad }} />
      )}
      {/* nav style */}
      <div className="flex gap-1 p-1.5 items-center">
        {tokens.navStyle === "sidebar" ? (
          <>
            <span style={{ width: 8, height: 14, background: "#fff", border: "1px solid var(--line)", borderRadius: 2 }} />
            {[0, 1].map((i) => <span key={i} className="h-1.5 flex-1" style={{ background: i === 0 ? primary : "var(--line)", borderRadius: 999 }} />)}
          </>
        ) : tokens.navStyle === "segmented" ? (
          <span className="flex-1 flex overflow-hidden" style={{ border: "1px solid var(--line)", borderRadius: 4 }}>
            {[0, 1, 2].map((i) => <span key={i} className="h-2 flex-1" style={{ background: i === 0 ? primary : "#fff" }} />)}
          </span>
        ) : tokens.navStyle === "pills" ? (
          [0, 1, 2].map((i) => <span key={i} className="h-2 flex-1" style={{ background: i === 0 ? `${accent}88` : "#fff", border: "1px solid var(--line)", borderRadius: 999 }} />)
        ) : (
          [0, 1, 2].map((i) => <span key={i} className="h-1.5 flex-1" style={{ background: i === 0 ? "#1c1917" : "var(--line)", borderRadius: 0 }} />)
        )}
      </div>
      <div className="px-1.5 pb-1.5">
        <span className="inline-block text-[7px] px-1.5 py-0.5" style={{ background: tokens.buttonStyle === "solid" ? primary : "transparent", color: tokens.buttonStyle === "solid" ? "#fff" : primary, border: tokens.buttonStyle === "outline" ? `1px solid ${primary}` : "none", borderRadius: tokens.buttonRadius, fontFamily: tokens.headingFont, fontStyle: tokens.headingItalic ? "italic" : "normal" }}>Aa</span>
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
  const headingStyle: React.CSSProperties = { fontFamily: tokens.headingFont, fontStyle: tokens.headingItalic ? "italic" : "normal", fontWeight: tokens.headingWeight, letterSpacing: tokens.headingLetterSpacing };
  const btn: React.CSSProperties = {
    ...(tokens.buttonStyle === "solid"
      ? { background: primary, color: "#fff", borderRadius: tokens.buttonRadius }
      : { background: "transparent", color: primary, border: `1.5px solid ${primary}`, borderRadius: tokens.buttonRadius }),
    ...(tokens.buttonCase === "uppercase" ? { textTransform: "uppercase" as const, letterSpacing: "0.1em" } : {}),
  };
  const cardBg = tokens.cardTint ? `linear-gradient(0deg, ${accent}${tokens.cardTint}, ${accent}${tokens.cardTint}), #FFFFFF` : tokens.surfaceCard;
  const cardStyle: React.CSSProperties = { background: cardBg, border: tokens.cardBorder, borderRadius: tokens.cardRadius, boxShadow: tokens.cardShadow };

  const heroImg = coverUrl
    ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(120deg, ${primary}, ${accent})` };

  const coverProps = onEditCover
    ? { onClick: onEditCover, role: "button" as const, tabIndex: 0, title: editLabel, className: "" }
    : {};
  const coverEditClass = onEditCover ? "group cursor-pointer" : "";

  const body = (
    <>
      <div className="p-4" style={cardStyle}>
        <div className="text-base" style={{ ...headingStyle, color: "var(--ink)" }}>Welcome to your planning portal</div>
        <p className="text-[11px] mt-1" style={{ color: "var(--ink-2)" }}>Pick your menu, manage guests, track your budget and timeline — all in one place.</p>
        <button className="mt-3 text-[11px] px-3 py-1.5 font-medium" style={btn}>Start planning</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3" style={{ ...cardStyle, background: accent + "2e" }}>
          <div className="text-[10px] uppercase" style={{ color: "var(--ink-2)", letterSpacing: tokens.eyebrowTracking }}>Countdown</div>
          <div className="text-lg" style={{ ...headingStyle, color: primary }}>112 days</div>
        </div>
        <div className="p-3" style={cardStyle}>
          <div className="text-[10px] uppercase" style={{ color: "var(--ink-2)", letterSpacing: tokens.eyebrowTracking }}>Checklist</div>
          <div className="text-lg" style={{ ...headingStyle, color: "var(--ink)" }}>3 / 8 done</div>
        </div>
      </div>
    </>
  );

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid var(--line)", background: tokens.surface, fontFamily: tokens.bodyFont }}>
      {/* HERO */}
      {tokens.heroStyle === "split" ? (
        // Modern — solid primary block (names/date/countdown) beside the cover image.
        <div className="grid grid-cols-2">
          <div className="p-4 flex flex-col justify-center gap-1" style={{ background: primary, color: "#fff" }}>
            <div className="text-[9px] uppercase opacity-85" style={{ letterSpacing: tokens.eyebrowTracking }}>Wedding portal</div>
            <div className="text-2xl leading-tight" style={headingStyle}>Adam &amp; Eve</div>
            <div className="text-[11px] opacity-95">14 Dec 2025</div>
            <div className="mt-1 self-start px-2.5 py-1 text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.18)", borderRadius: tokens.buttonRadius }}>112 days to go</div>
          </div>
          <div {...coverProps} className={`relative h-40 ${coverEditClass}`} style={heroImg as React.CSSProperties}>
            <div className="absolute top-3 left-3 z-10"><PreviewLogo logoUrl={logoUrl} venueName={venueName} headingStyle={headingStyle} /></div>
            {onEditCover && <CoverEditHint label={editLabel} />}
          </div>
        </div>
      ) : tokens.heroStyle === "framed" ? (
        // Editorial — matted magazine plate, caption-style names below the frame.
        <div className="p-3">
          <div style={{ border: "1px solid #1c1917", padding: 4 }}>
            <div {...coverProps} className={`relative h-32 ${coverEditClass}`} style={{ ...(heroImg as React.CSSProperties), border: "1px solid #1c1917" }}>
              <div className="absolute top-2 left-2 z-10"><PreviewLogo logoUrl={logoUrl} venueName={venueName} headingStyle={headingStyle} /></div>
              {onEditCover && <CoverEditHint label={editLabel} />}
            </div>
          </div>
          <div className="pt-3 flex items-end justify-between gap-2 flex-wrap">
            <div>
              <div className="text-[9px] uppercase" style={{ color: "var(--ink-2)", letterSpacing: tokens.eyebrowTracking }}>The wedding of</div>
              <div className="text-2xl leading-tight uppercase" style={{ ...headingStyle, color: "var(--ink)" }}>Adam &amp; Eve</div>
            </div>
            <div className="text-[10px] uppercase text-right" style={{ color: "var(--ink)", letterSpacing: "0.18em" }}>14 Dec 2025<div style={{ color: "var(--ink-2)" }}>112 days to go</div></div>
          </div>
        </div>
      ) : tokens.heroStyle === "arch" ? (
        // Romantic — arch-shaped cover, flourish divider, italic names below.
        <div className="pt-4 px-4 text-center">
          <div {...coverProps} className={`relative mx-auto overflow-hidden ${coverEditClass}`} style={{ ...(heroImg as React.CSSProperties), width: "68%", height: 140, borderRadius: "999px 999px 16px 16px", boxShadow: tokens.cardShadow }}>
            {onEditCover && <CoverEditHint label={editLabel} />}
          </div>
          <div className="flex items-center justify-center gap-2 mt-2.5" style={{ color: primary }}>
            <span style={{ width: 28, borderTop: `1px solid ${primary}66` }} />
            <span className="text-[10px] leading-none">{tokens.flourish ?? "✦"}</span>
            <span style={{ width: 28, borderTop: `1px solid ${primary}66` }} />
          </div>
          <div className="text-2xl leading-tight mt-1" style={{ ...headingStyle, color: "var(--ink)" }}>Adam &amp; Eve</div>
          <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>{venueName} · 14 Dec 2025</div>
        </div>
      ) : (
        // Classic — full-bleed cover, dark gradient, centred serif names + date.
        <div {...coverProps} className={`relative h-44 ${coverEditClass}`} style={heroImg as React.CSSProperties}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.55))" }} />
          <div className="absolute top-3 left-3 z-10"><PreviewLogo logoUrl={logoUrl} venueName={venueName} headingStyle={headingStyle} /></div>
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4">
            <div className="text-[9px] uppercase" style={{ color: "rgba(255,255,255,0.85)", letterSpacing: tokens.eyebrowTracking }}>Wedding portal</div>
            <div className="text-2xl leading-tight text-white mt-1" style={headingStyle}>Adam &amp; Eve</div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.9)" }}>{venueName} · 14 Dec 2025</div>
          </div>
          {onEditCover && <CoverEditHint label={editLabel} />}
        </div>
      )}

      {/* NAV + BODY — classic shows its left sidebar; the rest use top tabs */}
      {tokens.navStyle === "sidebar" ? (
        <div className="flex">
          <div className="w-[104px] shrink-0 p-2.5 space-y-1" style={{ background: tokens.surfaceCard, borderRight: tokens.divider }}>
            {SAMPLE_TABS.map((t, i) => (
              <div key={t} className="text-[10px] px-1.5 py-1" style={{ color: i === 0 ? primary : "var(--ink-2)", fontWeight: i === 0 ? 700 : 500 }}>
                <span style={{ borderBottom: i === 0 ? `2px solid ${primary}` : "2px solid transparent", paddingBottom: 1 }}>{t}</span>
              </div>
            ))}
          </div>
          <div className="flex-1 p-3 space-y-3">{body}</div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <PreviewTabs tokens={tokens} primary={primary} accent={accent} />
          {body}
        </div>
      )}
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

function PreviewLogo({ logoUrl, venueName, headingStyle }: { logoUrl: string | null; venueName: string; headingStyle: React.CSSProperties }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="h-7 max-w-[120px] object-contain" />
  ) : (
    <span className="font-semibold text-sm" style={{ ...headingStyle, color: "#fff" }}>{venueName}</span>
  );
}

function PreviewTabs({ tokens, primary, accent }: { tokens: TemplateTokens; primary: string; accent: string }) {
  const base = "text-[11px] px-2.5 py-1 transition";
  if (tokens.navStyle === "pills") {
    // Romantic — soft pills, accent tint when active.
    return (
      <div className="flex flex-wrap gap-1.5">
        {SAMPLE_TABS.map((t, i) => (
          <span key={t} className={base} style={{ borderRadius: 999, background: i === 0 ? `${accent}55` : "rgba(255,255,255,0.65)", color: i === 0 ? primary : "var(--ink-2)", border: `1px solid ${i === 0 ? `${primary}55` : "rgba(0,0,0,0.1)"}`, fontWeight: i === 0 ? 700 : 500 }}>{t}</span>
        ))}
      </div>
    );
  }
  if (tokens.navStyle === "segmented") {
    // Modern — joined pill-group control.
    return (
      <div className="inline-flex overflow-hidden" style={{ border: tokens.cardBorder, borderRadius: "0.6rem", background: "#fff" }}>
        {SAMPLE_TABS.map((t, i) => (
          <span key={t} className={base} style={{ background: i === 0 ? primary : "#fff", color: i === 0 ? "#fff" : "var(--ink-2)", borderLeft: i === 0 ? "none" : tokens.divider, fontWeight: i === 0 ? 700 : 500 }}>{t}</span>
        ))}
      </div>
    );
  }
  // Editorial — numbered uppercase text tabs over a hairline rule.
  return (
    <div className="flex flex-wrap gap-4" style={{ borderBottom: tokens.divider }}>
      {SAMPLE_TABS.map((t, i) => (
        <span key={t} className="text-[10px] pb-1.5 uppercase" style={{ letterSpacing: "0.12em", color: i === 0 ? "var(--ink)" : "var(--ink-2)", boxShadow: i === 0 ? "inset 0 -2px 0 #1c1917" : "none", fontWeight: i === 0 ? 700 : 500 }}>
          <span style={{ fontSize: 8, marginRight: 4, color: i === 0 ? primary : "#a8a29e" }}>{String(i + 1).padStart(2, "0")}</span>{t}
        </span>
      ))}
    </div>
  );
}
