import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { VenueMessagesView, type VenueThread, type VenueThreadMessage } from "@/components/VenueMessagesView";

export const dynamic = "force-dynamic";

// Supabase joins come back as an object or a one-element array depending on how
// the FK is detected — normalise to a single record.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

// Venue oversight inbox: every couple↔supplier thread for this venue, with the
// full transcript INCLUDING raw_body (the unredacted original of flagged
// messages — venue eyes only; couple and supplier only ever see the redacted
// body). RLS scopes both tables to the venue's members.
export default async function VenueMessages() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const [{ data: threadRows }, { data: msgRows }] = await Promise.all([
    supabase
      .from("message_threads")
      .select("id, wedding_id, intro_id, supplier_name, supplier_type, supplier_email, supplier_phone, status, last_message_at, created_at, wedding:weddings(couple_names, wedding_date), intro:supplier_intros(commission_type, commission_value, status, commission_amount)")
      .eq("venue_id", venue.id)
      .order("last_message_at", { ascending: false }),
    supabase
      .from("thread_messages")
      .select("id, thread_id, sender, body, raw_body, flagged, flag_reason, created_at")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: true }),
  ]);

  const msgsByThread = new Map<string, VenueThreadMessage[]>();
  for (const m of (msgRows ?? []) as Array<Record<string, unknown>>) {
    const tid = String(m.thread_id);
    const list = msgsByThread.get(tid) ?? [];
    list.push({
      id: String(m.id),
      sender: (m.sender as VenueThreadMessage["sender"]) ?? "system",
      body: String(m.body ?? ""),
      rawBody: m.raw_body ? String(m.raw_body) : null,
      flagged: !!m.flagged,
      flagReason: m.flag_reason ? String(m.flag_reason) : null,
      createdAt: String(m.created_at ?? ""),
    });
    msgsByThread.set(tid, list);
  }

  const threads: VenueThread[] = ((threadRows ?? []) as Array<Record<string, unknown>>).map((t) => {
    const wedding = one(t.wedding as { couple_names?: string; wedding_date?: string } | Array<{ couple_names?: string; wedding_date?: string }> | null);
    const intro = one(t.intro as { commission_type?: string; commission_value?: number; status?: string; commission_amount?: number | null } | Array<{ commission_type?: string; commission_value?: number; status?: string; commission_amount?: number | null }> | null);
    const status = (["active", "booked", "closed"].includes(String(t.status)) ? String(t.status) : "active") as VenueThread["status"];
    return {
      id: String(t.id),
      weddingId: t.wedding_id ? String(t.wedding_id) : null,
      coupleNames: wedding?.couple_names ? String(wedding.couple_names) : "Unknown couple",
      weddingDate: wedding?.wedding_date ? String(wedding.wedding_date) : null,
      supplierName: String(t.supplier_name ?? ""),
      supplierType: t.supplier_type ? String(t.supplier_type) : null,
      supplierEmail: t.supplier_email ? String(t.supplier_email) : null,
      supplierPhone: t.supplier_phone ? String(t.supplier_phone) : null,
      status,
      lastMessageAt: t.last_message_at ? String(t.last_message_at) : null,
      commission: intro
        ? {
            type: String(intro.commission_type ?? "percent"),
            value: Number(intro.commission_value ?? 0),
            status: String(intro.status ?? "intro_requested"),
            amount: intro.commission_amount == null ? null : Number(intro.commission_amount),
          }
        : null,
      messages: msgsByThread.get(String(t.id)) ?? [],
    };
  });

  return (
    <div className="space-y-8">
      <header>
        <div className="vy-eyebrow">Marketplace</div>
        <h1 className="vy-h1 mt-1">Messages</h1>
        <p className="text-stone-600 text-sm mt-1">
          Every couple↔supplier conversation at {venue.name}, mediated by Venuely. Contact details stay
          masked between the parties until the couple books — you see the full transcripts, including
          the originals of any flagged messages, and can reply into any thread.
        </p>
      </header>

      <VenueMessagesView threads={threads} />
    </div>
  );
}
