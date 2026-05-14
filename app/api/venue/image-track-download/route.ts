// Unsplash production-rate requirement: when an end-user picks/uses a photo,
// hit the photo's download_location endpoint to register the download.
// This does NOT actually serve a file — it's a tracking ping.
// https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { download_location } = await req.json();
    if (!download_location || typeof download_location !== "string") {
      return NextResponse.json({ ok: true }); // silent no-op if missing
    }
    if (!download_location.startsWith("https://api.unsplash.com/")) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) return NextResponse.json({ ok: true }); // can't track without key, but don't block UX
    await fetch(download_location, {
      headers: { "Authorization": `Client-ID ${key}`, "Accept-Version": "v1" },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never block UX on tracking failure
  }
}
