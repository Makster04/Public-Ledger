# Six grades: proposal for sign-off

Status: proposed November 7, 2026. Nothing here runs yet. Until it's built, the formulas in the
[score methodology](00_POLITICAL_SCORECARD_METHODOLOGY.md) are what the site uses.

The proposal retires the Integrity grade and splits what it measured into separate grades. It also adds a grade that
uses [IntegrityIndex.us](https://integrityindex.us/methodology)'s published formula exactly, credited to them.

| # | Grade | The question | Replaces |
|---|---|---|---|
| 1 | **Your Match** | How close is their record to your views? | Unchanged |
| 2 | **Keeps Their Word** | Do they keep their promises? | Integrity's Honesty part (the Promises Delivered Index) |
| 3 | **Shows Up** | Do they show up and get bills moving? | Integrity's Showing Up part |
| 4 | **Unbought** | How independent is their money from special interests? | Integrity's Fundraising and Personal Finances parts |
| 5 | **Above Board** | Is their money tied to their office, do they follow the disclosure rules, and are they in legal trouble? | Integrity's Conflicts of Interest part, the trading indexes and the Legal Trouble deduction |
| 6 | **People First** | Do their votes favor working people over business interests? | Unchanged, except the CCI keeps only its behavior parts |

**Shared rules (unchanged):**
- **Letter grades:** A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below 60.
- **Not enough evidence:** **Not graded**, never a zero.
- **Missing data:** stays unknown, never a clean record.
- **Rounding:** only the displayed grade is rounded.

Each grade below is written twice:
- **With its indexes:** each index named, with its own formula.
- **Merged:** the indexes' formulas written into one line.

```text
H(x, m) = x^0.745 ÷ (m^0.745 + x^0.745)     the Hill curve: 0 at none, ½ at the midpoint m, toward 1 above it
```

Shares are fractions from 0 to 1 unless a formula says percent.

---

## 1. Your Match (unchanged, no indexes)

```text
Your Match = 100 × Σ(importance × matching evidence) ÷ Σ(importance × all evidence)
```

- **Importance:** low 1, medium 2, high 3.
- **Evidence:** a vote, bill or official act is 1. A statement is 0.5, and only on an issue with no action.
- **Each bill counts once.**
- **Minimum:** at least 3 issues with evidence, covering at least half the importance you chose. See
  [Your Match](02_YOUR_MATCH_SCORE.md).

---

## 2. Keeps Their Word

**With its index:** Keeps Their Word is the Promises Delivered Index.

**Merged:**

```text
Keeps Their Word = 100 × (Kept + ½ × (Partly kept + Changed)) ÷ (Kept + Partly kept + Changed + Broken)
```

- **Counted:**
  - hand-checked promises;
  - reviewed promise-finder checks;
  - automatic campaign-promise matches, labeled "matched automatically";
  - reviewed pledges (no corporate PAC money, a congressional stock-trading ban, a former-member lobbying ban,
    overturning Citizens United), each counted as a kept or broken promise. This is a change: today pledges count only
    in Fundraising.
- **A president:** PolitiFact's tracker counts (Kept 1, Compromise ½, Broken 0). Stalled and In the Works wait.
- **Left out:** vague goals, promises with no related bill yet, unclear checks, outcome-only checks, and statements
  made in debate the day of the vote or the day before, which are shown but not scored.
- **Unacted:** a promise left unacted at the end of a term counts as broken.
- **Minimum:** 3 counted checks. There's no fallback. Today 13 of the 59 profiles meet it.
- **Planned additions dropped:** Flip-Flop is already covered, since a changed position gets half credit and the
  promise finder flags reversals. Pants on Fire is shown, not scored, because fact-checkers choose which claims to
  check, so coverage is uneven.

**Example:** 4 kept, 1 partly kept, 1 broken. `100 × 4.5 ÷ 6 = 75`, a **C**.

---

## 3. Shows Up

**With its indexes:**

```text
Shows Up    = 0.75 × Attendance + 0.25 × Get It Done
Attendance  = clamp(100 − 5 × missed %, 0, 100)
Get It Done = 100 × min(1, r ÷ m)
```

**Merged:**

```text
Shows Up = clamp(75 − 3.75 × missed %, 0, 75) + 25 × min(1, r ÷ m)
```

**What the terms mean:**
- **missed %:** the percent of roll calls missed while in office, from 2018 on. The record is Voteview's.
- **r:** the share of bills and joint resolutions they sponsored that advanced (reported, passed a chamber, or became
  law).
- **m:** the typical rate for their party in their chamber, Congress by Congress.

**What counts and what doesn't:**
- **Missed:** "not voting," paired and announced votes.
- **There:** Present counts as being there.
- **Left out:** a reviewed, cited absence for medical leave, a birth or adoption, a death in the family, or military
  duty.

**When an index is missing:**
- **No Get It Done** (fewer than 10 sponsored bills, or a typical rate of 0): `Shows Up = clamp(100 − 5 × missed %, 0, 100)`.
- **No Attendance** (fewer than 50 votes in office, such as a candidate who hasn't served): Not graded.

**Example:** missed 2% of votes, with bills advanced at 1.4× their party's rate. `0.75 × 90 + 0.25 × 100 = 92.5`, an **A**.

---

## 4. Unbought

This is IntegrityIndex.us's published formula, with its House and Senate weights, credited to them on the page. Under
the grade the page says: *"How independent their money is from special interests. It doesn't measure how they vote."*

**With its parts:**

```text
Unbought = max(0, 75 + Donor − PAC − PAC Reliance − Earmarks − Stocks − Trades + Bonuses + Pledges)
```

| Part | House | Senate |
|---|---|---|
| **Donor:** Σ share of receipts × weight | ≤$200 and unitemized 16 · $200–499 12 · $500–999 6 · $1,000–1,999 3 · $2,000+ 2 · itemized gifts the FEC hasn't sorted by size 4.04 · self-funding 1 · joint fundraising 1 | 14 · 10 · 6 · 3 · 2 · 5.2 · 1 · 1 |
| **PAC:** Σ dollars × rate | corporate 0.000015 · lobbyist 0.000008 · trade 0.000002 · political and ideological 0.000001 · union and other 0.00000075 | 0.00001 · 0.000005 · 0.000001 · 0.0000005 · 0.00000025 |
| **PAC Reliance** | 10 × H(PAC share of receipts, 0.20) | same |
| **Earmarks** | earmarked dollars × 0.00002 (ActBlue and WinRed excluded) | same |
| **Stocks** | 20 × H(individual-stock value, $400,000); 0 with a qualified blind trust or a full sell-off | same |
| **Trades** | 20 × H(trade count, 50) + 0.00001 × H(trade value, $8,000) | same |
| **Bonuses** | +5 for no corporate PAC money · +1 for pledging not to take it · +1 for holding no individual stocks | same |
| **Pledges and bills** | +1 each, for a pledge or a cosponsored bill: former-member lobbying ban · congressional stock-trading ban · overturning Citizens United | same |

**Merged (House):**

```text
Unbought = max(0, 75
  + min(16, 16·small + 12·s200 + 6·s500 + 3·s1000 + 2·s2000 + 16·unitemized + 4.04·unsorted + 1·self + 1·joint)
  − min(30, 0.000015·$Corporate + 0.000008·$Lobbyist + 0.000002·$Trade + 0.000001·($Political + $Ideological)
            + 0.00000075·($Union + $Other))
  − 10·H(PAC share, 0.20)
  − 0.00002·$Earmarked
  − 20·H($Stock value, 400,000)
  − 20·H(Trade count, 50) − 0.00001·H($Trade value, 8,000)
  + 5·[no corporate PAC money] + 1·[pledged no corporate PAC money] + 1·[no individual stocks]
  + 1·[lobbying ban] + 1·[stock-trading ban] + 1·[overturn Citizens United])
```

**Merged (Senate):** the same formula with these numbers instead:
- **Donor:** `min(14, …)` with weights 14 · 10 · 6 · 3 · 2 · 14 · 5.2 · 1 · 1.
- **PAC rates:** 0.00001 · 0.000005 · 0.000001 · 0.0000005 · 0.00000025.

**Reading the terms:**
- **The donor shares** (small, s200 … s2000, unitemized, unsorted, self, joint) are fractions of total receipts in the
  same reporting period.
- **The `$` terms** are dollar amounts.
- **A `[ ]` term** is 1 when true and 0 otherwise.
- **The highest possible score** is 101 in the House and 99 in the Senate. Their formula has no upper cap.

**Example** (a House member who raised $2 million):

| Term | Inputs | Points |
|---|---|---:|
| Donor | 50% small × 16 + 30% $2,000+ × 2 | +8.6 |
| PAC | $300K corporate × 0.000015 + $100K union × 0.00000075 | −4.6 |
| PAC Reliance | 20% from PACs: 10 × H(0.20, 0.20) | −5.0 |
| Earmarks | $50K × 0.00002 | −1.0 |
| Stocks | $200K: 20 × H(200K, 400K) | −7.5 |
| Trades | 10 trades: 20 × H(10, 50) | −4.6 |
| Pledges | cosponsored the stock-trading ban | +1.0 |
| **Unbought** | 75 + 8.6 − 4.6 − 5.0 − 1.0 − 7.5 − 4.6 + 1.0 | **62, a D** |

**Minimums:**
- **The cycle's FEC report.**
- **The person's financial disclosure, read** (see "Reading disclosures" below). Until both exist the grade says *"Not
  graded yet: their financial disclosure hasn't been read."* The stock terms are never dropped to make a grade possible,
  because leaving them out would raise the score on missing data.
- **The +5 and +1 abstention bonuses** need the same-period PAC categories and the read asset list. Unknown is not
  "none."
- **Earmarks** come from 5 conduit groups so far, so the page labels the earmark penalty "partial."

### Numbers their page leaves out (filled in by us, labeled, and asked about)

1. **The PAC penalty's floor** ("floored at max_penalty") has no number on their page. We use 30.
2. **The donor score's limits** ("clamped to [floor, cap]") aren't given. We use 0 up to 16 (House) or 14 (Senate).
3. **The PAC Reliance midpoint** isn't given. We use 20%.
4. **"avg_value" in the stock term** could be the average holding or the total. We use the total of individual-stock
   range midpoints.
5. **The trade-value maximum** is published as 0.00001, which means trade value effectively doesn't count. It's copied
   as published.

We also ask them whether they value ranges at the midpoint, and where their senators' reports come from. If their
answers differ from our choices, we change ours to match.

### Where we differ from their page on purpose

**A broken pledge.** A pledge reviewed as broken earns no pledge point (a cosponsored bill can still earn it), and it
counts as broken in Keeps Their Word. Their page gives the point for taking the pledge, whether or not it was kept.

---

## 5. Above Board

**With its indexes** (each index runs 0–100, higher is worse):

```text
Above Board = clamp(100 − (0.35 × Outside Income & Conflicts + 0.20 × Gifts & Travel
                         + 0.25 × Trade Conflicts + 0.20 × Stock Disclosure Dodger) − Legal Trouble, 0, 100)
```

| Index | Formula |
|---|---|
| **Outside Income & Conflicts** | 0.40 × I + 0.25 × Lobbyist Overlap + 0.20 × Contracts for Donors + 0.15 × Foreign Agent (rescaled over the parts available; I is required) |
| · I | min(100, 60 × H(income from interested organizations, $50,000) + min(40, 20 per board seat or officer post) + 40 for a future-job, leave or continuing-payment agreement) |
| · Lobbyist Overlap | 100 × H(share of receipts from interested organizations' PACs and employees, 0.25) |
| · Contracts for Donors | 100 × H(donor companies that gave $10,000+ and received over $1M in contracts from an agency their committees oversee, 5) |
| · Foreign Agent | min(100, 25 per campaign contribution from a registered foreign agent). Contacts are no longer counted: foreign agents reach out to offices on their own, so contacts mostly show committee seats |
| **Gifts & Travel** | min(100, 60 × H(value of gifts and paid trips from interested organizations, $10,000) + min(40, 10 per gift or trip)) |
| **Trade Conflicts** (renamed from the Insider Trading Index) | 100 × (0.45 × share in their committees' sectors + 0.30 × share within 30 days of a related vote + 0.25 × share in donor companies). At least 5 trades; covered with no trades scores 0. The single-stock activity part is dropped, since Unbought counts trade volume |
| **Stock Disclosure Dodger** | 100 × (0.70 × share of trade reports late (after 45 days) or missing + 0.30 × share of annual reports late), rescaled over the filing types available. At least 3 required filings |
| **Legal Trouble** (subtracted in full) | min(100, Σ over cases of Status × Kind × Age). Status: finding 20, open 15, closed without a finding 5, allegation 0. Kind: criminal 1.5, ethics or civil 1, technical 0.5. Age: ½ for a closed case decided over 10 years ago |

**Merged:**

```text
Above Board = clamp(100 − Legal − [
    0.14  · min(100, 60·H($Interested income, 50,000) + min(40, 20·Board seats) + 40·[job or payment deal])
  + 8.75  · H(share of receipts from interested organizations, 0.25)
  + 7     · H(donor companies with contracts, 5)
  + min(5.25, 1.3125 · foreign-agent contributions)
  + 0.20  · min(100, 60·H($Interested gifts and trips, 10,000) + min(40, 10·number of gifts and trips))
  + 11.25 · Committee-sector trades + 7.5 · Near-vote trades + 6.25 · Donor-company trades
  + 14    · Late or missing trade reports + 6 · Late annual reports
], 0, 100)

Legal = min(100, Σ over cases of Status × Kind × Age)
```

**What the merged terms mean:**
- **The trade and filing terms** (committee-sector, near-vote and donor-company trades; late reports) are shares from 0
  to 1.
- **The most each group can cost** adds up to the weights: outside income and conflicts 35 (14 + 8.75 + 7 + 5.25),
  gifts and travel 20, trades 25 (11.25 + 7.5 + 6.25) and filings 20 (14 + 6).

**When an index is missing:**
- **It drops out and the others are rescaled:**
  `Above Board = clamp(100 − Σ(weight × index) ÷ Σ(weights of the available ones) − Legal Trouble, 0, 100)`.
- **Today, before the disclosure reader exists,** only the two trading indexes are available, so the merged formula is:

```text
Above Board = clamp(100 − Legal − [25·Committee-sector + 16.67·Near-vote + 13.89·Donor-company
                                   + 31.11·Late trade reports + 13.33·Late annual reports], 0, 100)
```

**Minimum:** a sourced, dated Legal Trouble review, plus at least one of the four indexes. Legal Trouble alone isn't
enough, because a clean legal record would hand any candidate a 100.

**Examples:**
- **With every index:** Outside Income & Conflicts 40.3, Gifts & Travel 52, Trade Conflicts 40, Stock Disclosure
  Dodger 20, Legal Trouble 5. `100 − (14.1 + 10.4 + 10 + 4) − 5 = 56`, an **F**.
- **Today's version:**
  - **Trades:** half in their committees' sectors, 40% near a related vote, 20% in donor companies.
  - **Filings:** a quarter of trade reports late, no annual report late.
  - **Legal:** one closed ethics case, worth 5 points.

  `100 − 5 − (12.5 + 6.67 + 2.78 + 7.78) = 65`, a **D**.

**What it doesn't claim:** Above Board shows where their money overlaps their duties and whether they follow the
filing rules. It doesn't prove wrongdoing. A confirmed insider-trading case or other finding counts in Legal Trouble.
A STOCK Act late-filing case moves to Stock Disclosure Dodger once its trades are read, so it isn't counted twice.

---

## 6. People First

**With its index:**

```text
People First       = 0.75 × Legislative Action + 0.25 × (100 − CCI)
Legislative Action = worker-side points ÷ (worker-side points + profit-side points) × 100
CCI                = 0.65 × Business-Funder Voting + 0.35 × Lobbied Bills
```

**Merged:**

```text
People First = 75 · W ÷ (W + P) + 25 − 16.25 · min(1, Excess ÷ 25) − 8.75 · Lobbied
```

**What the terms mean:**
- **W and P:** the worker-side and profit-side points from their actions. Each scored bill counts once, at strength
  |bill score| ÷ 100. Disputed bills are shown but not scored.
- **Excess:** how many points above the rest of their party they vote with their business funders, weighted by money
  given. It needs at least 5 compared votes. 25 points above counts as 100.
- **Lobbied:** the share of bills their donors lobbied on where their action took the profit side. It needs at least 3
  bills.

**The CCI (Corporation Compromised Index) keeps only its behavior parts.** It drops the business PAC share (35%) and
employee giving (10%), because Unbought now counts where the money comes from.

**When an index is missing:**
- **Without one CCI part:** the CCI is the other part alone.
- **Without the CCI:** `People First = 100 · W ÷ (W + P)`.
- **Minimum:** 3 scored actions.

**Example:** Legislative Action 70, CCI 30. `0.75 × 70 + 0.25 × 70 = 70`, a **C**.

---

## Reading disclosures

Unbought and Above Board need each person's financial disclosure: their holdings, trades, outside income, gifts and
travel.

- **House members and House candidates: fully automatic.**
  - **Downloading:** the House Clerk's yearly indexes list every filing, and each online-filed report is a PDF whose
    text the reader pulls out (`src/pdf.mjs`). Candidate reports come from the same index.
  - **Grading:** the values read from an online-filed report count without hand review, labeled "read automatically
    from the filing." This is the same rule as the automatic campaign-promise matches.
  - **Reports flagged instead of read:** paper filings (scanned images), open-ended ranges ("over $1,000,000"), and
    assets whose type can't be told. Those people show "Not graded yet" until a later reader handles them.
- **Senators and Senate candidates: try once, without getting around the site's block.**
  - **The try:** the headless-browser reader already in the repo (`scripts/build-holdings.py`) is run once from your
    computer. It opens Senate eFD and accepts its terms of use like any visitor.
  - **If eFD lets it through:** senators become automatic too.
  - **If eFD blocks it:** we stop there. Senators show "Not graded yet: Senate reports can't be read automatically"
    on Unbought, and Above Board uses whatever indexes it has.
  - **Kept as it is:** the hand-saved route (`npm run efd:import`) still works but isn't required.
- **What's still not covered:**
  - **Bargo** (free) stays as a cross-check on the last 3 months of trades. It has no holdings, so it can't stand in
    for the reports.
  - **No free republished dataset of Senate filings is available.** Senate Stock Watcher's data bucket now refuses
    access.
  - **Quiver Quantitative and Disclosed Capitol's API are paid**, so they aren't used.
- **Stock value:** the total of the midpoints of the individual-stock value ranges (stocks and stock options; funds,
  bonds, property and cash left out) on the latest annual report. Trade value is the total of the trades' range
  midpoints. Each trade counts once across trade reports and the annual report's transaction list.
- **To decide when the disclosure reader is built (task #13):** how an organization named on a report is matched to
  lobbying records, industries and contracts without a person checking each match. Only an exact match would count;
  anything fuzzy is left out.

## Shown, not graded

- **Money:** the money map, receipts, outside spending and bundled gifts.
- **Personal finances:** net worth by year, holdings and trades, and timing flags.
- **Influence and ideology:** Donor Loyalty and DW-NOMINATE.
- **History:** the old Integrity, Ethics and Promises Delivered values stay in `public/score-log.json` and are never
  recalculated. The change is logged as a rule change.

## Dropped

| Measure | Why |
|---|---|
| Integrity (the grade) | Split into Keeps Their Word, Shows Up, Unbought and Above Board |
| Fundraising and Personal Finances | Replaced by Unbought |
| Vote Donor Alignment | Donor Loyalty does the same job with party taken into account. Raw alignment mostly reflects party. Its vote table stays as Donor Loyalty's evidence |
| Statement–action consistency | Needs a paid OpenAI key; its one trial (November 3) returned no labels (20 of 20 rate-limited); it paired statements with unrelated votes; and Keeps Their Word answers the same question for free. The code and the saved trial stay in the repo, unused |
| Key-vote position | A second ideology score next to DW-NOMINATE, resting on our own calls about which side is conservative |
| The CCI's business PAC share and employee giving | Unbought counts where the money comes from |
| The Insider Trading Index's single-stock activity part | Unbought counts trade volume |
| Contacts in the Foreign Agent Flag | Foreign agents contact offices on their own; only contributions count |

**Planned measures not to build:**
- **Grassroots:** the same thing as Unbought's donor score.
- **Super PAC Dependence:** it's outside money the candidate doesn't control. It's shown on the money map.
- **Worker Backed:** it would put money back into People First.
- **Flip-Flop:** already covered by Keeps Their Word.
- **Get Things Done as a separate grade:** already in Shows Up.

**Pants on Fire:** shown, not scored.

**Kept for later:** Speech Donor Alignment, and Across the Aisle and Party Rebel as context.

## Build order

1. **Grades and pages.** The six grades in `public/grades.js` and `public/scoring.js`, the profile's grade row and
   tabs, the renames (Trade Conflicts, Keeps Their Word, Shows Up), the methodology pages, and the score-log entry, in
   one change.
2. **Unbought's formula.** House and Senate weights, the abstention bonuses and the filled-in numbers, each labeled.
3. **Automatic House disclosures.** The stock-value total from annual reports, grading straight from online-filed
   reports, and the flags for reports that can't be read.
4. **Senators.** The one-time headless-browser try for Senate reports.
5. **The disclosure reader** (task #13) for Outside Income & Conflicts and Gifts & Travel.
6. **The email to IntegrityIndex.us** with the questions above.
