import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const venueId = (form.get("venue_id") as string || "").trim();
    if (!file || !venueId) return NextResponse.json({ error: "Missing file or venue_id" }, { status: 400 });
    if (!/^[a-zA-Z0-9-]+$/.test(venueId)) return NextResponse.json({ error: "Invalid venue_id" }, { status: 400 });

    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${venueId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from("venue-media").upload(path, buf, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: pub } = admin.storage.from("venue-media").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
