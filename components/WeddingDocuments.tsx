"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Doc = { id: string; label: string; url: string; kind: string; visible_to_couple: boolean; created_at: string };

export function WeddingDocuments({ weddingId, docs }: { weddingId: string; docs: Doc[] }) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function upload(file: File, kind: string) {
    setUploading(true); setMsg(`Uploading ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("wedding_id", weddingId);
      fd.append("label", file.name);
      fd.append("kind", kind);
      fd.append("visible_to_couple", "true");
      const res = await fetch("/api/venue/wedding-document", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok || !j.ok) { setMsg(`Failed: ${j.error ?? "unknown"}`); return; }
      setMsg(`Uploaded ${file.name}`);
      router.refresh();
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setUploading(false); }
  }

  function remove(id: string) {
    if (!confirm("Remove this document?")) return;
    startTransition(async () => {
      await fetch("/api/venue/wedding-document", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      router.refresh();
    });
  }

  return (
    <section className="vy-card space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="vy-eyebrow">Documents</div>
          <h3 className="font-medium mt-1">Files for this wedding ({docs.length})</h3>
        </div>
        <label className="rounded-full bg-stone-900 text-white px-4 py-2 text-sm font-medium hover:bg-stone-700 cursor-pointer">
          {uploading ? "Uploading…" : "+ Upload file"}
          <input type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.docx,.doc"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "document"); }} />
        </label>
      </div>

      {msg && <p className="text-xs text-stone-600">{msg}</p>}

      {docs.length === 0 ? (
        <p className="text-sm text-stone-500">No documents yet. Upload the proforma, floor plans, supplier list, etc.</p>
      ) : (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2 border-b border-stone-100 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-stone-500 text-xs uppercase tracking-wider w-20 shrink-0">{d.kind}</span>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-stone-800 hover:underline truncate">{d.label}</a>
                {!d.visible_to_couple && <span className="vy-tag vy-tag-soft text-xs">venue only</span>}
              </div>
              <button disabled={isPending} onClick={() => remove(d.id)} className="text-stone-500 hover:text-red-700 text-xs px-2 py-1">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
