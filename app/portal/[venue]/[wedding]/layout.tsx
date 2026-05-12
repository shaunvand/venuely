import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venue: string; wedding: string }>;
}) {
  await requireRole(["couple", "venue_admin", "owner"]);
  const { venue: venueSlug, wedding: weddingSlug } = await params;
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, branding_primary")
    .eq("slug", venueSlug)
    .single();

  if (!venue) notFound();

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, couple_names, wedding_date")
    .eq("venue_id", venue.id)
    .eq("slug", weddingSlug)
    .single();

  if (!wedding) notFound();

  const base = `/portal/${venueSlug}/${weddingSlug}`;
  const tabs = [
    ["Dashboard", ""],
    ["Our Venue", "/venue"],
    ["Guest List", "/guests"],
    ["Accommodation", "/accommodation"],
    ["Suppliers", "/suppliers"],
    ["Catalogue", "/catalogue"],
    ["Rentals", "/rentals"],
    ["Budget", "/budget"],
    ["Checklist", "/checklist"],
    ["Day Timeline", "/timeline"],
  ] as const;

  return (
    <div className="min-h-screen">
      <header
        className="px-6 py-4 text-white"
        style={{ background: venue.branding_primary || "#0a4a3a" }}
      >
        <div className="text-sm opacity-80">{venue.name}</div>
        <div className="text-xl font-semibold">{wedding.couple_names}</div>
      </header>
      <nav className="border-b bg-white">
        <ul className="flex flex-wrap gap-1 px-4 text-sm">
          {tabs.map(([label, path]) => (
            <li key={label}>
              <Link
                href={`${base}${path}`}
                className="block px-3 py-3 hover:bg-gray-50"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
