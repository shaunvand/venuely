import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

// Couple file uploads (documents = contracts/proof-of-payment; inspiration =
// mood-board images). Files live in the PRIVATE `wedding-files` bucket; we never
// expose public URLs — GET returns short-lived signed URLs minted by the service
// role. Couple auth via the portal password cookie; everything scoped to wedding.
const BUCKET = "wedding-files";
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const KINDS: Record<string, { table: string; meta: string }> = {
  documents: { table: "wedding_documents", meta: "label" },
  inspiration: { table: "wedding_inspiration", meta: "note" },
};

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
function safeName(n: string) { return (n || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80); }

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await ctx.params;
  const c = KINDS[kind]; if (!c) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const db = admin();
  const sel = kind === "documents" ? "id, label, file_path, mime_type, created_at" : "id, note, file_path, source_url, source, created_at";
  const { data } = await db.from(c.table).select(sel).eq("wedding_id", access.wedding.id).order("created_at", { ascending: false });
  const list = (data ?? []) as unknown as Record<string, unknown>[];
  const rows = await Promise.all(list.map(async (r) => {
    const rec = r as Record<string, unknown>;
    // External (pinned) references already have a URL; only uploaded files need signing.
    if (rec.source_url) return { ...rec, url: rec.source_url };
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(rec.file_path as string, 3600);
    return { ...rec, url: signed?.signedUrl ?? null };
  }));
  return NextResponse.json({ ok: true, rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await ctx.params;
  const c = KINDS[kind]; if (!c) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const db = admin();

  // Pin-from-URL mode (inspiration): a search result or a pasted Pinterest link —
  // we store the reference + attribution, not the binary.
  if (kind === "inspiration" && (req.headers.get("content-type") || "").includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { source_url?: string; note?: string; source?: string };
    const src = String(body.source_url ?? "").trim();
    if (!/^https?:\/\//i.test(src)) return NextResponse.json({ error: "source_url required" }, { status: 400 });
    const { data, error } = await db.from("wedding_inspiration")
      .insert({ wedding_id: access.wedding.id, source_url: src, note: body.note?.trim() || null, source: body.source?.trim() || "link" })
      .select("id, note, source_url, source, file_path, created_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = data as unknown as Record<string, unknown>;
    return NextResponse.json({ ok: true, row: { ...row, url: row.source_url } });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (max 15MB)" }, { status: 413 });

  const ext = safeName(file.name);
  const path = `${kind}/${access.wedding.id}/${crypto.randomUUID()}-${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const metaVal = String(form.get(c.meta) ?? "").trim() || (kind === "documents" ? file.name : null);
  const insert: Record<string, unknown> = { wedding_id: access.wedding.id, file_path: path, [c.meta]: metaVal };
  if (kind === "documents") insert.mime_type = file.type || null;
  const sel = kind === "documents" ? "id, label, file_path, mime_type, created_at" : "id, note, file_path, created_at";
  const { data, error } = await db.from(c.table).insert(insert).select(sel).single();
  if (error) { await db.storage.from(BUCKET).remove([path]); return NextResponse.json({ error: error.message }, { status: 500 }); }
  const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(path, 3600);
  const row = data as unknown as Record<string, unknown>;
  return NextResponse.json({ ok: true, row: { ...row, url: signed?.signedUrl ?? null } });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await ctx.params;
  const c = KINDS[kind]; if (!c) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = admin();
  const { data: row } = await db.from(c.table).select("file_path").eq("id", body.id).eq("wedding_id", access.wedding.id).single();
  if (row?.file_path) await db.storage.from(BUCKET).remove([row.file_path as string]); // external pins have no file_path
  const { error } = await db.from(c.table).delete().eq("id", body.id).eq("wedding_id", access.wedding.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
