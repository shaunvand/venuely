import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { LogoMark } from "@/components/Logo";
import { VenueSidebarNav } from "@/components/VenueSidebarNav";

export default async function VenueLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["venue_admin", "owner"]);
  return (
    <div className="min-h-screen flex bg-[color:var(--bone)]">
      <aside className="vy-sidebar w-64 p-5 flex flex-col">
        <Link href="/venue" className="flex items-center gap-2.5 mb-1.5">
          <LogoMark size={44} />
          <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--poppy)", fontFamily: "'Fraunces', Georgia, serif" }}>Venuely.</span>
        </Link>
        <div className="mb-5 text-sm italic text-[color:var(--ink-2)]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>Every wedding, beautifully handled.</div>
        <VenueSidebarNav />
        <form action="/auth/signout" method="post" className="pt-4 border-t border-[color:var(--line)] mt-4">
          <button className="vy-btn vy-btn-ghost w-full justify-start">Sign out</button>
        </form>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
