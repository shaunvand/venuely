import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const weddingId = (form.get("wedding_id") as string || "").trim();
    const label = ((form.get("label") as string) || file?.name || "Document").trim();
    const kind = (form.get("kind") as string || "document").trim();
    const visibleStr = form.get("visible_to_couple") as string;
    const visible = visibleStr === "false" ? false : true;
    if (!file || !weddingId) return NextResponse.json({ error: "Missing file or wedding_id" }, { status: 400 });

    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: w } = await auth.from("weddings").select("id, venue_id, slug").eq("id", weddingId).single();
    if (!w) return NextResponse.json({ error: "Wedding not found" }, { status: 404 });
    const [{ data: m }, { data: profile }] = await Promise.all([
      auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", w.venue_id).maybeSingle(),
      auth.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (!m && profile?.role !== "owner") return NextResponse.json({ error: "Not your wedding" }, { status: 403 });

    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Extension comes from a VALIDATED MIME allowlist, never the filename — this
    // is a PUBLIC bucket, so svg/html (script-carrying) types are rejected.
    const ALLOWED_DOC_TYPES: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/heic": "heic",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "text/plain": "txt", "text/csv": "csv",
    };
    const ext = ALLOWED_DOC_TYPES[file.type];
    if (!ext) return NextResponse.json({ error: "Unsupported file type — upload a PDF, image, Word or Excel document." }, { status: 415 });
    const path = `wedding-docs/${weddingId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from("venue-media").upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const { data: pub } = admin.storage.from("venue-media").getPublicUrl(path);

    const { data: row, error: insErr } = await admin
      .from("wedding_documents")
      .insert({ wedding_id: weddingId, label, url: pub.publicUrl, kind, visible_to_couple: visible, uploaded_by: user.id })
      .select("id")
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: row.id, url: pub.publicUrl, slug: w.slug });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Defense-in-depth: resolve doc → wedding → venue and verify membership before
    // deleting (don't rely on RLS alone; report 404/403 instead of a silent no-op).
    const { data: doc } = await auth.from("wedding_documents").select("id, wedding_id").eq("id", id).maybeSingle();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: w } = await auth.from("weddings").select("venue_id").eq("id", doc.wedding_id).maybeSingle();
    const [{ data: m }, { data: profile }] = await Promise.all([
      auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", w?.venue_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle(),
      auth.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (!m && profile?.role !== "owner") return NextResponse.json({ error: "Not your wedding" }, { status: 403 });
    const { error } = await auth.from("wedding_documents").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
