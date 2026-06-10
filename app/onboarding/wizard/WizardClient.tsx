"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SetupVenueForm } from "@/components/SetupVenueForm";
import type { SetupVenueState } from "@/app/onboarding/setup-venue/actions";
import { BulkUploader, type BulkUploaderHandle } from "@/components/BulkUploader";
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

/* ── Smart Import explainer ──────────────────────────────────────────────
   A simple "your files → Smart Import → sorted into your dashboard" diagram
   so owners understand what to upload and where it lands before they drop
   anything in. Module-scope helpers (not nested components). */
const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function FileGlyph({ kind }: { kind: "pdf" | "sheet" | "doc" }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path d="M6 2h8l4 4v16H6z" {...ICON} />
      <path d="M14 2v4h4" {...ICON} />
      {kind === "sheet" && <path d="M8 13h8M8 17h8M12 11v8" {...ICON} />}
      {kind === "pdf" && <path d="M8 14h8M8 18h5" {...ICON} />}
      {kind === "doc" && <path d="M8 12h8M8 15h8M8 18h5" {...ICON} />}
    </svg>
  );
}

function DestGlyph({ name }: { name: "menu" | "box" | "bed" | "people" }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      {name === "menu" && <><path d="M5 3v7a2 2 0 002 2v9M5 3v4M9 3v4M7 3v4M16 3c-1.5 0-2 2-2 5s.5 4 2 4v9" {...ICON} /></>}
      {name === "box" && <><rect x="3" y="4" width="18" height="4" rx="1" {...ICON} /><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4" {...ICON} /></>}
      {name === "bed" && <path d="M3 18v-7a2 2 0 012-2h9a4 4 0 014 4v5M3 14h18M3 18v2M21 13v7" {...ICON} />}
      {name === "people" && <><circle cx="9" cy="8" r="3" {...ICON} /><path d="M3.5 20c0-3 2.5-5.5 5.5-5.5S14.5 17 14.5 20" {...ICON} /><path d="M16 5.5a3 3 0 010 5.8M20.5 20c0-2.4-1.4-4.5-3.5-5.3" {...ICON} /></>}
    </svg>
  );
}

const IMPORT_DOCS = [
  { kind: "pdf" as const, label: "Quote / brochure PDF" },
  { kind: "sheet" as const, label: "Stock & rentals sheet" },
  { kind: "sheet" as const, label: "Rooming spreadsheet" },
  { kind: "doc" as const, label: "Supplier directory" },
];

const IMPORT_DESTS = [
  { name: "menu" as const, label: "Catalogue", sub: "Menus, sorted by course & category" },
  { name: "box" as const, label: "Rentals", sub: "Included vs paid extras + pricing" },
  { name: "bed" as const, label: "Accommodation", sub: "Rooms allocated with sleeps & rate" },
  { name: "people" as const, label: "Suppliers", sub: "Partner vendors grouped by type" },
];

function ImportExplainer({ onSmartImport }: { onSmartImport?: () => void }) {
  return (
    <div className="mb-6 rounded-2xl p-4 sm:p-5" style={{ border: "1px solid var(--line)", background: "var(--cream)" }}>
      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1.25fr]">
        {/* Your documents */}
        <div>
          <div className="vy-eyebrow mb-2">1 · Your documents</div>
          <div className="grid grid-cols-2 gap-2">
            {IMPORT_DOCS.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={onSmartImport}
                className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-xs shadow-sm text-left hover-lift cursor-pointer"
                style={{ border: "1px solid var(--line)" }}
              >
                <span className="flex-shrink-0" style={{ color: "var(--ink-2)" }}><FileGlyph kind={d.kind} /></span>
                <span className="leading-tight">{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Smart Import — the whole pill is the upload trigger */}
        <div className="flex flex-col items-center justify-center gap-2 py-1">
          <button
            type="button"
            onClick={onSmartImport}
            title="Choose files or a folder to import"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-sm cursor-pointer transition hover:brightness-105 active:scale-95"
            style={{ background: "var(--poppy)", boxShadow: "0 8px 20px -10px var(--poppy)" }}
          >
            ✨ Smart Import
          </button>
          <svg viewBox="0 0 40 24" className="w-10 h-6 rotate-90 lg:rotate-0" aria-hidden style={{ color: "var(--poppy)" }}>
            <path d="M4 12h28M26 6l8 6-8 6" {...ICON} />
          </svg>
          <span className="text-[10px] text-center leading-tight" style={{ color: "var(--ink-2)" }}>click to choose<br />files or a folder</span>
        </div>

        {/* Sorted into your dashboard */}
        <div>
          <div className="vy-eyebrow mb-2">2 · Sorted into your dashboard</div>
          <div className="grid grid-cols-2 gap-2">
            {IMPORT_DESTS.map((d) => (
              <div key={d.label} className="rounded-xl bg-white px-3 py-2.5 shadow-sm" style={{ border: "1px solid var(--line)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--peach)", color: "var(--poppy-deep)" }}><DestGlyph name={d.name} /></span>
                  <span className="text-sm font-medium">{d.label}</span>
                </div>
                <div className="mt-1 text-[11px] leading-snug" style={{ color: "var(--ink-2)" }}>{d.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--ink-2)" }}>
        Smart Import reads each file, then files every item into the right place — it even allocates your accommodation rooms and sorts menu items into categories automatically. You review and edit everything on the right before it saves to your dashboard.
      </p>
    </div>
  );
}

export function WizardClient({
  initialStep,
  venue,
  mapsKey,
  setupAction,
  setup,
  previewHref,
  justCreated = false,
}: {
  initialStep: number;
  venue: WizardVenue | null;
  mapsKey: string | null;
  setupAction: (prevState: SetupVenueState, formData: FormData) => Promise<SetupVenueState>;
  setup: WizardSetup | null;
  previewHref: string | null;
  justCreated?: boolean;
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
          {venue ? (
            <Link href="/venue" className="text-sm hover:underline whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
              Save &amp; finish later →
            </Link>
          ) : (
            // No venue yet → /venue would just bounce them back here; don't offer it.
            <span className="text-sm whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
              Finish step 1 to unlock your dashboard
            </span>
          )}
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

          {/* Step content — key on the step so each change remounts and replays the
              entrance animation. */}
          <section key={step} className="min-w-0 anim-rise">
            {step === 1 && (
              <StepBasics venue={venue} mapsKey={mapsKey} setupAction={setupAction} justCreated={justCreated} onContinue={() => setStep(2)} />
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

function VenueSetupToast({ venueName }: { venueName: string }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ background: "rgba(28,25,23,0.35)" }}>
      <div className="anim-pop bg-white rounded-2xl shadow-xl px-8 py-7 text-center max-w-sm w-full" style={{ border: "1px solid var(--line)" }}>
        <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ background: "var(--leaf)", color: "#1f5d3e" }}>✓</div>
        <h2 className="vy-h2 mt-4">Your venue is set up</h2>
        <p className="text-sm mt-1.5" style={{ color: "var(--ink-2)" }}>{venueName} is ready — taking you to Smart Import…</p>
      </div>
    </div>
  );
}

function StepBasics({
  venue,
  mapsKey,
  setupAction,
  justCreated,
  onContinue,
}: {
  venue: WizardVenue | null;
  mapsKey: string | null;
  setupAction: (prevState: SetupVenueState, formData: FormData) => Promise<SetupVenueState>;
  justCreated: boolean;
  onContinue: () => void;
}) {
  // Just created → flash a 2-second confirmation, then auto-advance to Import.
  useEffect(() => {
    if (venue && justCreated) {
      const t = setTimeout(onContinue, 2000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue, justCreated]);

  // Venue already created — show a done summary and let them continue.
  if (venue) {
    return (
      <StepShell
        eyebrow="Step 1 of 4 · Basics"
        title="Your venue is set up"
        intro="The essentials are saved. You can edit name, address, branding and your story any time from venue settings."
      >
        {justCreated && <VenueSetupToast venueName={venue.name} />}
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

  // No venue yet — embed the existing setup form. On a successful create the setupVenue
  // server action redirects back here to /onboarding/wizard?step=1&created=1, where the
  // ?created=1 flag flashes a confirmation and auto-advances into Step 2 (Import).
  // Expected failures come back as { error } and render inline in the form.
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
  const uploaderRef = useRef<BulkUploaderHandle>(null);
  const [up, setUp] = useState({ processing: false, imported: false, hasItems: false, includedCount: 0, isImporting: false });

  // Once an import lands, automatically move on to Your spaces (after a beat so the
  // success state is visible) — no manual "Continue" click needed.
  useEffect(() => {
    if (up.imported) {
      const t = setTimeout(onContinue, 1600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [up.imported]);

  const working = up.processing || up.imported;

  return (
    <StepShell
      eyebrow="Step 2 of 4 · Import"
      title="Import what you already have"
      intro="Drop in the files you already send couples — quote PDFs, stock lists, brochures, rooming spreadsheets, supplier directories. Smart Import reads them and pre-fills your catalogue, rentals, accommodation and partner vendors. You review everything before it saves."
    >
      <ImportExplainer onSmartImport={() => uploaderRef.current?.openFilePicker()} />
      {importDone && !up.processing && !up.imported && (
        <div className="mb-4 rounded-xl p-3 flex items-center gap-3 text-sm" style={{ background: "var(--leaf)", color: "#1f5d3e", border: "1px solid var(--line)" }}>
          <span>✓</span> You&apos;ve already imported inventory. Add more files below, or continue.
        </div>
      )}
      {venue ? (
        <BulkUploader ref={uploaderRef} venueId={venue.id} onStateChange={setUp} />
      ) : (
        <div className="vy-empty text-sm">Create your venue first (Step 1) to import inventory.</div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="vy-btn vy-btn-ghost">← Back</button>
        {working ? (
          <span className="inline-flex items-center gap-2.5 text-sm" style={{ color: "var(--ink-2)" }}>
            <span className="inline-block w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "var(--peach)", borderTopColor: "var(--poppy)" }} />
            {up.imported ? "Imported — opening Your spaces…" : "Setting up your dashboard…"}
          </span>
        ) : (
          <button type="button" onClick={onContinue} className="text-sm hover:underline" style={{ color: "var(--ink-2)" }}>
            Skip for now → Your spaces
          </button>
        )}
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
          {/* welcome=1 plays the logo opener once on first dashboard arrival */}
          <Link href="/venue?welcome=1" className="vy-btn vy-btn-primary">Go to my dashboard →</Link>
        </div>
      </div>
    </StepShell>
  );
}
