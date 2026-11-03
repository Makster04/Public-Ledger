# Public Ledger: Scores and methodology

This is the canonical guide to every score, index, and position measure currently implemented in Public Ledger. It describes the checked-in implementation; the app's live Methodology page should stay consistent with it. Grade formulas are implemented in [`public/grades.js`](../public/grades.js), scoring assembly in [`public/scoring.js`](../public/scoring.js), and Integrity preview formulas in [`public/integrity.js`](../public/integrity.js).

## At a glance

The current grading interface has three primary grades: Your Match, Integrity, and People First (called Workers > Profit until Nov. 3, 2026; the name changed, the calculations did not). **The presentation migration to Integrity is complete; the methodology is still provisional and uncalibrated.** This interface change does not claim calibration or alter the historical published calculations for Ethics and Promises Delivered. Monthly Integrity comparisons remain in their separate log. Future methodology activation requires a completed comparison period, reviewed live financial coverage, source-backed calibration, and an explicit methodology migration.

| Output | Status | What it measures | Evidence minimum |
|---|---|---|---|
| Your Match | Published grade | How closely does this politician's record align with your views? Personalized to your answers; it does not measure honesty, ethics, or whether their policies benefit working people | At least 3 issues with evidence and at least 50% of selected issue importance covered |
| Integrity | Current primary grade; provisional and uncalibrated | How consistently does this politician keep commitments, manage financial conflicts, and meet accountability standards? Honesty (30%), Personal Finances (30%) and Fundraising (40%), less the Legal Trouble Index | At least 2 complete components and a dated, sourced Legal Trouble review |
| People First | Published grade | How consistently do this politician's legislative actions prioritize working people? 75% legislative-action score + 25% (100 − CCI) | At least 3 scored actions |
| Promises Delivered; Ethics | Historical published grades; Promises Delivered is now the Promises Delivered Index (Honesty) and Ethics' three indices feed Integrity; preserved in the official monthly log; evidence now lives inside Integrity | Existing reviewed statement and case/trading records | Historical values only; not current headline grades |
| Statement–action consistency | Per-statement analysis, not a politician grade | Share of resolved relevant actions classified consistent with a particular statement | At least 1 resolved relevant action by default; configurable |

Letter thresholds are A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F < 60. Each grade rounds its final displayed percentage to a whole number. An insufficient-evidence result is **Not graded**, never an imputed zero.

## Integrity: current presentation, provisional method

The Integrity component calculations and consolidated presentation are implemented, adapting the structure of [IntegrityIndex.us](https://integrityindex.us/methodology) and crediting that source. Public Ledger adds reviewed promise evidence as Honesty and subtracts its existing Legal Trouble Index. The parameters are Public Ledger's provisional choices, not calibrated reproductions of IntegrityIndex.us. Interface consolidation does not count as calibration.

The overall Integrity formula is:

```text
weighted = sum(component weight × component value for complete components)
           / sum(weights for complete components)
Integrity = clamp(weighted − Legal Trouble, 0, 100)
```

Honesty, Personal Finances, and Fundraising have weights 30%, 30%, and 40%. Missing components are excluded and available weights normalized. At least two components must be complete. A sourced, dated Legal Trouble review is also required; unknown legal input is not zero. Legal Trouble is subtracted after the weighted average, at full strength. Only the final displayed grade is rounded. The same two-component minimum applies to the president.

### Integrity components

**Honesty:** `100 × (kept + 0.5 × partly kept) ÷ counted checks`. It reuses the reviewed Promise calculation and PolitiFact tracker handling. At least three counted checks are required; pending, vague, and ambiguous items do not count. Flip-Flop and Pants on Fire are not implemented.

**Personal Finances:**

```text
Hill(x, midpoint) = x^0.745 / (midpoint^0.745 + x^0.745)
S = 20 × Hill(stock value, $400,000)
T = 20 × Hill(trade count, 50) + 20 × Hill(trade value, $1,000,000)
F = clamp(100 − S − T − 0.20 × Insider Trading
          − 0.20 × Stock Disclosure Dodger, 0, 100)
```

Stock value is the sum of individual-stock position range midpoints in one reviewed annual holdings snapshot; it is not net worth or the average per holding. The holdings date and trading period are separate. Complete reviewed coverage, sources, transaction deduplication, valid filing dates and amounts are required. Open-ended or unreadable values stay unknown unless reviewed valuation resolves them. Only assets and trustee trades verified inside a qualified blind trust after its effective date are excluded. Outside assets, earlier trades, personal disclosure failures, and historical trades after divestment still count. Profiles outside congressional disclosure coverage have no Personal Finances component.

**Fundraising:** `M = clamp(75 + D − P − R − E + pledges, 0, 100)`. Every monetary share is of total campaign receipts for the same period.

- `D` is the sum of gift category receipt shares times weights, capped at 14. Weights: gifts ≤$200 (including unitemized once) 14; $200–499 10; $500–999 6; $1,000–1,999 3; $2,000+ 2; FEC itemized but unsorted 5.2; self-funding 1; joint fundraising 1. Buckets are mutually exclusive; a missing gift-size fetch is unavailable, not unsorted.
- `P = min(30, sum(PAC category share in percentage points × rate))`. Rates: corporate 2; lobbyist 1; trade/membership/cooperative 0.2; political/leadership/party/candidate and ideological/nonconnected 0.1; union/other 0.05. PAC categories must reconcile to the reviewed same-period PAC total.
- `R = 10 × Hill(PAC receipts share, 20%)`.
- `E = min(30, eligible earmarked dollars ÷ receipts × 100 × 4)`. Bundling groups share the same rate. ActBlue and WinRed are excluded. Duplicate receipts and direct-PAC/routed-gift duplication are excluded. The currently selected conduit collection is partial and cannot prove complete earmark coverage or a zero total.
- Pledges are corporate PAC refusal, congressional stock-trading ban, former-member lobbying ban, and overturning Citizens United. Each category contributes once: reviewed kept +1; reviewed broken −1; no pledge plus qualifying bill cosponsorship +1; otherwise 0. Pending pledges cannot use the no-pledge fallback. No abstention bonuses are awarded.

**Methodology status:** Integrity's provisional parameters and the proposed CCI revision still require calibration and evaluation. Holdings penalties, funding penalties, and pledge adjustments are calculation components, rather than additional standalone indices. Flip-Flop and Pants on Fire are planned additions to Honesty once their methods and evidence are ready.

Parameters still needing calibration include the 30/30/40 weights, two-component threshold, $400,000 stock midpoint, 50-trade midpoint, $1,000,000 trade-value midpoint, 20% PAC-reliance midpoint, 30-point PAC and earmark caps, and $20 million reference-campaign context. The reference campaign is explanatory context, not an extra multiplier in the share-based equations.

### People First comparison preview (proposed CCI revision)

A separate preview CCI removes the direct business-PAC-share component. Its remaining relative weights are employee giving 10%, business-funder voting 35%, and lobbied bills 20%, normalized over available implemented components. The preview is `0.75 × legislative-action score + 0.25 × (100 − preview CCI)`. If preview CCI is unavailable, it uses the legislative-action score alone, subject to the existing minimum. The published People First calculation continues using the existing CCI until this revision is explicitly adopted.

## Published grades

### Your Match

For each visitor-selected issue, calculate the share of the politician's weighted record that matches the visitor's side. Weight each issue by its visitor-selected importance (low 1, medium 2, high 3); divide matching weighted evidence by all available weighted evidence and multiply by 100. Actions count 1, statements count 0.5, and statements are only used for an issue without an action. One bill receives one credit; unsupported issues drop out. A grade requires at least 3 issues with evidence and coverage of at least half the visitor's selected issue importance. Choices are stored locally in the visitor's browser. See [Your Match](02_YOUR_MATCH_SCORE.md).

### Honesty: the Promises Delivered Index

`100 × (kept + 0.5 × partly kept or changed) ÷ counted checks`. Contradicted checks earn zero. Pending, ambiguous, vague, and outcome-only checks are excluded. A promise that could have been acted on but remains unacted at the end of a term is counted as contradicted. The president uses reviewed PolitiFact tracker counts: Kept 1, Compromise 0.5, Broken 0; Stalled and In the Works wait. At least three counted checks are required. Pledge evidence is shown with the reviewed verdict and does not independently change this grade. See [Promises Delivered](05_PROMISES_DELIVERED_INDEX.md).

### Historical Ethics grade

`max(0, round(100 − Legal Trouble − 0.10 × Insider Trading − 0.10 × Stock Disclosure Dodger))` describes the preserved historical Ethics method only. Ethics is no longer a current headline score and its old percentage is never averaged into Integrity. Its case and trading evidence remains in the Integrity section. See [historical Ethics method](06_ETHICS_INDICES.md).

### People First

**How consistently do this politician's legislative actions prioritize working people?**

```text
People First = 0.75 × Legislative-action score + 0.25 × (100 − CCI)
```


Each bill is scored from −100 (profit side) to +100 (worker side) using who gains and worker/business group positions, each half-weighted when both are available. Disputed bills are shown but not scored. The politician's votes/actions on each scored bill count its strength (`abs(bill score)/100`) for the side taken; each bill counts once. The legislative-action score is `worker points ÷ (worker points + profit points) × 100`. The published grade is 75% the legislative-action score and 25% `100 − CCI` when CCI is available; otherwise it is the legislative-action score alone. A grade needs 3 scored actions. For a president, signings and executive orders count for the marked side and vetoes for the other side. See [People First](04_PEOPLE_FIRST_SCORE.md).

## Indices and related analyses

These indices are components of Integrity, People First, or standalone Money & Influence analyses. They are not additional A–F grades.

### Legal Trouble Index 🚨 (higher is worse)

Each reviewed case contributes status points × kind × age, summed and capped at 100. Status values: finding 20, open investigation 15, closed without finding 5, allegation 0. Kind factors: criminal 1.5, ethics/civil 1, technical 0.5. A non-open case decided more than 10 years before the reviewed research is multiplied by 0.5; open cases count in full. Each matter counts once at its current reviewed status. Allegations remain visible but do not score.

### Insider Trading Index 📈 (higher is worse)

Weighted parts: committee conflicts 40%, trades within 30 days of related votes 25%, trades in donor companies 20%, and single-stock activity 15% (50 trades/year reaches 100 for that part). The conflict part uses trade value midpoints when available; if amounts cannot all be read, it uses trade counts. Needs five reviewed trades. Under existing Ethics behavior, a verified covered review with no trades scores 0; uncovered or incomplete data must not be represented as no activity in the Integrity component.

### Stock Disclosure Dodger Index 🙈 (higher is worse)

Late/missing transaction reports contribute 70%; late annual disclosures contribute 30%, renormalized over filing types with usable coverage. Trade filing deadlines are 45 days. It needs three required filings and transaction-report coverage. A STOCK Act case moves to this index when those trades have been reviewed, avoiding a duplicate Legal Trouble deduction.

### Corporation Compromised Index 🏢 (higher is worse)

CCI weights: business PAC receipts share 35% (20% share reaches 100), employee giving from donor companies 10% (10% share reaches 100), business-funder voting above party 35% (25 percentage points reaches 100; five compared votes), and profit-side results on donor-lobbied bills 20% (at least three bills). Missing parts drop out and weights are normalized; business PAC share is required. The existing CCI remains in the published People First grade. The separate preview CCI has the modified weights described above.

### Donor Loyalty Index 🤝 (higher means more donor-aligned)

For each funder with money to/for the campaign and public vote positions, compare the politician's share of votes matching that funder with the party's share on those same votes, leaving the member's vote out of party totals. Weight funders by direct, routed/bundled, and for-candidate spending, capped so no funder exceeds half the total weight. Average the differences; retain only the amount above the party. Five compared votes are required; 25 points above the party maps to 100. It is an association, not proof money caused a vote.

### Vote Donor Alignment

`votes matching funder positions ÷ compared votes × 100` for groups that gave directly or through routed gifts. Each compared vote counts once; missed votes are excluded. This is descriptive analysis, not the Donor Loyalty Index or a grade.

### Statement–action consistency

For each statement independently: `consistent ÷ (consistent + inconsistent) × 100`. Irrelevant, unresolved, out-of-scope, and context-only actions do not enter the denominator. Duplicate underlying events are collapsed; actions are scoped relative to the statement date. If the configurable resolved-action minimum is not met, show “Insufficient evidence,” not 0% or 100%. Coverage describes selected/evaluated candidate actions, not every action taken. The OpenAI model's label probabilities are uncalibrated estimates. See [`docs/STATEMENT_ACTION_PIPELINE.md`](../docs/STATEMENT_ACTION_PIPELINE.md).

## Context measures (not grades)

- **DW-NOMINATE:** Voteview's career voting-position scale, from roughly −1 (more liberal) to +1 (more conservative). It describes voting patterns, not performance or quality.
- **Key-vote position:** share of selected votes on marked bills on which the person took the conservative side; at least three marked votes are required. House and Senate sets differ, so compare within a chamber.
- **Issue-position bars:** direction and balance of available evidence by issue. Context only; no single overall score.
- **Campaign receipts, outside spending, donor shares, net-worth ranges, stock holdings/trades, timing flags, and donor-employer figures:** descriptive financial data or review leads, not grades unless explicitly included in a formula above. Outside spending is not treated as money controlled by the candidate.
- **Get It Done, No-Show, Across the Aisle, Party Rebel, Worker Backed, Grassroots, Super PAC Dependence, Lobbyist Overlap, Contracts for Donors, and Foreign Agent Flag:** older design notes or proposed measures. They are not implemented as current scores/indices unless separately documented as implemented in the app. See [future/retired score concepts](08_PROPOSED_AND_RETIRED_IDEAS.md).

## Missing data, sources, history, and rollout

Missing and incomplete data stay unknown; they are not converted into zero activity or a clean score. Refreshed official records remain leads until reviewed. Every score view links to its evidence, sources, relevant dates, and limitations. Official score changes are recorded in `public/score-log.json`; monthly Integrity comparisons use the separate `public/integrity-preview-log.json` and never rewrite official history.

Integrity cutover requires a monthly comparison period, reviewed live financial coverage, source-backed calibration, and a later explicit methodology migration. No automatic grade switch occurs. This is how Public Ledger adapts and credits [IntegrityIndex.us](https://integrityindex.us/methodology); it does not claim that its provisional parameters reproduce that site's calibrated results.

## Related guides

- [How calculations and missing data work](01_HOW_THE_MATH_WORKS.md)
- Grades:
  - [Your Match](02_YOUR_MATCH_SCORE.md)
  - [Integrity](03_INTEGRITY_SCORE.md)
  - [People First and the Corporation Compromised Index](04_PEOPLE_FIRST_SCORE.md)
- Indices inside Integrity:
  - [Promises Delivered Index (Honesty)](05_PROMISES_DELIVERED_INDEX.md)
  - [Legal Trouble, Insider Trading and Stock Disclosure Dodger indices](06_ETHICS_INDICES.md)
- [Money & Influence analysis](07_MONEY_&_INFLUENCE_ANALYSIS.md)
- [Proposed and retired ideas](08_PROPOSED_AND_RETIRED_IDEAS.md)
