import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { portalAccess } from "@/lib/portal/access";

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const RESEND_API = "https://api.resend.com/emails";

type SubmitBody = {
  kind: "catalogue" | "rentals" | "full";
  state: Record<string, unknown>;
  totals?: Record<string, unknown>;
  message?: string;
};

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const access = await portalAccess(slug, request);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  let body: SubmitBody;
  try { body = (await request.json()) as SubmitBody; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  if (!body.kind || !["catalogue", "rentals", "full"].includes(body.kind)) {
    return NextResponse.json({ error: "kind required" }, { status: 400 });
  }

  const supabase = admin();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, venue:venues(name, contact_email)")
    .eq("id", access.wedding.id)
    .single();
  if (!wedding) return NextResponse.json({ error: "wedding not found" }, { status: 404 });

  const { data: submission, error: sErr } = await supabase
    .from("submissions")
    .insert({
      wedding_id: wedding.id,
      kind: body.kind,
      state: body.state ?? {},
      totals: body.totals ?? null,
      message: body.message ?? null,
    })
    .select("id, created_at")
    .single();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Email venue if Resend is configured.
  const v = (wedding as unknown as { venue: { name: string; contact_email: string | null } | null }).venue;
  const to = v?.contact_email;
  if (process.env.RESEND_API_KEY && to) {
    const subject = `[${body.kind}] New selection from ${wedding.couple_names}`;
    const html = renderEmail(body, wedding.couple_names, wedding.wedding_date);
    try {
      await fetch(RESEND_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Venuely <hello@venuely.co.za>",
          to,
          subject,
          html,
        }),
      });
    } catch {
      // Email failure is non-fatal — the submission record is the source of truth.
    }
  }

  return NextResponse.json({ ok: true, submission });
}

function renderEmail(body: SubmitBody, couple: string, date: string | null): string {
  const totals = body.totals ?? {};
  const safe = (v: unknown) => String(v ?? "—");
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px">
      <h2>New ${body.kind} submission</h2>
      <p><b>${couple}</b>${date ? ` · ${date}` : ""}</p>
      ${body.message ? `<p style="background:#fafaf9;padding:12px;border-left:3px solid #c19a3b">${safe(body.message)}</p>` : ""}
      <h3>Totals</h3>
      <pre style="background:#f5f5f4;padding:12px;border-radius:6px;overflow:auto">${safe(JSON.stringify(totals, null, 2))}</pre>
      <p style="color:#888;font-size:12px">Open Venuely admin to view the full submission and reply to the couple.</p>
    </div>
  `;
}
