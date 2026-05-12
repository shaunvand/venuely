import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { promoteToOwner } from "./actions";

export default async function BecomeOwnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/onboarding/become-owner");

  const { count: ownerCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "owner");

  if (ownerCount && ownerCount > 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold">Already claimed</h1>
          <p className="text-gray-600">An owner already exists for this Venuely instance.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={promoteToOwner} className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Claim owner account</h1>
        <p className="text-gray-600 text-sm">
          No owner exists yet on this Venuely instance. Click below to promote
          <span className="font-mono"> {user.email}</span> to the owner role.
        </p>
        <button className="px-4 py-2 bg-black text-white rounded">Make me the owner</button>
      </form>
    </main>
  );
}
