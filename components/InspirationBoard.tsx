"use client";

import { useEffect, useRef, useState } from "react";

type Pin = { id: string; note: string | null; url: string | null; source: string | null; created_at: string };
type Result = { url: string; thumb: string; alt: string; source: string };

const CATEGORIES = ["Boho", "Rustic", "Classic", "Modern", "Garden", "Vineyard", "Beach", "Fairytale", "Minimalist", "Luxe", "Vintage", "Romantic"];
const SWATCHES = ["#D8A7B1", "#E8C8B0", "#B7C9A8", "#9CAFB7", "#C8B6E2", "#E6D3A3", "#A88B6A", "#2E2A26", "#FFFFFF", "#C04B4B"];

// Inspiration board. Pinterest has no public keyword-search API for third parties,
// so couples search our licensed image library by aesthetic (e.g. "Boho"), pin the
// ones they love into a unified board, and can also paste real Pinterest links or
// upload their own. The colour palette is saved on the wedding (wedding_state).
export function InspirationBoard({ slug, initialPalette, primary, accent, heading, cardRadius }: {
  slug: string; initialPalette: string[]; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("Boho");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [palette, setPalette] = useState<string[]>(initialPalette ?? []);
  const [linkUrl, setLinkUrl] = useState("");
  const [pinning, setPinning] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{ id: string; style?: string; categories?: string[]; palette?: string[]; venueMatches?: string[]; suggestions?: string[] } | null>(null);
  const [matching, setMatching] = useState(false);
  const [vibe, setVibe] = useState<{ style: string | null; matches: string[] } | null>(null);
  async function matchVibe() {
    setMatching(true); setVibe(null);
    try {
      const r = await fetch(`/api/wedding/${slug}/inspiration/match-vibe`, { method: "POST" });
      const j = await r.json();
      if (j.ok) { setVibe({ style: j.style ?? null, matches: j.matches ?? [] }); window.dispatchEvent(new CustomEvent("venuely:vibe-matched", { detail: { matches: j.matches ?? [] } })); }
      else setVibe({ style: null, matches: [] });
    } catch { setVibe({ style: null, matches: [] }); } finally { setMatching(false); }
  }
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch(`/api/wedding/${slug}/files/inspiration`).then((r) => r.json()).then((j) => { setPins(j.rows ?? []); setLoading(false); }).catch(() => setLoading(false)); }, [slug]);

  async function search(term: string) {
    setQ(term); setSearching(true);
    try { const r = await fetch(`/api/wedding/${slug}/inspiration-search?q=${encodeURIComponent(term)}`); const j = await r.json(); setResults(j.results ?? []); }
    finally { setSearching(false); }
  }
  useEffect(() => { search("Boho"); /* initial */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pinned = new Set(pins.map((p) => p.url));

  async function pin(url: string, source: string, note?: string) {
    setPinning(url);
    const r = await fetch(`/api/wedding/${slug}/files/inspiration`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source_url: url, source, note }) });
    const j = await r.json(); if (j.ok) setPins((p) => [j.row, ...p]);
    setPinning(null);
  }
  async function unpin(id: string) {
    setPins((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/wedding/${slug}/files/inspiration`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  }
  async function uploadOwn(files: FileList | null) {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f); fd.append("note", "My upload");
      const r = await fetch(`/api/wedding/${slug}/files/inspiration`, { method: "POST", body: fd });
      const j = await r.json(); if (j.ok) setPins((p) => [j.row, ...p]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  async function savePalette(next: string[]) {
    setPalette(next);
    await fetch(`/api/wedding/${slug}/state`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ patch: { palette: next } }) });
  }
  function toggleSwatch(hex: string) { savePalette(palette.includes(hex) ? palette.filter((c) => c !== hex) : [...palette, hex]); }

  // Claude vision: analyse a pinned image → style/categories/palette + which of the
  // venue's actual offerings fit the look.
  async function analyze(pin: Pin) {
    if (!pin.url) return;
    setAnalyzing(pin.id); setAnalysis(null);
    try {
      const r = await fetch(`/api/wedding/${slug}/inspiration/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ imageUrl: pin.url }) });
      const j = await r.json();
      if (j.ok) setAnalysis({ id: pin.id, ...j.analysis });
      else setAnalysis({ id: pin.id, suggestions: [j.error === "AI not configured" ? "AI isn't switched on yet." : "Couldn't analyse this image."] });
    } finally { setAnalyzing(null); }
  }

  const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius };
  const chip = (active: boolean): React.CSSProperties => ({ border: `1px solid ${active ? primary : "rgba(0,0,0,0.15)"}`, background: active ? primary : "#fff", color: active ? "#fff" : "#44403c", borderRadius: 999, padding: "5px 13px", fontSize: 12.5, cursor: "pointer", fontWeight: 600 });

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Inspiration board</h2>
        <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Search a look you love, pin your favourites, and shape your wedding&apos;s style — your venue sees this board to bring your vision to life.</div>
      </div>

      {/* Whole-vibe AI match — reads all pins, highlights matching venue items. */}
      <div style={{ ...card, padding: 14, background: `${accent}12` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700 }}>✨ Match my vibe</div>
            <div style={{ fontSize: 12.5, color: "#57534e", marginTop: 2 }}>AI reads all your pins and highlights the venue&apos;s items that fit your style.</div>
          </div>
          <button onClick={matchVibe} disabled={matching || pins.length === 0} style={{ background: pins.length ? primary : "#ccc", color: "#fff", border: "none", borderRadius: 999, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: matching || pins.length === 0 ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>{matching ? "Matching…" : "Match my vibe"}</button>
        </div>
        {vibe && (
          <div style={{ marginTop: 12 }}>
            {vibe.matches.length > 0 ? (
              <>
                <div style={{ fontSize: 12.5, color: "#44403c", marginBottom: 6 }}>{vibe.style ? <>Your vibe reads as <b>{vibe.style}</b>. </> : null}These of your venue&apos;s items match — they&apos;re now highlighted in <b>Extras &amp; Rentals</b>:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{vibe.matches.map((m) => <span key={m} style={{ fontSize: 12, background: "#fff", border: `1px solid ${primary}`, color: primary, borderRadius: 8, padding: "3px 10px", fontWeight: 600 }}>✨ {m}</span>)}</div>
              </>
            ) : <div style={{ fontSize: 12.5, color: "#8a8a8a" }}>No strong matches found in your venue&apos;s current items — try pinning a few more images.</div>}
          </div>
        )}
      </div>

      {/* Palette */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700, marginBottom: 8 }}>Colour palette</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {SWATCHES.map((hex) => (
            <button key={hex} onClick={() => toggleSwatch(hex)} title={hex} style={{ width: 30, height: 30, borderRadius: "50%", background: hex, cursor: "pointer", border: palette.includes(hex) ? `3px solid ${primary}` : "1px solid rgba(0,0,0,0.15)" }} />
          ))}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8a8a8a", cursor: "pointer" }}>
            <input type="color" onChange={(e) => { if (!palette.includes(e.target.value)) savePalette([...palette, e.target.value]); }} style={{ width: 30, height: 30, border: "none", background: "none", cursor: "pointer" }} />
            custom
          </label>
        </div>
        {palette.length > 0 && <div style={{ fontSize: 11.5, color: "#8a8a8a", marginTop: 8 }}>{palette.length} colour{palette.length > 1 ? "s" : ""} chosen — saved to your wedding.</div>}
      </div>

      {/* Search */}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(q); }} placeholder="Search a style, e.g. boho arch, rustic table…" style={{ flex: 1, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 999, padding: "9px 16px", fontSize: 14 }} />
          <button onClick={() => search(q)} style={{ background: primary, color: "#fff", border: "none", borderRadius: 999, padding: "9px 20px", fontWeight: 600, cursor: "pointer" }}>Search</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CATEGORIES.map((cat) => <button key={cat} onClick={() => search(cat)} style={chip(q.toLowerCase() === cat.toLowerCase())}>{cat}</button>)}
        </div>
      </div>

      {/* Results (masonry) */}
      {searching ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>Searching…</span> : (
        <div style={{ columns: "160px 4", columnGap: 10 }}>
          {results.map((r) => {
            const isPinned = pinned.has(r.url);
            return (
              <div key={r.url} style={{ breakInside: "avoid", marginBottom: 10, position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumb} alt={r.alt} loading="lazy" style={{ width: "100%", display: "block" }} />
                <button onClick={() => !isPinned && pin(r.url, r.source, q)} disabled={isPinned || pinning === r.url}
                  style={{ position: "absolute", top: 8, right: 8, background: isPinned ? "#1a7f4b" : primary, color: "#fff", border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: isPinned ? "default" : "pointer" }}>
                  {isPinned ? "✓ Pinned" : pinning === r.url ? "…" : "Pin"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add your own + Pinterest link */}
      <div style={{ ...card, padding: 14, display: "grid", gap: 10 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700 }}>Add your own</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => uploadOwn(e.target.files)} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} style={{ border: `1px solid ${primary}`, background: "#fff", color: primary, borderRadius: 999, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>⬆ Upload image</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Paste a Pinterest (or any) image link…" style={{ flex: 1, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 999, padding: "8px 14px", fontSize: 13 }} />
          <button onClick={() => { if (/^https?:\/\//i.test(linkUrl)) { pin(linkUrl, "Pinterest"); setLinkUrl(""); } }} style={{ background: accent, color: "#fff", border: "none", borderRadius: 999, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Pin link</button>
        </div>
      </div>

      {/* AI analysis result */}
      {analysis && (
        <div style={{ ...card, padding: 16, border: `1px solid ${primary}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700 }}>✨ AI ideas{analysis.style ? ` · ${analysis.style}` : ""}</div>
            <button onClick={() => setAnalysis(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#8a8a8a" }}>✕</button>
          </div>
          {analysis.categories && analysis.categories.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11.5, color: "#8a8a8a", marginBottom: 4 }}>Style tags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{analysis.categories.map((c) => <span key={c} style={{ fontSize: 12, background: `${accent}22`, borderRadius: 999, padding: "3px 10px" }}>{c}</span>)}</div>
            </div>
          )}
          {analysis.palette && analysis.palette.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11.5, color: "#8a8a8a", marginBottom: 4 }}>Palette — tap to add to yours</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{analysis.palette.map((hex) => <button key={hex} onClick={() => { if (!palette.includes(hex)) savePalette([...palette, hex]); }} title={`Add ${hex}`} style={{ width: 28, height: 28, borderRadius: "50%", background: hex, border: palette.includes(hex) ? `3px solid ${primary}` : "1px solid rgba(0,0,0,0.15)", cursor: "pointer" }} />)}</div>
            </div>
          )}
          {analysis.venueMatches && analysis.venueMatches.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11.5, color: "#8a8a8a", marginBottom: 4 }}>From {`your venue's`} options that suit this look</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{analysis.venueMatches.map((m) => <span key={m} style={{ fontSize: 12, background: "#fff", border: `1px solid ${primary}`, color: primary, borderRadius: 8, padding: "3px 10px", fontWeight: 600 }}>{m}</span>)}</div>
            </div>
          )}
          {analysis.suggestions && analysis.suggestions.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11.5, color: "#8a8a8a", marginBottom: 4 }}>Styling ideas</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#44403c" }}>{analysis.suggestions.map((s, i) => <li key={i} style={{ marginBottom: 2 }}>{s}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {/* My board */}
      <div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: primary, fontWeight: 700, marginBottom: 10 }}>My board ({pins.length})</div>
        {loading ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading…</span> : pins.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#8a8a8a", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12 }}>Pin images above to start your board.</div>
        ) : (
          <div style={{ columns: "160px 4", columnGap: 10 }}>
            {pins.map((p) => (
              <div key={p.id} style={{ breakInside: "avoid", marginBottom: 10, position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.url && <img src={p.url} alt={p.note || "inspiration"} loading="lazy" style={{ width: "100%", display: "block" }} />}
                <button onClick={() => unpin(p.id)} title="Remove" style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 999, width: 26, height: 26, cursor: "pointer", fontSize: 13 }}>✕</button>
                <button onClick={() => analyze(p)} disabled={analyzing === p.id} title="Get AI ideas" style={{ position: "absolute", top: 8, left: 8, background: analyzing === p.id ? "rgba(0,0,0,0.5)" : primary, color: "#fff", border: "none", borderRadius: 999, padding: "3px 9px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{analyzing === p.id ? "…" : "✨ Ideas"}</button>
                {p.source && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: 10, color: "#fff", background: "linear-gradient(transparent,rgba(0,0,0,0.55))", padding: "12px 8px 4px" }}>{p.source}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
