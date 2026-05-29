"use client";

import { useState } from "react";
import Link from "next/link";
import { SetupVenueForm } from "@/components/SetupVenueForm";
import { BulkUploader } from "@/components/BulkUploader";
import { LogoMark } from "@/components/Logo";

type WizardVenue = { id: string; slug: string; name: string };

type SetupStepLite = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  count?: number | null;
  hint?: string;
};

type WizardSetup = {
  steps: SetupStepLite[];
  doneCount: number;
  totalCount: number;
  pct: number;
  hasImported: boolean;
  areasCount: number;
  weddingsCount: number;
};

const STEPS = [
  { n: 1, label: "Basics", blurb: "Name & address" },
  { n: 2, label: "Import", blurb: "Smart Import" },
  { n: 3, label: "Your spaces", blurb: "Areas & rooms" },
  { n: 4, label: "Review & go live", blurb: "Final check" },
] as const;

export function WizardClient({
  initialStep,
  venue,
  mapsKey,
  setupAction,
  setup,
  previewHref,
}: {
  initialStep: number;
  venue: WizardVenue | null;
  mapsKey: string | null;
  setupAction: (formData: FormData) => void;
  setup: WizardSetup | null;
  previewHref: string | null;
}) {
  const [step, setStep] = useState<number>(initialStep);

  // Step 1 is only actionable when there's no venue yet; once a venue exists it's done.
  const basicsDone = !!venue;
  const importDone = !!setup?.hasImported;
  const spacesDone = (setup?.areasCount ?? 0) > 0;

  function stepStatus(n: number): "done" | "active" | "upcoming" {
    if (n === step) return "active";
    if (n === 1 && basicsDone) return "done";
    if (n === 2 && importDone) return "done";
    if (n === 3 && spacesDone) return "done";
    if (n < step) return "done";
    return "upcoming";
  }

  // Can't leave step 1 until the venue exists (later steps all need a venue_id).
  const canNavigate = (n: number) => n === 1 || basicsDone;

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:py-12">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <LogoMark size={40} />
            <div>
              <span className="font-serif text-xl" style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}>
                Venuely.
              </span>
              <div className="text-xs" style={{ color: "var(--ink-2)" }}>
                {venue ? `Setting up ${venue.name}` : "Let's set up your venue"}
              </div>
            </div>
          </div>
          <Link href="/venue" className="text-sm hover:underline whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
            Save &amp; finish later →
          </Link>
        </header>

        <div className="grid lg:grid-cols-[220px_1fr] gap-8">
          {/* Left-rail progress */}
          <nav aria-label="Onboarding steps" className="lg:sticky lg:top-8 self-start">
            {/* Mobile: horizontal stepper */}
            <ol className="flex lg:hidden items-center gap-2 mb-2 overflow-x-auto">
              {STEPS.map((s) => {
                const st = stepStatus(s.n);
                return (
                  <li key={s.n} className="flex-1 min-w-0">
                    <button
                      type="button"
                      disabled={!canNavigate(s.n)}
                      onClick={() => canNavigate(s.n) && setStep(s.n)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-full text-xs font-medium whitespace-nowrap disabled:opacity-40"
                      style={{
                        background: st === "done" ? "var(--leaf)" : st === "active" ? "var(--peach)" : "var(--bone)",
                        color: st === "done" ? "#1f5d3e" : st === "active" ? "var(--poppy-deep)" : "var(--ink-2)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ background: "rgba(255,255,255,0.7)" }}>
                        {st === "done" ? "✓" : s.n}
                      </span>
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Desktop: vertical rail */}
            <ol className="hidden lg:block space-y-1">
              {STEPS.map((s, i) => {
                const st = stepStatus(s.n);
                return (
                  <li key={s.n}>
                    <button
                      type="button"
                      disabled={!canNavigate(s.n)}
                      onClick={() => canNavigate(s.n) && setStep(s.n)}
                      className="w-full text-left flex items-start gap-3 rounded-xl px-3 py-3 transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white"
                      style={st === "active" ? { background: "#fff", border: "1px solid var(--line)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" } : { border: "1px solid transparent" }}
                    >
                      <span
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5"
                        style={{
                          background: st === "done" ? "var(--poppy)" : st === "active" ? "var(--peach)" : "var(--bone)",
                          color: st === "done" ? "#fff" : st === "active" ? "var(--poppy-deep)" : "var(--ink-2)",
                        }}
                      >
                        {st === "done" ? "✓" : s.n}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium" style={{ color: st === "upcoming" ? "var(--ink-2)" : "var(--ink)" }}>
                          {s.label}
                        </span>
                        <span className="block text-xs" style={{ color: "var(--ink-2)" }}>{s.blurb}</span>
                      </span>
                    </button>
                    {i < STEPS.length - 1 && <div className="ml-[26px] h-3 w-px" style={{ background: "var(--line)" }} aria-hidden />}
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Step content */}
          <section className="min-w-0">
            {step === 1 && (
              <StepBasics venue={venue} mapsKey={mapsKey} setupAction={setupAction} onContinue={() => setStep(2)} />
            )}
            {step === 2 && (
              <StepImport venue={venue} importDone={importDone} onBack={() => setStep(1)} onContinue={() => setStep(3)} />
            )}
            {step === 3 && (
              <StepSpaces spacesDone={spacesDone} areasCount={setup?.areasCount ?? 0} onBack={() => setStep(2)} onContinue={() => setStep(4)} />
            )}
            {step === 4 && (
              <StepReview setup={setup} previewHref={previewHref} onBack={() => setStep(3)} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function StepShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="vy-card">
      <div className="mb-5">
        <div className="vy-eyebrow">{eyebrow}</div>
        <h1 className="vy-h1 mt-1">{title}</h1>
        <p className="text-stone-600 text-sm mt-2 max-w-2xl">{intro}</p>
      </div>
      {children}
    </div>
  );
}

function StepBasics({
  venue,
  mapsKey,
  setupAction,
  onContinue,
}: {
  venue: WizardVenue | null;
  mapsKey: string | null;
  setupAction: (formData: FormData) => void;
  onContinue: () => void;
}) {
  // Venue already created — show a done summary and let them continue.
  if (venue) {
    return (
      <StepShell
        eyebrow="Step 1 of 4 · Basics"
        title="Your venue is set up"
        intro="The essentials are saved. You can edit name, address, branding and your story any time from venue settings."
      >
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "var(--leaf)", border: "1px solid var(--line)" }}>
          <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.7)", color: "#1f5d3e" }}>✓</span>
          <div className="text-sm">
            <div className="font-medium">{venue.name}</div>
            <div style={{ color: "var(--ink-2)" }}>venuely.co.za/portal/{venue.slug}</div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onContinue} className="vy-btn vy-btn-primary">Continue → Import</button>
          <Link href="/venue/settings" className="vy-btn vy-btn-ghost">Edit venue details</Link>
        </div>
      </StepShell>
    );
  }

  // No venue yet — embed the existing setup form. On a successful create it runs the
  // setupVenue server action which redirects to /venue (its only supported behaviour);
  // from the dashboard the user is deep-linked back into the wizard to keep importing.
  return (
    <StepShell
      eyebrow="Step 1 of 4 · Basics"
      title="Set up your venue"
      intro="Just the essentials — name, address and how couples reach you. Already have a website? Paste it in below and Smart Import will pre-fill what it can."
    >
      <SetupVenueForm action={setupAction} mapsKey={mapsKey} />
      <p className="text-xs text-stone-500 -mt-6">
        After we create your venue you&apos;ll move on to importing your catalogue, rentals and accommodation.
      </p>
    </StepShell>
  );
}

function StepImport({
  venue,
  importDone,
  onBack,
  onContinue,
}: {
  venue: WizardVenue | null;
  importDone: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <StepShell
      eyebrow="Step 2 of 4 · Import"
      title="Import what you already have"
      intro="Drop in the files you already send couples — quote PDFs, stock lists, brochures, rooming spreadsheets, supplier directories. Smart Import reads them and pre-fills your catalogue, rentals, accommodation and partner vendors. You review everything before it saves."
    >
      {importDone && (
        <div className="mb-4 rounded-xl p-3 flex items-center gap-3 text-sm" style={{ background: "var(--leaf)", color: "#1f5d3e", border: "1px solid var(--line)" }}>
          <span>✓</span> You&apos;ve already imported inventory. Add more files below, or continue.
        </div>
      )}
      {venue ? (
        <BulkUploader venueId={venue.id} />
      ) : (
        <div className="vy-empty text-sm">Create your venue first (Step 1) to import inventory.</div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="vy-btn vy-btn-ghost">← Back</button>
        <button type="button" onClick={onContinue} className="vy-btn vy-btn-primary">
          {importDone ? "Continue → Your spaces" : "Skip for now → Your spaces"}
        </button>
      </div>
    </StepShell>
  );
}

function StepSpaces({
  spacesDone,
  areasCount,
  onBack,
  onContinue,
}: {
  spacesDone: boolean;
  areasCount: number;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <StepShell
      eyebrow="Step 3 of 4 · Your spaces"
      title="Add the spaces couples can use"
      intro="The main areas of your venue — ceremony lawn, reception hall, gardens — plus any optional extras. Each space is priced per day type (Meet & Greet / Wedding / Farewell) so couples see accurate totals."
    >
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ border: "1px solid var(--line)", background: spacesDone ? "var(--leaf)" : "var(--cream)" }}>
        <span className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.7)", color: spacesDone ? "#1f5d3e" : "var(--poppy-deep)" }}>
          {spacesDone ? "✓" : "📍"}
        </span>
        <div className="text-sm flex-1">
          {spacesDone ? (
            <>
              <div className="font-medium">{areasCount} space{areasCount === 1 ? "" : "s"} added</div>
              <div style={{ color: "var(--ink-2)" }}>Manage pricing and add more from the areas page.</div>
            </>
          ) : (
            <>
              <div className="font-medium">No spaces yet</div>
              <div style={{ color: "var(--ink-2)" }}>Add at least your main ceremony and reception areas so couples can build their day.</div>
            </>
          )}
        </div>
        <Link href="/venue/areas" className="vy-btn vy-btn-secondary whitespace-nowrap">
          {spacesDone ? "Manage spaces" : "Add spaces"}
        </Link>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="vy-btn vy-btn-ghost">← Back</button>
        <button type="button" onClick={onContinue} className="vy-btn vy-btn-primary">Continue → Review</button>
      </div>
    </StepShell>
  );
}

function StepReview({
  setup,
  previewHref,
  onBack,
}: {
  setup: WizardSetup | null;
  previewHref: string | null;
  onBack: () => void;
}) {
  const steps = setup?.steps ?? [];
  const pct = setup?.pct ?? 0;
  const doneCount = setup?.doneCount ?? 0;
  const totalCount = setup?.totalCount ?? 0;

  return (
    <StepShell
      eyebrow="Step 4 of 4 · Review & go live"
      title="You're ready to go"
      intro="Here's where your setup stands. You can finish the rest any time from your dashboard — nothing here blocks you from going live."
    >
      <section className="vy-card-hero mb-5">
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

      <ol className="space-y-2 mb-6">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ border: "1px solid var(--line)", background: s.done ? "var(--cream)" : "#fff" }}>
            <span
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: s.done ? "var(--poppy)" : "var(--bone)", color: s.done ? "#fff" : "var(--ink-2)" }}
            >
              {s.done ? "✓" : "·"}
            </span>
            <span className="flex-1 min-w-0 text-sm">
              <span className="font-medium">{s.title}</span>
              {typeof s.count === "number" && s.count > 0 && (
                <span className="ml-2 vy-tag vy-tag-soft">{s.count}</span>
              )}
            </span>
            {!s.done && (
              <Link href={s.href} className="text-xs hover:underline whitespace-nowrap" style={{ color: "var(--poppy)" }}>
                {s.cta} →
              </Link>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="vy-btn vy-btn-ghost">← Back</button>
        <div className="flex flex-wrap items-center gap-3">
          {previewHref && (
            <Link href={previewHref} className="vy-btn vy-btn-secondary">Preview what couples see ↗</Link>
          )}
          <Link href="/venue" className="vy-btn vy-btn-primary">Go to my dashboard →</Link>
        </div>
      </div>
    </StepShell>
  );
}
