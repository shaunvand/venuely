import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";

export default async function VenueLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["venue_admin", "owner"]);
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r p-4 flex flex-col">
        <h2 className="font-semibold mb-4">Venue Admin</h2>
        <nav className="flex flex-col gap-1 text-sm flex-1">
          <Link href="/venue" className="hover:underline">Overview</Link>
          <Link href="/venue/weddings" className="hover:underline">Weddings</Link>
          <Link href="/venue/catalogue" className="hover:underline">Catalogue</Link>
          <Link href="/venue/rentals" className="hover:underline">Rentals</Link>
          <Link href="/venue/accommodation" className="hover:underline">Accommodation</Link>
          <Link href="/venue/payments" className="hover:underline">Payments</Link>
          <Link href="/venue/settings" className="hover:underline">Settings</Link>
        </nav>
        <form action="/auth/signout" method="post">
          <button className="text-xs text-gray-500 hover:underline">Sign out</button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
