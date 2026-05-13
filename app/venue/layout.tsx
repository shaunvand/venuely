import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { LogoMark } from "@/components/Logo";

export default async function VenueLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["venue_admin", "owner"]);
  return (
    <div className="min-h-screen flex bg-[color:var(--bone)]">
      <aside className="vy-sidebar w-64 p-5 flex flex-col">
        <Link href="/venue" className="flex items-center gap-2 mb-1 text-stone-900">
          <LogoMark size={28} className="text-[color:var(--forest)]" />
          <span className="font-serif text-xl">Venuely</span>
        </Link>
        <div className="vy-eyebrow mb-5">Venue admin</div>
        <nav className="flex flex-col flex-1">
          <Link href="/venue" className="vy-side-link">Overview</Link>
          <Link href="/venue/weddings" className="vy-side-link">Weddings</Link>
          <div className="vy-side-section">Marketplace</div>
          <Link href="/venue/catalogue" className="vy-side-link">Catalogue</Link>
          <Link href="/venue/rentals" className="vy-side-link">Rentals</Link>
          <Link href="/venue/accommodation" className="vy-side-link">Accommodation</Link>
          <div className="vy-side-section">Partner vendors</div>
          <Link href="/venue/marketplace/caterers" className="vy-side-link">Caterers</Link>
          <Link href="/venue/marketplace/planners" className="vy-side-link">Planners</Link>
          <Link href="/venue/marketplace/florists" className="vy-side-link">Florists</Link>
          <Link href="/venue/marketplace/djs" className="vy-side-link">DJs</Link>
          <Link href="/venue/marketplace/photographers" className="vy-side-link">Photographers</Link>
          <Link href="/venue/marketplace/decor" className="vy-side-link">Decor</Link>
          <Link href="/venue/marketplace/bar" className="vy-side-link">Bar services</Link>
          <div className="vy-side-section">Money</div>
          <Link href="/venue/payments" className="vy-side-link">Payments</Link>
          <div className="vy-side-section">Setup</div>
          <Link href="/venue/settings" className="vy-side-link">Settings</Link>
        </nav>
        <form action="/auth/signout" method="post" className="pt-4 border-t border-[color:var(--line)] mt-4">
          <button className="vy-btn vy-btn-ghost w-full justify-start">Sign out</button>
        </form>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
