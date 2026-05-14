# Venuely: Real-Time Payment Splitting in South Africa (2026)

**Verdict up top:** The fantasy of "R200k arrives, R2k to Venuely + R198k to venue, both instant, zero KYC on the venue" **does not exist in ZA in 2026.** The closest realistic v1 is **Paystack Transaction Splits** (collect on card/EFT, auto-split at settlement, venue onboards as a "subaccount"). Everything fancier (Stitch PayOS, Peach Marketplace, dLocal-style PayShap splits) is enterprise-sales, weeks-to-months bake, and still requires sub-merchant KYC.

---

## 1. Stitch (stitch.money)

Stitch's 2026 stack is **PayOS** (orchestration), **Payouts** (RTC/RPP/SDV rails, 24/7), and the new **BNPL**. Their `/solutions-for-marketplaces-platforms` page positions for ride-share/marketplace, but the productised flow is **collect → Stitch float → API-initiated payout to vendor**, not atomic split-at-settlement on the card rail. Effectively **T+0 via RTC/PayShap payout**, not "single transaction, two destinations." Enterprise sales, ISO 27001, no self-serve sign-up. Sub-merchant KYC required (they partner around FICA/AML in-house).
- **Bake to first split:** 4-8 weeks (sales + contract + integration).
- **Disqualifier Q:** "Can a single card auth be settled directly to two bank accounts without funds touching a Stitch-held float?" (Almost certainly **no** — it's a payout from float.)

## 2. Peach Payments

Peach supports "split payments" but the genuine **marketplace/sub-merchant** product requires **Visa/Mastercard Payment Facilitator or Marketplace registration** — Peach is the PayFac, Venuely would be the marketplace, each venue is a sub-merchant with **FICA KYC** (CIPC docs, proof of bank, director ID, proof of address, sometimes 3mo bank statements). Nov 2025 they partnered with RelyComply to automate exactly this KYC scaling — which tells you it's a real, non-trivial onboarding step. **Real-Time Clearance (RTC) payouts** launched 2025.
- **Bake to first split:** 6-10 weeks (sales → marketplace agreement → first sub-merchant FICA → live).
- **Disqualifier Q:** "What is the median time from a venue submitting FICA docs to that venue receiving its first split payout?"

## 3. Paystack (ZA)

**Transaction Splits / Multi-split** is the most self-serve real product in this list. Platform creates **subaccounts**, defines split percentages or flat amounts, Paystack settles each party's share directly on the normal ZAR settlement cycle (T+1 / T+2 for cards in ZA). Subaccount verification step exists — payouts are held until the subaccount's bank account is verified. **Chargeback liability sits with the merchant of record** per their ToS (in ZA practice, that's effectively the platform/main account — `the merchant is responsible for the full amount of any disputes... regardless of any agreements to share liability`). Per-transaction split fee is normal Paystack pricing (~2.9% + R1 cards, ~1.5% capped EFT), no extra split fee.
- **Bake to first split:** **3-7 days** (this is the only realistic <4-week answer).
- **Disqualifier Q:** "If a couple chargebacks R200k after the R198k has already settled to the venue subaccount, who eats the loss — Venuely or Paystack pulls from the venue?"

## 4. Ozow / Pay by Bank

Instant EFT only. No productised marketplace-split. Their docs cover payouts/refunds, but no native multi-destination split at authorisation. Would need Venuely to receive full amount + manually push payout. **Not a real candidate.**

## 5. iKhokha PayLink

SMB card/QR/link tool. **No marketplace/split product.** Skip.

## 6. Adumo / Lesaka / Network International

Adumo is card acquiring (no SaaS marketplace SDK). Lesaka is enterprise/retail focus. Network International is regional acquirer, not platform-facing. **None ship a self-serve marketplace API in ZA.** Skip for a solo founder.

## 7. PayShap / RPP — the holy grail check

PayShap limit is now **R50,000 per transaction** (BankservAfrica, Aug 2024). **A R200k wedding payment cannot fit in one PayShap.** This kills PayShap as the primary rail for Venuely's use case.

dLocal/inDrive (May 2026, TechAfrica News) **does** do real-time split + driver payouts in ZA — but dLocal is enterprise-only, contract-led, and built for cross-border platforms with volume. Not solo-founder territory.

---

## Ranked recommendation

| Rank | Provider | Bake | Reality |
|---|---|---|---|
| **1** | **Paystack Subaccounts** | **3-7 days** | Closest thing to "ship it in 4 weeks." Not atomic-on-the-rail, but settled-split on T+1. Chargeback risk sits on Venuely — price the 1% to cover it. |
| 2 | Peach Marketplace | 6-10 wks | Right product, wrong timeline for v1. |
| 3 | Stitch PayOS + Payouts | 4-8 wks | Float-then-payout model. Good v2. |
| 4 | DebiCheck monthly | 2-3 wks | Honest fallback. Bounce risk + delayed cash, but FICA-light for venues. |
| — | PayShap-only | n/a | R50k cap kills it. |
| — | Ozow / iKhokha / Adumo | n/a | No marketplace product. |

**Honest answer for v1 in <4 weeks: Paystack Subaccounts.** Couple pays full amount → Paystack splits at settlement T+1 → venue gets R198k next business day, Venuely gets R2k next business day. It is **not** instant, but it is **auto-split, no manual reconciliation, and the venue's KYC = one bank-account verification, not a FICA file.** If the founder wants instant + atomic, the answer is **wait for v2 with Peach Marketplace or Stitch**, OR accept DebiCheck. There is no 2026 ZA product that gives instant split + zero venue KYC.

---

## Sources

- https://stitch.money/
- https://stitch.money/payouts
- https://stitch.money/orchestration
- https://stitch.money/solutions-for-marketplaces-platforms/
- https://thepaypers.com/payments/news/peach-payments-launches-real-time-clearance-payouts
- https://fintech.global/2025/11/19/peach-payments-and-relycomply-boost-aml-compliance/
- https://www.peachpayments.com/
- https://paystack.com/docs/payments/split-payments/
- https://paystack.com/docs/payments/multi-split-payments/
- https://paystack.com/za/terms
- https://support.paystack.com/en/articles/2127234
- https://support.paystack.com/en/articles/2132802
- https://ozow.com/faq
- https://ozow.com/blog/forget-instant-eft-its-pay-by-bank
- https://www.ikhokha.com/pay-link
- https://stitch.money/blog/what-is-payshap-the-rapid-payments-programme-in-south-africa
- https://techafricanews.com/2026/05/05/dlocal-powers-indrives-cashless-payments-rollout-in-south-africa-with-real-time-splits-and-payouts/
- https://www.payshap.co.za/
