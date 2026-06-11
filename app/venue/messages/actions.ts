"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentVenue } from "@/lib/venue/current";

// The venue writes into a couple↔supplier thread (e.g. to nudge a slow supplier
// or answer a question). Venue messages are NOT redacted — the venue is the
// mediator and may share whatever it likes. Bumps the couple's unread counter so
// the message surfaces in their portal badge.
export async function sendVenueMessage(threadId: string, text: string) {
  const body = text.trim();
  if (!body) throw new Error("Message is empty");

  const venue = await getCurrentVenue();
  const supabase = await createClient();

  const { data: thread, error: fetchErr } = await supabase
    .from("message_threads")
    .select("id, venue_id, couple_unread")
    .eq("id", threadId)
    .single();
  if (fetchErr || !thread) throw new Error("Thread not found");
  if (thread.venue_id !== venue.id) throw new Error("Not your venue");

  const { error: insertErr } = await supabase.from("thread_messages").insert({
    thread_id: threadId,
    venue_id: venue.id,
    sender: "venue",
    body,
    flagged: false,
  });
  if (insertErr) throw new Error(insertErr.message);

  const { error: updateErr } = await supabase
    .from("message_threads")
    .update({
      couple_unread: (Number(thread.couple_unread) || 0) + 1,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .eq("venue_id", venue.id);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath("/venue/messages");
}
