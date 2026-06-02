import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

// Read a venue's uploaded bank statement (PDF or image) and extract the banking
// details to pre-fill the EFT form. The statement is processed IN MEMORY and is
// NOT stored — bank statements are sensitive and the media bucket is public.

async function authVenue(venueId: string) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };
  const [{ data: member }, { data: profile }] = await Promise.all([
    auth.from("venue_members").select("venue_id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle(),
    auth.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!member && profile?.role !== "owner") return { ok: false as const, status: 403, error: "Not your venue" };
  return { ok: true as const };
}

const FIELDS_INSTRUCTION =
  `Extract the ACCOUNT HOLDER's banking details from this South African bank statement. ` +
  `Return ONLY a JSON object, no prose, with exactly these keys (use "" when a value isn't present):\n` +
  `{"bank_name":"","account_name":"","account_number":"","branch_code":"","swift":"","iban":""}\n` +
  `Notes: account_name is the account holder's name; branch_code is the 6-digit SA branch/universal code; ` +
  `swift is the BIC/SWIFT code; iban only if explicitly shown. Do not invent values.`;

function parseFields(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const o = JSON.parse(text.slice(start, end + 1));
    return {
      bank_name: String(o.bank_name ?? ""),
      account_name: String(o.account_name ?? ""),
      account_number: String(o.account_number ?? ""),
      branch_code: String(o.branch_code ?? ""),
      swift: String(o.swift ?? ""),
      iban: String(o.iban ?? ""),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const venueId = String(form.get("venue_id") || "").trim();
    const file = form.get("file");
    if (!venueId || !/^[a-zA-Z0-9-]+$/.test(venueId)) return NextResponse.json({ error: "Missing venue_id" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });

    const gate = await authVenue(venueId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured (ANTHROPIC_API_KEY)." }, { status: 503 });
    const anthropic = new Anthropic({ apiKey });

    const buf = Buffer.from(await file.arrayBuffer());
    const type = file.type || "";

    let content: Anthropic.ContentBlockParam[];
    if (type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      const flat = String(text).slice(0, 60_000);
      if (!flat.trim()) return NextResponse.json({ error: "Could not read text from that PDF. Try an image or a clearer file." }, { status: 422 });
      content = [{ type: "text", text: `${FIELDS_INSTRUCTION}\n\nBANK STATEMENT TEXT:\n${flat}` }];
    } else if (type.startsWith("image/")) {
      const media_type = (type === "image/png" ? "image/png" : type === "image/webp" ? "image/webp" : type === "image/gif" ? "image/gif" : "image/jpeg") as "image/png" | "image/webp" | "image/gif" | "image/jpeg";
      content = [
        { type: "text", text: FIELDS_INSTRUCTION },
        { type: "image", source: { type: "base64", media_type, data: buf.toString("base64") } },
      ];
    } else {
      return NextResponse.json({ error: "Upload a PDF or image of your bank statement." }, { status: 415 });
    }

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content }],
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const fields = parseFields(out);
    if (!fields) return NextResponse.json({ error: "Couldn't read the banking details — please enter them manually." }, { status: 422 });

    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
