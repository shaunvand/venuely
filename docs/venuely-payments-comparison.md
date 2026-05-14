# Venuely ZA Payments Comparison — 2026-05

Use-case: B2B SaaS taking **1% commission** off couple-paid wedding totals (R40k–R200k). Solo founder, <10 venues, pre-revenue.

## Provider matrix

| Provider | Sub-merchant / Split | KYC friction | ZAR settlement | Marketplace gating | Chargeback liability | DebiCheck |
|---|---|---|---|---|---|---|
| **Peach Payments** | Split Payments (true sub-merchant, Visa "marketplace" registered) | Each sub-merchant fully KYC'd by Peach Ops; FICA docs (CIPC, ID, proof of bank, proof of address). Not <10 min, not self-serve embed. | T+1 daily, weekdays only | Visa Marketplace registration required for platform; documented at support article (Visa ref AI12076) | Lands on **sub-merchant** (acquirer holds platform jointly liable if no marketplace reg) | Yes (Peach DebiCheck) |
| **Stitch** | PayOS + Sub-account, enterprise tier | Enterprise contract; KYB on platform, sub-account KYB on each venue. Not self-serve in <10 min. | T+1 for cards; Pay-by-bank near-instant | Stitch sales-gated; volume conversation; not turn-on-and-go | Sub-account; Stitch handles dispute pipeline | **Yes — strongest** (TT1 real-time, TT2 batch, TT3 card-present) |
| **Paystack** | Subaccounts + Multi-split (percentage or flat, multiple recipients) | Subaccount = bank account + business name; **lighter than Peach** but full KYC still triggers verification delay on first payout. Programmatic via API. | T+1 ZA business days (after first verification clears) | No marketplace approval letter for basic split; standard ToS | **Merchant of record bears** — "merchants are responsible for the full amount of disputes, regardless of agreements to share." 48h auto-accept if no response. | No DebiCheck |
| **PayFast (Network Intl)** | Split Payments (fixed / % / combo, recurring supported) | Both parties must be **fully onboarded PayFast merchants**. Standard FICA. Not embeddable; venue signs up separately. | T+1–T+2 | None advertised | Sub-merchant | No (separate Adumo product) |
| **Stripe Connect** | N/A directly. Stripe does **not** support ZA-domiciled businesses. ZA reachable only via Paystack (Stripe-owned). | — | — | — | — | — |
| **Yoco** | Online gateway is **waitlist / phased onboarding** in 2026 — confirmed closed-ish. No marketplace split product. | Fast for own merchant (15 min ID+selfie), but no sub-merchant model. | T+1 | N/A | Merchant | No |

## Option C — DebiCheck mandate fallback (founder didn't consider)

**Mechanic**: Each venue signs a DebiCheck mandate at Venuely signup. Venue keeps its own gateway for couple payments. Venuely tallies confirmed wedding totals in-dash and auto-debits 1% monthly via Stitch (or Peach) DebiCheck. SARB-authenticated → bank must approve disputes → near-zero repudiation. New April 2026 60-day dispute rule explicitly **excludes properly-mandated DebiCheck** if collected per mandate terms.

- **Viable?** Yes, and arguably the cleanest v1 — Venuely is collecting *from venues*, not couples, so **no marketplace registration, no sub-merchant KYC on couples, no chargeback exposure on R40k–R200k wedding totals**.
- **Minimum debit amount**: PASA imposes no statutory minimum; Stitch/Peach typically R1+. A R200k wedding × 1% = R2,000 debit — comfortably above any floor.
- **Mandate flow for venue**: TT1 (real-time, in-app via bank app push / USSD / banking app — venue authorises within 120s) is the path. TT2 batch is fallback (2 business days). TT3 is card-present (not relevant here). Flow is: Venuely → Stitch API → venue's bank → venue authorises via their *own* banking app (FNB / Standard Bank / ABSA / Nedbank / Capitec / Investec all support DebiCheck). No Venuely-side bank app needed.
- **Real friction**: ~3–5 min per venue, but **requires venue to be at their phone with banking app logged in**. Sales call doable in one Zoom.

## Recommendation — opinionated

**Go with Option C (DebiCheck via Stitch) as v1.** Reasoning for a solo, pre-revenue founder at <10 venues:

1. **Ship speed**: No Visa marketplace registration. No sub-merchant KYC pipeline to build. Stitch DebiCheck Mandates API + a simple monthly cron tallying confirmed weddings = **integrable in <2 weeks**.
2. **Risk surface**: You never touch couple money. No PCI scope on R40k–R200k flows. No chargeback liability — the new April 2026 60-day window only bites non-DebiCheck debit orders.
3. **Pricing leverage**: Stitch DebiCheck per-transaction fee (~R3–R5) on a R2k commission = 0.15–0.25% cost vs 2.5–3.5% on a card split.
4. **If you must do splits later**: Add **Paystack Subaccounts** (cheapest API, T+1, programmatic) once you hit ~20 venues and want couples paying through Venuely. Peach Marketplace only when you have a Visa volume story.

**Avoid v1**: Peach Marketplace (Visa registration latency), Stripe Connect (not ZA), Yoco (no split, waitlisted), PayFast Split (each venue must onboard separately = same friction as marketplace without the embed).

**Single thing to do FIRST this week**: Book a 30-min call with Stitch sales (stitch.money) and explicitly ask: *"DebiCheck Mandates API only, ~10 collecting businesses Y1, ZAR R1k–R5k monthly debit per business — what's pricing, minimum commit, and onboarding KYB scope on Venuely as the collecting party?"* Their answer (commit floor + per-txn fee + KYB doc list) is the only thing that can kill Option C. If they quote an enterprise minimum, fall back to Peach DebiCheck or Direct Debit aggregators (Hyphen, NuPay, StratCol).

## Sources

- Peach Payments onboarding: https://support.peachpayments.com/support/solutions/articles/47001220838-onboarding-process-for-merchants-being-settled-by-peach
- Peach marketplace (Visa ref AI12076): https://support.peachpayments.com/support/solutions/articles/47001239566-marketplace-requirements-by-visa-ref-ai12076
- Peach developer hub: https://developer.peachpayments.com/
- Stitch DebiCheck: https://stitch.money/payment-methods/debicheck
- Stitch DebiCheck guide (TT1/TT2/TT3): https://stitch.money/blog/debicheck-the-ultimate-guide
- Stitch Recurring Payments: https://stitch.money/solutions/recurring-payments
- Stitch PayOS: https://stitch.money/orchestration
- Paystack Multi-split docs: https://paystack.com/docs/payments/multi-split-payments/
- Paystack getting-your-money / settlement: https://support.paystack.com/en/articles/2125314
- Paystack chargeback policy: https://support.paystack.com/en/articles/2127234
- Paystack ZA terms: https://paystack.com/za/terms
- PayFast Split Payments: https://payfast.io/features/split-payments/
- Stripe global / ZA: https://stripe.com/global
- Yoco online gateway FAQ (waitlist): https://support.yoco.help/en/articles/109553-yoco-online-payment-gateway-faqs
- 60-day debit dispute rule (April 2026): https://www.arcadiafinance.co.za/news/major-changes-to-debit-order-disputes/
