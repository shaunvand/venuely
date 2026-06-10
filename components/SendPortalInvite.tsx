"use client";

import { useState, useTransition } from "react";
import type { SendPortalInviteResult } from "@/app/venue/weddings/actions";
import { useLoading } from "@/components/LoadingProvider";

export function SendPortalInvite({
  portalUrl,
  passwordSet,
  lastOpenedAt,
  sendAction,
}: {
  portalUrl: string;
  passwordSet: boolean;
  lastOpenedAt: string | null;
  // Pre-bound server action: sendPortalInvite.bind(null, weddingId, slug)
  sendAction: (opts: { email?: string; whatsapp?: string }) => Promise<SendPortalInviteResult>;
}) {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<SendPortalInviteResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const loading = useLoading();

  // The live link is whatever the action last returned, else the SSR-provided URL.
  const liveUrl = result?.url ?? portalUrl;
  // A wa.me link: prefer the one the action built (carries the access code);
  // otherwise build a bare share link client-side from the typed number.
  const waUrl = result?.whatsappUrl ?? buildWaUrl(whatsapp, liveUrl);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(liveUrl)}`;

  function copyUrl() {
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function send() {
    loading.show("Sending the couple their link…");
    startTransition(async () => {
      try {
        const r = await sendAction({ email: email.trim(), whatsapp: whatsapp.trim() });
        setResult(r);
        loading.complete("Sent ✓");
      } catch (e) {
        loading.hide();
        throw e;
      }
    });
  }

  return (
    <div className="vy-card space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="vy-eyebrow">Invite the couple</div>
        {lastOpenedAt ? (
          <span className="vy-tag vy-tag-active text-xs">
            Couple last opened: {new Date(lastOpenedAt).toLocaleString()}
          </span>
        ) : (
          <span className="vy-tag vy-tag-soft text-xs">Not opened yet</span>
        )}
      </div>

      <p className="text-xs text-stone-500">
        Send the couple their portal link and access code by email and/or WhatsApp.
        {passwordSet ? "" : " A friendly access code is generated automatically on first send."}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="vy-label">Couple email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="couple@example.com"
            className="vy-input w-full"
          />
        </div>
        <div className="space-y-1">
          <label className="vy-label">WhatsApp number (optional)</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="082 123 4567"
            className="vy-input w-full"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={send} disabled={isPending} className="vy-btn vy-btn-primary">
          {isPending ? "Sending…" : "Send link & access"}
        </button>
        <button onClick={copyUrl} className="vy-btn vy-btn-secondary">
          {copied ? "✓ Link copied" : "Copy link"}
        </button>
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 whitespace-nowrap"
          >
            ↗ Share on WhatsApp
          </a>
        ) : null}
      </div>

      {result && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm space-y-1">
          {result.password && (
            <p>
              Access code generated:{" "}
              <span className="font-mono font-semibold text-[var(--poppy)]">{result.password}</span>{" "}
              <span className="text-stone-500 text-xs">(share this with the couple)</span>
            </p>
          )}
          <p className="text-stone-600">
            {result.emailSent
              ? "✓ Email sent to the couple."
              : result.reason === "email_not_configured"
                ? "Email not configured — copy the link or share via WhatsApp."
                : result.reason === "no_email"
                  ? "No email entered — link is ready to copy / WhatsApp."
                  : "Could not send email — link is still ready to share."}
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 border-t border-stone-200 pt-4">
        {/* QR via a public endpoint — no npm dependency added. */}
        <img
          src={qrSrc}
          alt="Portal QR code"
          width={108}
          height={108}
          className="rounded-lg border border-stone-200 bg-white p-1"
        />
        <div className="text-xs text-stone-500">
          <p className="font-medium text-stone-700">Scan to open the portal</p>
          <p>Show this QR at a viewing or print it on the welcome pack.</p>
        </div>
      </div>
    </div>
  );
}

// Mirror of lib/whatsapp.ts whatsappUrl, kept client-side so the "Share" button
// works before the server action runs. Strips formatting, defaults to +27 (ZA).
function buildWaUrl(phone: string, url: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = "27" + digits.slice(1);
  if (digits.length === 9 && !digits.startsWith("27")) digits = "27" + digits;
  if (!/^\d{8,15}$/.test(digits)) return null;
  const msg = `Hi! Your wedding planning portal is ready 💍\n\n${url}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}
