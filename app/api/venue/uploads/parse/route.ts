import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import Anthropic from "@anthropic-ai/sdk";
import { INVENTORY_FIELDS, type InventoryType } from "@/lib/inventory/schemas";
import { extractXlsxImages, extractPdfImages, type ExtractedImage } from "@/lib/imports/extract-images";
import { searchOneImage, mapWithConcurrency } from "@/lib/imports/image-search";
import { requireVenueMember } from "@/lib/security/guards";

export const runtime = "nodejs";
export const maxDuration = 300;

// `unsupported` marks a file we recognised but cannot read as text (e.g. legacy .doc).
type Extract = {
  filename: string;
  kind: "pdf" | "xlsx" | "csv" | "txt" | "docx";
  text: string;
  chars: number;
  error?: string;
  unsupported?: string;
};

// Pull plain text out of a .docx by reading word/document.xml and flattening the runs.
// <w:t> holds the visible text; </w:p> ends a paragraph; <w:tab/> is a tab; <w:br/> a line break.
async function extractDocxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) return "";
  return docXml
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, (_m, t) => t)
    .replace(/<[^>]+>/g, "")              // strip remaining XML tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractFile(file: File): Promise<Extract> {
  const name = file.name;
  const ext = (name.toLowerCase().split(".").pop() || "");
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    if (ext === "pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const out = await extractText(pdf, { mergePages: true });
      const text = Array.isArray(out.text) ? out.text.join("\n") : (out.text ?? "");
      return { filename: name, kind: "pdf", text, chars: text.length };
    }
    if (ext === "docx") {
      const text = await extractDocxText(buf);
      return { filename: name, kind: "docx", text, chars: text.length };
    }
    if (ext === "doc") {
      // Legacy binary Word — reading it as utf-8 yields garbage. Flag clearly instead.
      return {
        filename: name,
        kind: "docx",
        text: "",
        chars: 0,
        unsupported: "Old Word .doc — please save as .docx or PDF and re-upload",
      };
    }
    if (ext === "xlsx" || ext === "xls") {
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheets = wb.SheetNames.map((sn) => {
        const ws = wb.Sheets[sn];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: null });
        return `### Sheet: ${sn}\n${rows.length ? JSON.stringify(rows, null, 0) : "(empty)"}`;
      });
      const text = sheets.join("\n\n");
      return { filename: name, kind: "xlsx", text, chars: text.length };
    }
    if (ext === "csv") {
      const text = buf.toString("utf-8");
      return { filename: name, kind: "csv", text, chars: text.length };
    }
    const text = buf.toString("utf-8");
    return { filename: name, kind: "txt", text, chars: text.length };
  } catch (e) {
    return { filename: name, kind: ext === "pdf" ? "pdf" : "txt", text: "", chars: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

const CATEGORY_GUIDE = `
TARGET CATEGORIES (assign each item to exactly one):
- "catalogue" — venue-owned per-head menu / bar / services priced per_person or fixed
- "rentals" — physical items rented with stock (chairs, tables, linen, decor pieces, lighting hire)
- "accommodation" — on-site rooms / cottages / suites / tents to sleep guests overnight
- "caterers" — external catering vendor partner (the company)
- "planners" — external wedding planner / coordinator vendor partner
- "florists" — external florist vendor partner
- "djs" — DJ / live music / sound vendor partner
- "photographers" — photo / video vendor partner
- "decor" — external decor / styling vendor partner (the company, not the item)
- "bar" — external bar service / mobile bar vendor partner

DISTINCTION RULES:
- A line item with a unit price → catalogue or rental. A company contact (phone/email/website) → vendor partner.
- "DJ services R5,000" alone = catalogue. "John's DJ Services — john@djs.co.za — from R5,000" = vendor partner "djs".
- Tables / chairs / glasses = rentals. Cottages / rooms / tents = accommodation.
- For Pat Busch: items with codes F1–F40 are FREE catalogue/rentals (mark "is_free": true if present). R1–R77 are paid rentals.
`.trim();

const FIELDS_SCHEMA = `
PER-ITEM SCHEMA — only fields relevant to the category should be filled, leave others null.
EVERY item MUST include "cost_treatment" — one of "included" (in venue's base price) or "extra" (charged on top).
Default to "extra" unless the document clearly labels it complimentary / free / in-package / included.
- catalogue: { category, name, description, cost_treatment, price, price_unit ("fixed"|"per_person"|"per_hour"), image_url }
- rentals:   { category, name, description, cost_treatment, price, stock_total, image_url }
- accommodation: { name, room_type, sleeps, cost_treatment, price_per_night, description, contact_name, contact_phone, contact_email, website_url, address, image_url }
- vendor types (caterers/planners/florists/djs/photographers/decor/bar):
    { name, description, cost_treatment, price_from, contact_email, contact_phone, website_url, image_url }
`.trim();

type ParsedItem = { category: string; data: Record<string, unknown> };
type ParseResult = { items: ParsedItem[]; stop_reason: string | null; truncated: boolean };

const EXTRACT_SYSTEM = `You extract structured wedding-venue inventory and vendor data from arbitrary venue documents.

${CATEGORY_GUIDE}

${FIELDS_SCHEMA}

OUTPUT FORMAT — return ONE JSON object PER LINE (JSONL / NDJSON), no prose, no markdown fences, no outer array:
{"category":"rentals","data":{"name":"Champagne flutes","item_code":"F1","cost_treatment":"included"}}
{"category":"catalogue","data":{"name":"...", ...}}
… one line per item, that's it.

EXTRACTION RULES — extract everything that *could* plausibly be a marketplace item, even when partial:
- A row qualifies if it has a NAME or CODE that identifies an item, vendor, or service. Price is NOT required — leave price null when missing.
- Pat Busch's convention: items prefixed "F1, F2 …" are FREE (cost_treatment: "included"). Items prefixed "R1, R2 …" are paid RENTAL (cost_treatment: "extra"). Use the code as the description if no other description is given.
- Extract company / supplier names from "Preferred Service Providers" / "Recommended Vendors" pages — phone, email, website all optional.
- For decor / rental / catalogue lists: each numbered or bulleted item is its own row. Group only when the source clearly groups them (e.g. "120 Dinner Knives, Forks, Spoons" → 1 row labelled "Dinner cutlery set").
- Default cost_treatment to "extra" unless the document says complimentary / free / included / F-coded.
- For prices: include if clearly stated as a number; strip "R", spaces, commas. If absent, leave null — DO NOT skip the item.
- Each item needs at minimum a name (or a code that can serve as the name).
- Keep descriptions short (one sentence max).
- If the document has truly NO inventory or vendor content (e.g. address-only map, T&Cs, raw floor plan), return {"items":[]}.

If you are unsure whether something qualifies, INCLUDE it — the user reviews and edits before commit.`;

function filenameHint(filename: string): string {
  const fnameLower = filename.toLowerCase();
  return /free|complimentary|included|in[-\s]?package/.test(fnameLower)
    ? `\n\nIMPORTANT FILENAME SIGNAL: the filename "${filename}" indicates these are COMPLIMENTARY / INCLUDED items. Set cost_treatment:"included" for every item unless an item is explicitly marked as a paid extra.`
    : /rental|extra|optional|hire|paid|add[-\s]?on/.test(fnameLower)
    ? `\n\nIMPORTANT FILENAME SIGNAL: the filename "${filename}" indicates these are PAID EXTRA / RENTAL items. Set cost_treatment:"extra" for every item unless an item is explicitly marked as complimentary.`
    : "";
}

// Parse the JSONL body Claude returns. `truncated` is true when the model ran out of
// output budget mid-list (stop_reason "max_tokens") so the caller can warn the user.
function parseJsonl(raw: string, stop_reason: string | null, filename: string): ParseResult {
  const cleaned = raw.replace(/^```(?:json|jsonl|ndjson)?\s*/i, "").replace(/```\s*$/i, "");
  const items: ParsedItem[] = [];
  for (const line of cleaned.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.category && obj.data) items.push(obj);
    } catch {
      // line incomplete (truncated final line) — skip silently
    }
  }
  console.log(`[smart-import] ${filename}: parsed ${items.length} items from JSONL (stop_reason ${stop_reason})`);
  return { items, stop_reason, truncated: stop_reason === "max_tokens" };
}

async function parseWithClaude(client: Anthropic, filename: string, text: string): Promise<ParseResult> {
  const userMsg = `Source filename: ${filename}${filenameHint(filename)}

Document content:
${text.slice(0, 90000)}

Return the JSON now.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16384,
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const block = response.content.find((c) => c.type === "text");
  const raw = block && block.type === "text" ? block.text : "";
  console.log(`[smart-import] ${filename}: input ${text.length}c → claude returned ${raw.length}c. Stop reason: ${response.stop_reason}`);
  return parseJsonl(raw, response.stop_reason ?? null, filename);
}

// Vision fallback for image-only / scanned PDFs: send the rasterised page PNGs to
// Claude using the SAME extraction prompt so we read inventory off the picture itself.
async function parseImagesWithClaude(
  client: Anthropic,
  filename: string,
  images: ExtractedImage[],
): Promise<ParseResult> {
  // Fetch each uploaded page PNG back as base64 for the vision call. Cap pages to keep
  // the request inside the model's image limit and the 300s route budget.
  const pages = images.filter((im) => im.page != null).slice(0, 8);
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const im of pages) {
    try {
      const res = await fetch(im.url);
      if (!res.ok) continue;
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: "image/png", data: b64 },
      });
    } catch { /* skip unreadable page */ }
  }
  if (!blocks.length) return { items: [], stop_reason: null, truncated: false };

  blocks.push({
    type: "text",
    text: `Source filename: ${filename}${filenameHint(filename)}

The images above are the pages of a scanned / image-only document. Read every inventory item, room, or vendor visible in them and return the JSON now.`,
  });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16384,
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: blocks }],
  });

  const block = response.content.find((c) => c.type === "text");
  const raw = block && block.type === "text" ? block.text : "";
  console.log(`[smart-import] ${filename}: VISION over ${blocks.length - 1} pages → ${raw.length}c. Stop reason: ${response.stop_reason}`);
  return parseJsonl(raw, response.stop_reason ?? null, filename);
}

// Hard filename signal — wins over Claude's guess when the filename is explicit.
function filenameCostTreatment(filename: string): "included" | "extra" | null {
  const f = filename.toLowerCase();
  if (/free|complimentary|included|in[-\s]?package/.test(f)) return "included";
  if (/rental|extra|optional|hire|paid|add[-\s]?on/.test(f)) return "extra";
  return null;
}

// Strip codes / quantities / parentheticals so Unsplash gets a clean search term.
// "F1 - F4 200 Champagne Flutes (universal superior...)" → "Champagne Flutes"
function simplifyForSearch(name: string): string {
  return String(name)
    .replace(/\([^)]*\)/g, " ")                 // drop parentheticals
    .replace(/\b[FR]\d+\s*[-–]?\s*[FR]?\d*\b/gi, " ") // drop F1, R12, F1-F4 codes
    .replace(/\b\d{1,4}\b/g, " ")               // drop bare quantities
    .replace(/[^a-zA-Z\s&]/g, " ")
    .replace(/\b(set|sets|of|the|a|an|various|sundry|incl|etc|x)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const venueId = (form.get("venue_id") as string || "").trim();
    if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });
    if (!venueId) return NextResponse.json({ error: "Missing venue_id" }, { status: 400 });

    const gate = await requireVenueMember(venueId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured (ANTHROPIC_API_KEY)." }, { status: 503 });
    const client = new Anthropic({ apiKey });

    const validCategories = new Set(Object.keys(INVENTORY_FIELDS)) as Set<InventoryType>;

    // Extract text from every file + pull embedded images from xlsx in parallel.
    const filtered = files.filter((f) => f && typeof f !== "string");
    const extracts = await Promise.all(filtered.map(extractFile));
    const imageBatches = await Promise.all(filtered.map(async (f) => {
      const ext = (f.name.toLowerCase().split(".").pop() || "");
      if (ext !== "xlsx" && ext !== "xls") return [] as ExtractedImage[];
      try {
        const buf = Buffer.from(await f.arrayBuffer());
        return await extractXlsxImages(buf, f.name, venueId);
      } catch { return [] as ExtractedImage[]; }
    }));
    const allImages: ExtractedImage[] = imageBatches.flat();
    const imagesByFile = new Map<string, ExtractedImage[]>();
    allImages.forEach((img) => {
      const list = imagesByFile.get(img.source_file) ?? [];
      list.push(img);
      imagesByFile.set(img.source_file, list);
    });

    // Map filename → original File so we can re-read a scanned PDF for the vision fallback.
    const fileByName = new Map<string, File>();
    filtered.forEach((f) => { if (!fileByName.has(f.name)) fileByName.set(f.name, f); });

    // Process files sequentially through Claude to avoid rate limits + token bursts.
    type FileReport = {
      filename: string;
      chars: number;
      items: number;
      status: string;
      error?: string;
      stop_reason?: string | null;
      truncated?: boolean;
      unsupported?: string;
    };
    const reports: FileReport[] = [];
    const allItems: Array<{ category: string; data: Record<string, unknown>; source_file: string }> = [];

    // Attach images to the parsed items. Prefer drawing anchors (sheet/row order) so an
    // embedded photo lands on the right row; fall back to a positional counter otherwise.
    function attachImages(
      valid: ParsedItem[],
      fileImages: ExtractedImage[],
      fnameOverride: "included" | "extra" | null,
      sourceFile: string,
    ) {
      const hasAnchors = fileImages.some((im) => im.sheet != null || im.row != null);
      // Anchor order = sheet name then row number; this matches the reading order Claude
      // emits items in, so the Nth anchored image maps to the Nth item.
      const ordered = hasAnchors
        ? [...fileImages].sort((a, b) => {
            const s = String(a.sheet ?? "").localeCompare(String(b.sheet ?? ""));
            if (s !== 0) return s;
            return (a.row ?? Number.MAX_SAFE_INTEGER) - (b.row ?? Number.MAX_SAFE_INTEGER);
          })
        : fileImages;
      let imgIdx = 0;
      valid.forEach((it) => {
        if (fnameOverride) it.data.cost_treatment = fnameOverride;
        let image_source: "embedded" | "online" | "none" = "none";
        if (!it.data.image_url && ordered[imgIdx]) {
          it.data.image_url = ordered[imgIdx].url;
          image_source = "embedded";
          imgIdx++;
        } else if (it.data.image_url) {
          image_source = "embedded";
        }
        (it as { image_source?: string }).image_source = image_source;
        allItems.push({ ...it, source_file: sourceFile });
      });
    }

    for (const ex of extracts) {
      if (ex.unsupported) {
        reports.push({ filename: ex.filename, chars: 0, items: 0, status: ex.unsupported, unsupported: ex.unsupported });
        continue;
      }
      if (ex.error) {
        reports.push({ filename: ex.filename, chars: 0, items: 0, status: "extract failed", error: ex.error });
        continue;
      }
      const fnameOverride = filenameCostTreatment(ex.filename);
      // Image-only / scanned PDF: rasterise pages and read them with Claude VISION
      // rather than silently dropping the file.
      if (ex.chars < 50) {
        if (ex.kind === "pdf") {
          try {
            const orig = fileByName.get(ex.filename);
            const buf = orig ? Buffer.from(await orig.arrayBuffer()) : null;
            const pageImages = buf ? await extractPdfImages(buf, ex.filename, venueId) : [];
            if (pageImages.length) {
              // Surface the rendered pages in the gallery + per-file image count.
              pageImages.forEach((im) => allImages.push(im));
              const result = await parseImagesWithClaude(client, ex.filename, pageImages);
              const valid = result.items.filter((it) => validCategories.has(it.category as InventoryType) && it.data?.name);
              attachImages(valid, [], fnameOverride, ex.filename);
              reports.push({
                filename: ex.filename,
                chars: ex.chars,
                items: valid.length,
                status: (valid.length ? "scanned — read with vision" : "scanned — no inventory found (map / floor plan)") + ` (+${pageImages.length} pages)`,
                stop_reason: result.stop_reason,
                truncated: result.truncated,
              });
              continue;
            }
          } catch (e) {
            reports.push({ filename: ex.filename, chars: ex.chars, items: 0, status: "scanned PDF — vision read failed", error: e instanceof Error ? e.message : String(e) });
            continue;
          }
        }
        reports.push({ filename: ex.filename, chars: ex.chars, items: 0, status: "no extractable text (likely image-only PDF — map / floor plan)" });
        continue;
      }
      try {
        const result = await parseWithClaude(client, ex.filename, ex.text);
        const valid = result.items.filter((it) => validCategories.has(it.category as InventoryType) && it.data?.name);
        const fileImages = imagesByFile.get(ex.filename) ?? [];
        attachImages(valid, fileImages, fnameOverride, ex.filename);
        const imgNote = fileImages.length ? ` (+${fileImages.length} images)` : "";
        reports.push({
          filename: ex.filename,
          chars: ex.chars,
          items: valid.length,
          status: (valid.length ? "ok" : "nothing recognisable") + imgNote,
          stop_reason: result.stop_reason,
          truncated: result.truncated,
        });
      } catch (e) {
        reports.push({ filename: ex.filename, chars: ex.chars, items: 0, status: "Claude error", error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Auto-search stock photos (Pexels-first, Unsplash fallback) for items that
    // ended the parse pass without any image. Concurrency 4 keeps us under the
    // provider rate caps (Pexels 200/hr, Unsplash 50/hr) on large imports.
    const needSearch: number[] = [];
    allItems.forEach((it, i) => { if (!it.data.image_url) needSearch.push(i); });
    if (needSearch.length) {
      // Build short, generic Unsplash queries — name first; fallback to category if no result.
      const results = await mapWithConcurrency(needSearch, 4, async (i) => {
        const it = allItems[i];
        const simple = simplifyForSearch(String(it.data.name ?? ""));
        if (simple) {
          const hit = await searchOneImage(simple);
          if (hit) return hit;
        }
        // Fall back to a generic category term ("rentals" → "wedding rentals", etc.)
        const fallback = it.category === "accommodation" ? "wedding accommodation"
          : it.category === "catalogue" ? "wedding catering"
          : it.category === "rentals" ? "wedding decor"
          : `wedding ${it.category}`;
        return await searchOneImage(fallback);
      });
      results.forEach((url, k) => {
        if (!url) return;
        const it = allItems[needSearch[k]];
        it.data.image_url = url;
        (it as { image_source?: string }).image_source = "online";
      });
    }

    const items = allItems.map((it, i) => ({
      _id: i,
      _include: true,
      category: it.category,
      source_file: it.source_file,
      data: it.data,
      image_source: ((it as unknown as { image_source?: string }).image_source) ?? (it.data.image_url ? "embedded" : "none"),
    }));

    const counts: Record<string, number> = {};
    items.forEach((it) => { counts[it.category] = (counts[it.category] ?? 0) + 1; });

    return NextResponse.json({
      ok: true,
      items,
      counts,
      files: reports,
      images: allImages,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
