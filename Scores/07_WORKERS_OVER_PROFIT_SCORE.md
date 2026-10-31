# WORKERS > PROFIT SCORE 👷

<img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> **Done** · <img src="../assets/checkbox-progress.svg" width="20" align="absmiddle" alt="In the works"> **In the works** · <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> **Not started**. To change one, swap the image name in its line: `checkbox-empty` (not started), `checkbox-progress` (in the works) or `checkbox-checked` (done).

Back to [Updates & fixes in need](../.04_UPDATES_&_FIXES_IN_NEED.md). The rules every index follows are in [How the math works](01_HOW_THE_MATH_WORKS.md).

## Updates &/or changes

| Status | Item | Notes |
|---|---|---|
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Renamed from People vs. Profit | |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Top donors treemap | On the Workers > Profit tab. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Corporation Compromised Index 🏢 | Designed. The Donor Loyalty Index 🤝 and the bill scores it depends on are built. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Worker Backed Index ✊ | Designed, not built. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Grassroots Index 🌱 | Designed, not built. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | New Workers > Profit grade formula | 75% from the bills + 25% from (100 − Corporation Compromised). |
| <img src="../assets/checkbox-progress.svg" width="20" align="absmiddle" alt="In the works"> | Add more Workers > Profit bills with cited evidence | 14 on file, 10 scored. Next: a business group's position on the GENIUS Act and the National Right-to-Work Act, cited public statements for candidates without a voting record, and more bills where the AFL-CIO's and the Chamber's key votes split. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Rename the "People" side to "Workers" | In the charts and tables. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Decide whether agency estimates and tariffs can mark a bill | From the methodology's open decisions. CBO's coverage estimates now count, as access. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Decide the graph for each index | |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Better bill marking | Each bill scored from −100 to +100. See below, and the full list on the Workers > Profit scores page. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Access to basic needs in who gains | A cited estimate that a bill expands or cuts access to health coverage, schools, child care, food assistance, housing and the like, averaged with the money side. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Bills that didn't pass | Cosponsorships (from Congress.gov) count like a Yea, and cited public statements count half. The PRO Act, the Raise the Wage Act and the Paycheck Fairness Act are on file. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Infrastructure law and CHIPS Act listed as Even | Both sides supported them. The CHIPS prevailing-wage amendment is scored on its own. |
| <img src="../assets/checkbox-progress.svg" width="20" align="absmiddle" alt="In the works"> | Cited statements for candidates without a voting record | 25 from 22 candidates so far; the rest are listed in Updates & fixes. |
| <img src="../assets/checkbox-progress.svg" width="20" align="absmiddle" alt="In the works"> | Lobbying on each key bill (LDA.gov) | Built, and shown beside each bill, never in its score. Waits on its first live run. |

## Better bill marking

- **Problem:** the site needs a stronger, more consistent way to decide whether a bill mainly helps workers or corporations.
- **Idea:** instead of a yes-or-no mark, score each bill on a scale from fully worker-backed to fully corporate-backed.
- **Who gains (nonpartisan):** [CBO](https://www.cbo.gov/cost-estimates), [Joint Committee on Taxation](https://www.jct.gov/), [Tax Policy Center](https://www.taxpolicycenter.org/) and [Penn Wharton Budget Model](https://budgetmodel.wharton.upenn.edu/).
- **Who took a side:**
  - **Worker side:** the [AFL-CIO](https://aflcio.org/scorecard), [Economic Policy Institute](https://www.epi.org/) and [National Employment Law Project](https://www.nelp.org/).
  - **Business side:** the [U.S. Chamber of Commerce](https://www.uschamber.com/how-they-voted), [NFIB](https://www.nfib.com/) and [National Association of Manufacturers](https://www.nam.org/).
  - **Tax bills, one from each side:** the [Tax Foundation](https://taxfoundation.org/) and [ITEP](https://itep.org/).
  - **Construction pay, one from each side:** [North America's Building Trades Unions](https://nabtu.org/) and [Associated Builders and Contractors](https://www.abc.org/), on prevailing-wage measures only.
- **Who lobbied:** unions vs. corporations lobbying on each bill, from [LDA.gov](https://lda.gov/) (`LDA_API_KEY`, optional). Read weekly for each key bill and shown beside its score.
- **Bill details:**
  - [Congress.gov](https://api.congress.gov/sign-up/) (`CONGRESS_API_KEY`) for subjects, summaries and committee reports.
  - [GovInfo](https://www.govinfo.gov/api-signup) (`GOVINFO_API_KEY`) for full bill text.
  - [Regulations.gov](https://open.gsa.gov/api/regulationsgov/) (`REGULATIONS_API_KEY`) for union and company comments on related rules.
- **Many groups at once (paid only):** [Vote Smart](https://www.votesmart.org/votesmart-api) has business and labor groups' key votes and ratings, but it needs a paid license ($4,850 a year to publish) and doesn't allow crediting it. Not planned; the groups' own scorecards above are free.
- **White House position:** Statements of Administration Policy, from the [American Presidency Project](https://www.presidency.ucsb.edu/).
- **Other scorecards:** Heritage Action, LCV, the ACLU and HRC mostly rate other issues, so they fit in Your match instead.
- **Decided:** each bill is scored from −100 (fully corporate-backed) to +100 (fully worker-backed), from two equal parts.
  - **Who gains (50%):** a cited CBO, JCT, Tax Policy Center or Penn Wharton analysis, on one of five steps: +100 lower-income households come out ahead while the top pays more; +50 it tilts toward lower-income households; 0 about even; −50 it tilts toward the top; −100 lower-income households lose while the top gains.
  - **Who took a side (50%):** each worker group that supports a bill counts +100 and each that opposes it −100. Business groups count the other way, so a business group opposing a bill counts toward workers. Each side's groups are averaged first, then the two sides, so three business groups don't outweigh one worker group. If both sides support a bill, it lands near 0.
  - **When they disagree:** if the two parts point opposite ways, the bill is **Disputed**: shown, but not scored.
  - **One part only:** that part decides. A bill marked from groups' positions alone needs a worker group and a business group on opposite sides.
  - **Shown, not scored:** lobbying (a report says a client lobbied on the bill, not which side it was on), CBO estimates that don't split by income, and the White House's position (it follows the president's party).
  - **Each vote counts the bill's strength:** a Yea on a +75 bill adds 0.75 to the working-people side; a Nay adds 0.75 to the other side.
  - **Access counts as who gains too:** a cited estimate that a bill expands or cuts access to a basic need, mainly for lower- and middle-income households (health coverage, public schools, child care, food assistance, housing, or services like clean water and low-income broadband): +100 for a clear expansion, −100 for a clear cut, ±50 for a smaller or mixed change. With both money and access, their average. Not counted for bills that fund the whole government, or for public money that mainly goes to companies.
  - **Bills that didn't pass count too:** sponsoring or cosponsoring one counts like a Yea (cosponsors from Congress.gov, `npm run bills:cosponsors`). A cited public statement that names the bill counts half a vote; a later vote or cosponsorship replaces it. Not cosponsoring counts for nothing. A bill counts once across its versions in different Congresses, and the latest vote wins.
- **On file now:** 14 bills and amendments, 10 scored. −100: the One Big Beautiful Bill Act and the Cornyn amendment to strip prevailing wages from CHIPS-funded construction. −75: the 2017 tax law and H.R. 6703 (Lower Health Care Premiums; CBO finds a small cut in coverage). +75: the Inflation Reduction Act and the American Rescue Plan Act. +100: the three-year ACA credit extension (CBO: up to 4 million more insured), the PRO Act, the Raise the Wage Act and the Paycheck Fairness Act. **Even:** the infrastructure law and the CHIPS and Science Act. **Not scored yet:** the GENIUS Act (only the AFL-CIO on file) and the National Right-to-Work Act (no cited position from the listed groups). 23 people have the 3 scored actions a grade needs. **Statements:** 25 cited public statements from 22 candidates without a congressional voting record (20 on the One Big Beautiful Bill Act, 3 on the PRO Act, 2 on the ACA credit extension), at half a vote each; none of them reaches a grade on statements alone yet.

---

## Index designs

### Corporation Compromised Index 🏢
**Measures:** how much of their money comes from corporations, and how often they side with those funders.

- **Corporate PAC share (35%, required):** money from corporate and industry-group PACs ÷ campaign funds raised, over the same reports. The ceiling is 20%.
- **Corporate employees' giving (10%):** giving from employees of the companies among their top 20 donor organizations ÷ campaign funds raised. The ceiling is 10%.
- **Voting with business funders (35%):** on key votes where a business funder took a public side, how often they voted that way, minus their party's average on the same votes. Being at or below the party average scores 0, and the ceiling is 25 points above it. Business funders include the Chamber of Commerce, NFIB, Americans for Prosperity and Club for Growth.
- **Profit side on lobbied bills (20%):** on Workers > Profit bills that a top donor organization lobbied on, the share where they took the Profit side. This part needs at least 3 such bills.

Outside spending is left out, because candidates legally can't control it.

**Example:** PAC share 8% scores 40, employees 3% scores 30, +10 vs. party scores 40, and 2 of 4 lobbied bills scores 50. That gives (0.35×40) + (0.10×30) + (0.35×40) + (0.20×50) = **41**.

**Keys and sources:**
- **Campaign money:** `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> for campaign totals, PAC contributions and donors by employer. PAC sectors are assigned by this app from committee names, with no key.
- **Business funders' positions:** the reviewed research (their scorecards and key-vote letters). No key.
- **Votes:** Senate and House roll calls (no key), and `CONGRESS_API_KEY` for House votes from 2023 on.
- **Lobbying:** `LDA_API_KEY` (optional).
- **Bill scores:** the reviewed research (who gains and who took a side). No key.

### Worker Backed Index ✊
The same formula with unions:
- union PAC share;
- union employees' giving (people employed by the unions themselves);
- voting with union funders such as the AFL-CIO, SEIU and AFSCME, compared with their party's average;
- the People side on bills that unions lobbied on.

It's shown next to the Corporation Compromised Index, so both sides are measured the same way.

**Keys and sources:** the same as the Corporation Compromised Index 🏢: `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">, `CONGRESS_API_KEY`, `LDA_API_KEY` (optional), the roll calls (no key) and the reviewed research.

### Grassroots Index 🌱
**Measures:** the share of campaign funds from donors who gave $200 or less, × 100. A score of 42 means 42% came from small donors.

**Minimum:** an FEC report.

**Keys and sources:** `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">, from the campaign totals (the FEC's "unitemized" contributions).

### ↓↓↓

### New Workers > Profit grade formula 👷
**Workers > Profit** = 75% from today's score (actions on marked bills) + 25% from (100 − Corporation Compromised Index).

- The grade still needs today's minimum number of scored actions on marked bills. Without them, it stays "Not graded", and the index is shown on its own.
- The Worker Backed ✊ and Grassroots 🌱 indexes sit beside the grade, not inside it.
