"use client";

import { useEffect, useRef, useState } from "react";

type Doc = { id: string; label: string | null; mime_type: string | null; url: string | null; created_at: string };

const fmtDate = (s: string) => s.slice(0, 10);
const icon = (m: string | null) => (m?.includes("pdf") ? "📄" : m?.startsWith("image") ? "🖼️" : "📎");

// Couple documents (signed contract, proof-of-payment, ID copies). Private bucket;
// links are short-lived signed URLs fetched on load.
export function DocumentManager({ slug, primary, accent, heading, cardRadius }: {
  slug: string; primary: string; accent: string; heading: React.CSSProperties; cardRadius: string;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/wedding/${slug}/files/documents`).then((r) => r.json()).then((j) => { setDocs(j.rows ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, [slug]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setErr("");
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f); fd.append("label", f.name);
      const r = await fetch(`/api/wedding/${slug}/files/documents`, { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok) setDocs((d) => [j.row, ...d]); else setErr(j.error || "upload failed");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    await fetch(`/api/wedding/${slug}/files/documents`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  }

  const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: cardRadius };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ ...heading, fontSize: 26, margin: 0 }}>Documents</h2>
        <div style={{ color: "#57534e", fontSize: 13, marginTop: 2 }}>Keep your signed contract, proof of payment and any paperwork in one secure place. Only you and your venue can see these.</div>
      </div>

      <div style={{ ...card, padding: 16, borderStyle: "dashed", textAlign: "center" }}>
        <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.doc,.docx" onChange={(e) => upload(e.target.files)} style={{ display: "none" }} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ background: primary, color: "#fff", border: "none", borderRadius: 999, padding: "10px 22px", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          {busy ? "Uploading…" : "＋ Upload a document"}
        </button>
        <div style={{ fontSize: 12, color: "#8a8a8a", marginTop: 8 }}>PDF, image or Word · up to 15MB</div>
        {err && <div style={{ color: "#b42318", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
      </div>

      {loading ? <span style={{ color: "#8a8a8a", fontSize: 13 }}>Loading…</span> : docs.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#8a8a8a", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12 }}>No documents yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {docs.map((d) => (
            <div key={d.id} style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>{icon(d.mime_type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label || "Document"}</div>
                <div style={{ fontSize: 11.5, color: "#8a8a8a" }}>Added {fmtDate(d.created_at)}</div>
              </div>
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: accent, fontWeight: 600, textDecoration: "none" }}>Open ↗</a>}
              <button onClick={() => remove(d.id)} title="Delete" style={{ border: "none", background: "transparent", color: "#b42318", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
