import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/components/Reveal";
import { LogoMark } from "@/components/Logo";

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
      <Features />
      <ForCouples />
      <TrustedBy />
      <Pricing />
      <FAQ />
      <FinalCTA />
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
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <LogoMark size={52} />
          <span
            className="font-serif text-3xl"
            style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}
          >
            Venuely.
          </span>
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

/* ── Dashboard mockup (hero right panel) ────────────────────────────── */

function DashboardMockup() {
  const navIcons = [
    /* home */
    <svg key="home" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7l6-5 6 5v7H2z" /><path d="M6 14v-4h4v4" /></svg>,
    /* users */
    <svg key="users" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.2" /><path d="M2 13c.6-2 2.2-3 4-3s3.4 1 4 3" /><circle cx="11.5" cy="5" r="1.6" /><path d="M10.5 10c1.8-.2 3.1.8 3.5 2.5" /></svg>,
    /* bed */
    <svg key="bed" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 11.5v-5h12v5" /><path d="M2 9.5h12" /><path d="M5 7V5.5A.5.5 0 0 1 5.5 5h2a.5.5 0 0 1 .5.5V7" /></svg>,
    /* box */
    <svg key="box" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l5 2.5v7L8 14 3 11.5v-7z" /><path d="M8 2v12M3 4.5l5 2.5 5-2.5" /></svg>,
    /* clock */
    <svg key="clock" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></svg>,
    /* settings */
    <svg key="settings" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2" /><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" /></svg>,
  ];

  return (
    <div className="w-full h-full flex" style={{ background: "var(--cream)" }}>
      {/* Sidebar */}
      <div
        className="flex-shrink-0 flex flex-col items-center py-5 gap-4"
        style={{ width: 44, background: "#fff", borderRight: "1px solid var(--line)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center mb-1"
          style={{ background: "var(--poppy)" }}
        >
          <span style={{ color: "#fff", fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 9 }}>V.</span>
        </div>
        {navIcons.map((icon, i) => (
          <div
            key={i}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: i === 0 ? "var(--poppy)" : "var(--ink-2)", background: i === 0 ? "var(--cream)" : "transparent" }}
          >
            {icon}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 p-2.5 flex flex-col gap-2 overflow-hidden">
        {/* Weekend Overview */}
        <div className="bg-white rounded-xl p-2.5" style={{ border: "1px solid var(--line)" }}>
          <div className="flex items-start justify-between">
            <div
              className="text-[7.5px] uppercase tracking-wider"
              style={{ color: "var(--ink-2)", letterSpacing: "0.18em" }}
            >
              Weekend Overview
            </div>
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "var(--cream)" }}>
              <svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="var(--ink-2)" strokeWidth="1.2" strokeLinecap="round"><rect x="1.5" y="2" width="11" height="10" rx="1.5" /><path d="M1.5 5.5h11" /><path d="M4.5 1v2M9.5 1v2" /></svg>
            </div>
          </div>
          <div className="font-serif text-sm font-bold leading-snug mt-0.5" style={{ color: "var(--ink)" }}>
            12 – 14 Dec 2025
          </div>
          <div className="text-[8.5px] mt-0.5 mb-2" style={{ color: "var(--ink-2)" }}>
            3 weddings · fully booked
          </div>
          <div className="flex items-end gap-0.5 h-5">
            {[3, 5, 4, 7, 5, 9, 6].map((h, k) => (
              <div
                key={k}
                className="flex-1 rounded-sm"
                style={{ height: `${h * 2.2}px`, background: k === 5 ? "var(--poppy)" : "var(--sage-2)" }}
              />
            ))}
          </div>
        </div>

        {/* Payments Collected */}
        <div className="bg-white rounded-xl p-2.5" style={{ border: "1px solid var(--line)" }}>
          <div className="text-[7.5px] uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-2)", letterSpacing: "0.18em" }}>
            Payments Collected
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-serif text-base leading-tight" style={{ color: "var(--ink)" }}>R86,400</div>
              <div className="text-[8.5px]" style={{ color: "var(--ink-2)" }}>of R145,000 invoiced</div>
            </div>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style={{ border: "3px solid var(--poppy)", color: "var(--poppy)" }}
            >
              60%
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-2 flex-1">
          {[
            { label: "Accommodation", value: "32 / 40", sub: "rooms booked", w: "80%",
              icon: <svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="var(--ink-2)" strokeWidth="1.2" strokeLinecap="round"><path d="M2 10v-4h10v4" /><path d="M2 8h10" /><path d="M4.5 6V4.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V6" /></svg> },
            { label: "Rentals Tracked", value: "128", sub: "items reserved", w: "60%",
              icon: <svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="var(--ink-2)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3h6v5H4z" /><path d="M2.5 11h9" /><path d="M5.5 8v3M8.5 8v3" /></svg> },
          ].map(({ label, value, sub, w, icon }) => (
            <div key={label} className="bg-white rounded-xl p-2 flex flex-col justify-between" style={{ border: "1px solid var(--line)" }}>
              <div>
                <div className="text-[7px] uppercase tracking-wider" style={{ color: "var(--ink-2)", letterSpacing: "0.15em" }}>{label}</div>
                <div className="font-serif text-sm mt-0.5 leading-tight" style={{ color: "var(--ink)" }}>{value}</div>
                <div className="text-[8px]" style={{ color: "var(--ink-2)" }}>{sub}</div>
                <div className="h-0.5 rounded-full mt-1.5" style={{ background: "var(--line)" }}>
                  <div className="h-full rounded-full" style={{ width: w, background: "var(--poppy)" }} />
                </div>
              </div>
              <div className="flex justify-end mt-1">
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "var(--cream)" }}>
                  {icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-16 grid lg:grid-cols-2 gap-12 items-center">
      <Blob className="w-[420px] h-[420px] -right-32 top-0 opacity-90" color="var(--sage-2)" />
      <Blob className="w-64 h-64 right-10 -bottom-10 opacity-70" color="var(--peach)" />

      <div className="relative z-10">
        <p className="text-xs uppercase tracking-[0.32em] mb-6" style={{ color: "var(--sage)" }}>
          For South African wedding venues
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.02]" style={{ fontWeight: 900 }}>
          Run your venue
          <br />
          like a <span style={{ color: "var(--poppy)" }}>hotel.</span>
          <br />
          <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Without the hotel software.</span>
        </h1>
        <p className="mt-7 text-base leading-relaxed max-w-md" style={{ color: "var(--ink-2)" }}>
          Venuely gives every couple their own branded dashboard, plus a clean admin for
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
        <div className="mt-8">
          <TrustChips />
        </div>
      </div>

      {/* Arched dashboard mockup */}
      <div className="relative z-10 flex justify-center lg:justify-end">
        <DotGrid className="absolute -left-4 top-1/3 opacity-20 hidden lg:block" />
        <div
          className="w-[300px] sm:w-[380px] h-[460px] sm:h-[520px] overflow-hidden p-3"
          style={{ background: "var(--poppy)", borderRadius: "9999px 9999px 18px 18px" }}
        >
          <div
            className="w-full h-full overflow-hidden"
            style={{ borderRadius: "9999px 9999px 10px 10px" }}
          >
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Trusted-by strip ───────────────────────────────────────────────── */

function TrustedBy() {
  const venues = ["THE GLASSHOUSE", "RIVERSTONE ESTATE", "OAK & IVY VENUE", "THE GATHERING", "Serenity"];
  return (
    <section className="relative border-y" style={{ borderColor: "var(--line)", background: "var(--cream)" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 text-center">
        <p className="text-xs uppercase tracking-[0.32em] mb-2" style={{ color: "var(--sage)" }}>
          Trusted by
        </p>
        <h3 className="font-serif text-2xl sm:text-3xl mb-8" style={{ fontWeight: 900 }}>
          Wedding venues across South Africa
        </h3>
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-5 font-serif text-lg" style={{ color: "var(--sage)" }}>
          {venues.map((v) => (
            <span key={v} className="tracking-[0.15em]">{v}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ───────────────────────────────────────────────────────── */

function FeatureIcon({ name }: { name: "portal" | "catalogue" | "bed" | "users" | "card" | "chat" }) {
  const stroke = "var(--ink)";
  const sw = 1.6;
  switch (name) {
    case "portal":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="12" cy="10" r="2.6" />
          <path d="M6.5 18c1.2-2.4 3.2-3.6 5.5-3.6s4.3 1.2 5.5 3.6" />
        </svg>
      );
    case "catalogue":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="3.5" width="14" height="17" rx="1.6" />
          <path d="M9 3.5v2.2h6V3.5" />
          <path d="M8.5 10h7M8.5 13h7M8.5 16h4" />
        </svg>
      );
    case "bed":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18v-7h18v7" />
          <path d="M3 18v2M21 18v2" />
          <path d="M3 14h18" />
          <path d="M7 11V8.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 8.5V11" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9.5" r="2.6" />
          <path d="M3.5 18c.8-2.4 2.8-3.6 5.5-3.6s4.7 1.2 5.5 3.6" />
          <circle cx="16.5" cy="8" r="2" />
          <path d="M15 13.6c2.6-.2 4.6 1 5.5 2.9" />
        </svg>
      );
    case "card":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h3" />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v11H9.5L5 19.5V16H4z" />
          <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
        </svg>
      );
  }
}

function TrustChips() {
  const chips: { icon: React.ReactNode; label: string }[] = [
    {
      label: "No credit card required",
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--poppy-deep)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h3" />
        </svg>
      ),
    },
    {
      label: "Setup in minutes",
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--poppy-deep)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      ),
    },
    {
      label: "Cancel anytime",
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--poppy-deep)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.5 12.5l2.4 2.4 4.6-5.2" />
        </svg>
      ),
    },
  ];
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm" style={{ color: "var(--ink-2)" }}>
      {chips.map((c) => (
        <span key={c.label} className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--peach)" }}
          >
            {c.icon}
          </span>
          {c.label}
        </span>
      ))}
    </div>
  );
}

function Features() {
  const items: { icon: "portal" | "catalogue" | "bed" | "users" | "card" | "chat"; title: string; desc: string }[] = [
    { icon: "portal", title: "A dashboard for every couple", desc: "Each wedding gets its own branded URL with a guest list, supplier directory, day-of timeline, budget tracker and checklist. Your venue, your colours." },
    { icon: "catalogue", title: "Catalogue & rentals at your fingertips", desc: "List every item you own — décor, tables, fairy lights, the lot. Couples browse and pick. You see who reserved what, when, and avoid double-bookings on busy weekends." },
    { icon: "bed", title: "Accommodation, properly tracked", desc: "Cottages, suites, tents. Multi-night, multi-room. No more colour-coded spreadsheets or last-minute panic over who's sleeping where." },
    { icon: "users", title: "Suppliers in one place", desc: "Your preferred photographers, florists, caterers and coordinators — already populated. Couples see your trusted list, not a random Google search." },
    { icon: "card", title: "Payments tracked, not chased", desc: "Track deposits and final payments per wedding. Mark them paid, see who's overdue, attach invoices. One screen, all your weekends." },
    { icon: "chat", title: "WhatsApp-first, not email-only", desc: "Coming soon: nudge couples on WhatsApp when payments are due, when their guest list is sparse, when their timeline is empty. Because nobody reads SaaS emails." },
  ];
  return (
    <section id="features" className="relative max-w-7xl mx-auto px-6 lg:px-10 py-24">
      <Leaf className="absolute right-2 top-24 opacity-40 hidden lg:block" />

      <Reveal>
        <div className="text-center mb-16 relative z-10">
          <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-tight">
            Everything a wedding
            <br />
            venue <span style={{ color: "var(--poppy)", fontStyle: "italic" }}>actually</span> needs
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
                className="w-12 h-12 rounded-full flex items-center justify-center mb-5"
                style={{ background: i % 2 ? "var(--sage-2)" : "var(--peach)" }}
              >
                <FeatureIcon name={it.icon} />
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

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 grid lg:grid-cols-2 gap-14 items-center relative z-10">
        <Reveal>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] mb-5" style={{ color: "var(--sage)" }}>
              For your couples
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-tight">
              A dashboard they&apos;ll
              <br />
              <span style={{ color: "var(--poppy)", fontStyle: "italic" }}>actually</span> use
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
            <div className="mt-8">
              <TrustChips />
            </div>
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
              venuely.co.za/<span style={{ color: "var(--poppy)" }}>your-venue</span>/<span style={{ color: "var(--poppy)" }}>smith-jones</span>
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
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="font-serif text-lg">Hi Sarah &amp; James</div>
                    <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>12 Dec 2025 · Riverstone Estate</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>Countdown</div>
                    <div className="font-serif text-xl leading-tight">128<span className="text-[10px] font-sans ml-1" style={{ color: "var(--ink-2)" }}>days</span></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-3">
                  {[
                    { l: "Budget", v: "R86,400", s: "of R120,000", w: "72%" },
                    { l: "Paid out", v: "R24,000", s: "8 suppliers", w: "40%" },
                  ].map((b) => (
                    <div key={b.l} className="rounded-xl px-3 py-2.5" style={{ border: "1px solid var(--line)" }}>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--ink-2)" }}>{b.l}</div>
                      <div className="font-serif text-base">{b.v}</div>
                      <div className="text-[9px]" style={{ color: "var(--ink-2)" }}>{b.s}</div>
                      <div className="h-1 rounded-full mt-1.5" style={{ background: "var(--daisy)" }}>
                        <div className="h-full rounded-full" style={{ width: b.w, background: "var(--poppy)" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-2)" }}>Suppliers · 12 confirmed</div>
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                    {[
                      { n: "Joubert Photography", t: "Photo", s: "Paid", c: "var(--leaf)" },
                      { n: "Petal & Stem", t: "Florist", s: "Deposit", c: "var(--peach)" },
                      { n: "Cape Catering Co.", t: "Catering", s: "Due 28 Nov", c: "var(--daisy)" },
                    ].map((r, i, a) => (
                      <div key={r.n} className="flex items-center justify-between px-3 py-1.5 text-[10px]" style={i < a.length - 1 ? { borderBottom: "1px solid var(--line)" } : {}}>
                        <div className="flex-1 truncate">
                          <span style={{ color: "var(--ink)" }}>{r.n}</span>
                          <span className="ml-1.5" style={{ color: "var(--ink-2)" }}>· {r.t}</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px]" style={{ background: r.c, color: "var(--ink)" }}>{r.s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: "var(--cream)" }}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] flex-shrink-0" style={{ background: "var(--peach)" }}>→</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium leading-tight">Next up · Menu tasting with caterer</div>
                    <div className="text-[9px]" style={{ color: "var(--ink-2)" }}>Sat 24 Aug · 11:00 · Riverstone Estate</div>
                  </div>
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
    "Branded couple dashboards",
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
              <span className="block mb-1">Example: couple spends R120,000 → we invoice you R1,200. <span style={{ color: "var(--poppy)", fontWeight: 600 }}>You keep R118,800.</span></span>
              <span className="block text-[12px]">40 weddings/year × R120k avg = R48k a year — paid only when revenue lands, never a fixed bill at the end of the month.</span>
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

function FaqIcon({ name }: { name: "who" | "compare" | "phone" | "calendar" | "cloud" | "card" }) {
  const s = "var(--ink)";
  const w = 1.6;
  const p = { fill: "none", stroke: s, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "who":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
          <circle cx="9" cy="9.5" r="2.6" />
          <path d="M3.5 18c.8-2.4 2.8-3.6 5.5-3.6s4.7 1.2 5.5 3.6" />
          <circle cx="16.5" cy="8" r="2" />
          <path d="M15 13.6c2.6-.2 4.6 1 5.5 2.9" />
        </svg>
      );
    case "compare":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
          <rect x="3.5" y="4" width="9" height="13" rx="1.6" />
          <path d="M11.5 19l3-2.3" />
          <path d="M14.5 7l2-1.6" />
          <rect x="13.5" y="9" width="7" height="11" rx="1.4" />
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
          <rect x="7" y="3" width="10" height="18" rx="2.2" />
          <path d="M11 18h2" />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17" />
          <path d="M8 3.5v3M16 3.5v3" />
          <path d="M8 14h2M13 14h3M8 17h2" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
          <path d="M7 16h10a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.7-1.2A3.6 3.6 0 0 0 7 16z" />
          <path d="M12 12v5M9.7 14.7L12 17l2.3-2.3" />
        </svg>
      );
    case "card":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" {...p}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h3" />
        </svg>
      );
  }
}

function FAQ() {
  const qs: { icon: "who" | "compare" | "phone" | "calendar" | "cloud" | "card"; q: string; a: string }[] = [
    { icon: "who", q: "Who is this for?", a: "South African wedding venues — wine farms, lodges, country estates, beach venues — that host more than a handful of weddings a year. If you currently run on spreadsheets, WhatsApp groups and PDFs, Venuely is built for you." },
    { icon: "compare", q: "How is this different from HoneyBook or Aisle Planner?", a: "Those are built for US/UK planners and bill in USD. Venuely is built for venues, billed in rand, with accommodation and rentals tracking baked in. ZA-specific from day one." },
    { icon: "phone", q: "Can my couples use it on their phone?", a: "Yes. The whole dashboard is responsive — couples open it on a phone the morning of the wedding to check the timeline. No app to install." },
    { icon: "calendar", q: "What if I have 3 weddings on the same Saturday?", a: "Each wedding is its own dashboard with its own data. Rentals are tracked per weekend so the same 50 chairs can't get booked twice. Accommodation bookings are tied to date ranges." },
    { icon: "cloud", q: "Do I need to import my catalogue manually?", a: "You can add items in the admin one by one, or use Smart Import — send us your existing list or document pack and it bulk-imports automatically." },
    { icon: "card", q: "What about payment processing?", a: "Couples pay you directly — we don't sit between you and your money. Venuely tracks who's paid what. In-dashboard payment integration is on the roadmap if you want it." },
  ];
  return (
    <section id="faq" className="relative overflow-hidden" style={{ background: "var(--cream)" }}>
      {/* Decorations — ration to one per zone (top-left botanical, bottom-right blob + dots). */}
      <Leaf className="absolute -top-4 -left-4 opacity-50 hidden lg:block" />
      <Blob className="w-72 h-72 -right-32 -bottom-12 opacity-70" color="var(--sage-2)" />
      <DotGrid className="absolute right-16 bottom-10 opacity-40 hidden lg:block" />

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 grid lg:grid-cols-[340px_1fr] gap-10 lg:gap-16 items-start relative z-10">
        {/* Left arch — decorative venue interior, matches hero treatment, smaller. */}
        <div className="hidden lg:block relative">
          <div
            className="w-full h-[460px] overflow-hidden p-2.5"
            style={{ background: "var(--poppy)", borderRadius: "9999px 9999px 14px 14px" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=700&q=80"
              alt=""
              className="w-full h-full object-cover"
              style={{ borderRadius: "9999px 9999px 8px 8px" }}
            />
          </div>
        </div>

        {/* Right column: heading + accordion */}
        <div>
          <Reveal>
            <div className="mb-10">
              <h2 className="font-serif text-5xl sm:text-6xl text-center lg:text-left" style={{ fontWeight: 900 }}>
                Questions
              </h2>
              <p className="mt-2 text-base text-center lg:text-left" style={{ color: "var(--ink-2)" }}>
                Everything you need to know about Venuely.
              </p>
            </div>
          </Reveal>

          <div className="space-y-3.5">
            {qs.map(({ icon, q, a }, i) => (
              <Reveal key={q} delay={i * 50}>
                <details
                  className="group bg-white rounded-2xl overflow-hidden relative transition-colors open:bg-[color:var(--cream)]"
                  style={{ border: "1px solid var(--line)" }}
                >
                  {/* Left poppy border accent on open */}
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-1 opacity-0 group-open:opacity-100 transition-opacity"
                    style={{ background: "var(--poppy)" }}
                  />
                  <summary className="cursor-pointer list-none flex items-center gap-4 px-6 py-5">
                    <span
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: i % 2 ? "var(--sage-2)" : "var(--peach)" }}
                    >
                      <FaqIcon name={icon} />
                    </span>
                    <span className="flex-1 font-semibold text-[15px]">{q}</span>
                    <span
                      className="font-light leading-none transition-transform group-open:rotate-45"
                      style={{ color: "var(--poppy)", fontSize: "1.5rem" }}
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-6 pb-6 pl-[5rem] text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                    {a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ──────────────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden" style={{ background: "var(--daisy)" }}>
      <Blob className="w-[420px] h-[420px] -left-32 -top-20 opacity-70" color="var(--peach)" />
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-20 text-center relative z-10">
        <p className="text-xs uppercase tracking-[0.32em] mb-6" style={{ color: "var(--sage)" }}>
          Ready when you are
        </p>
        <div className="relative mx-auto max-w-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cta-hero.jpeg"
            alt="A preview of the Venuely venue dashboard"
            className="w-full h-auto rounded-2xl shadow-[0_30px_60px_-20px_rgba(28,25,23,0.35)]"
            style={{ border: "1px solid var(--line)" }}
          />
        </div>
        <p className="mt-10 text-base leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-2)" }}>
          Drop in your existing PDFs, brochures and rooming lists — Smart Import builds your
          dashboard for you. No credit card. Free until your first booking lands.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-8 py-4 rounded-lg font-medium text-white transition-all hover:scale-[1.03] active:scale-[0.98] text-base"
            style={{ background: "var(--poppy)" }}
          >
            Sign up for free
          </Link>
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>
            Setup in minutes · Cancel anytime
          </span>
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
