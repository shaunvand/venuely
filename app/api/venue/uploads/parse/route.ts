import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { extractText, getDocumentProxy } from "unpdf";
import Anthropic from "@anthropic-ai/sdk";
import { INVENTORY_FIELDS, type InventoryType } from "@/lib/inventory/schemas";

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

RULES:
- Be conservative. Skip rows you can't confidently identify or that aren't inventory/vendors (T&Cs, table-of-contents, terms, deposit policies, floor-plan labels, addresses).
- For prices: only include if clearly stated; strip "R", spaces, commas; return a number. Skip if unclear.
- Each item needs at minimum a name.
- Keep descriptions short (one sentence max).
- If the document has NO inventory or vendor content (e.g. it's a floor plan, address map, or pure policy doc), return {"items":[]}.`;

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
  const s = raw.indexOf("{"); const e = raw.lastIndexOf("}");
  if (s < 0 || e < 0) return [];
  try {
    const parsed = JSON.parse(raw.slice(s, e + 1)) as { items?: Array<{ category: string; data: Record<string, unknown> }> };
    return parsed.items ?? [];
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    const client = new Anthropic({ apiKey });

    const validCategories = new Set(Object.keys(INVENTORY_FIELDS)) as Set<InventoryType>;

    // Extract every file in parallel.
    const extracts = await Promise.all(files.filter((f) => f && typeof f !== "string").map(extractFile));

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
        const filtered = items.filter((it) => validCategories.has(it.category as InventoryType) && it.data?.name);
        filtered.forEach((it) => allItems.push({ ...it, source_file: ex.filename }));
        reports.push({ filename: ex.filename, chars: ex.chars, items: filtered.length, status: filtered.length ? "ok" : "nothing recognisable" });
      } catch (e) {
        reports.push({ filename: ex.filename, chars: ex.chars, items: 0, status: "Claude error", error: e instanceof Error ? e.message : String(e) });
      }
    }

    const items = allItems.map((it, i) => ({
      _id: i,
      _include: true,
      category: it.category,
      source_file: it.source_file,
      data: it.data,
    }));

    const counts: Record<string, number> = {};
    items.forEach((it) => { counts[it.category] = (counts[it.category] ?? 0) + 1; });

    return NextResponse.json({
      ok: true,
      items,
      counts,
      files: reports,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
