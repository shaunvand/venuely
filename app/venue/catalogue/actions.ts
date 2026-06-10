"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addCatalogue(venueId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("catalogue_items").insert({
    venue_id: venueId,
    category: formData.get("category") as string,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    price: Number(formData.get("price") || 0),
    price_unit: formData.get("price_unit") as string,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/venue/catalogue");
}

export async function toggleCatalogueActive(itemId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("catalogue_items").update({ active }).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/catalogue");
}

export async function deleteCatalogue(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("catalogue_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/catalogue");
}

// AI auto-grouping: classify each catalogue item into a course / event part
// (Breakfast, Lunch, Dinner, Drinks & Bar, Snacks & Canapés, Other) using Claude,
// so the couple portal can group the menu by part of the day.
const EVENT_PARTS = ["Breakfast", "Lunch", "Dinner", "Drinks & Bar", "Snacks & Canapés", "Other"];

export async function autoCategoriseCatalogue(venueId: string): Promise<void> {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("catalogue_items")
    .select("id, name, description, category")
    .eq("venue_id", venueId);
  const list = (items ?? []) as Array<{ id: string; name: string; description: string | null; category: string | null }>;
  if (!list.length) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI not configured (ANTHROPIC_API_KEY).");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey });

  const lines = list.map((it, i) => `${i}: ${it.name}${it.description ? ` — ${it.description.slice(0, 120)}` : ""}`).join("\n");
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content:
        `Group these wedding-venue catalogue/menu items by the part of the wedding day they belong to. ` +
        `Pick exactly one of: ${EVENT_PARTS.join(", ")}.\n` +
        `Coffee/tea/breakfast → Breakfast; canapés/snacks/welcome bites → Snacks & Canapés; ` +
        `bar/drinks/beverages → Drinks & Bar; lunch/day menu → Lunch; dinner/reception meal → Dinner; ` +
        `anything not food/drink (fees, setup) → Other.\n` +
        `Output JSONL, one per item, no prose: {"i":<index>,"part":"<one of the list>"}\n\n${lines}`,
    }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const map: Record<number, string> = {};
  for (const ln of text.split("\n")) {
    const s = ln.trim();
    if (!s.startsWith("{")) continue;
    try {
      const o = JSON.parse(s);
      if (typeof o.i === "number" && typeof o.part === "string") {
        const m = EVENT_PARTS.find((p) => p.toLowerCase() === o.part.toLowerCase());
        if (m) map[o.i] = m;
      }
    } catch { /* skip */ }
  }
  for (let i = 0; i < list.length; i++) {
    const part = map[i] || "Other";
    const { error } = await supabase.from("catalogue_items").update({ event_part: part }).eq("id", list[i].id).eq("venue_id", venueId);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/venue/catalogue");
}
