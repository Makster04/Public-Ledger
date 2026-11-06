# Integrity 🧭

> **Five parts:** Honesty 20%, Personal Finances 20%, Fundraising 25%, Showing Up 15% and Conflicts of Interest 20%, minus Legal Trouble. Every formula is in [03a_INTEGRITY_REVISION.md](03a_INTEGRITY_REVISION.md); Conflicts of Interest is not graded until its disclosure reader is built.

**How consistently does this politician keep commitments, manage financial conflicts, and meet accountability standards?**

**Status: primary grade; its parameters are provisional.** Calculated in `public/integrity.js`. Promises and ethics evidence are available within Integrity. Historical grades remain accessible.

Integrity combines three components:

| Component | Weight | What it includes |
|---|---:|---|
| **Honesty** | **20%** | The **Promises Delivered Index**, based on reviewed kept, partly kept, and broken commitments. |
| **Personal Finances** | **20%** | The **Insider Trading Index**, **Stock Disclosure Dodger Index**, and the approved holdings and trading penalties. |
| **Fundraising** | **25%** | Donor-size contributions, PAC-type and PAC-reliance penalties, earmarked-donation penalties, and verified pledge adjustments, adapted from [IntegrityIndex.us](https://integrityindex.us/methodology). |
| **Showing Up** | **15%** | 75% Attendance (roll-call votes missed while in office since 2018: `100 − 5 × missed %`, floored at 0; cited medical leave, birth or adoption, a death in the family, and military duty left out; votes missed while campaigning count) and 25% Get It Done (sponsored bills advanced against the typical member of their party in their chamber). |
| **Conflicts of Interest** | **20%** | Outside Income & Conflicts and Gifts & Travel, from the latest annual or candidate report; see [03a_INTEGRITY_REVISION.md](03a_INTEGRITY_REVISION.md). |

**Showing Up:** `0.75 × Attendance + 0.25 × Get It Done`. **Attendance:** `clamp(100 − 5 × missed %, 0, 100)`, where missed % is the share of roll-call votes the member missed while in office from 2018 through the current year. The record is Voteview's file of every roll call in both chambers (built into `public/attendance.json` by `npm run attendance:build`): "not voting", paired and announced votes are missed; Yea, Nay and Present count as there; votes before a member joined or after they left don't count. 2% missed scores 90, 10% scores 50, 20% or more scores 0. Votes missed while campaigning count as missed. A reviewed absence with a cited source in the person's `absences` in `public/research.json` (`{from, to, reason, src}`, reason `medical`, `birth`, `adoption`, `bereavement` or `military`) is left out of both the votes and the misses for its dates; any other reason, or one without a source, is not. At least 50 votes in office in those years are required: a former member who served then is counted for the time they served, and a candidate who hasn't served has no Showing Up part. The record shows that a vote was missed, not why or where the member was, and the page never says more than that.

**Get It Done** (25% of Showing Up, with Attendance 75%; Attendance alone when Get It Done isn't available): `100 × min(1, their advanced rate ÷ the typical rate of their party in their chamber)`, over the Congresses since 2018 (the 115th through the 119th now), the typical rate weighted by their own bills in each Congress. Bills and joint resolutions they sponsored count (not simple or concurrent resolutions); one advanced when its latest action on Congress.gov shows a committee reporting it, a calendar placement, passage of either chamber, its arrival in the other, presentment, signing or law. At least 10 sponsored bills. A party's typical rate is the median of its members with at least 5 such bills that Congress; independents are compared with the party they caucus with. Built into `public/get-it-done.json` by `npm run getitdone:build` (Congress.gov with `CONGRESS_API_KEY`, and Voteview's member lists for parties).

**Conflicts of Interest:** `clamp(100 − (0.60 × Outside Income & Conflicts + 0.40 × Gifts & Travel), 0, 100)`, from the latest annual or candidate report and reviewed matches of the organizations on it, read from `public/conflicts.json`. Outside Income & Conflicts = 0.40 × I (income, board seats and agreements with interested organizations) + 0.25 × Lobbyist Overlap + 0.20 × Contracts for Donors + 0.15 × Foreign Agent Flag, over the parts available; Gifts & Travel scores gifts and paid trips from interested organizations by value and number. The formulas, thresholds and the definition of an interested organization are in [03a_INTEGRITY_REVISION.md](03a_INTEGRITY_REVISION.md). The formulas are built; the reader that fills `public/conflicts.json` from the disclosures is not yet, so this part is not graded for anyone until then.

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

## Honesty: the Promises Delivered Index 📦

The Promises Delivered Index measures reviewed commitments and stated positions against documented actions. It does not measure whether a politician is generally truthful in every setting.

```text
H = 100 × (kept + 0.5 × partly kept or changed) / counted checks
```

| Reviewed check | Credit |
|---|---:|
| Supported/kept | 1 |
| Partly supported or changed position | 0.5 |
| Contradicted | 0 |

At least three counted checks are required. Pending, ambiguous, vague, and outcome-dependent checks are excluded. A promise the politician could have acted on but did not by the end of the relevant term is recorded as contradicted. Counts and individual reviews remain visible on the profile with quotes, dates, and sources.

**Where checks come from:** researchers' own reviews, and the promise finder (`npm run promises:find`), which reads every collected floor speech, press release, Bluesky and Threads post and YouTube title for commitments: a sentence saying what the person will do ("I will vote no"), or the side they take now ("I oppose", "I rise in support of"). Reports of what they already did ("I voted for") are not commitments. Each commitment is linked to a bill in one of two ways:

- **By name:** it names the bill, by number or name (in the sentence, the press-release headline or the floor speech's title), and they voted on it within two years afterward.
- **By subject:** it names no bill, but within 30 days afterward they voted on one whose title, summary or descriptions share its subject (SALT, Ukraine aid, the debt limit, a nominee's name).

A sentence linked only through the speech's title, or by subject, has to be about a measure (a bill, a deal, a vote, a nominee) and, by subject, take a clear side: "I urge my colleagues to support this legislation" is linked; "we must take real action on AI" in a speech filed under a bill's title, or "support for Israel" near a vote on a resolution about Israel, is not. A statement about introducing a bill is linked to that bill by name, never to a vote on another bill of the same subject. The queue lists the surest items first: the bill named and a final vote that clearly matches or doesn't (high), then subject links with a final vote and matching procedural votes (medium), then the rest (low).

A draft verdict comes from the deciding vote (the last final-passage vote, or a procedural vote if that is all there is): the side they took and the side they voted match, kept; they don't, broken; only a matching procedural vote, partly kept. Nothing counts until a person reviews it (`npm run promises:review`). The reviewer is shown what to check: a condition in the promise ("if the Senate reduces the SALT number…"), a procedural vote only, a vote the same day as the statement, a link by subject rather than by name, or votes that went both ways. Each person, bill and side is checked once, from the earliest statement, and a bill already checked for that person is not offered again. Checks found this way are marked on the profile.

**The president:** reviewed PolitiFact tracker tallies. Promise Kept earns 1; Compromise earns 0.5; Promise Broken earns 0. Stalled and In the Works are not counted until given a final rating. The same three-check minimum applies.

**Money-related pledges:** pledge records are checked against FEC and legislative records as supporting evidence on the reviewed promise. The records check is shown alongside the verdict and can flag a conflict for human review; it does not silently replace the reviewed verdict or add a second promise point. Pledges count separately in Fundraising (below).

**Planned additions:** Flip-Flop and Pants on Fire, once their methods and evidence are ready. They are not implemented, and no scores are invented for them. Statement–action consistency (see the [pipeline](../docs/STATEMENT_ACTION_PIPELINE.md)) is calculated per statement and is not this index.

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

### Insider Trading Index 📈

This measures reviewed congressional trades overlapping with committee jurisdiction, votes, donors, and single-stock activity. It does not claim that trading itself is wrongdoing.

| Part | Weight | Calculation |
|---|---:|---|
| Committee conflicts | 40% | Share of individual-stock trade value in sectors the member's committees oversee; use disclosed amount midpoints where all values are readable, otherwise count trades |
| Near-vote trades | 25% | Share of reviewed trades within 30 days of a related vote/action |
| Trades in donor companies | 20% | Share of reviewed trades in companies whose PAC/group is a tracked donor |
| Single-stock activity | 15% | Annualized individual-stock trade count; 50 per year reaches 100 |

At least five reviewed trades are required. With confirmed congressional disclosure coverage and no trades, the index is 0. No coverage is unavailable, not a verified zero. Spouse/dependent trades are included and labeled. Qualified blind-trust trustee trades after the effective date are excluded only when verified; outside and pre-trust trades remain. No-stock status is a description, not a bonus. Presidential OGE trades are shown but not scored by these congressional methods.

### Stock Disclosure Dodger Index 🙈

Measures late/missing Periodic Transaction Reports and late annual disclosures. Trade reports are late after the 45-day deadline or if missing. Trade-report violations have 70% weight and annual disclosure lateness 30%; weights are normalized over available filing types. At least three required filings and covered trade reporting are needed. Missing due/filed dates are not assumed timely. Once trades are reviewed, a covered STOCK Act case moves out of Legal Trouble and into this index to avoid counting the same disclosure failure twice.

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

## Legal Trouble Index 🚨 (deducted at full strength)

The Legal Trouble Index is subtracted after component averaging. A review must be dated, sourced, and explicit even if it finds no scored cases. A missing review is unknown, never a clean 0.

Each reviewed case contributes `status points × case-kind multiplier × age multiplier`; total is capped at 100.

| Reviewed status | Points |
|---|---:|
| Confirmed finding | 20 |
| Open official investigation | 15 |
| Closed without finding | 5 |
| Allegation with no official action | 0; listed, not scored |

| Case kind | Multiplier |
|---|---:|
| Criminal | 1.5 |
| Ethics or civil | 1.0 |
| Technical disclosure/reporting issue | 0.5 |

A non-open case whose latest status change was more than 10 years before the reviewed research is multiplied by 0.5. Open cases count in full. A case is counted once at its current status; related duplicate matters should be consolidated to one case. Leads from news, enforcement, or court feeds do not count until reviewed against a source.

## Historical grades: Ethics and Promises Delivered

Ethics and Promises Delivered are earlier published grades. Their past values remain accessible in the official monthly history (`public/score-log.json`) and on each profile's Integrity tab. They are preserved without recalculation and are never averaged into Integrity.

```text
Ethics (historical) = max(0, round(100 − Legal Trouble − 0.10 × Insider Trading
                                         − 0.10 × Stock Disclosure Dodger))
Promises Delivered (historical) = the Honesty formula above, graded A–F on its own
```

Under the historical Ethics method an unavailable trading index created no deduction; Integrity's stricter rule treats unknown data as unavailable instead. Net-worth ranges are displayed for context and are not part of either.

## People First comparison

The proposed CCI revision removes the direct business-PAC-share component and reweights employee giving (10%), business-funder voting (35%), and lobbied bills (20%) over the available implemented components. The comparison is `0.75 × existing legislative-action score + 0.25 × (100 − preview CCI)`, or the legislative-action score alone if the preview CCI is unavailable. The published People First calculation continues using the existing CCI until the revision is explicitly adopted. See [People First](04_PEOPLE_FIRST_SCORE.md).

## Methodology status

Integrity's provisional parameters and the proposed CCI revision still require calibration and evaluation. Holdings penalties, funding penalties, and pledge adjustments are calculation components, rather than additional standalone indices.

Inputs without reviewed coverage stay unavailable rather than clean, so a profile can show its component explanations and still be Not graded overall. Monthly Integrity comparisons are stored in `public/integrity-preview-log.json`, separate from official score history.

See [People First](04_PEOPLE_FIRST_SCORE.md) and the [canonical score inventory](00_POLITICAL_SCORECARD_METHODOLOGY.md).
