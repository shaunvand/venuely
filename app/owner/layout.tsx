import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["owner"]);
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r p-4 flex flex-col">
        <h2 className="font-semibold mb-4">Venuely — Owner</h2>
        <nav className="flex flex-col gap-1 text-sm flex-1">
          <Link href="/owner" className="hover:underline">Dashboard</Link>
          <Link href="/owner/venues" className="hover:underline">Venues</Link>
          <Link href="/owner/billing" className="hover:underline">Billing</Link>
        </nav>
        <form action="/auth/signout" method="post">
          <button className="text-xs text-gray-500 hover:underline">Sign out</button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
