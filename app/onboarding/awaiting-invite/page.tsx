import Link from "next/link";

export default function AwaitingInvite() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
      <div className="max-w-md text-center space-y-4">
        <h1 className="font-serif text-3xl">You&apos;re signed in</h1>
        <p className="text-stone-600">
          You don&apos;t have a wedding portal linked to your account yet.
          Your venue will send you an invitation by email — once you accept it, your portal will appear here.
        </p>
        <p className="text-sm text-stone-500">
          If you think this is a mistake, contact your venue.
        </p>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-stone-500 hover:underline mt-6">Sign out</button>
        </form>
        <p className="text-xs text-stone-400">
          <Link href="/" className="hover:underline">Back to venuely.co.za</Link>
        </p>
      </div>
    </main>
  );
}
