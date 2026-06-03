import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";
import * as XLSX from "xlsx";

// Smart import for the guest list. Accepts a CSV or XLSX upload (or pasted CSV
// text) and maps columns → name / email / phone by header sniffing, then bulk-adds
// guests (each gets an rsvp_token by default). Portal-gated, service-role write.
export const runtime = "nodejs";
function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const pick = (row: Record<string, unknown>, names: string[]) => {
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase().trim();
    if (names.some((n) => k === n || k.includes(n))) { const v = row[key]; if (v != null && String(v).trim()) return String(v).trim(); }
  }
  return "";
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, req);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  let rows: Record<string, unknown>[] = [];
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
      const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    } else {
      const b = (await req.json().catch(() => ({}))) as { csv?: string };
      if (!b.csv) return NextResponse.json({ error: "no data" }, { status: 400 });
      const wb = XLSX.read(b.csv, { type: "string" });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    }
  } catch {
    return NextResponse.json({ error: "could not read the file — use .xlsx or .csv" }, { status: 400 });
  }

  const guests = rows.map((r) => ({
    full_name: pick(r, ["name", "guest", "full name", "fullname"]),
    email: pick(r, ["email", "e-mail", "mail"]),
    phone: pick(r, ["phone", "whatsapp", "mobile", "cell", "number", "contact"]),
    side: pick(r, ["side", "party"]) || null,
  })).filter((g) => g.full_name);

  if (!guests.length) return NextResponse.json({ error: "no rows with a name found — make sure there's a Name column" }, { status: 400 });

  const db = admin();
  const payload = guests.map((g) => ({ ...g, wedding_id: access.wedding.id, rsvp_status: "pending", consent_at: new Date().toISOString() }));
  const { data, error } = await db.from("guests").insert(payload).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, imported: data?.length ?? 0 });
}
