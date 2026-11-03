# Integrity Score preview 🧭

**Current status: Integrity is now one of the three primary grades in the interface; its methodology remains provisional and uncalibrated.** The formula and component calculator are implemented in `public/integrity.js`, profile evidence is consolidated in one Integrity section, and monthly comparisons are stored separately. The score is Not graded where required reviewed coverage is missing. Historical Ethics and Promises Delivered records are preserved and are not averaged into Integrity.

This adapted design is inspired by and credits [IntegrityIndex.us](https://integrityindex.us/methodology). Public Ledger's weights, caps, curves, midpoints, reference-campaign context, and evidence minimums are provisional and uncalibrated. This is not a claim to reproduce IntegrityIndex.us's numerical outputs.

## Overall formula

```text
available_average = sum(weight × complete component) / sum(available weights)
Integrity = clamp(available_average − Legal Trouble, 0, 100)
```

| Component | Weight |
|---|---:|
| Honesty | 30% |
| Personal Finances | 30% |
| Fundraising | 40% |

Missing components are omitted and the remaining weights normalized. At least **two complete components** are required, including for the president. A dated, sourced Legal Trouble review is independently required; unknown legal input is not zero. Legal Trouble is subtracted after the weighted average at full strength. Only the final displayed grade is rounded, using the application's standard A–F thresholds. A missing required input makes Integrity Not graded with an explanation.

## Honesty

```text
H = 100 × (kept + 0.5 × partly kept) / counted checks
```

At least three counted checks are required. Pending and ambiguous checks do not enter the denominator. The preview reuses reviewed Promises Delivered evidence and the president's PolitiFact tracker handling. Flip-Flop and Pants on Fire are future additions, not implemented indices; no scores are invented for them.

## Personal Finances

```text
Hill(x, midpoint) = x^0.745 / (midpoint^0.745 + x^0.745)
S = 20 × Hill(stock value, $400,000)
T = 20 × Hill(trade count, 50) + 20 × Hill(trade value, $1,000,000)
F = clamp(100 − S − T − 0.20 × Insider Trading
          − 0.20 × Stock Disclosure Dodger, 0, 100)
```

Stock value is the sum of midpoints for individual-stock position ranges in one reviewed annual holdings snapshot, never net worth or average value per holding. The snapshot date is separate from the trade period. Complete reviewed coverage, sources, readable values, transaction deduplication, filing dates, and reporting deadlines are required. An open-ended or unreadable amount stays unknown until a reviewed valuation resolves it. Missing filing dates do not imply timely filing.

Only assets and trustee trades verified inside a qualified blind trust after its effective date are excluded. Outside assets, earlier trades, personal disclosure failures, and historical trades remain. Divesting later does not erase earlier activity. Profiles outside congressional disclosure coverage have no Personal Finances component.

## Fundraising

```text
M = clamp(75 + D − P − R − E + pledge points, 0, 100)
```

Every monetary share is divided by total campaign receipts for the same reporting period.

**Donor score D:** `clamp(sum(category dollars / receipts × weight), 0, 14)`. Mutually exclusive buckets use: small gifts including unitemized (counted once) 14; $200–499 10; $500–999 6; $1,000–1,999 3; $2,000+ 2; itemized FEC gifts not yet sorted 5.2; self-funding 1; joint fundraising 1. The repository's FEC bucket edges are ≤$200, $200.01–$499.99, $500–$999.99, $1,000–$1,999.99, and ≥$2,000. A missing donor-size fetch is unavailable, not unsorted.

**PAC penalty P:** `min(30, sum(PAC dollars / receipts × 100 × category rate))`. Rates per percentage point of receipts: corporate 2; lobbyist 1; trade/membership/cooperative 0.2; political/leadership/party/candidate 0.1; ideological/nonconnected 0.1; union/other 0.05. PAC categories must reconcile to the reviewed same-period PAC total.

**PAC reliance R:** `10 × Hill(PAC dollars / receipts, 0.20)`.

**Earmark penalty E:** `min(30, eligible earmarked dollars / receipts × 100 × 4)`. Bundling groups use the same rate; ActBlue and WinRed are excluded. Duplicate receipts and direct-PAC/routed-gift duplication must be removed. Current selected-group conduit collection is partial and cannot establish complete earmark coverage or a zero total.

**Pledge points:** corporate PAC refusal, congressional stock-trading ban, former-member lobbying ban, and overturning Citizens United. Each category contributes once: reviewed kept +1; reviewed broken −1; no pledge but qualifying bill cosponsorship +1; neither or awaiting review 0. A pending pledge cannot use the no-pledge fallback. There are no no-corporate-PAC or no-stocks abstention bonuses.

## Legal Trouble deduction

The preview subtracts the existing Legal Trouble Index after component averaging. A review must be dated, sourced, and explicit even if it finds no scored cases. Existing Ethics rules determine its 0–100 value. A missing review is unknown, never a clean 0.

## Workers > Profit comparison

The separate preview CCI removes the direct business-PAC-share component. Remaining relative weights are employee giving 10%, business-funder voting 35%, and lobbied bills 20%, normalized over available implemented components. The comparison is `0.75 × existing legislative-action score + 0.25 × (100 − preview CCI)`. If preview CCI is unavailable, use the legislative-action score alone, subject to its current evidence minimum. The published Workers > Profit grade and CCI remain unchanged.

## Current limitations and cutover conditions

The method is in code, but formula implementation is not the same as a complete, calibrated score. Current methodology notes that reviewed annual holdings/trade coverage is not yet available as complete score input, sourced Legal Trouble coverage reviews are not recorded for profiles, earmark coverage is incomplete, and employee-giving/lobbied-bill CCI inputs are not built. Those values remain unavailable rather than clean. As a result, an overall Integrity grade may not be produced even while the component explanations are visible.

Integrity comparisons are stored in `public/integrity-preview-log.json`, separate from official score history. No automatic methodology switch is allowed. Cutover requires a monthly comparison period, reviewed live financial coverage, source-backed calibration, and a later explicit methodology migration. Ethics and Promises Delivered are no longer separate headline grades, but their past published values remain in official history and their supporting evidence remains accessible within Integrity.

See [Ethics and its indices](03_ETHICS_SCORE.md), [Promises Delivered](04_PROMISES_DELIVERED_SCORE.md), [Workers > Profit](07_WORKERS_OVER_PROFIT_SCORE.md), and the [canonical score inventory](00_POLITICAL_SCORECARD_METHODOLOGY.md).
