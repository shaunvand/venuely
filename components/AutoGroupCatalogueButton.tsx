"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLoading } from "@/components/LoadingProvider";
import { autoCategoriseCatalogue } from "@/app/venue/catalogue/actions";

// Client wrapper for the AI course-grouping action so the user gets a loading
// screen while Claude classifies the menu and a "done" confirmation when it
// finishes — a bare <form action> server-action submit gave no feedback (the work
// takes ~10s), so it looked like nothing happened.
export function AutoGroupCatalogueButton({ venueId }: { venueId: string }) {
  const router = useRouter();
  const loading = useLoading();
  const [pending, startTransition] = useTransition();

  function run() {
    if (pending) return;
    loading.show("Grouping your menu by course…", {
      messages: ["Reading your menu…", "Sorting into Breakfast, Lunch, Dinner…", "Grouping drinks & canapés…"],
    });
    startTransition(async () => {
      try {
        const res = await autoCategoriseCatalogue(venueId);
        if (res?.ok) {
          loading.complete(res.grouped ? `Done — grouped ${res.grouped} item${res.grouped === 1 ? "" : "s"} by course ✓` : "Nothing to group yet");
          router.refresh();
        } else {
          loading.hide();
          alert(res?.error || "Couldn't group the menu — please try again.");
        }
      } catch (e) {
        loading.hide();
        alert(e instanceof Error ? e.message : "Couldn't group the menu — please try again.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="vy-btn vy-btn-secondary text-sm"
      title="Use AI to group menu items into Breakfast / Lunch / Dinner / Drinks for the couple portal"
    >
      {pending ? "Grouping…" : "✨ Auto-group by course (AI)"}
    </button>
  );
}
