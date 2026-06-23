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
import { useLoading } from "@/components/LoadingProvider";

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
  const loading = useLoading();

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
    loading.show("Uploading your cover photo…", { messages: ["Uploading…", "Optimising…"] });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok && j.ok) { setCoverUrl(j.url); loading.complete("Uploaded ✓"); }
      else { setMsg(`Cover upload failed: ${j.error ?? "unknown"}`); loading.hide(); }
    } catch (e) {
      loading.hide();
      setMsg(`Cover upload failed: ${e instanceof Error ? e.message : "unknown"}`);
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
    loading.show("Reading your website…", { messages: ["Reading your website…", "Finding your best images…"] });
    try {
      const res = await fetch("/api/venue/site-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: website, venue_id: venueId }),
      });
      const j = await res.json();
      if (res.ok && j.ok && j.url) { apply(j.url); setMsg("Image pulled from your website ✓ — replace it any time."); loading.complete("Pulled ✓"); }
      else { setMsg(`Couldn't find a usable image on your site${j.error ? ` (${j.error})` : ""} — try uploading one.`); loading.hide(); }
    } catch {
      setMsg("Couldn't reach your website — try uploading instead.");
      loading.hide();
    } finally {
      setBusy(false);
    }
  }

  async function pullColours() {
    setPulling(true);
    setMsg(null);
    setPulled([]);
    loading.show("Reading your website…", { messages: ["Reading your website…", "Picking out your brand colours…"] });
    try {
      const res = await fetch("/api/venue/brand-extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: website }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg(j.error || "Couldn't read the site."); loading.hide(); return; }
      const colors: string[] = j.colors || [];
      setPulled(colors);
      if (colors[0]) setPrimary(colors[0]);
      if (colors[1]) setAccent(colors[1]);
      setMsg(colors.length ? `Found ${colors.length} colour${colors.length === 1 ? "" : "s"} from ${j.site} — click a swatch to apply.` : "No clear brand colours found — set them manually.");
      loading.complete(colors.length ? "Done ✓" : "No colours found");
    } catch {
      setMsg("Couldn't reach the website.");
      loading.hide();
    } finally {
      setPulling(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    loading.show("Uploading your logo…", { messages: ["Uploading…", "Optimising…"] });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("venue_id", venueId);
      const res = await fetch("/api/venue/inventory/image", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok && j.ok) { setLogoUrl(j.url); loading.complete("Uploaded ✓"); }
      else { setMsg(`Logo upload failed: ${j.error ?? "unknown"}`); loading.hide(); }
    } catch (e) {
      loading.hide();
      setMsg(`Logo upload failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setMsg(null);
    loading.show("Saving your design…");
    startTransition(async () => {
      try {
        await saveVenuePortalDesign({ template, primary, accent, logoUrl, coverUrl });
        setMsg("Design saved ✓");
        setSaved(true);
        loading.complete("Saved ✓");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Save failed");
        loading.hide();
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

          {/* Second save action at the bottom — so you don't have to scroll back
              up to the header button after editing colours/logo/cover. */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
            {saved && <span className="text-xs" style={{ color: "#1f5d3e" }}>Saved ✓</span>}
            <button onClick={save} disabled={isPending} className="vy-btn vy-btn-primary">
              {isPending ? "Saving…" : "Save design"}
            </button>
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

// Tiny visual glyph for the template thumbnail — hints each template's nav
// position (sidebar / numbered top tabs / segmented / pills) + hero shape
// (overlay / framed / split / arch).
function TemplateGlyph({ tokens, primary, accent }: { tokens: TemplateTokens; primary: string; accent: string }) {
  const hero = `linear-gradient(120deg, ${primary}, ${accent})`;
  if (tokens.navStyle === "sidebar") {
    // Classic — left sidebar + full-bleed overlay hero.
    return (
      <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--line)", background: tokens.surface, height: 58 }}>
        <div className="flex h-full">
          <div className="w-[26%] p-1 space-y-1" style={{ background: "#fff", borderRight: "1px solid var(--line)" }}>
            {[0, 1, 2].map((i) => <div key={i} className="h-1 rounded-full" style={{ background: i === 0 ? primary : "var(--line)" }} />)}
          </div>
          <div className="flex-1 p-1 space-y-1 min-w-0">
            <div className="h-6" style={{ background: hero, borderRadius: 6 }} />
            <div className="flex gap-1">{[0, 1].map((i) => <div key={i} className="h-2.5 flex-1" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 4 }} />)}</div>
          </div>
        </div>
      </div>
    );
  }
  if (tokens.navStyle === "top-tabs") {
    // Editorial — numbered text tabs over a hairline + framed/matted plate.
    return (
      <div className="rounded-md overflow-hidden p-1 space-y-1" style={{ border: "1px solid var(--line)", background: tokens.surface, height: 58 }}>
        <div className="flex gap-1 pb-0.5" style={{ borderBottom: "1px solid #1c1917" }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-1 flex-1" style={{ background: i === 0 ? "#1c1917" : "var(--line)" }} />)}
        </div>
        <div className="mx-2" style={{ border: "1px solid #1c1917", padding: 2 }}>
          <div className="h-5" style={{ background: hero }} />
        </div>
        <div className="h-1 w-1/2 mx-auto" style={{ background: "var(--line)" }} />
      </div>
    );
  }
  if (tokens.navStyle === "segmented") {
    // Modern — joined segmented control + split colour-block hero.
    return (
      <div className="rounded-md overflow-hidden p-1 space-y-1" style={{ border: "1px solid var(--line)", background: tokens.surface, height: 58 }}>
        <div className="flex w-full overflow-hidden" style={{ border: "1px solid #E7E5E4", borderRadius: 4, background: "#fff" }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-2 flex-1" style={{ background: i === 0 ? primary : "transparent", borderLeft: i === 0 ? "none" : "1px solid #E7E5E4" }} />)}
        </div>
        <div className="flex overflow-hidden" style={{ borderRadius: 6, border: "1px solid #E7E5E4", height: 28 }}>
          <div className="w-2/5" style={{ background: primary }} />
          <div className="flex-1" style={{ background: hero }} />
        </div>
      </div>
    );
  }
  // Romantic — pill tabs + arch-shaped hero + ✦ flourish.
  return (
    <div className="rounded-md overflow-hidden p-1 space-y-1 text-center" style={{ border: "1px solid var(--line)", background: tokens.surface, height: 58 }}>
      <div className="flex gap-1 justify-center">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-2 w-5 rounded-full" style={{ background: i === 0 ? `${accent}88` : "#fff", border: `1px solid ${i === 0 ? primary : "var(--line)"}` }} />)}
      </div>
      <div className="mx-auto w-9" style={{ height: 24, background: hero, borderRadius: "999px 999px 3px 3px" }} />
      <div className="text-[7px] leading-none" style={{ color: primary }}>✦</div>
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
  // The preview is fully token-driven (the templates now genuinely differ): each
  // template shows its REAL layout in miniature — sidebar vs numbered top tabs vs
  // segmented vs pills, plus its hero treatment — with the realistic content
  // blocks (progress strip, stat cards, countdown rail, Next Up, Need help).
  const t = tokens;
  const headingStyle: React.CSSProperties = {
    fontFamily: t.headingFont,
    fontStyle: t.headingItalic ? "italic" : "normal",
    ...(t.headingWeight != null ? { fontWeight: t.headingWeight } : {}),
    ...(t.headingLetterSpacing ? { letterSpacing: t.headingLetterSpacing } : {}),
  };
  const cardStyle: React.CSSProperties = {
    background: t.cardTint ? `linear-gradient(0deg, ${accent}${t.cardTint}, ${accent}${t.cardTint}), ${t.surfaceCard}` : t.surfaceCard,
    border: t.cardBorder,
    borderRadius: t.cardRadius,
    boxShadow: t.cardShadow,
  };
  const btn: React.CSSProperties = t.buttonStyle === "solid"
    ? { background: primary, color: "#fff", borderRadius: t.buttonRadius, border: "none" }
    : { background: "transparent", color: primary, border: `1px solid ${primary}`, borderRadius: t.buttonRadius, textTransform: t.buttonCase, letterSpacing: t.buttonCase ? "0.08em" : undefined };

  const heroImg: React.CSSProperties = coverUrl
    ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(120deg, ${primary}, ${accent})` };

  // NB: no `title` attr here — the native tooltip doubled up with CoverEditHint.
  const coverProps = onEditCover
    ? { onClick: onEditCover, role: "button" as const, tabIndex: 0 }
    : {};
  const coverEditClass = onEditCover ? "group cursor-pointer" : "";

  const NAV = ["Overview", "Our Venue", "Guest List", "Accommodation", "Timeline", "Payments"];
  const CHIPS: Array<[string, boolean]> = [["Venue", true], ["Rooms", true], ["Catering", true], ["Guests", false], ["Timeline", false], ["Pay", false]];

  // ── Mini hero — one of the four real treatments ──
  let heroMini: React.ReactNode;
  if (t.heroStyle === "framed") {
    heroMini = (
      <div style={{ background: "#fff", border: t.cardBorder, padding: 5 }}>
        <div style={{ border: t.divider, padding: 3 }}>
          <div {...coverProps} className={`relative h-[68px] overflow-hidden ${coverEditClass}`} style={heroImg}>
            {onEditCover && <CoverEditHint label={editLabel} />}
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 pt-1.5">
          <div className="min-w-0">
            <div className="text-[6px] uppercase" style={{ letterSpacing: t.eyebrowTracking, color: "#78716c" }}>The wedding of</div>
            <div className="text-[11px] leading-tight truncate" style={{ ...headingStyle, textTransform: t.heroNameTransform, color: "var(--ink)" }}>Adam &amp; Eve</div>
          </div>
          <div className="text-[6px] uppercase text-right shrink-0" style={{ letterSpacing: "0.14em", color: "var(--ink)" }}>14 Dec 2025<br />112 days</div>
        </div>
      </div>
    );
  } else if (t.heroStyle === "split") {
    heroMini = (
      <div className="grid overflow-hidden" style={{ gridTemplateColumns: "5fr 6fr", borderRadius: t.cardRadius, border: t.cardBorder }}>
        <div className="p-2 text-white flex flex-col justify-center gap-0.5 min-w-0" style={{ background: primary }}>
          <div className="text-[6px] uppercase opacity-85 truncate" style={{ letterSpacing: t.eyebrowTracking }}>Wedding portal</div>
          <div className="text-[12px] leading-tight" style={headingStyle}>Adam &amp; Eve</div>
          <div className="text-[7px] opacity-95">14 Dec 2025</div>
          <div className="text-[7px] mt-0.5 px-1.5 py-0.5 self-start" style={{ background: "rgba(255,255,255,0.18)", borderRadius: t.buttonRadius }}>112 days to go</div>
        </div>
        <div {...coverProps} className={`relative min-h-[92px] ${coverEditClass}`} style={heroImg}>
          {onEditCover && <CoverEditHint label={editLabel} />}
        </div>
      </div>
    );
  } else if (t.heroStyle === "arch") {
    heroMini = (
      <div className="text-center">
        <div {...coverProps} className={`relative h-[84px] w-[70%] mx-auto overflow-hidden ${coverEditClass}`} style={{ ...heroImg, borderRadius: "999px 999px 10px 10px", boxShadow: t.cardShadow }}>
          {onEditCover && <CoverEditHint label={editLabel} />}
        </div>
        <div className="flex items-center justify-center gap-1 mt-1" style={{ color: primary }}>
          <span style={{ width: 14, borderTop: `1px solid ${primary}66` }} />
          <span className="text-[7px] leading-none">{t.flourish ?? "✦"}</span>
          <span style={{ width: 14, borderTop: `1px solid ${primary}66` }} />
        </div>
        <div className="text-[12px] leading-tight" style={{ ...headingStyle, color: "var(--ink)" }}>Adam &amp; Eve</div>
        <div className="text-[7px]" style={{ color: "var(--ink-2)" }}>{venueName} · 14 Dec 2025 · 112 days to go</div>
      </div>
    );
  } else {
    // Classic overlay — full-bleed cover with names on top.
    heroMini = (
      <div {...coverProps} className={`relative h-[104px] overflow-hidden ${coverEditClass}`} style={{ ...heroImg, borderRadius: t.cardRadius }}>
        {coverUrl && <div className="absolute inset-0" style={{ background: "linear-gradient(transparent 30%, rgba(0,0,0,0.6))" }} />}
        <div className="absolute bottom-2 left-2.5 right-2.5">
          <div className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.9)" }}>Wedding portal</div>
          <div className="text-[17px] leading-tight text-white" style={{ ...headingStyle, fontStyle: "italic" }}>Adam &amp; Eve</div>
          <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.92)" }}>{venueName} · 14 Dec 2025 · 112 days to go</div>
        </div>
        {onEditCover && <CoverEditHint label={editLabel} />}
      </div>
    );
  }

  // ── Shared realistic content blocks (token-styled) ──
  const progressStrip = (
    <div className="p-2.5" style={cardStyle}>
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
  );
  const statCards = (
    <div className="grid grid-cols-2 gap-2">
      {[["Guests", "32 confirmed"], ["Accommodation", "12 / 40 rooms"]].map(([eb, v]) => (
        <div key={eb} className="p-2" style={cardStyle}>
          <div className="text-[8px] uppercase" style={{ color: "var(--ink-2)", letterSpacing: t.eyebrowTracking }}>{eb}</div>
          <div className="text-[11px] font-semibold" style={{ ...headingStyle, color: "var(--ink)" }}>{v}</div>
        </div>
      ))}
    </div>
  );
  const rail = (
    <>
      <div className="p-2 text-center text-white" style={{ background: "#5F8B6A", borderRadius: t.cardRadius }}>
        <div className="text-[7px] uppercase tracking-wider opacity-90">Your wedding day</div>
        <div className="text-xl leading-none my-0.5" style={headingStyle}>112</div>
        <div className="text-[7px] uppercase tracking-wider opacity-90">days to go</div>
      </div>
      <div className="p-2" style={cardStyle}>
        <div className="text-[9px] font-semibold" style={{ ...headingStyle, color: "var(--ink)" }}>Next Up</div>
        {["Assign rooms", "Guest list", "Pay invoice"].map((task) => (
          <div key={task} className="text-[8px] mt-1 px-1.5 py-1 truncate" style={{ border: "1px solid var(--line)", borderRadius: t.navStyle === "sidebar" ? 7 : t.cardRadius, color: "var(--ink-2)" }}>{task} ›</div>
        ))}
      </div>
      <div className="p-2" style={{ background: "#fbf1e7", borderRadius: t.cardRadius }}>
        <div className="text-[9px] font-semibold" style={{ ...headingStyle, color: "var(--ink)" }}>Need help?</div>
        <div className="mt-1 text-center text-[8px] font-bold px-1 py-1" style={{ ...btn, ...(t.buttonStyle === "solid" ? {} : { fontWeight: 700 }) }}>Message your venue</div>
      </div>
    </>
  );

  // ── Classic: sidebar layout (the original miniature) ──
  if (t.navStyle === "sidebar") {
    return (
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid var(--line)", background: t.mainBg, fontFamily: t.bodyFont }}>
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
              {NAV.map((nav, i) => (
                <div key={nav} className="text-[9px] px-1.5 py-1 truncate" style={{ borderRadius: 999, background: i === 0 ? `${primary}1a` : "transparent", color: i === 0 ? primary : "var(--ink-2)", fontWeight: i === 0 ? 700 : 500 }}>{nav}</div>
              ))}
              <div className="text-[9px] px-1.5 pt-1" style={{ color: "var(--ink-2)" }}>+ 12 more…</div>
            </div>
          </div>

          {/* MAIN — cover hero, progress strip, stat cards */}
          <div className="p-2.5 space-y-2.5 min-w-0">
            {heroMini}
            {progressStrip}
            {statCards}
            <button className="text-[10px] px-2.5 py-1 font-medium" style={btn}>Start planning</button>
          </div>

          {/* MINI RIGHT RAIL — countdown + next up, like the live overview */}
          <div className="p-2.5 space-y-2" style={{ borderLeft: "1px solid var(--line)" }}>{rail}</div>
        </div>
      </div>
    );
  }

  // ── Editorial / Modern / Romantic: horizontal top-nav layouts ──
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid var(--line)", background: t.mainBg, fontFamily: t.bodyFont }}>
      {/* Mini header: venue logo + couple name */}
      <div className="flex items-center justify-between px-2.5 pt-2 gap-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-4 max-w-[88px] object-contain" />
        ) : (
          <span className="text-[9px] font-semibold leading-tight truncate" style={{ ...headingStyle, color: primary }}>{venueName}</span>
        )}
        <span className="text-[7px] shrink-0" style={{ color: "var(--ink-2)" }}>Adam &amp; Eve</span>
      </div>

      {/* Mini top nav — numbered tabs / segmented group / pills */}
      {t.navStyle === "top-tabs" && (
        <div className="flex gap-2 px-2.5 pt-1.5 overflow-hidden" style={{ borderBottom: t.divider }}>
          {NAV.map((nav, i) => (
            <span key={nav} className="text-[6.5px] uppercase whitespace-nowrap pb-1" style={{ letterSpacing: "0.1em", fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "#1c1917" : "#78716c", boxShadow: i === 0 ? "inset 0 -1.5px 0 #1c1917" : undefined }}>
              <span style={{ color: i === 0 ? primary : "#a8a29e", marginRight: 2 }}>{String(i + 1).padStart(2, "0")}</span>{nav}
            </span>
          ))}
        </div>
      )}
      {t.navStyle === "segmented" && (
        <div className="px-2.5 pt-1.5">
          <div className="inline-flex overflow-hidden max-w-full" style={{ border: t.cardBorder, borderRadius: 7, background: "#fff" }}>
            {NAV.slice(0, 5).map((nav, i) => (
              <span key={nav} className="text-[6.5px] px-1.5 py-1 whitespace-nowrap" style={{ borderLeft: i === 0 ? "none" : t.divider, background: i === 0 ? primary : "transparent", color: i === 0 ? "#fff" : "var(--ink-2)", fontWeight: i === 0 ? 700 : 500 }}>{nav}</span>
            ))}
          </div>
        </div>
      )}
      {t.navStyle === "pills" && (
        <div className="flex gap-1 px-2.5 pt-1.5 overflow-hidden">
          {NAV.map((nav, i) => (
            <span key={nav} className="text-[6.5px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ border: `1px solid ${i === 0 ? `${primary}55` : "rgba(0,0,0,0.10)"}`, background: i === 0 ? `${accent}55` : "rgba(255,255,255,0.65)", color: i === 0 ? primary : "var(--ink-2)", fontWeight: i === 0 ? 700 : 500 }}>{nav}</span>
          ))}
        </div>
      )}

      {/* Mini main + right rail */}
      <div className="grid gap-2 p-2.5" style={{ gridTemplateColumns: "1fr 124px" }}>
        <div className="space-y-2 min-w-0">
          {heroMini}
          {progressStrip}
          {statCards}
          <button className="text-[10px] px-2.5 py-1 font-medium" style={btn}>Start planning</button>
        </div>
        <div className="space-y-2">{rail}</div>
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

