import { requireRole } from "@/lib/auth/require-role";
import { VenueSidebar } from "@/components/VenueSidebar";

export default async function VenueLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["venue_admin", "owner"]);
  return (
    <div className="min-h-screen flex bg-[color:var(--bone)]">
      <VenueSidebar />
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
