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

        {/* ---- Live preview ---- */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="vy-label">Live preview</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--cream)", color: "var(--ink-2)" }}>what couples see</span>
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
  const headingStyle: React.CSSProperties = { fontFamily: tokens.headingFont, fontStyle: tokens.headingItalic ? "italic" : "normal" };
  const btn: React.CSSProperties =
    tokens.buttonStyle === "solid"
      ? { background: primary, color: "#fff", borderRadius: tokens.buttonRadius }
      : { background: "transparent", color: primary, border: `1.5px solid ${primary}`, borderRadius: tokens.buttonRadius };

  const heroImg = coverUrl
    ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(120deg, ${primary}, ${accent})` };

  const coverProps = onEditCover
    ? { onClick: onEditCover, role: "button" as const, tabIndex: 0, title: editLabel, className: "" }
    : {};
  const coverEditClass = onEditCover ? "group cursor-pointer" : "";

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid var(--line)", background: tokens.surface, fontFamily: tokens.bodyFont }}>
      {/* HERO */}
      {tokens.heroStyle === "split" ? (
        <div className="grid grid-cols-2">
          <div {...coverProps} className={`relative h-40 ${coverEditClass}`} style={heroImg as React.CSSProperties}>
            <div className="absolute top-3 left-3 z-10"><PreviewLogo logoUrl={logoUrl} venueName={venueName} headingStyle={headingStyle} /></div>
            {onEditCover && <CoverEditHint label={editLabel} />}
          </div>
          <div className="p-4 flex flex-col justify-center" style={{ background: accent + "33" }}>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-2)" }}>Wedding portal</div>
            <div className="text-2xl leading-tight" style={{ ...headingStyle, color: "var(--ink)" }}>Alex &amp; Sam</div>
            <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>{venueName} · 14 Dec 2025</div>
          </div>
        </div>
      ) : tokens.heroStyle === "framed" ? (
        <div className="p-3">
          <div {...coverProps} className={`relative h-36 ${coverEditClass}`} style={{ ...(heroImg as React.CSSProperties), border: `1px solid var(--line)` }}>
            <div className="absolute top-3 left-3 z-10"><PreviewLogo logoUrl={logoUrl} venueName={venueName} headingStyle={headingStyle} /></div>
            {onEditCover && <CoverEditHint label={editLabel} />}
          </div>
          <div className="pt-3">
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-2)" }}>Wedding portal</div>
            <div className="text-2xl leading-tight" style={{ ...headingStyle, color: "var(--ink)" }}>Alex &amp; Sam</div>
            <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>{venueName} · 14 Dec 2025</div>
          </div>
        </div>
      ) : (
        <div {...coverProps} className={`relative h-44 ${coverEditClass}`} style={heroImg as React.CSSProperties}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55))" }} />
          <div className="absolute top-3 left-3 z-10"><PreviewLogo logoUrl={logoUrl} venueName={venueName} headingStyle={headingStyle} /></div>
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.85)" }}>Wedding portal</div>
            <div className="text-xl leading-tight text-white" style={headingStyle}>Alex &amp; Sam</div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.9)" }}>{venueName} · 14 Dec 2025</div>
          </div>
          {onEditCover && <CoverEditHint label={editLabel} />}
        </div>
      )}

      {/* TABS + BODY */}
      <div className="p-4 space-y-4">
        <PreviewTabs tokens={tokens} primary={primary} />
        <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: tokens.cardRadius }}>
          <div className="text-base" style={{ ...headingStyle, color: "var(--ink)" }}>Welcome to your planning portal</div>
          <p className="text-[11px] mt-1" style={{ color: "var(--ink-2)" }}>Pick your menu, manage guests, track your budget and timeline — all in one place.</p>
          <button className="mt-3 text-[11px] px-3 py-1.5 font-medium" style={btn}>Start planning</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3" style={{ background: accent + "2e", borderRadius: tokens.cardRadius }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>Countdown</div>
            <div className="text-lg" style={{ ...headingStyle, color: primary }}>112 days</div>
          </div>
          <div className="p-3" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: tokens.cardRadius }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>Checklist</div>
            <div className="text-lg" style={{ ...headingStyle, color: "var(--ink)" }}>3 / 8 done</div>
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

function PreviewLogo({ logoUrl, venueName, headingStyle }: { logoUrl: string | null; venueName: string; headingStyle: React.CSSProperties }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="h-7 max-w-[120px] object-contain" />
  ) : (
    <span className="font-semibold text-sm" style={{ ...headingStyle, color: "#fff" }}>{venueName}</span>
  );
}

function PreviewTabs({ tokens, primary }: { tokens: TemplateTokens; primary: string }) {
  const base = "text-[11px] px-2.5 py-1 transition";
  if (tokens.tabStyle === "pill") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {SAMPLE_TABS.map((t, i) => (
          <span key={t} className={base} style={{ borderRadius: 999, background: i === 0 ? primary : "transparent", color: i === 0 ? "#fff" : "var(--ink-2)", border: i === 0 ? "none" : "1px solid var(--line)" }}>{t}</span>
        ))}
      </div>
    );
  }
  if (tokens.tabStyle === "segmented") {
    return (
      <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--line)" }}>
        {SAMPLE_TABS.map((t, i) => (
          <span key={t} className={base} style={{ background: i === 0 ? primary : "#fff", color: i === 0 ? "#fff" : "var(--ink-2)" }}>{t}</span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-4 border-b" style={{ borderColor: "var(--line)" }}>
      {SAMPLE_TABS.map((t, i) => (
        <span key={t} className="text-[11px] pb-1.5" style={{ color: i === 0 ? primary : "var(--ink-2)", borderBottom: i === 0 ? `2px solid ${primary}` : "2px solid transparent", fontWeight: i === 0 ? 600 : 400 }}>{t}</span>
      ))}
    </div>
  );
}
