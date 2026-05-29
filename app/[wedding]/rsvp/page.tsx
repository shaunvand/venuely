import { notFound } from "next/navigation";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { RsvpForm } from "./RsvpForm";

export const dynamic = "force-dynamic";

function admin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null;
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type RsvpWedding = {
  id: string;
  slug: string;
  couple_names: string;
  wedding_date: string | null;
  venue: { name: string } | null;
};

async function loadWedding(slug: string): Promise<RsvpWedding | null> {
  const ad = admin();
  if (!ad) return null;
  const { data } = await ad
    .from("weddings")
    .select("id, slug, couple_names, wedding_date, venue:venues(name)")
    .eq("slug", slug)
    .maybeSingle();
  return (data as unknown as RsvpWedding | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ wedding: string }> }): Promise<Metadata> {
  const { wedding: slug } = await params;
  const wedding = await loadWedding(slug);
  const title = wedding ? `RSVP — ${wedding.couple_names}` : "RSVP";
  return {
    title,
    description: wedding ? `Let ${wedding.couple_names} know if you can make it.` : "Wedding RSVP",
    robots: { index: false, follow: false },
  };
}

export default async function RsvpPage({ params }: { params: Promise<{ wedding: string }> }) {
  const { wedding: slug } = await params;
  const wedding = await loadWedding(slug);
  if (!wedding) notFound();

  const prettyDate = wedding.wedding_date
    ? new Date(wedding.wedding_date).toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <main className="min-h-screen px-5 py-10 sm:py-16" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <div className="mx-auto w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: "var(--poppy)" }}>
            {wedding.venue?.name ?? "Wedding"}
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
            {wedding.couple_names}
          </h1>
          {prettyDate && <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>{prettyDate}</p>}
          <p className="mt-4 text-sm" style={{ color: "var(--ink-2)" }}>
            We&apos;d love to celebrate with you. Please let us know if you can make it.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(28,25,23,0.06)]">
          <RsvpForm slug={wedding.slug} />
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--sage)" }}>
          Powered by Venuely
        </p>
      </div>
    </main>
  );
}
