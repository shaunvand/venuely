import Link from "next/link";
import type { Metadata } from "next";

// Public, static POPIA-aligned privacy policy for venuely.co.za.
//
// This page backs the consent checkbox already shown on the public enquiry
// form (/v/[slug]) and the review form, and on signup. It is plain static
// content — no DB reads — so it prerenders and is always reachable by URL.
//
// The root layout supplies no global chrome, so (like /venues) this page
// renders its own brand header + footer.

const CONTACT_EMAIL = "privacy@venuely.co.za";
const LAST_UPDATED = "29 May 2026";

export function generateMetadata(): Metadata {
  const title = "Privacy policy — Venuely";
  const description =
    "How Venuely collects, uses, stores and protects personal information for venue owners, couples and enquiry leads, in line with South Africa's POPIA.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: "https://venuely.co.za/privacy",
      siteName: "Venuely",
      locale: "en_ZA",
      type: "website",
    },
  };
}

type Section = {
  heading: string;
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    heading: "Who we are",
    body: (
      <>
        <p>
          Venuely (&ldquo;Venuely&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the wedding-venue
          software platform at <span className="font-medium">venuely.co.za</span>. We are the
          responsible party (data controller) for the personal information described below. This
          policy explains what we collect, why, how long we keep it, and the rights you have under
          South Africa&rsquo;s Protection of Personal Information Act, 2013 (POPIA).
        </p>
        <p className="mt-3">
          Venuely is a multi-tenant platform: each wedding venue is a separate tenant that uses
          Venuely to manage its own couples, enquiries and bookings. Where a venue uses Venuely to
          process the personal information of its couples and leads, that venue is the responsible
          party for those records and Venuely acts as its operator (processor). For the account and
          billing data of venue owners themselves, Venuely is the responsible party.
        </p>
      </>
    ),
  },
  {
    heading: "Information we collect",
    body: (
      <>
        <p>We collect only the information needed to run the platform. Specifically:</p>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-medium">Venue owners &amp; staff.</span> Name, email address,
            phone number, the venue&rsquo;s business details (name, region, capacity, contact
            details, photos), subscription and billing information, and authentication data needed
            to secure your account.
          </li>
          <li>
            <span className="font-medium">Couples.</span> Names, contact details, wedding date and
            guest information, plus the planning data you enter into your private couple portal
            (budget, catalogue and rental selections, accommodation, guest list and RSVPs,
            timeline and checklist items).
          </li>
          <li>
            <span className="font-medium">Enquiry leads.</span> When you submit a
            &ldquo;request a quote / check availability&rdquo; form on a public venue listing, we
            collect the name, email, phone, preferred event date, guest count and any message you
            choose to share, together with the consent you give at submission.
          </li>
          <li>
            <span className="font-medium">Technical data.</span> Basic information your browser
            sends automatically (such as IP address and device/browser type) and minimal
            operational logs used to keep the service secure and reliable.
          </li>
        </ul>
        <p className="mt-3">
          We do not knowingly collect special personal information or the personal information of
          children, and we ask that you do not submit it through our forms.
        </p>
      </>
    ),
  },
  {
    heading: "Why we use it, and our lawful basis",
    body: (
      <>
        <p>
          Under POPIA we may only process personal information where we have a lawful basis. We
          rely on the following:
        </p>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-medium">To provide the service (performance of a contract).</span>{" "}
            Creating and securing accounts, running couple portals, processing enquiries and
            bookings, and supporting venues and couples.
          </li>
          <li>
            <span className="font-medium">Consent.</span> When you tick the consent box on an
            enquiry or review form, you agree to the relevant venue (and Venuely as its operator)
            contacting you about your enquiry and processing your details for that purpose. You may
            withdraw consent at any time (see your rights below).
          </li>
          <li>
            <span className="font-medium">Legitimate interests.</span> Keeping the platform secure,
            preventing fraud and abuse, and improving and supporting the service, balanced against
            your privacy.
          </li>
          <li>
            <span className="font-medium">Legal obligation.</span> Meeting tax, accounting and
            other legal requirements, for example retaining billing records.
          </li>
        </ul>
        <p className="mt-3">
          We do not sell your personal information, and we do not use enquiry or couple data for
          unrelated advertising.
        </p>
      </>
    ),
  },
  {
    heading: "How we store and protect it",
    body: (
      <p>
        Personal information is stored on managed, access-controlled infrastructure. Access is
        restricted by row-level security so that each venue can see only its own couples and
        enquiries, and each couple can see only their own portal. Data is encrypted in transit, and
        we apply reasonable technical and organisational safeguards as required by POPIA. Some of
        our service providers (such as our hosting, database and payment processors) may store data
        outside South Africa; where this happens we take steps to ensure a comparable level of
        protection.
      </p>
    ),
  },
  {
    heading: "How long we keep it",
    body: (
      <>
        <p>
          We keep personal information only for as long as it is needed for the purpose it was
          collected, or as required by law:
        </p>
        <ul className="mt-3 space-y-3">
          <li>
            <span className="font-medium">Enquiry leads</span> are retained while the venue works
            the lead and for a reasonable follow-up period afterwards, then deleted or anonymised
            unless the lead becomes a booking.
          </li>
          <li>
            <span className="font-medium">Couple and booking records</span> are retained for the
            duration of the engagement and a reasonable period afterwards to support the venue and
            resolve queries.
          </li>
          <li>
            <span className="font-medium">Account and billing records</span> are retained for as
            long as the account is active and thereafter for the periods required by tax and
            accounting law.
          </li>
        </ul>
        <p className="mt-3">
          When personal information is no longer needed, we delete or de-identify it.
        </p>
      </>
    ),
  },
  {
    heading: "Your rights",
    body: (
      <>
        <p>As a data subject under POPIA you have the right to:</p>
        <ul className="mt-3 space-y-2">
          <li>
            <span className="font-medium">Access</span> — ask what personal information we hold
            about you and obtain a copy.
          </li>
          <li>
            <span className="font-medium">Correction</span> — ask us to correct information that is
            inaccurate, irrelevant, out of date or incomplete.
          </li>
          <li>
            <span className="font-medium">Deletion</span> — ask us to delete or destroy information
            we are no longer entitled to keep.
          </li>
          <li>
            <span className="font-medium">Objection &amp; withdrawal of consent</span> — object to
            processing, or withdraw consent you previously gave, at any time. This will not affect
            processing that already took place.
          </li>
          <li>
            <span className="font-medium">Complaint</span> — lodge a complaint with the Information
            Regulator (South Africa) if you believe your rights have been infringed.
          </li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, contact us using the details below. Because enquiry and
          couple data is held by venues using Venuely, we may need to direct your request to the
          relevant venue, and we will help you do so.
        </p>
      </>
    ),
  },
  {
    heading: "Cookies & similar technologies",
    body: (
      <p>
        We use only the cookies and local storage strictly necessary to keep you signed in and to
        run the platform securely. We do not use third-party advertising or cross-site tracking
        cookies.
      </p>
    ),
  },
  {
    heading: "Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time. When we make material changes we will update
        the date at the top of this page and, where appropriate, notify account holders. Continued
        use of Venuely after an update means you accept the revised policy.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--cream)", color: "var(--ink)" }}>
      {/* Header (matches /venues) */}
      <header
        className="border-b"
        style={{ borderColor: "var(--line)", background: "rgba(255,246,240,0.9)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-2xl"
            style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}
          >
            Venuely.
          </Link>
          <Link
            href="/venues"
            className="text-sm hover:opacity-60 transition-opacity"
            style={{ color: "var(--ink-2)" }}
          >
            Browse venues
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-12 pb-6">
        <p
          className="text-xs uppercase tracking-[0.32em] mb-3"
          style={{ color: "var(--sage)" }}
        >
          Legal
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight" style={{ fontWeight: 900 }}>
          Privacy <span style={{ color: "var(--poppy)", fontStyle: "italic" }}>policy</span>
        </h1>
        <p className="mt-4 text-base" style={{ color: "var(--ink-2)" }}>
          How we look after your personal information, in line with South Africa&rsquo;s Protection
          of Personal Information Act (POPIA).
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--sage)" }}>
          Last updated {LAST_UPDATED}
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <article key={s.heading}>
              <h2
                className="font-serif text-2xl leading-snug"
                style={{ color: "var(--ink)", fontWeight: 700 }}
              >
                {s.heading}
              </h2>
              <div
                className="mt-3 text-sm leading-relaxed space-y-1 [&_ul]:list-disc [&_ul]:pl-5"
                style={{ color: "var(--ink-2)" }}
              >
                {s.body}
              </div>
            </article>
          ))}

          {/* Contact */}
          <article
            className="rounded-2xl p-6"
            style={{ background: "#fff", border: "1px solid var(--line)" }}
          >
            <h2
              className="font-serif text-2xl leading-snug"
              style={{ color: "var(--ink)", fontWeight: 700 }}
            >
              Contact us
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
              For any privacy question, or to exercise your rights of access, correction or
              deletion, reach our information officer at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium hover:opacity-70"
                style={{ color: "var(--poppy)" }}
              >
                {CONTACT_EMAIL}
              </a>
              . We aim to respond to all requests within a reasonable time as required by POPIA.
            </p>
          </article>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: "var(--line)", background: "var(--cream)" }}>
        <div
          className="max-w-3xl mx-auto px-6 py-8 text-xs flex flex-wrap items-center justify-between gap-3"
          style={{ color: "var(--ink-2)" }}
        >
          <span>© {new Date().getFullYear()} Venuely · Built for wedding venues.</span>
          <Link href="/" className="hover:opacity-60">
            Home
          </Link>
        </div>
      </footer>
    </div>
  );
}
