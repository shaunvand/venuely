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
    const subject = `New wedding selection from ${wedding.couple_names}`;
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
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const rZA = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;
  const labelize = (k: string) => k.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

  // Count what the couple selected, from the saved state.
  const state = (body.state ?? {}) as Record<string, unknown>;
  const countSel = (v: unknown) => v && typeof v === "object"
    ? Object.values(v as Record<string, unknown>).filter((e) => e === true || (e && typeof e === "object" && ((e as Record<string, unknown>).sel ?? (e as Record<string, unknown>).selected))).length
    : 0;
  const itemCount = countSel(state.catalogueSelections) + countSel(state.rentalSelections)
    + Object.keys((state.roomAssignments as Record<string, unknown>) ?? {}).length
    + (Array.isArray(state.customRequests) ? (state.customRequests as unknown[]).length : 0);

  // Format the totals as a clean money table (was a raw JSON dump).
  const totals = (body.totals ?? {}) as Record<string, unknown>;
  const rows = Object.entries(totals).map(([k, v]) => {
    const num = Number(v);
    const val = Number.isFinite(num) ? rZA(num) : esc(v);
    const strong = /grand|total|due/i.test(k);
    return `<tr><td style="padding:8px 0;color:#57534e">${esc(labelize(k))}</td><td style="padding:8px 0;text-align:right;font-weight:${strong ? 700 : 500};color:#1c1917">${val}</td></tr>`;
  }).join("");

  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;color:#1c1917">
      <h2 style="margin:0 0 4px">New wedding selection</h2>
      <p style="margin:0 0 16px;color:#57534e"><b>${esc(couple)}</b>${date ? ` · ${esc(date)}` : ""}${itemCount ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"} selected` : ""}</p>
      ${body.message ? `<p style="background:#fafaf9;padding:12px;border-left:3px solid #c19a3b;margin:0 0 16px">${esc(body.message)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4;margin:0 0 16px">
        ${rows || `<tr><td style="padding:8px 0;color:#57534e">Total</td><td style="padding:8px 0;text-align:right">—</td></tr>`}
      </table>
      <p style="color:#888;font-size:12px">Open Venuely admin to view the full submission and reply to the couple.</p>
    </div>
  `;
}
