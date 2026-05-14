import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { extractText, getDocumentProxy } from "unpdf";
import Anthropic from "@anthropic-ai/sdk";
import { INVENTORY_FIELDS, type InventoryType } from "@/lib/inventory/schemas";
import { extractXlsxImages, type ExtractedImage } from "@/lib/imports/extract-images";
import { searchOneImage, mapWithConcurrency } from "@/lib/imports/image-search";

export const runtime = "nodejs";
export const maxDuration = 300;

type Extract = { filename: string; kind: "pdf" | "xlsx" | "csv" | "txt"; text: string; chars: number; error?: string };

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

async function parseWithClaude(client: Anthropic, filename: string, text: string): Promise<Array<{ category: string; data: Record<string, unknown> }>> {
  const system = `You extract structured wedding-venue inventory and vendor data from arbitrary venue documents.

${CATEGORY_GUIDE}

${FIELDS_SCHEMA}

OUTPUT FORMAT — return ONLY a JSON object, no prose, no markdown fences:
{"items":[{"category":"<category>","data":{...}}, ...]}

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

  const userMsg = `Source filename: ${filename}

Document content:
${text.slice(0, 90000)}

Return the JSON now.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  const block = response.content.find((c) => c.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";
  console.log(`[smart-import] ${filename}: input ${text.length}c → claude returned ${raw.length}c. First 300: ${raw.slice(0, 300)}`);
  const s = raw.indexOf("{"); const e = raw.lastIndexOf("}");
  if (s < 0 || e < 0) {
    console.warn(`[smart-import] ${filename}: no JSON in Claude response`);
    return [];
  }
  try {
    const parsed = JSON.parse(raw.slice(s, e + 1)) as { items?: Array<{ category: string; data: Record<string, unknown> }> };
    console.log(`[smart-import] ${filename}: parsed ${parsed.items?.length ?? 0} items`);
    return parsed.items ?? [];
  } catch (err) {
    console.warn(`[smart-import] ${filename}: JSON parse error — ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    const venueId = (form.get("venue_id") as string || "").trim();
    if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });
    if (!venueId) return NextResponse.json({ error: "Missing venue_id" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
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

    // Process files sequentially through Claude to avoid rate limits + token bursts.
    type FileReport = { filename: string; chars: number; items: number; status: string; error?: string };
    const reports: FileReport[] = [];
    const allItems: Array<{ category: string; data: Record<string, unknown>; source_file: string }> = [];

    for (const ex of extracts) {
      if (ex.error) {
        reports.push({ filename: ex.filename, chars: 0, items: 0, status: "extract failed", error: ex.error });
        continue;
      }
      if (ex.chars < 50) {
        reports.push({ filename: ex.filename, chars: ex.chars, items: 0, status: "no extractable text (likely image-only PDF — map / floor plan)" });
        continue;
      }
      try {
        const items = await parseWithClaude(client, ex.filename, ex.text);
        const valid = items.filter((it) => validCategories.has(it.category as InventoryType) && it.data?.name);
        const fileImages = imagesByFile.get(ex.filename) ?? [];
        let imgIdx = 0;
        valid.forEach((it) => {
          let image_source: "embedded" | "online" | "none" = "none";
          if (!it.data.image_url && fileImages[imgIdx]) {
            it.data.image_url = fileImages[imgIdx].url;
            image_source = "embedded";
            imgIdx++;
          } else if (it.data.image_url) {
            image_source = "embedded";
          }
          (it as { image_source?: string }).image_source = image_source;
          allItems.push({ ...it, source_file: ex.filename });
        });
        const imgNote = fileImages.length ? ` (+${fileImages.length} images)` : "";
        reports.push({ filename: ex.filename, chars: ex.chars, items: valid.length, status: (valid.length ? "ok" : "nothing recognisable") + imgNote });
      } catch (e) {
        reports.push({ filename: ex.filename, chars: ex.chars, items: 0, status: "Claude error", error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Auto-search Unsplash for items that ended the parse pass without any image.
    // Concurrency 4 keeps us well under Unsplash demo (50/hr) and production caps.
    const needSearch: number[] = [];
    allItems.forEach((it, i) => { if (!it.data.image_url) needSearch.push(i); });
    if (needSearch.length) {
      const queries = needSearch.map((i) => {
        const it = allItems[i];
        const parts = [
          String(it.data.name ?? ""),
          String(it.data.description ?? ""),
          it.category,
          "wedding",
        ].filter((s) => s && s.trim());
        return parts.join(" ");
      });
      const results = await mapWithConcurrency(queries, 4, (q) => searchOneImage(q));
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
