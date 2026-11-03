# Workers > Profit 👷

**Status: published grade.** It estimates whether documented actions favor working people or wealthy/corporate interests. It is a methodology-based comparison, not a claim about intent. Current Workers > Profit grade and its established CCI calculation remain unchanged while the separate Integrity and modified-CCI comparisons are previews.

## Score each bill

Each bill receives a strength from −100 (profit side) to +100 (worker side), based on two evidence parts:

1. **Who gains (50% when both parts are available):** a cited nonpartisan distributional/access analysis. Money and access-to-basic-needs evidence use the reviewed five-step scale: +100, +50, 0, −50, −100. If both money and access evidence exist, their mean is used.
2. **Who took a side (50% when both parts are available):** worker-group support is +100 and opposition −100. Business-group positions count in the opposite direction. Average groups within each side, then average the two sides so a larger number of groups from one side cannot dominate. If both parts point in opposite directions, the bill is disputed and not scored. If only one valid part exists, it can score the bill; group-only evidence requires a worker and business group taking opposite sides.

Lobbying reports, by themselves, establish exposure, not a group's position. They are displayed but do not score the bill. Funding for government as a whole and public money primarily going to companies do not count as access evidence.

## Score the politician's actions

For each scored bill the person acted on, give its strength (`abs(bill score)/100`) to the side their action took. A Yea or sponsorship takes the bill's marked side; a Nay takes the other. A president's signature or executive order takes its marked side; a veto takes the other. Public statements specifically about a bill count at half action weight and only until a later action is recorded. Each bill counts once; missed votes and not cosponsoring count for nothing.

```text
Bill-action score = worker-side points / (worker-side points + profit-side points) × 100
```

At least three scored actions are required. Without enough actions, the grade is Not graded.

## Published Corporation Compromised Index 🏢

The published CCI estimates reliance on business money and voting alignment with business funders. Each component scores 0–100, higher meaning more compromised by this method:

| Component | Weight | Scale / minimum |
|---|---:|---|
| Business PAC share of same-period campaign receipts | 35% (required) | 20% receipts reaches 100 |
| Employee giving from donor companies | 10% | 10% receipts reaches 100 |
| Voting with business funders beyond party voting rate | 35% | 25 points above party reaches 100; 5 compared votes |
| Profit-side actions on bills lobbied on by top donors | 20% | At least 3 relevant bills |

Available component weights are normalized, but the business-PAC-share component is required for the published index. Outside spending is excluded. When CCI exists, the published Workers > Profit grade is `0.75 × bill-action score + 0.25 × (100 − CCI)`; otherwise it uses bill-action score alone. The CCI is computed in `corporationCompromised` in `public/grades.js`.

## Integrity comparison CCI

The **preview** version removes the direct business-PAC-share component to avoid overlapping money-source penalties with Integrity Fundraising. It normalizes over available implemented components: employee giving 10%, business-funder voting 35%, and lobbied bills 20%. The preview Worker comparison is 75% bill-action score plus 25% of `100 − preview CCI`, or bill-action score alone if preview CCI is unavailable. Employee giving and lobbied-bill inputs are not yet implemented/reviewed, so the preview may have limited coverage. This preview never alters the published grade.

See [Integrity](08_INTEGRITY_SCORE.md), [Money & Influence](05_MONEY_&_INFLUENCE_ANALYSIS.md), and [the canonical methodology](00_POLITICAL_SCORECARD_METHODOLOGY.md).
