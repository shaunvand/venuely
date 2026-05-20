import Link from "next/link";
import { getCurrentVenue } from "@/lib/venue/current";
import { createClient } from "@/lib/supabase/server";
import { computeSetupSteps } from "@/lib/venue/setup";

export default async function VenueSetup() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { steps, doneCount, totalCount, pct } = await computeSetupSteps(supabase, venue);

  return (
    <div className="space-y-10">
      <header>
        <div className="vy-eyebrow">Onboarding</div>
        <h1 className="vy-h1 mt-1">Setup checklist</h1>
        <p className="text-stone-600 text-sm mt-1">
          Work through these to get your venue ready for couples. You can always come back from the Overview link.
        </p>
      </header>

      <section className="vy-card-hero">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="vy-eyebrow">Setup progress</div>
            <h2 className="vy-h2 mt-1">{doneCount} of {totalCount} steps complete</h2>
          </div>
          <div className="font-serif text-4xl tabular-nums" style={{ color: "var(--poppy)" }}>{pct}%</div>
        </div>
        <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--poppy)" }} />
        </div>
      </section>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.key} className={`vy-card flex gap-4 ${s.done ? "border-[color:var(--sage)]/40 bg-[color:var(--cream)]/40" : ""}`}>
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-medium text-sm ${s.done ? "text-white" : "bg-stone-100 text-stone-500"}`} style={s.done ? { background: "var(--poppy)" } : {}}>
              {s.done ? "✓" : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="font-semibold text-[15px]">{s.title}</h3>
                {typeof s.count === "number" && (
                  <span className="vy-tag vy-tag-soft">{s.count} item{s.count === 1 ? "" : "s"}</span>
                )}
              </div>
              <p className="text-sm text-stone-600 mt-1">{s.description}</p>
              {s.hint && <p className="text-xs text-stone-500 mt-1 italic">{s.hint}</p>}
            </div>
            <div className="flex-shrink-0 flex items-center">
              <Link href={s.href} className={`vy-btn ${s.done ? "vy-btn-secondary" : "vy-btn-primary"} whitespace-nowrap`}>
                {s.cta}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
