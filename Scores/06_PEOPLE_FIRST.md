# 6. People First

**Purpose:** whether their votes and bills favor working people or business interests, and whether they side with their business funders more than the rest of their party does.

**What it uses:**

- Scored bills, each rated from −100 (profit side) to +100 (worker side). Half comes from a cited nonpartisan analysis of who gains. Half comes from who took sides: worker groups count toward the worker side, business groups toward the profit side.
- Their votes and sponsorships on those bills.
- Their business funders' positions, and the bills those funders lobbied on.

**What the tab shows:** each scored action and which side it took, plus Corporation Compromised: how far they side with their business funders, as a percentage.

**How it's calculated:**

```text
People First            = 0.75 × Legislative Action + 0.25 × (100% − Corporation Compromised)
                          (Legislative Action alone if Corporation Compromised is missing)
Legislative Action      = 100% × worker-side points ÷ (worker + profit points)   each bill counts at |its score| ÷ 100
Corporation Compromised = 0.65 × Business-Funder Voting + 0.35 × Lobbied Bills
```

- **Business-Funder Voting:** how far above the rest of their party they vote with their business funders, weighted by money given, as a percentage (25 points above scores 100%). Needs 5 compared votes.
- **Lobbied Bills:** the percentage of bills their donors lobbied on where they took the profit side. Needs 3 bills.
- **Minimum:** 3 scored actions.
