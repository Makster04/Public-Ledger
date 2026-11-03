# Integrity 🧭

**How consistently does this politician keep commitments, manage financial conflicts, and meet accountability standards?**

**Status: primary grade, provisional and uncalibrated.** The formula and component calculator are implemented in `public/integrity.js`, and profile evidence is consolidated in one Integrity section. Promises and ethics evidence are available within Integrity. Historical Ethics and Promises Delivered grades remain accessible in the official monthly history and are never averaged into Integrity.

Integrity combines three components:

| Component | Weight | What it includes |
|---|---:|---|
| **Honesty** | **30%** | The **Promises Delivered Index**, based on reviewed kept, partly kept, and broken commitments. |
| **Personal Finances** | **30%** | The **Insider Trading Index**, **Stock Disclosure Dodger Index**, and the approved holdings and trading penalties. |
| **Fundraising** | **40%** | Donor-size contributions, PAC-type and PAC-reliance penalties, earmarked-donation penalties, and verified pledge adjustments, adapted from [IntegrityIndex.us](https://integrityindex.us/methodology). |

The **Legal Trouble Index** is deducted at full strength after averaging the available components:

```text
Integrity =
    weighted average of available components
    − Legal Trouble

Final result is bounded between 0 and 100.
```

In detail:

```text
available_average = sum(weight × complete component) / sum(available weights)
Integrity = clamp(available_average − Legal Trouble, 0, 100)
```

**Evidence requirements:**
- At least **two complete components** and a **sourced Legal Trouble review** are required, including for the president.
- Missing components are excluded, and the remaining weights are normalized.
- Insufficient evidence produces **"Not graded,"** rather than an assumed clean record. Unknown legal input is not zero.
- Honesty requires at least **three counted promise checks**.

Only the final displayed grade is rounded, using the standard A–F thresholds.

**Flip-Flop** and **Pants on Fire** are planned additions to Honesty once their methods and evidence are ready.

This adapted design credits [IntegrityIndex.us](https://integrityindex.us/methodology). Public Ledger's weights, caps, curves, midpoints, reference-campaign context, and evidence minimums are its own provisional choices; this is not a claim to reproduce IntegrityIndex.us's numerical outputs.

## Honesty: the Promises Delivered Index

```text
H = 100 × (kept + 0.5 × partly kept) / counted checks
```

At least three counted checks are required. Pending and ambiguous checks do not enter the denominator. The preview reuses reviewed Promises Delivered evidence and the president's PolitiFact tracker handling. Flip-Flop and Pants on Fire are planned additions, not implemented indices; no scores are invented for them.

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

## People First comparison

The proposed CCI revision removes the direct business-PAC-share component and reweights employee giving (10%), business-funder voting (35%), and lobbied bills (20%) over the available implemented components. The comparison is `0.75 × existing legislative-action score + 0.25 × (100 − preview CCI)`, or the legislative-action score alone if the preview CCI is unavailable. The published People First calculation continues using the existing CCI until the revision is explicitly adopted. See [People First](04_PEOPLE_FIRST_SCORE.md).

## Methodology status, limitations and cutover conditions

Integrity's provisional parameters and the proposed CCI revision still require calibration and evaluation. Holdings penalties, funding penalties, and pledge adjustments are calculation components, rather than additional standalone indices.

The method is in code, but formula implementation is not the same as a complete, calibrated score. Current methodology notes that reviewed annual holdings/trade coverage is not yet available as complete score input, sourced Legal Trouble coverage reviews are not recorded for profiles, earmark coverage is incomplete, and employee-giving/lobbied-bill CCI inputs are not built. Those values remain unavailable rather than clean. As a result, an overall Integrity grade may not be produced even while the component explanations are visible.

Integrity comparisons are stored in `public/integrity-preview-log.json`, separate from official score history. No automatic methodology switch is allowed. Cutover requires a monthly comparison period, reviewed live financial coverage, source-backed calibration, and a later explicit methodology migration. Ethics and Promises Delivered are no longer separate headline grades, but their past published values remain in official history and their supporting evidence remains accessible within Integrity.

See [Ethics and its indices](06_ETHICS_INDICES.md), [Promises Delivered](05_PROMISES_DELIVERED_INDEX.md), [People First](04_PEOPLE_FIRST_SCORE.md), and the [canonical score inventory](00_POLITICAL_SCORECARD_METHODOLOGY.md).
