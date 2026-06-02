"use server";

import { revalidatePath } from "next/cache";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { PORTAL_TEMPLATES, resolveTheme, type PortalTemplateId } from "@/lib/portal/templates";

// Persist the venue's couple-portal design (chosen template + theme colours +
// logo). Scoped to the current venue via getCurrentVenue() + RLS.
export async function saveVenuePortalDesign(input: {
  template: string;
  primary: string;
  accent: string;
  logoUrl: string | null;
}): Promise<{ ok: true }> {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const template = (Object.prototype.hasOwnProperty.call(PORTAL_TEMPLATES, input.template)
    ? input.template
    : "classic") as PortalTemplateId;
  const theme = resolveTheme({ primary: input.primary, accent: input.accent, logoUrl: input.logoUrl });
  const { error } = await supabase
    .from("venues")
    .update({ portal_template: template, portal_theme: theme })
    .eq("id", venue.id);
  if (error) throw new Error(error.message);
  revalidatePath("/venue/your-venue");
  return { ok: true };
}
