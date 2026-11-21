# 4. Big Money Independence

**Purpose:** how independent their money is from special interests: who funds them and what they own. It doesn't measure how they vote. The formula is adapted from IntegrityIndex.us.

**What it uses:**

- FEC reports: gift sizes, PAC money by type, joint fundraising, and gifts that groups like AIPAC or Club for Growth collect and forward.
- Annual financial disclosures: stock holdings and trades.
- Pledges, and bills they've sponsored or cosponsored.

**What the tab shows:** each part's points, a money map, and a timeline of net worth, stocks and trades.

**On the home page's cards:** the same grade as the profile's Overview, worked out from the same records the refresh has read (the FEC's gift sizes, the stocks on their annual report and this cycle's trades). It says what it's waiting for when a record isn't read yet.

**Shown, not counted:** outside groups' spending, which a candidate can't control, and lobbyists' gifts, whose campaign gifts the FEC numbers above already include:

- Ads that named them near an election (FEC electioneering communications).
- What corporations and unions spent telling their members how to vote on them (FEC communication costs).
- Lobbyists' political gifts that name them (LDA.gov LD-203), with lobbyists added up, never named.
- The groups behind outside spending, with a nonprofit's own tax return (IRS Form 990) where it has one, since a nonprofit doesn't name its donors.

**How it's calculated:**

```text
75% + Donor − PAC Penalty − PAC Reliance − Earmark Penalty − Stock Penalty − Trade Penalty + Bonuses + Pledges
(never below 0% or above 100%)
```

Each part adds or takes off percentage points, so the score is a percentage to one decimal.

- **Donor:** up to +16 (House) or +14 (Senate). Smaller gifts earn more; a campaign funded entirely by small gifts gets the full amount.
- **PAC Penalty:** each PAC dollar times a rate by type, with corporate PACs costing the most and unions the least. For example, $100,000 from corporate PACs costs a House member 1.5 points and a senator 1. Capped at 30.
- **PAC Reliance:** up to −10, rising with PACs' share of all receipts.
- **Earmark Penalty:** forwarded gifts × 0.00002, so $50,000 costs 1 point. Capped at 30, like the PAC Penalty (since Nov. 18, 2026; IntegrityIndex.us gives no cap). $3.35M routed through AIPAC would otherwise cost 67 points. When not every group has been searched for someone, the total found is a floor: the tab says "at least" and marks the penalty "so far" (since Nov. 20, 2026).
- **Stock Penalty:** up to −20 for individual stocks held. Nothing for a qualified blind trust.
- **Trade Penalty:** up to −20, rising with the number of trades. Someone not sitting in Congress (a candidate, a member-elect) files no trade reports, so it is 0 for them (since Nov. 18, 2026). A member's trade reports count once they have all been read; that read stays counted for 14 days while the refresh re-reads them, and the grade says the day it was made (since Nov. 19, 2026; before, it lapsed after 36 hours, so a refresh that fell a day behind put most members back to waiting).
- **Bonuses:** +5 for no corporate PAC money, +1 for signing the no-corporate-PAC pledge, +1 for holding no individual stocks.
- **Pledges:** +1 each for backing a lobbying ban, a congressional stock-trading ban, or overturning Citizens United, by pledge or by sponsoring or cosponsoring a bill.

**Needs:** this cycle's FEC report, PAC money sorted by type (the reviewed PAC lines must cover at least 80% of the cycle's PAC money, or the FEC's bulk files give the whole cycle's money by type, with a total within 80–120% of the campaign's; otherwise the PAC part waits, since Nov. 20, 2026, rather than spread a few reports' mix over the whole cycle), and their disclosure read: holdings and trades for a member of Congress, their candidate financial report for anyone else. A president isn't graded.

**Shown at most 100%:** IntegrityIndex.us's final score has no upper cap, but a grade here is a percentage, so a House member with every bonus and pledge (up to 102) shows 100%.

## THINGS STILL NOT ADDED, UPDATED, OR CALCULATED YET

- **Ten numbers IntegrityIndex.us's page leaves out** are filled in here and labeled on the tab, for example the PAC penalty's and the Earmark Penalty's caps of 30 and the PAC Reliance midpoint of 20%. They still need confirming.
- **Senate candidates' reports** are read only once someone saves them from Senate eFD (`npm run efd:import`); House candidates' are read by the refresh.
- **Gift sizes from the FEC** are read only for the 45 full profiles. For everyone else, itemized gifts count at the not-yet-sorted rate.
- **Holdings and trades:**
  - The blind-trust and no-stocks statuses still need review (`npm run review:holdings`).
  - The House and Senate trade readers haven't had their first full live run.
  - Senate eFD turns the refresh away, so senators' reports are fetched by hand.
- **Forwarded gifts are a floor:**
  - Only the groups found forwarding gifts are read. Others, such as Council for a Livable World, need their committees added.
  - Three totals are missing: Ricketts' from Club for Growth, Stelson's from EMILY's List and Hageman's from the Senate Conservatives Fund.
- **PAC types:** 163 PAC names aren't sorted by type yet, though 98% of PAC money is.
- **PAC lines for 8 full profiles:** 25 full profiles have under 80% of their PAC money in the reports reviewed here. For 17 of them the bulk files' whole-cycle totals match their campaign and are used. For 8 they don't (Hamilton: $15,000 of $245,500 reviewed, $153,061 in the bulk files; Brown, Flanagan, Rutinel, Ricketts and Castor have too little there; Hern's and Letlow's also hold their House campaigns), so their PAC part waits until more reports are read.
- **The tab and the other places it shows can differ:**
  - The tab's own figure credits joint fundraising back to the people who gave, and fills in PAC lines from the refresh.
  - The profile's Overview, the home card, the rankings and the share card don't do this yet.
  - So for someone whose joint fundraising has been read, the numbers can differ.
- **A president** isn't graded.
