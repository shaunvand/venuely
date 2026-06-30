"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Force a fresh server render of the current route whenever this mounts. Next's
// client router/prefetch cache can serve a stale copy of a dynamic page after a
// mutation on another tab (e.g. saving a table → the Inventory hub still shows the
// old count); router.refresh() bypasses that cache so the page reflects the latest
// data on every visit. Use on lightweight aggregate pages where freshness > a brief
// reconcile.
export function RefreshOnMount() {
  const router = useRouter();
  useEffect(() => { router.refresh(); }, [router]);
  return null;
}
