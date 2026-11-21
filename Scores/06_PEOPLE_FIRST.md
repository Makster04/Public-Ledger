# 6. People First

**Purpose:** whether their votes and bills favor working people or business interests, and whether they side with their business funders more than the rest of their party does.

**What it uses:**

- Scored bills, each rated from −100 (profit side) to +100 (worker side). Half comes from a cited nonpartisan analysis of who gains. Half comes from who took sides: worker groups count toward the worker side, business groups toward the profit side.
- Their votes and sponsorships on those bills.
- Their business funders' positions, and the lobbying reports (LDA.gov) that name the scored bills.

**What the tab shows:** each scored action and which side it took, plus Corporation Compromised: how far they side with their business funders, as a number from 0 to 100. Under it, the bills their business donors lobbied on, the side they took on each, and which donors lobbied (directly or through a coalition).

**How it's calculated:**

```text
People First            = 0.75 × Legislative Action + 0.25 × (100 − Corporation Compromised)
                          (Legislative Action alone if Corporation Compromised is missing)
Legislative Action      = 100% × worker-side points ÷ (worker + profit points)   each bill counts at |its score| ÷ 100
Corporation Compromised = 0.65 × Business-Funder Voting + 0.35 × Lobbied Bills   (0 to 100, no % sign)
```

- **Business-Funder Voting (0–100):** how far above the rest of their party they vote with their business funders, weighted by money given (25 points above their party scores 100). Needs 5 compared votes.
- **Lobbied Bills (0–100):** of the scored bills they acted on that one of their top 20 business donors lobbied on, the share where they took the profit side. Needs 3 bills.
  - **Business donors:** corporate, trade-association and cooperative PACs (by the FEC's sponsor type, or the sector this site assigns when the FEC record isn't matched), and the business groups whose positions are compared (the Chamber of Commerce, NFIB, the bankers' and Realtors' associations and the others listed on the tab).
  - **Lobbied on:** a lobbying report filed in the bill's Congress that names it, for the donor's company or association, or for a coalition that lists the donor among its members. Names are matched word for word after dropping "PAC", "Political Action Committee", "Inc." and the like; a one-word name must match exactly. Amendments aren't searched: reports name bills, not amendment numbers.
  - **What it doesn't say:** a report doesn't say which side the client lobbied for, so this is how often they sided with profit on the bills their business donors worked on, not whether they did what a donor wanted.
  - **Built by hand:** `npm run lobbying:bills` reads the reports into `public/lobbied-bills.json`. Without that file, Lobbied Bills waits and Business-Funder Voting counts alone.
- **A missing part drops out** and the other is rescaled.
- **Minimum:** 3 scored actions for a number, and 10 scored actions on at least 5 different bills for a grade. Under that, the number is shown as **provisional**, with no letter, and left out of the Rankings and Scores lists, the share card and the news (since Nov. 20, 2026). With 10 bills scored, everyone has 3 to 9 actions, so every People First number is provisional until more bills are scored; 95% of them were exactly 0% or 100%, mostly following party.

## THINGS STILL NOT ADDED, UPDATED, OR CALCULATED YET

- **Lobbied Bills:**
  - The first full read of the lobbying reports (about 40,000 for the 10 scored bills) is in progress. It waits until `public/lobbied-bills.json` is in.
  - Amendments can't be matched.
  - A PAC is matched to its company by name, not by an official ID.
- **Basic profiles:** Corporation Compromised isn't worked out, since they have no reviewed donors. Their People First is Legislative Action alone.
- **The proposed Corporation Compromised revision** (adding employee giving) is waiting on a decision. Its employee-giving part isn't built.
- **More scored bills:** a business group's position on the GENIUS Act (only the AFL-CIO's is on file), and cited positions on the National Right-to-Work Act.
- **Cited statements** still to find for candidates without a voting record. For example, Charles Booker is one short of a grade.
- **Decide** whether agency estimates and tariffs can mark a bill.
- **Not found:** the Senate number of the BLAST Act.
