import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { INVENTORY_FIELDS, type InventoryType } from "@/lib/inventory/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[Rr\s,]/g, "").replace(/[^\d.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const type = (form.get("type") as string || "") as InventoryType;
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    if (!["catalogue", "rentals", "accommodation"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: null });
    if (!rows.length) return NextResponse.json({ error: "Sheet is empty" }, { status: 400 });

    const headers = Object.keys(rows[0]);
    const fields = INVENTORY_FIELDS[type];
    const fieldList = fields.map((f) => `"${f.key}" (${f.label})`).join(", ");
    const sample = rows.slice(0, 5);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    const client = new Anthropic({ apiKey });

    const system = `You map spreadsheet column headers to a fixed schema. Return ONLY a JSON object mapping each schema field to the best matching header (string) or null if no clear match. No prose, no markdown fences.

Target schema fields (only these keys allowed in output): ${fieldList}

Rules:
- Be conservative: return null when no header is clearly the right match. Do not guess.
- The output object MUST have every schema field as a key, with either the source header string or null as the value.
- Match by meaning, not exact text. "Item", "Product" → "name". "Cost", "ZAR", "R" → "price". "Picture", "Photo" → "image_url".`;

    const userMsg = `Inventory type: ${type}
Spreadsheet headers: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sample)}

Return the mapping JSON now.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    const block = response.content.find((c) => c.type === "text");
    const raw = block && block.type === "text" ? block.text.trim() : "";
    const s = raw.indexOf("{"); const e = raw.lastIndexOf("}");
    let mapping: Record<string, string | null> = {};
    if (s >= 0 && e >= 0) {
      try { mapping = JSON.parse(raw.slice(s, e + 1)); } catch {}
    }

    const numericKeys = new Set(fields.filter((f) => f.type === "number").map((f) => f.key));
    const preview = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const f of fields) {
        const src = mapping[f.key];
        const raw = src && Object.prototype.hasOwnProperty.call(r, src) ? r[src] : null;
        if (raw == null || raw === "") { out[f.key] = null; continue; }
        out[f.key] = numericKeys.has(f.key) ? toNum(raw) : String(raw).trim();
      }
      return out;
    });

    return NextResponse.json({
      ok: true,
      type,
      headers,
      mapping,
      preview,
      fields: fields.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? null })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
