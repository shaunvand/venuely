import { requireRole } from "@/lib/auth/require-role";
import { VenueSidebar } from "@/components/VenueSidebar";
import { WelcomeCover } from "@/components/WelcomeCover";
import { VenueTour } from "@/components/VenueTour";

export default async function VenueLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["venue_admin", "owner"]);
  return (
    <div className="min-h-screen flex bg-[color:var(--bone)]">
      {/* Covers the dashboard skeleton on the post-onboarding ?welcome=1 arrival,
          so only the icon animation shows before the dashboard. */}
      <WelcomeCover />
      {/* Spotlight guided tour — starts after the first-run welcome, replayable
          from the sidebar "Take a tour" button. */}
      <VenueTour />
      <VenueSidebar />
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
