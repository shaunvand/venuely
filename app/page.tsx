import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo, LogoMark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = data?.role ?? null;
  }

  const dashboardHref =
    role === "owner" ? "/owner"
    : role === "venue_admin" ? "/venue"
    : "/portal/pat-busch/demo-wedding";

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 overflow-x-hidden">
      <Nav signedIn={!!user} dashboardHref={dashboardHref} />
      <Hero />
      <Logos />
      <Features />
      <ForCouples />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav({ signedIn, dashboardHref }: { signedIn: boolean; dashboardHref: string }) {
  return (
    <header className="border-b border-stone-200/70 bg-stone-50/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Logo />
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#features" className="hidden sm:inline hover:text-stone-600 transition-colors">Features</a>
          <a href="#pricing" className="hidden sm:inline hover:text-stone-600 transition-colors">Pricing</a>
          <a href="#faq" className="hidden sm:inline hover:text-stone-600 transition-colors">FAQ</a>
          {signedIn ? (
            <>
              <Link href={dashboardHref} className="px-3.5 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-800 transition-colors">
                Dashboard
              </Link>
              <form action="/auth/signout" method="post">
                <button className="text-stone-500 hover:text-stone-900 transition-colors">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-stone-600 transition-colors">Sign in</Link>
              <Link href="/signup" className="px-3.5 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-800 transition-colors">
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-32 text-center">
      {/* Drifting background blobs */}
      <div aria-hidden className="absolute inset-0 overflow-hidden -z-0 pointer-events-none">
        <div className="absolute top-10 left-1/4 w-72 h-72 rounded-full bg-amber-100/40 blur-3xl anim-drift"></div>
        <div className="absolute top-32 right-1/4 w-96 h-96 rounded-full bg-emerald-100/40 blur-3xl anim-drift" style={{ animationDelay: "-7s" }}></div>
      </div>

      <div className="relative z-10">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-6 anim-fade-in">
          For South African wedding venues
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl leading-[1.05] tracking-tight max-w-3xl mx-auto anim-fade-up">
          Run your venue like a hotel.
          <br />
          <span className="text-shimmer">Without the hotel software.</span>
        </h1>
        <p className="mt-7 text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed anim-fade-up delay-200">
          Venuely gives wedding venues a branded portal for every couple, a clean dashboard for your team, and accommodation, catalogue and rentals tracking — all priced in rand and built for how venues actually work.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap anim-fade-up delay-300">
          <Link
            href="/signup"
            className="px-7 py-3.5 rounded-md bg-stone-900 text-white hover:bg-stone-800 font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
          >
            Start your 14-day free trial
          </Link>
          <a
            href="#features"
            className="px-7 py-3.5 rounded-md border border-stone-300 hover:bg-white transition-colors"
          >
            See how it works
          </a>
        </div>
        <p className="mt-5 text-sm text-stone-500 anim-fade-in delay-500">
          No card required · Cancel anytime · ZAR billing
        </p>
      </div>
    </section>
  );
}

function Logos() {
  return (
    <section className="border-y border-stone-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
          Built with leading South African wedding venues
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-stone-400 font-serif text-xl">
          <span className="hover:text-stone-700 transition-colors cursor-default">Pat Busch Mountain Reserve</span>
          <span className="text-stone-300">·</span>
          <span className="italic">Your venue here</span>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      title: "A portal for every couple",
      desc: "Each wedding gets its own branded URL with a guest list, supplier directory, day-of timeline, budget tracker and checklist. Your venue, your colours.",
    },
    {
      title: "Catalogue & rentals at your fingertips",
      desc: "List every item you own — décor, tables, fairy lights, the lot. Couples browse and pick. You see who reserved what, when, and avoid double-bookings on busy weekends.",
    },
    {
      title: "Accommodation, properly tracked",
      desc: "Cottages, suites, tents. Multi-night, multi-room. No more colour-coded spreadsheets or last-minute panic over who's sleeping where.",
    },
    {
      title: "Suppliers in one place",
      desc: "Your preferred photographers, florists, caterers and coordinators — already populated. Couples see your trusted list, not a random Google search.",
    },
    {
      title: "Payments tracked, not chased",
      desc: "Track deposits and final payments per wedding. Mark them paid, see who's overdue, attach invoices. One screen, all your weekends.",
    },
    {
      title: "WhatsApp-first, not email-only",
      desc: "Coming soon: nudge couples on WhatsApp when payments are due, when their guest list is sparse, when their timeline is empty. Because nobody reads SaaS emails.",
    },
  ];
  return (
    <section id="features" className="max-w-6xl mx-auto px-6 py-28">
      <Reveal>
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl sm:text-5xl tracking-tight">
            Everything a wedding venue actually needs
          </h2>
          <p className="mt-4 text-stone-600 max-w-xl mx-auto">
            Built from the ground up for ZA venues, not a US platform pretending to support rand.
          </p>
        </div>
      </Reveal>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 80}>
            <div className="border border-stone-200 rounded-lg p-7 bg-white lift h-full">
              <h3 className="font-semibold text-lg">{it.title}</h3>
              <p className="mt-2 text-stone-600 text-sm leading-relaxed">{it.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ForCouples() {
  return (
    <section className="bg-stone-900 text-stone-100 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 py-28 grid lg:grid-cols-2 gap-14 items-center">
        <Reveal>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400 mb-4">For your couples</p>
            <h2 className="font-serif text-4xl sm:text-5xl tracking-tight">A portal they'll actually use</h2>
            <p className="mt-5 text-stone-300 leading-relaxed">
              No more PDFs that go out of date the moment you save them. No more group WhatsApp confusion. Each couple gets a single link — bookmark it, share it with bridesmaids, check it on the morning of the wedding. Always current, always yours.
            </p>
            <ul className="mt-7 space-y-2.5 text-stone-300 text-sm">
              <li className="flex gap-3"><Tick /> Browse your catalogue and pick what they want</li>
              <li className="flex gap-3"><Tick /> Track their own budget and supplier payments</li>
              <li className="flex gap-3"><Tick /> See the day-of timeline you've planned together</li>
              <li className="flex gap-3"><Tick /> Build their guest list and dietary requirements</li>
            </ul>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className="bg-stone-800 rounded-xl p-7 border border-stone-700 font-mono text-xs text-stone-400 leading-relaxed shadow-2xl">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-stone-700">
              <span className="w-3 h-3 rounded-full bg-red-400/70"></span>
              <span className="w-3 h-3 rounded-full bg-amber-400/70"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-400/70"></span>
              <span className="ml-3 text-stone-500 text-[10px]">browser</span>
            </div>
            <div className="text-stone-500">
              venuely.co.za/portal/<span className="text-amber-300">your-venue</span>/<span className="text-amber-300">smith-jones</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div className="text-stone-200">Dashboard</div>
              <div className="text-stone-200">Our Venue</div>
              <div className="text-stone-200">Guest List</div>
              <div className="text-stone-200">Accommodation</div>
              <div className="text-stone-200">Suppliers</div>
              <div className="text-stone-200">Catalogue</div>
              <div className="text-stone-200">Rentals</div>
              <div className="text-stone-200">Budget</div>
              <div className="text-stone-200">Checklist</div>
              <div className="text-stone-200">Day Timeline</div>
            </div>
            <div className="mt-6 pt-4 border-t border-stone-700 text-stone-500">
              10 tabs · One link · Always live
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-1 flex-shrink-0">
      <path d="M3 8.5 L6.5 12 L13 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="max-w-3xl mx-auto px-6 py-28 text-center">
      <Reveal>
        <h2 className="font-serif text-4xl sm:text-5xl tracking-tight">
          One price. No tiers. No surprises.
        </h2>
        <p className="mt-4 text-stone-600">Every feature. Unlimited weddings. Unlimited couples.</p>
      </Reveal>

      <Reveal delay={150}>
        <div className="mt-12 border border-stone-300 rounded-2xl p-10 bg-white lift">
          <div className="text-stone-500 text-xs uppercase tracking-[0.3em]">Per venue</div>
          <div className="mt-3 flex items-baseline justify-center gap-2">
            <span className="text-6xl font-serif">R1 499</span>
            <span className="text-stone-500 text-lg">/ month</span>
          </div>
          <div className="text-stone-500 text-sm mt-2">Billed in rand · cancel anytime</div>

          <ul className="mt-9 space-y-2.5 text-left max-w-md mx-auto text-sm">
            {[
              "Unlimited weddings per year",
              "Branded couple portals",
              "Catalogue, rentals & accommodation tracking",
              "Supplier directory",
              "Payment tracking & invoicing",
              "Email support (WhatsApp support coming soon)",
              "14-day free trial — no card required",
            ].map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="text-emerald-600 mt-0.5"><Tick /></span>
                <span className="text-stone-700">{f}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="mt-10 inline-block px-8 py-3.5 rounded-md bg-stone-900 text-white hover:bg-stone-800 font-medium transition-all hover:scale-[1.02] shadow-sm hover:shadow-md"
          >
            Start free trial
          </Link>
          <p className="text-xs text-stone-500 mt-5">
            Compare: Sonas (UK) is ~R2 300/mo and won't take ZAR. Spreadsheets are free until they aren't.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

function FAQ() {
  const qs: [string, string][] = [
    ["Who is this for?", "South African wedding venues — wine farms, lodges, country estates, beach venues — that host more than a handful of weddings a year. If you currently run on spreadsheets, WhatsApp groups and PDFs, Venuely is built for you."],
    ["How is this different from HoneyBook or Aisle Planner?", "Those are built for US/UK planners and bill in USD. Venuely is built for venues, billed in rand, with accommodation and rentals tracking baked in. ZA-specific from day one."],
    ["Can my couples use it on their phone?", "Yes. The whole portal is responsive — couples open it on a phone the morning of the wedding to check the timeline. No app to install."],
    ["What if I have 3 weddings on the same Saturday?", "Each wedding is its own portal with its own data. Rentals are tracked per weekend so the same 50 chairs can't get booked twice. Accommodation bookings are tied to date ranges."],
    ["Do I need to import my catalogue manually?", "You can add items in the admin one by one, or send us your existing list and we'll bulk-import it for you."],
    ["What about payment processing?", "Couples pay you directly — we don't sit between you and your money. Venuely tracks who's paid what. Yoco / Ozow integration is on the roadmap for in-portal payments if you want it."],
    ["How do I cancel?", "From your billing page, one click. No phone calls, no retention queue. We assume you'll come back."],
  ];
  return (
    <section id="faq" className="max-w-3xl mx-auto px-6 py-28">
      <Reveal>
        <h2 className="font-serif text-4xl sm:text-5xl tracking-tight text-center">Questions</h2>
      </Reveal>
      <div className="mt-12 divide-y divide-stone-200">
        {qs.map(([q, a], i) => (
          <Reveal key={q} delay={i * 50}>
            <details className="group py-6">
              <summary className="cursor-pointer list-none flex justify-between items-center font-medium hover:text-stone-700 transition-colors">
                <span>{q}</span>
                <span className="text-stone-400 group-open:rotate-45 transition-transform text-xl ml-4">+</span>
              </summary>
              <p className="mt-3 text-stone-600 text-sm leading-relaxed">{a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="bg-stone-100 border-t border-stone-200 relative overflow-hidden">
      <div aria-hidden className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-emerald-100/30 blur-3xl anim-drift pointer-events-none"></div>
      <div className="relative max-w-3xl mx-auto px-6 py-24 text-center">
        <Reveal>
          <LogoMark size={48} className="mx-auto text-stone-900 mb-6" />
          <h2 className="font-serif text-4xl sm:text-5xl tracking-tight">
            Try it on your next wedding.
          </h2>
          <p className="mt-4 text-stone-600">
            14 days free. No card. If it doesn't save you a Sunday evening of admin, walk away.
          </p>
          <Link
            href="/signup"
            className="mt-9 inline-block px-8 py-3.5 rounded-md bg-stone-900 text-white hover:bg-stone-800 font-medium transition-all hover:scale-[1.02] shadow-sm hover:shadow-md"
          >
            Start your free trial
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-stone-50">
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-stone-400 hidden sm:inline">·</span>
          <span className="text-sm text-stone-500">Cape Town, South Africa</span>
        </div>
        <div className="flex gap-6 text-sm text-stone-500">
          <a href="mailto:hello@venuely.co.za" className="hover:text-stone-900 transition-colors">hello@venuely.co.za</a>
          <Link href="/login" className="hover:text-stone-900 transition-colors">Sign in</Link>
          <Link href="/signup" className="hover:text-stone-900 transition-colors">Start trial</Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 pb-6 text-xs text-stone-400">
        © {new Date().getFullYear()} Venuely
      </div>
    </footer>
  );
}
