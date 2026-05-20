import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--cream)" }}
    >
      <Link href="/" className="flex items-center gap-3 mb-10 hover:opacity-90 transition-opacity">
        <LogoMark size={88} />
        <span
          className="font-serif text-5xl"
          style={{ color: "var(--poppy)", fontWeight: 900, letterSpacing: "-0.03em" }}
        >
          Venuely.
        </span>
      </Link>

      <div className="relative w-full max-w-2xl">
        {/* Envelope back + flap + body, drawn as inline SVG so the letter sits on top. */}
        <svg
          viewBox="0 0 600 380"
          className="w-full h-auto drop-shadow-[0_24px_40px_rgba(28,25,23,0.18)]"
          aria-hidden
        >
          {/* Envelope back panel */}
          <path d="M30 130 H570 V350 Q570 360 560 360 H40 Q30 360 30 350 Z" fill="var(--peach)" />
          {/* Inner shadow at the mouth */}
          <path d="M30 130 L300 280 L570 130 Z" fill="rgba(0,0,0,0.06)" />
          {/* Opened flap (folded back) */}
          <path
            d="M30 130 L300 0 L570 130 L300 60 Z"
            fill="var(--poppy)"
            opacity="0.92"
          />
          {/* Flap top-edge highlight */}
          <path d="M30 130 L300 0 L570 130" stroke="var(--poppy-deep)" strokeWidth="1.5" fill="none" />
          {/* Front pocket bevel */}
          <path d="M30 350 L300 220 L570 350" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" fill="none" />
        </svg>

        {/* Letter paper — sits above the envelope, copy centred on it */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bg-white rounded-md px-10 py-10 text-center"
          style={{
            top: "10%",
            width: "min(78%, 460px)",
            border: "1px solid var(--line)",
            boxShadow: "0 18px 40px -18px rgba(28,25,23,0.25)",
          }}
        >
          <div
            className="mx-auto mb-5 w-12 h-12 rounded-full flex items-center justify-center text-lg"
            style={{ background: "var(--peach)", color: "var(--poppy-deep)" }}
          >
            ✉
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl leading-tight">Check your inbox</h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
            We&apos;ve sent a confirmation link
            {email ? (
              <>
                {" "}to <span style={{ color: "var(--poppy)", fontWeight: 600 }}>{email}</span>
              </>
            ) : null}
            . Click it and you&apos;ll land straight in your new venue dashboard.
          </p>
          <p className="mt-5 text-xs" style={{ color: "var(--ink-2)" }}>
            Didn&apos;t get it? Check spam, or try{" "}
            <Link href="/signup" className="underline" style={{ color: "var(--poppy)" }}>
              another address
            </Link>
            .
          </p>
        </div>
      </div>

      <p className="mt-12 text-xs" style={{ color: "var(--ink-2)" }}>
        Already confirmed?{" "}
        <Link href="/login" className="underline" style={{ color: "var(--poppy)" }}>
          Log in
        </Link>
      </p>
    </main>
  );
}
