import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { LogoMark } from "@/components/Logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["owner"]);
  return (
    <div className="min-h-screen flex bg-[color:var(--bone)]">
      <aside className="vy-sidebar w-64 p-5 flex flex-col">
        <Link href="/admin" className="flex items-center gap-2 mb-1 text-stone-900">
          <LogoMark size={28} className="text-[color:var(--forest)]" />
          <span className="font-serif text-xl">Venuely</span>
        </Link>
        <div className="vy-eyebrow mb-5">Site admin</div>
        <nav className="flex flex-col flex-1">
          <Link href="/admin" className="vy-side-link">Dashboard</Link>
          <Link href="/admin/venues" className="vy-side-link">Venues</Link>
          <Link href="/admin/billing" className="vy-side-link">Billing</Link>
          <div className="vy-side-section">Switch context</div>
          <Link href="/venue" className="vy-side-link">Venue admin →</Link>
          <Link href="/dashboard" className="vy-side-link">Portals</Link>
        </nav>
        <form action="/auth/signout" method="post" className="pt-4 border-t border-[color:var(--line)] mt-4">
          <button className="vy-btn vy-btn-ghost w-full justify-start">Sign out</button>
        </form>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
