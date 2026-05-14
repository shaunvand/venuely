import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as unknown as { default?: (b: Buffer) => Promise<{ text: string }> }).default
  ?? (pdfParseModule as unknown as (b: Buffer) => Promise<{ text: string }>);
import Anthropic from "@anthropic-ai/sdk";
import { INVENTORY_FIELDS } from "@/lib/inventory/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

type Extract = { filename: string; kind: "pdf" | "xlsx" | "csv" | "txt"; text: string };

async function extractFile(file: File): Promise<Extract> {
  const name = file.name;
  const lower = name.toLowerCase();
  const ext = lower.split(".").pop() || "";
  const buf = Buffer.from(await file.arrayBuffer());
  if (ext === "pdf") {
    const out = await pdfParse(buf);
    return { filename: name, kind: "pdf", text: out.text };
  }
  if (ext === "xlsx" || ext === "xls") {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheets = wb.SheetNames.map((sn) => {
      const ws = wb.Sheets[sn];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: null });
      return `### Sheet: ${sn}\n${rows.length ? JSON.stringify(rows, null, 0) : "(empty)"}`;
    });
    return { filename: name, kind: "xlsx", text: sheets.join("\n\n") };
  }
  if (ext === "csv") {
    return { filename: name, kind: "csv", text: buf.toString("utf-8") };
  }
  return { filename: name, kind: "txt", text: buf.toString("utf-8") };
}

const CATEGORY_GUIDE = `
TARGET CATEGORIES (assign each item to exactly one):
- "catalogue" — venue-owned per-head menu/bar/services priced per_person or fixed (e.g. "3-course dinner", "welcome drink", "canapés")
- "rentals" — physical items rented with stock (chairs, tables, linen, decor pieces, lighting hire)
- "accommodation" — on-site rooms / cottages / suites / tents to sleep guests overnight
- "caterers" — external catering vendor partner (a company that does the catering)
- "planners" — external wedding planner / coordinator vendor partner
- "florists" — external florist vendor partner
- "djs" — DJ / live music / sound vendor partner
- "photographers" — photo / video vendor partner
- "decor" — external decor / styling vendor partner (the company, not the item)
- "bar" — external bar service / mobile bar vendor partner

DISTINCTION RULES (critical):
- A line-item with a unit price → "catalogue" or "rentals". A company/contact with phone/email → vendor partner type.
- "DJ services R5,000" alone is catalogue (a service the venue charges for). "John's DJ Services — john@djs.co.za — from R5,000" is a vendor partner ("djs").
- Tables/chairs/glasses are "rentals". Cottages/rooms/tents are "accommodation".
`.trim();

const FIELDS_SCHEMA = `
PER-ITEM SCHEMA — only fields relevant to the category should be filled, leave others null:
- catalogue: { category, name, description, price, price_unit ("fixed"|"per_person"|"per_hour"), image_url }
- rentals:   { category, name, description, price, stock_total, image_url }
- accommodation: { name, room_type, sleeps, price_per_night, description, image_url }
- vendor types (caterers/planners/florists/djs/photographers/decor/bar):
    { name, description, price_from, contact_email, contact_phone, website_url, image_url }
`.trim();

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

    const extracts: Extract[] = [];
    for (const f of files) {
      if (!f || typeof f === "string") continue;
      try { extracts.push(await extractFile(f)); }
      catch (e) { extracts.push({ filename: f.name, kind: "txt", text: `[Could not extract: ${e instanceof Error ? e.message : String(e)}]` }); }
    }

    const combined = extracts.map((e) =>
      `===== FILE: ${e.filename} (${e.kind}) =====\n${e.text.slice(0, 12000)}`
    ).join("\n\n");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    const client = new Anthropic({ apiKey });

    const system = `You extract structured wedding-venue inventory and vendor data from arbitrary venue documents (PDF quotes, brochures, Excel exports, supplier lists).

${CATEGORY_GUIDE}

${FIELDS_SCHEMA}

OUTPUT FORMAT — return ONLY a JSON object, no prose, no markdown fences:
{
  "items": [
    { "category": "<one of the 10 target categories above>", "data": { ...fields for that category... }, "source_file": "<filename>" },
    ...
  ]
}

RULES:
- Be conservative. Skip rows you can't confidently identify or that aren't inventory/vendors (e.g. table-of-contents, T&Cs, terms, deposit policies).
- For prices: only include if clearly stated; strip "R", spaces, commas; return a number. Skip if unclear.
- Vendor partners need at minimum a name. Catalogue/rentals/accommodation need at minimum a name.
- If a single row has multiple sub-items, return them as separate items.
- Keep descriptions short (one sentence max).`;

    const userMsg = `Files to process:

${combined.slice(0, 60000)}

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
    if (s < 0 || e < 0) return NextResponse.json({ error: "Model did not return JSON", raw: raw.slice(0, 400) }, { status: 502 });

    let parsed: { items?: Array<{ category: string; data: Record<string, unknown>; source_file?: string }> } = {};
    try { parsed = JSON.parse(raw.slice(s, e + 1)); }
    catch (err) { return NextResponse.json({ error: "Invalid JSON", detail: String(err) }, { status: 502 }); }

    const validCategories = new Set(Object.keys(INVENTORY_FIELDS));
    const items = (parsed.items ?? [])
      .filter((it) => validCategories.has(it.category))
      .map((it, i) => ({
        _id: i,
        _include: true,
        category: it.category,
        source_file: it.source_file ?? null,
        data: it.data ?? {},
      }));

    const counts: Record<string, number> = {};
    items.forEach((it) => { counts[it.category] = (counts[it.category] ?? 0) + 1; });

    return NextResponse.json({
      ok: true,
      items,
      counts,
      files: extracts.map((e) => ({ filename: e.filename, kind: e.kind, chars: e.text.length })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
