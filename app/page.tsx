import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/Reveal";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token_hash?: string; type?: string }>;
}) {
  const sp = await searchParams;
  if (sp.code || sp.token_hash) {
    const qs = new URLSearchParams();
    if (sp.code) qs.set("code", sp.code);
    if (sp.token_hash) qs.set("token_hash", sp.token_hash);
    if (sp.type) qs.set("type", sp.type);
    redirect(`/auth/callback?${qs.toString()}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      <Nav signedIn={!!user} />
      <Hero />
      <Logos />
      <Features />
      <ForCouples />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}

/* ── Decorative primitives ──────────────────────────────────────────── */

function DotGrid({ className = "", color = "var(--peach)" }: { className?: string; color?: string }) {
  return (
    <svg className={className} width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden>
      {Array.from({ length: 8 }).map((_, r) =>
        Array.from({ length: 8 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={6 + c * 16} cy={6 + r * 16} r="2.5" fill={color} />
        ))
      )}
    </svg>
  );
}

function Leaf({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="160" height="200" viewBox="0 0 160 200" fill="none" aria-hidden>
      <path d="M80 195 C80 140 80 70 80 10" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" />
      {Array.from({ length: 7 }).map((_, i) => {
        const y = 30 + i * 22;
        return (
          <g key={i} stroke="var(--sage)" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d={`M80 ${y} C60 ${y - 14} 40 ${y - 10} 30 ${y + 4} C48 ${y + 12} 66 ${y + 8} 80 ${y}`} />
            <path d={`M80 ${y} C100 ${y - 14} 120 ${y - 10} 130 ${y + 4} C112 ${y + 12} 94 ${y + 8} 80 ${y}`} />
          </g>
        );
      })}
    </svg>
  );
}

function Blob({ className = "", color }: { className?: string; color: string }) {
  return <div aria-hidden className={`absolute rounded-full ${className}`} style={{ background: color }} />;
}

/* ── Navigation ─────────────────────────────────────────────────────── */

function Nav({ signedIn }: { signedIn: boolean }) {
  const links = [
    { label: "Features", href: "#features", caret: true },
    { label: "Solutions", href: "#for-couples", caret: true },
    { label: "Pricing", href: "#pricing", caret: false },
    { label: "Resources", href: "#faq", caret: true },
    { label: "About", href: "#footer", caret: false },
  ];
  return (
    <header className="sticky top-0 z-30 backdrop-blur-sm" style={{ background: "rgba(255,246,240,0.85)" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="font-serif text-2xl"
          style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}
        >
          Venuely.
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm" style={{ color: "var(--ink)" }}>
          {links.map((l) => (
            <a key={l.label} href={l.href} className="flex items-center gap-1 hover:opacity-60 transition-opacity">
              {l.label}
              {l.caret && <span className="text-[9px] opacity-50">▼</span>}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/login" className="hover:opacity-60 transition-opacity">
            {signedIn ? "Dashboard" : "Log in"}
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-lg font-medium text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{ background: "var(--poppy)" }}
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────── */

function Hero() {
  const cards = [
    { icon: "🛏", label: "Guest Accommodation", value: "18", sub: "rooms booked", ring: "72%" },
    { icon: "📅", label: "Weekend Overview", value: "12 – 14 Dec 2025", sub: "", chart: true },
    { icon: "🪑", label: "Décor & Rentals", value: "47", sub: "items reserved" },
    { icon: "🧾", label: "Budget Tracker", value: "R145,000", sub: "of R210,000 spent", ring: "69%" },
    { icon: "💳", label: "Payments Collected", value: "R86,400", sub: "paid of R145,000" },
  ];
  return (
    <section className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-16 grid lg:grid-cols-2 gap-12 items-center">
      <Blob className="w-[420px] h-[420px] -right-32 top-0 opacity-90" color="var(--sage-2)" />
      <Blob className="w-64 h-64 right-10 -bottom-10 opacity-70" color="var(--peach)" />
      <DotGrid className="absolute left-[44%] top-1/2 -translate-y-1/2 opacity-60 hidden lg:block" />
      <Leaf className="absolute -left-6 bottom-0 opacity-40 hidden lg:block" />

      <div className="relative z-10">
        <p className="text-xs uppercase tracking-[0.32em] mb-6" style={{ color: "var(--sage)" }}>
          For South African wedding venues
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.02]">
          Run your venue
          <br />
          like a hotel.
          <br />
          <span style={{ color: "var(--sage)" }}>Without the hotel</span>
          <br />
          <span style={{ color: "var(--poppy)" }}>software.</span>
        </h1>
        <p className="mt-7 text-base leading-relaxed max-w-md" style={{ color: "var(--ink-2)" }}>
          Venuely gives wedding venues a branded portal for every couple, a clean dashboard for
          your team, and accommodation, catalogue and rentals tracking — all priced in rand and
          built for how venues actually work.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link
            href="/signup"
            className="px-7 py-3.5 rounded-lg font-medium text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{ background: "var(--poppy)" }}
          >
            Get Started Free
          </Link>
          <a
            href="#for-couples"
            className="px-7 py-3.5 rounded-lg font-medium transition-all hover:scale-[1.03]"
            style={{ border: "1.5px solid var(--poppy)", color: "var(--poppy)" }}
          >
            Book a Demo
          </a>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm" style={{ color: "var(--ink-2)" }}>
          {["No credit card required", "Setup in minutes", "Cancel anytime"].map((t) => (
            <span key={t} className="flex items-center gap-2.5">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
                style={{ background: "var(--peach)", color: "var(--poppy-deep)" }}
              >
                ✓
              </span>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Arched photo + floating stat cards */}
      <div className="relative z-10 flex justify-center lg:justify-end">
        <div className="relative">
          <div
            className="w-[300px] sm:w-[360px] h-[460px] sm:h-[520px] overflow-hidden p-3"
            style={{ background: "var(--poppy)", borderRadius: "9999px 9999px 18px 18px" }}
          >
            <img
              src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=900&q=80"
              alt="A wedding reception set inside a warm venue"
              className="w-full h-full object-cover"
              style={{ borderRadius: "9999px 9999px 10px 10px" }}
            />
          </div>

          <div className="absolute -right-6 sm:-right-16 top-6 space-y-3 w-[210px]">
            {cards.map((c, i) => (
              <Reveal key={c.label} delay={i * 90}>
                <div
                  className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_10px_30px_-12px_rgba(28,25,23,0.22)]"
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: i % 2 ? "var(--leaf)" : "var(--peach)" }}
                  >
                    {c.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-wider truncate" style={{ color: "var(--ink-2)" }}>
                      {c.label}
                    </div>
                    <div className="font-serif text-lg leading-tight" style={{ color: "var(--ink)" }}>
                      {c.value}
                    </div>
                    {c.sub && <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>{c.sub}</div>}
                    {c.chart && (
                      <div className="flex items-end gap-0.5 h-5 mt-1">
                        {[5, 8, 6, 11, 7, 13, 9].map((h, k) => (
                          <span
                            key={k}
                            className="w-1.5 rounded-sm"
                            style={{ height: `${h * 1.4}px`, background: k === 5 ? "var(--poppy)" : "var(--sage-2)" }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {c.ring && (
                    <span
                      className="text-[10px] font-semibold flex-shrink-0"
                      style={{ color: "var(--poppy)" }}
                    >
                      {c.ring}
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Venue logos strip ──────────────────────────────────────────────── */

function Logos() {
  const venues = ["THE GLASSHOUSE", "RIVERSTONE ESTATE", "OAK & IVY VENUE", "THE GATHERING", "Serenity"];
  return (
    <section className="border-t" style={{ borderColor: "var(--line)", background: "var(--daisy)" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 text-center">
        <p className="text-sm mb-6" style={{ color: "var(--ink-2)" }}>
          Loved by venues across South Africa
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-4 font-serif text-lg" style={{ color: "var(--sage)" }}>
          {venues.map((v) => (
            <span key={v} className="tracking-[0.15em]">{v}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ───────────────────────────────────────────────────────── */

function Features() {
  const items = [
    { icon: "👤", title: "A portal for every couple", desc: "Each wedding gets its own branded URL with a guest list, supplier directory, day-of timeline, budget tracker and checklist. Your venue, your colours." },
    { icon: "📋", title: "Catalogue & rentals at your fingertips", desc: "List every item you own — décor, tables, fairy lights, the lot. Couples browse and pick. You see who reserved what, when, and avoid double-bookings on busy weekends." },
    { icon: "🛏", title: "Accommodation, properly tracked", desc: "Cottages, suites, tents. Multi-night, multi-room. No more colour-coded spreadsheets or last-minute panic over who's sleeping where." },
    { icon: "👥", title: "Suppliers in one place", desc: "Your preferred photographers, florists, caterers and coordinators — already populated. Couples see your trusted list, not a random Google search." },
    { icon: "💳", title: "Payments tracked, not chased", desc: "Track deposits and final payments per wedding. Mark them paid, see who's overdue, attach invoices. One screen, all your weekends." },
    { icon: "💬", title: "WhatsApp-first, not email-only", desc: "Coming soon: nudge couples on WhatsApp when payments are due, when their guest list is sparse, when their timeline is empty. Because nobody reads SaaS emails." },
  ];
  return (
    <section id="features" className="relative max-w-7xl mx-auto px-6 lg:px-10 py-24">
      <Blob className="w-72 h-72 -left-40 top-20 opacity-70" color="var(--sage-2)" />
      <Blob className="w-72 h-72 -right-32 -top-6 opacity-60" color="var(--peach)" />
      <Leaf className="absolute right-2 top-24 opacity-40 hidden lg:block" />

      <Reveal>
        <div className="text-center mb-16 relative z-10">
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-tight">
            Everything a wedding
            <br />
            venue <span style={{ color: "var(--poppy)" }}>actually</span> needs
          </h2>
          <p className="mt-5 text-base" style={{ color: "var(--ink-2)" }}>
            Built from the ground up for ZA venues, not a US platform
            <br className="hidden sm:block" /> pretending to support rand.
          </p>
        </div>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 70}>
            <div className="relative bg-white rounded-2xl p-7 h-full overflow-hidden lift" style={{ border: "1px solid var(--line)" }}>
              <DotGrid className="absolute right-2 bottom-2 w-16 h-16 opacity-50" />
              <span
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg mb-5"
                style={{ background: i % 2 ? "var(--sage-2)" : "var(--peach)" }}
              >
                {it.icon}
              </span>
              <h3 className="font-serif text-xl leading-snug">{it.title}</h3>
              <p className="mt-3 text-sm leading-relaxed relative z-10" style={{ color: "var(--ink-2)" }}>
                {it.desc}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── For couples ────────────────────────────────────────────────────── */

function ForCouples() {
  const tabs = ["Overview", "Our Wedding", "Guest List", "Accommodation", "Catalogue", "Budget", "Payments", "Timeline", "Travel Info"];
  return (
    <section id="for-couples" className="relative overflow-hidden" style={{ background: "var(--daisy)" }}>
      <Blob className="w-[460px] h-[460px] -right-40 -top-20 opacity-80" color="var(--sage-2)" />
      <Blob className="w-72 h-72 right-20 bottom-0 opacity-60" color="var(--peach)" />
      <Leaf className="absolute -left-4 bottom-4 opacity-40 hidden lg:block" />

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 grid lg:grid-cols-2 gap-14 items-center relative z-10">
        <Reveal>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] mb-5" style={{ color: "var(--sage)" }}>
              For your couples
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-tight">
              A portal they&apos;ll
              <br />
              <span style={{ color: "var(--poppy)" }}>actually</span> use
            </h2>
            <p className="mt-6 text-base leading-relaxed max-w-md" style={{ color: "var(--ink-2)" }}>
              No more PDFs that go out of date the moment you save them. No more group WhatsApp
              confusion. Each couple gets a single link — bookmark it, share it with bridesmaids,
              check it on the morning of the wedding. Always current, always yours.
            </p>
            <ul className="mt-7 space-y-3.5 text-sm" style={{ color: "var(--ink)" }}>
              {[
                "Browse your catalogue and pick what they want",
                "Track their own budget and supplier payments",
                "See the day-of timeline you've planned together",
                "Build their guest list and dietary requirements",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] flex-shrink-0"
                    style={{ background: "var(--sage-2)", color: "var(--ink)" }}
                  >
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div className="bg-white rounded-2xl shadow-[0_24px_60px_-24px_rgba(28,25,23,0.3)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--daisy)" }}>
              <span className="w-3 h-3 rounded-full" style={{ background: "var(--poppy)" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "#F5C04E" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "var(--sage)" }} />
              <span className="ml-3 text-[11px]" style={{ color: "var(--ink-2)" }}>browser</span>
            </div>
            <div className="px-4 py-2 text-xs border-b" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>
              venuely.co.za/portal/<span style={{ color: "var(--poppy)" }}>your-venue</span>/<span style={{ color: "var(--poppy)" }}>smith-jones</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] min-h-[340px]">
              <div className="p-3 space-y-1 border-r text-[11px]" style={{ borderColor: "var(--line)" }}>
                {tabs.map((t, i) => (
                  <div
                    key={t}
                    className="px-2 py-1.5 rounded-md"
                    style={i === 0 ? { background: "var(--cream)", color: "var(--poppy)", fontWeight: 600 } : { color: "var(--ink-2)" }}
                  >
                    {t}
                  </div>
                ))}
              </div>
              <div className="p-5">
                <div className="font-serif text-lg">Hi Sarah &amp; James</div>
                <div className="text-[11px] mb-4" style={{ color: "var(--ink-2)" }}>12 Dec 2025 · Riverstone Estate</div>
                <div className="rounded-xl px-4 py-3 mb-3" style={{ background: "var(--cream)" }}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>Wedding Countdown</div>
                  <div className="font-serif text-2xl">128 <span className="text-xs font-sans" style={{ color: "var(--ink-2)" }}>days to go</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: "Budget Overview", v: "R86,400", s: "of R120,000", w: "72%" },
                    { l: "Payments Made", v: "R24,000", s: "paid to suppliers", w: "40%" },
                  ].map((b) => (
                    <div key={b.l} className="rounded-xl px-3 py-3" style={{ border: "1px solid var(--line)" }}>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>{b.l}</div>
                      <div className="font-serif text-lg">{b.v}</div>
                      <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>{b.s}</div>
                      <div className="h-1.5 rounded-full mt-2" style={{ background: "var(--daisy)" }}>
                        <div className="h-full rounded-full" style={{ width: b.w, background: "var(--poppy)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Pricing ────────────────────────────────────────────────────────── */

function Pricing() {
  const left = [
    "Unlimited weddings per year",
    "Branded couple portals",
    "Catalogue, rentals & accommodation tracking",
    "Partner-vendor marketplace with your commission built in",
  ];
  const right = [
    "Payment tracking & invoicing",
    "Email support (WhatsApp support coming soon)",
    "Free until your first booking",
  ];
  return (
    <section id="pricing" className="relative max-w-4xl mx-auto px-6 py-24">
      <Blob className="w-72 h-72 -left-40 top-0 opacity-70" color="var(--peach)" />
      <Blob className="w-72 h-72 -right-36 bottom-10 opacity-60" color="var(--sage-2)" />
      <Leaf className="absolute -left-6 top-10 opacity-40 hidden lg:block" />
      <DotGrid className="absolute right-0 top-2 opacity-50 hidden lg:block" />

      <Reveal>
        <div className="text-center relative z-10">
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-tight">
            Pay nothing until
            <br />
            your <span style={{ color: "var(--poppy)" }}>wedding</span> pays.
          </h2>
          <p className="mt-5 text-base max-w-lg mx-auto" style={{ color: "var(--ink-2)" }}>
            No subscription. No setup fee. We take 1% of what couples spend
            through the platform — that&apos;s it.
          </p>
        </div>
      </Reveal>

      <Reveal delay={150}>
        <div className="mt-12 bg-white rounded-3xl p-10 sm:p-12 relative z-10" style={{ border: "1px solid var(--line)" }}>
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.32em]" style={{ color: "var(--sage)" }}>Per booking</div>
            <div className="font-serif mt-2" style={{ color: "var(--poppy)", fontSize: "4.5rem", lineHeight: 1 }}>1%</div>
            <div className="text-lg" style={{ color: "var(--ink)" }}>of wedding spend</div>
            <div className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>No monthly fee · No contract · Cancel anytime</div>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 gap-x-10 gap-y-3.5 max-w-xl mx-auto">
            {[...left, ...right].map((f) => (
              <div key={f} className="flex items-start gap-3 text-sm" style={{ color: "var(--ink)" }}>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] flex-shrink-0"
                  style={{ background: "var(--sage)", color: "#fff" }}
                >
                  ✓
                </span>
                {f}
              </div>
            ))}
          </div>

          <div
            className="mt-9 rounded-2xl px-6 py-4 flex items-center gap-4 text-sm max-w-xl mx-auto"
            style={{ background: "var(--cream)", color: "var(--ink-2)" }}
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--peach)" }}
            >
              🌿
            </span>
            <span>
              Example: couple spends R120,000 through the portal → we invoice you R1,200.{" "}
              <span style={{ color: "var(--poppy)", fontWeight: 600 }}>You keep R118,800.</span>
            </span>
          </div>

          <div className="text-center mt-9">
            <Link
              href="/signup"
              className="inline-block px-8 py-3.5 rounded-lg font-medium text-white transition-all hover:scale-[1.03]"
              style={{ background: "var(--poppy)" }}
            >
              Get started — free
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ── FAQ ────────────────────────────────────────────────────────────── */

function FAQ() {
  const qs: { icon: string; q: string; a: string }[] = [
    { icon: "👥", q: "Who is this for?", a: "South African wedding venues — wine farms, lodges, country estates, beach venues — that host more than a handful of weddings a year. If you currently run on spreadsheets, WhatsApp groups and PDFs, Venuely is built for you." },
    { icon: "🔁", q: "How is this different from HoneyBook or Aisle Planner?", a: "Those are built for US/UK planners and bill in USD. Venuely is built for venues, billed in rand, with accommodation and rentals tracking baked in. ZA-specific from day one." },
    { icon: "📞", q: "Can my couples use it on their phone?", a: "Yes. The whole portal is responsive — couples open it on a phone the morning of the wedding to check the timeline. No app to install." },
    { icon: "📅", q: "What if I have 3 weddings on the same Saturday?", a: "Each wedding is its own portal with its own data. Rentals are tracked per weekend so the same 50 chairs can't get booked twice. Accommodation bookings are tied to date ranges." },
    { icon: "☁", q: "Do I need to import my catalogue manually?", a: "You can add items in the admin one by one, or use Smart Import — send us your existing list or document pack and it bulk-imports automatically." },
    { icon: "💳", q: "What about payment processing?", a: "Couples pay you directly — we don't sit between you and your money. Venuely tracks who's paid what. In-portal payment integration is on the roadmap if you want it." },
  ];
  return (
    <section id="faq" className="relative overflow-hidden" style={{ background: "var(--daisy)" }}>
      <Blob className="w-72 h-72 -right-36 -bottom-10 opacity-70" color="var(--sage-2)" />
      <Leaf className="absolute -left-4 top-10 opacity-40 hidden lg:block" />
      <DotGrid className="absolute left-[28%] top-10 opacity-50 hidden lg:block" />

      <div className="max-w-3xl mx-auto px-6 py-24 relative z-10">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="font-serif text-5xl sm:text-6xl">Questions</h2>
            <p className="mt-3 text-base" style={{ color: "var(--ink-2)" }}>
              Everything you need to know about Venuely.
            </p>
          </div>
        </Reveal>
        <div className="space-y-4">
          {qs.map(({ icon, q, a }, i) => (
            <Reveal key={q} delay={i * 50}>
              <details className="group bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                <summary className="cursor-pointer list-none flex items-center gap-4 px-6 py-5">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: i % 2 ? "var(--sage-2)" : "var(--peach)" }}
                  >
                    {icon}
                  </span>
                  <span className="flex-1 font-semibold text-[15px]">{q}</span>
                  <span
                    className="text-xl transition-transform group-open:rotate-45"
                    style={{ color: "var(--poppy)" }}
                  >
                    +
                  </span>
                </summary>
                <p className="px-6 pb-6 pl-[4.75rem] text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                  {a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer id="footer" className="border-t" style={{ borderColor: "var(--line)", background: "var(--cream)" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className="font-serif text-2xl" style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}>
            Venuely.
          </span>
          <span style={{ color: "var(--ink-2)" }}>·</span>
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>Cape Town, South Africa</span>
        </div>
        <div className="flex gap-7 text-sm" style={{ color: "var(--ink-2)" }}>
          <a href="mailto:hello@venuely.co.za" className="hover:opacity-60 transition-opacity">hello@venuely.co.za</a>
          <Link href="/login" className="hover:opacity-60 transition-opacity">Log in</Link>
          <Link href="/signup" className="hover:opacity-60 transition-opacity">Get Started</Link>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-8 text-xs" style={{ color: "var(--ink-2)" }}>
        © {new Date().getFullYear()} Venuely · Everything wedding, handled.
      </div>
    </footer>
  );
}
