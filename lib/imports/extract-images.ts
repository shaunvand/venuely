// Pull embedded images from .xlsx (xl/media/*) and PDF pages (rasterised).
// Uploads each to Supabase Storage under venue-media/imports/<venueId>/ and returns
// the public URLs so the smart importer can offer them to Claude / the user.

import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";

export type ExtractedImage = {
  url: string;
  source_file: string;
  sheet?: string | null;       // for xlsx
  row?: number | null;         // best-guess row anchor
  page?: number | null;        // for pdf
  ordinal: number;             // 0-based index within the source file
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp", emf: "image/x-emf",
};

async function uploadOne(ad: ReturnType<typeof admin>, venueId: string, buf: Buffer, ext: string): Promise<string> {
  const path = `imports/${venueId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await ad.storage.from("venue-media").upload(path, buf, {
    contentType: MIME[ext] ?? "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return ad.storage.from("venue-media").getPublicUrl(path).data.publicUrl;
}

// Parse xl/drawings/*.xml + cellAnchor to map media → sheet + row.
// This is best-effort; falls back to sheet=null/row=null if anchor parsing fails.
async function parseDrawingAnchors(zip: JSZip): Promise<Map<string, { sheet: string | null; row: number | null }>> {
  const anchorMap = new Map<string, { sheet: string | null; row: number | null }>();
  try {
    // sheet → drawing rel id mapping
    const sheetRels = Object.keys(zip.files).filter((p) => /xl\/worksheets\/_rels\/sheet\d+\.xml\.rels/.test(p));
    const sheetToDrawing: Record<string, string> = {};
    for (const p of sheetRels) {
      const xml = await zip.files[p].async("string");
      const sheetNum = p.match(/sheet(\d+)\.xml\.rels/)?.[1];
      const drawingMatch = xml.match(/Target="\.\.\/drawings\/(drawing\d+\.xml)"/);
      if (sheetNum && drawingMatch) sheetToDrawing[`sheet${sheetNum}.xml`] = drawingMatch[1];
    }
    // drawing → media mapping via drawing rels + xdr:from row
    for (const [sheetFile, drawingFile] of Object.entries(sheetToDrawing)) {
      const drawingXml = await zip.file(`xl/drawings/${drawingFile}`)?.async("string");
      const drawingRelsXml = await zip.file(`xl/drawings/_rels/${drawingFile}.rels`)?.async("string");
      if (!drawingXml || !drawingRelsXml) continue;
      const relMap: Record<string, string> = {};
      const relRe = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = relRe.exec(drawingRelsXml))) {
        const target = m[2].replace(/^\.\.\//, "");
        relMap[m[1]] = target.startsWith("xl/") ? target : `xl/${target.replace(/^\//, "")}`;
      }
      const anchorRe = /<xdr:(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<xdr:from>([\s\S]*?)<\/xdr:from>[\s\S]*?<xdr:pic[\s\S]*?<a:blip[^>]*r:embed="([^"]+)"/g;
      let a: RegExpExecArray | null;
      while ((a = anchorRe.exec(drawingXml))) {
        const fromXml = a[1];
        const rowMatch = fromXml.match(/<xdr:row>(\d+)<\/xdr:row>/);
        const row = rowMatch ? Number(rowMatch[1]) + 1 : null; // 0-based → 1-based
        const embedId = a[2];
        const mediaPath = relMap[embedId];
        if (mediaPath) anchorMap.set(mediaPath, { sheet: sheetFile.replace(".xml", ""), row });
      }
    }
  } catch { /* fall through */ }
  return anchorMap;
}

export async function extractXlsxImages(buf: Buffer, filename: string, venueId: string): Promise<ExtractedImage[]> {
  const zip = await JSZip.loadAsync(buf);
  const mediaEntries = Object.keys(zip.files).filter((p) => p.startsWith("xl/media/"));
  if (!mediaEntries.length) return [];
  const anchors = await parseDrawingAnchors(zip);
  const ad = admin();
  const out: ExtractedImage[] = [];
  let ordinal = 0;
  for (const path of mediaEntries.sort()) {
    const file = zip.files[path];
    if (file.dir) continue;
    const ext = (path.split(".").pop() || "png").toLowerCase();
    if (!MIME[ext]) continue;
    const data = Buffer.from(await file.async("arraybuffer"));
    try {
      const url = await uploadOne(ad, venueId, data, ext);
      const anchor = anchors.get(path) ?? { sheet: null, row: null };
      out.push({ url, source_file: filename, sheet: anchor.sheet, row: anchor.row, ordinal: ordinal++ });
    } catch { /* skip individual upload failures */ }
  }
  return out;
}

// PDF page-as-image rendering — defers heavy lifting. Returns empty array for now;
// hook for future pdfjs-dist + @napi-rs/canvas integration.
export async function extractPdfImages(_buf: Buffer, _filename: string, _venueId: string): Promise<ExtractedImage[]> {
  return [];
}
