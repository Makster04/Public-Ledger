# Six scores

Status: built November 7, 2026 (`public/six-scores.js`, the profile tabs in `public/app.js`). Group scorecards, the
disclosure reader for income, gifts and travel, and the one-time Senate eFD try are still to build.

The Integrity grade is retired and split into separate grades, and Your Match becomes part of a new Ideology tab. Unbought uses
[IntegrityIndex.us](https://integrityindex.us/methodology)'s published formula, credited to them.

| # | Score | Definition in one line |
|---|---|---|
| 1 | **Ideology** (a position, not a grade) | Where they stand from liberal to conservative, overall and on each issue |
| 2 | **Keeps Their Word** | How often they did what they promised |
| 3 | **Shows Up** | Whether they vote and get their bills moving |
| 4 | **Unbought** | How independent their money is from special interests |
| 5 | **Above Board** | Whether their money is tied to their office, whether they file on time, and whether they're in legal trouble |
| 6 | **People First** | Whether their votes favor working people over business interests |

**Rules for every score:**
- **Letter grades** (scores 2–6): A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below 60. Ideology uses its own liberal-to-conservative scale.
- **Not enough evidence:** **Not graded**, never a zero.
- **Missing data:** stays unknown, never a clean record.
- **Rounding:** only the displayed grade is rounded.

**How each grade is written:** each formula is shown twice. The first version names each index. The merged version
writes the index formulas into one line.

```text
H(x, m) = x^0.745 ÷ (m^0.745 + x^0.745)     the Hill curve: 0 at none, ½ at the midpoint m, toward 1 above it
```

Shares are fractions from 0 to 1 unless a formula says percent.

---

## 1. Ideology

**Definition:** where a politician stands from liberal to conservative, overall and issue by issue. It comes from their
own record, the ratings interest groups on both sides give them, and Voteview's standard measure.

**It's a position, not a grade.** Being liberal or conservative isn't good or bad, so it gets a scale instead of a
letter:

```text
−100 ───────── −60 ───────── −20 ───────── +20 ───────── +60 ───────── +100
 Very liberal       Liberal        Moderate       Conservative     Very conservative
```

**What the tab shows:**
1. **Overall lean:** one number on the scale, and a strip showing where they sit among their party and their chamber.
2. **Lean on each issue:** health care, taxes, immigration, abortion, civil rights, guns, climate, labor, voting and
   the rest, each on the same scale, with the votes and statements behind it.
3. **Group ratings:** the grades interest groups give them, shown in opposing pairs, exactly as each group published
   them, with the year and a link.
4. **DW-NOMINATE:** Voteview's career score, as an independent check.
5. **Your Match:** you set your own position on each issue, and the tab shows how close they are to you.

**Group ratings, in opposing pairs:**

| Issue | Conservative side | Liberal side |
|---|---|---|
| Guns | NRA | Giffords, Everytown |
| Abortion | SBA Pro-Life America, National Right to Life | Planned Parenthood Action, Reproductive Freedom for All |
| Environment | (none tracked yet) | LCV, EDF, NRDC |
| Labor | U.S. Chamber of Commerce, NFIB | AFL-CIO, SEIU, AFSCME, NEA, AFT |
| Taxes and spending | Club for Growth, Americans for Prosperity | (none tracked yet) |
| Civil rights | (none tracked yet) | HRC, ACLU |
| Overall | Heritage Action, Senate Conservatives Fund | (none tracked yet) |

**What it uses:**
- **Their record:** votes, bills and cosponsorships, plus statements, campaign promises and posts. Statements count half,
  and only on an issue with no votes or bills.
- **Each vote's side:** every vote and bill on file is coded, with a cited reason, as taking side A or B of its issue,
  and each issue says which side is the liberal one (`liberalSide` in `public/research.json`).
- **Group scorecards:** each group's own published scorecard for the ratings, read from its website by a script once a
  year.
  - A group whose site blocks scripts, or that publishes only images, is left out rather than entered by hand.
  - ACLU and HRC are asked for permission first.
  - Vote Smart has all these ratings in one place but costs $350 a month, so it isn't used.
- **Voteview:** for DW-NOMINATE.

**Formulas:**

**Which side of a vote is conservative.** Each vote and bill is already coded as taking side A or B of its issue, with a
cited reason, and each issue names its liberal side (for example, on guns side A, "stricter gun laws", is the liberal
one). The conservative side is the other one. Issues whose sides don't map onto liberal and conservative have no
liberal side marked: tariffs, Ukraine aid, war powers, Jan. 6, infrastructure, and money in politics.

**Lean on each issue.** C is the items on the conservative side and L the items on the liberal side. An item is a
vote, bill, cosponsorship or official act, one per bill; statements are used only on an issue with no action. The
number of items is shown with each issue's lean.

```text
Issue lean = 100 × (C − L) ÷ (C + L)
```

**Overall lean.** It averages the left–right issues, each counting the same. It needs at least 3 issues.

```text
Overall lean = average of the issue leans
```

The issues that split both parties aren't averaged in: tariffs, Ukraine aid, war powers, Jan. 6, infrastructure and
money in politics. They're still shown, with their counts and the reason they aren't placed.

**Group ratings, as one number.** Each score runs 0 to 100. Letter grades convert as A = 100, B = 75, C = 50, D = 25
and F = 0.

```text
Ratings lean = average over the groups that rated them of:
    a conservative group:  2 × score − 100
    a liberal group:      −(2 × score − 100)
```

**DW-NOMINATE, on the same scale:**

```text
DW-NOMINATE lean = 100 × their first-dimension score
```

**Your Match** (unchanged, now on the Ideology tab). You pick a side on each issue and how much it matters (low 1,
medium 2, high 3).

```text
Your Match = 100 × Σ(importance × share of their record on your side) ÷ Σ(importance)
```

For a liberal or conservative pick this equals 100 − |your position − their issue lean| ÷ 2. Moderate picks (lean
liberal, moderate, lean conservative) can be added later.

**The headline number:** the overall lean comes from the issue leans alone. The ratings lean and DW-NOMINATE are shown
beside it as two independent checks, so a gap between them shows up rather than being averaged away.

**Example:**
- **Issue leans:** guns +80, abortion +60, taxes +70, climate +40, labor +20. Overall lean **+54, Conservative**.
- **Ratings lean:** NRA A (+100), LCV 20% (+60), AFL-CIO 30% (+40). **+67**.
- **DW-NOMINATE:** 0.45. **+45**.

The three agree, so the reading is solid.

---

## 2. Keeps Their Word

**Definition:** of the promises they made, the share they kept, judged by what they did afterward. A promise counts
whether it was made on the campaign trail, in a speech or post, or as a signed pledge. It measures follow-through, not
whether you agree with the promise.

**Formula** (the Promises Delivered Index):

```text
Keeps Their Word = 100 × (Kept + ½ × (Partly kept + Changed)) ÷ (Kept + Partly kept + Changed + Broken)
```

**What counts:**
- **Checks:** hand-checked promises, reviewed promise-finder checks, and automatic campaign-promise matches (labeled
  "matched automatically").
- **Pledges:** reviewed pledges, each counted as kept or broken: no corporate PAC money, a congressional stock-trading
  ban, a former-member lobbying ban, overturning Citizens United.
- **A president:** PolitiFact's tracker counts. Kept is 1, Compromise ½, Broken 0; Stalled and In the Works wait.
- **Unacted:** a promise left unacted at the end of a term counts as broken.

**Left out:** vague goals, promises with no related bill yet, unclear checks, and statements made in debate the day of
the vote or the day before. Those are shown, not scored.

**Minimum:** 3 counted checks.

**Example:** 4 kept, 1 partly kept, 1 broken. `100 × 4.5 ÷ 6 = 75`, a **C**.

---

## 3. Shows Up

**Definition:** whether they do the basic work of the job: casting their votes, and getting the bills they sponsor
moving compared with others in their party. It doesn't say why a vote was missed or where they were.

**Formula, with its indexes:**

```text
Shows Up    = 0.75 × Attendance + 0.25 × Get It Done
Attendance  = clamp(100 − 5 × missed %, 0, 100)
Get It Done = 100 × min(1, r ÷ m)
```

**Merged:**

```text
Shows Up = clamp(75 − 3.75 × missed %, 0, 75) + 25 × min(1, r ÷ m)
```

**The terms:**
- **missed %:** the percent of roll calls missed while in office, from 2018 on (Voteview).
  - Counted as missed: not voting, paired and announced.
  - Counted as there: Present.
  - Left out: a reviewed, cited absence for medical leave, a birth or adoption, a death in the family, or military
    duty.
- **r:** the share of the bills and joint resolutions they sponsored that advanced, meaning reported by a committee,
  passed a chamber, or became law.
- **m:** their party's typical rate in their chamber.

**Missing data:**
- **No Get It Done** (fewer than 10 sponsored bills): `Shows Up = clamp(100 − 5 × missed %, 0, 100)`.
- **Fewer than 50 votes in office:** Not graded.

**Example:** they missed 2% of votes, and their bills advanced at 1.4× their party's rate. `75 − 7.5 + 25 = 92.5`, an
**A**.

---

## 4. Unbought

**Definition:** how independent a politician's money is from special interests: who funds their campaign (small
donors versus PACs and earmarked gifts) and whether they own or trade individual stocks. It doesn't measure how they
vote, and a low grade isn't a finding that anyone was bought. The profile says: *"How independent their money is from
special interests. It doesn't measure how they vote."*

**Formula, with its parts:**

```text
Unbought = max(0, 75 + Donor − PAC Penalty − PAC Reliance − Earmark Penalty − Stock Penalty − Trade Penalty + Bonuses + Pledges)
```

| Part | House | Senate |
|---|---|---|
| **Donor:** Σ share of receipts × weight | ≤$200 and unitemized 16 · $200–499 12 · $500–999 6 · $1,000–1,999 3 · $2,000+ 2 · gifts the FEC hasn't sorted by size 4.04 · self-funding 1 · joint fundraising 1 | 14 · 10 · 6 · 3 · 2 · 5.2 · 1 · 1 |
| **PAC Penalty:** Σ dollars × rate | corporate 0.000015 · lobbyist 0.000008 · trade 0.000002 · political and ideological 0.000001 · union and other 0.00000075 | 0.00001 · 0.000005 · 0.000001 · 0.0000005 · 0.00000025 |
| **PAC Reliance** | 10 × H(PAC share of receipts, 0.20) | same |
| **Earmark Penalty** | earmarked dollars × 0.00002 (ActBlue and WinRed excluded) | same |
| **Stock Penalty** | 20 × H(individual-stock value, $400,000); 0 with a qualified blind trust or a full sell-off | same |
| **Trade Penalty** | 20 × H(trade count, 50) + 0.00001 × H(trade value, $8,000) | same |
| **Bonuses** | +5 for no corporate PAC money · +1 for pledging not to take it · +1 for holding no individual stocks | same |
| **Pledges and bills** | +1 each, for a pledge or a cosponsored bill: former-member lobbying ban · stock-trading ban · overturning Citizens United | same |

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

**Merged (Senate):** the same formula with `min(14, …)` and the donor weights 14 · 10 · 6 · 3 · 2 · 14 · 5.2 · 1 · 1,
and the PAC rates 0.00001 · 0.000005 · 0.000001 · 0.0000005 · 0.00000025.

**The terms:**
- **Donor shares:** each is a fraction of total receipts in the same period. "small" is gifts up to $200; s200, s500,
  s1000 and s2000 are the $200–499, $500–999, $1,000–1,999 and $2,000+ gifts.
- **`$` terms:** dollar amounts.
- **`[ ]` terms:** 1 when true, 0 otherwise.
- **Highest possible score:** 101 in the House, 99 in the Senate.
- **Joint fundraising, credited back:** money a joint fundraising committee passed on (line 12) is credited to the
  people who gave it, by the size of each one's share as the memo entries list it; the part no entry lists is people
  whose share was $200 or less, so it counts as small gifts; committees' shares, and transfers from the candidate's
  other committees, stay at the joint fundraising weight. A cycle with too many records to read in full isn't
  credited back.
- **Earmarks:** every committee the FEC's totals by recipient show sending more than a PAC may give directly (or many
  checks, or memo entries) has its disbursements read for earmarked gifts, not just the 5 groups listed by hand.
- **Periods:** the Unbought tab can show the score over earlier cycles too (2023–2026, 2021–2026, or one earlier cycle
  alone). Each cycle's totals, gift sizes, PAC lines (each cycle's PAC shares applied to that cycle's PAC total),
  earmarks and joint fundraising are added up; trades count over the whole span; stocks held are from the latest annual
  report. A cycle missing a record leaves the score waiting. Everywhere else shows the current cycle.
- **PAC money not yet processed by the FEC** (reports filed after the processed totals end) is shown with a * and
  counts once the FEC processes it.

**Minimum:** the cycle's FEC report, and the person's financial disclosure read (holdings and trades). Until then:
*"Not graded yet: their financial disclosure hasn't been read."* The stock terms are never dropped to make a grade
possible.

**Example** (a House member who raised $2 million):

```text
Donor:        50% small × 16 + 30% $2,000+ × 2                            = +8.6
PAC:          $300K corporate × 0.000015 + $100K union × 0.00000075       = −4.6
PAC Reliance: 20% from PACs → 10 × H(0.20, 0.20)                          = −5.0
Earmarks:     $50K × 0.00002                                              = −1.0
Stocks:       $200K → 20 × H(200K, 400K)                                  = −7.5
Trades:       10 trades → 20 × H(10, 50)                                  = −4.6
Pledges:      cosponsored the stock-trading ban                           = +1.0
Unbought = 75 + 8.6 − 4.6 − 5.0 − 1.0 − 7.5 − 4.6 + 1.0 = 62 → D
```

**Numbers their page leaves out** (we fill these in, label them on the page, and ask IntegrityIndex.us):
1. **The PAC penalty's floor:** 30.
2. **The donor score's limits:** 0 to 16 (House) or 14 (Senate).
3. **The PAC Reliance midpoint:** 20%.
4. **"avg_value" in the stock term:** read as the total of individual-stock range midpoints.
5. **The trade-value maximum:** copied as published (0.00001), so trade value barely counts.
6. **PAC money by type:** the itemized PAC lines read so far give each type's share, applied to the FEC's PAC total for
   the period, so every PAC dollar counts.
7. **Gift sizes:** when the FEC's gift-size split isn't read for the period, itemized gifts count at the not-yet-sorted
   rate, as their formula scores gifts the FEC hasn't sorted.
8. **Which trades:** those made during the campaign's reporting period.

**One deliberate difference:** a pledge reviewed as broken earns no pledge point (a cosponsored bill still can), and it
counts as broken in Keeps Their Word.

**Earmark data:** earmarks come from 5 conduit groups so far, so the page labels the earmark penalty "partial."

---

## 5. Above Board

**Definition:** whether a politician's own money is tied to the power of their office, whether they follow the
disclosure rules, and whether they're in legal trouble. It counts:
- outside pay, board seats, job deals, gifts and paid trips from organizations with business before their committees;
- stock trades in their committees' sectors, near related votes, or in donors' companies;
- trade and annual reports filed late or not at all;
- court, ethics and enforcement cases.

It shows overlap and rule-following. It doesn't prove wrongdoing; a confirmed case counts through Legal Trouble.

**Formula, with its indexes** (each index runs 0 to 100, higher is worse):

```text
Above Board = clamp(100 − (0.35 × Outside Income & Conflicts + 0.20 × Gifts & Travel
                         + 0.25 × Trade Conflicts + 0.20 × Stock Disclosure Dodger) − Legal Trouble, 0, 100)

Outside Income & Conflicts = 0.40 × I + 0.25 × Lobbyist Overlap + 0.20 × Contracts for Donors + 0.15 × Foreign Agent
  I                    = min(100, 60 × H(income from interested organizations, $50,000)
                                  + min(40, 20 per board seat or officer post) + 40 for a job or payment agreement)
  Lobbyist Overlap     = 100 × H(share of receipts from interested organizations' PACs and employees, 0.25)
  Contracts for Donors = 100 × H(donor companies with over $1M in contracts from agencies their committees oversee, 5)
  Foreign Agent        = min(100, 25 per campaign contribution from a registered foreign agent)
Gifts & Travel          = min(100, 60 × H(value of gifts and paid trips from interested organizations, $10,000)
                                   + min(40, 10 per gift or trip))
Trade Conflicts         = 100 × (0.45 × share in their committees' sectors + 0.30 × share within 30 days of a related
                                 vote + 0.25 × share in donor companies)
Stock Disclosure Dodger = 100 × (0.70 × share of trade reports late (after 45 days) or missing
                                 + 0.30 × share of annual reports late)
Legal Trouble           = min(100, Σ Status × Kind × Age)
  Status  finding 20 · open 15 · closed without a finding 5 · allegation 0
  Kind    criminal 1.5 · ethics or civil 1 · technical 0.5
  Age     ½ for a closed case decided over 10 years ago, otherwise 1
```

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
```

**The terms:**
- **An interested organization:** one with business before them. It lobbies their committees, sits in a sector their
  committees oversee, or holds contracts from an agency they oversee.
- **The trade and filing terms:** shares from 0 to 1.
- **The most each group can cost:** 35 for outside income, 20 for gifts and travel, 25 for trades, 20 for filings.

**Missing data:**
- **A missing index:** it drops out and the others are rescaled.
- **Today:** the disclosure reader for income, gifts and travel isn't built yet, so only the two trading indexes count:

```text
Above Board = clamp(100 − Legal − [25·Committee-sector + 16.67·Near-vote + 13.89·Donor-company
                                   + 31.11·Late trade reports + 13.33·Late annual reports], 0, 100)
```

**Minimum:**
- **Trades:** 5 for Trade Conflicts. Verified coverage with no trades scores 0.
- **Parts the records can't tell yet:** trades read automatically from the official reports carry no near-vote review,
  and a stock whose company isn't matched to an industry is left out of the committee part; the other parts are rescaled.
- **Filings:** 3 required filings for Stock Disclosure Dodger.
- **The grade:** a sourced Legal Trouble review plus at least one of the four indexes.

**Example, today's version:**
- **Trades:** half in their committees' sectors, 40% near a related vote, 20% in donor companies.
- **Filings:** a quarter of trade reports late.
- **Legal:** one closed ethics case, 5 points.

`100 − 5 − (12.5 + 6.67 + 2.78 + 7.78) = 65`, a **D**.

---

## 6. People First

**Definition:** whether their votes and bills favor working people or business interests, and whether they side with
their business funders more than their own party does. It measures whose side their actions take, not their party.

**Formula, with its index:**

```text
People First       = 0.75 × Legislative Action + 0.25 × (100 − CCI)
Legislative Action = 100 × W ÷ (W + P)
CCI                = 0.65 × Business-Funder Voting + 0.35 × Lobbied Bills
  Business-Funder Voting = 100 × min(1, Excess ÷ 25)
  Lobbied Bills          = 100 × Lobbied
```

**Merged:**

```text
People First = 75 · W ÷ (W + P) + 25 − 16.25 · min(1, Excess ÷ 25) − 8.75 · Lobbied
```

**The terms:**
- **W and P:** the worker-side and profit-side points from their actions. Each scored bill counts once, at strength
  |bill score| ÷ 100. Disputed bills are shown, not scored.
- **Excess:** how many points above the rest of their party they vote with their business funders, weighted by money
  given. It needs at least 5 compared votes.
- **Lobbied:** the share of bills their donors lobbied on where they took the profit side. It needs at least 3 bills.

**Missing data:**
- **One CCI part missing:** the CCI is the other part alone.
- **No CCI:** `People First = 100 × W ÷ (W + P)`.

**Minimum:** 3 scored actions.

**Example:** Legislative Action 70 and CCI 30: `0.75 × 70 + 0.25 × 70 = 70`, a **C**.

---

## Profile tabs

Each score gets its own tab with everything behind it, so the separate **Money & Influence**, **Legislative Activity**
and **Integrity** tabs go away. Nothing is lost: every chart and list moves to the tab of the score it explains.

Every tab follows the same order:
1. **The score and its breakdown.** Each part has its points and links to the section that shows it.
2. **The evidence it counts.**
3. **"Shown, not counted."** Related records that don't change the score, each labeled that way.

**The tabs:** Overview · Ideology · Keeps Their Word · Shows Up · Unbought · Above Board · People First.

### Overview
- **All six scores at a glance:** the Ideology lean and the five letter grades, each linking to its tab.
- **Three things to know.**
- **Their race and election results.**
- **History and source records:** when each source was last read, and the score log.

### Ideology
- **Counted:** the overall lean, then the lean on each issue, each opening to the votes, bills and statements behind it.
  The full list of their votes and bills (from the Legislative Activity tab) lives here, sorted by issue.
- **Checks:** DW-NOMINATE, and the group ratings in opposing pairs.
- **Personal:** Your Match, with your own position on each issue.

### Keeps Their Word
- **Counted:** each promise with its verdict (kept, partly kept, changed, broken), the action that decided it, and where
  the promise came from: campaign site, speech, post, press release or pledge. Automatic matches are labeled "matched
  automatically."
- **Shown, not counted:** promises still waiting on a vote, vague goals, and statements made in debate.

### Shows Up
- **Counted:** missed votes by year, with any reviewed absences left out; the bills they sponsored and how far each got,
  against their party's typical rate.
- **Shown, not counted:** Across the Aisle and Party Rebel, once built.

### Unbought
- **Counted, where the money comes from:**
  - the money map;
  - "The numbers" table;
  - PACs by kind, which feeds the PAC penalty;
  - bundled gifts, which feed Earmarks;
  - joint fundraising, credited back to the people who gave it, which feeds Donor.
- **Period picker:** this cycle, wider spans back to 2017, or one earlier cycle alone.
- **Counted, stocks and trades:** the individual stocks held and their value (Stocks), and the number and value of their
  trades (Trades). Their full trade list lives here.
- **Counted, pledges and reform bills:** which pledges they signed and which of the three reform bills they cosponsored.
- **Shown, not counted:**
  - PAC money not yet processed by the FEC, marked with a *;
  - where the itemized gifts come from: in-state, out-of-state and the top states;
  - outside spending for and against them;
  - Donor Loyalty (whether their votes line up with their funders more than their party's do);
  - timing flags (donations near related votes);
  - donors by employer and industry;
  - net worth over time.

### Above Board
- **Counted:**
  - **Conflicts:** outside income, board seats and job deals; gifts and paid trips.
  - **Trades:** the trades flagged as tied to their committees, votes or donors, each linking to the full trade list on
    the Unbought tab.
  - **Filings:** each trade report and annual report with its due date and filing date.
  - **Legal Trouble:** each case.
- **Shown, not counted:** committee assignments and the sectors they oversee, and lobbying aimed at their committees.

### People First
- **Counted:** each scored bill with its worker or profit strength and their action on it; business-funder voting
  against their party; and the donor-lobbied bills (the CCI).
- **Shown, not counted:** disputed bills.

## Decisions that go with these grades

**Reading disclosures:**
- **House members and House candidates:** read automatically from the House Clerk's online-filed reports, and counted
  without hand review ("read automatically from the filing").
  - Flagged instead, as Not graded yet: paper filings, open-ended ranges, and assets whose type can't be told.
- **Senators:**
  - First: the headless-browser reader in the repo (`scripts/build-holdings.py`) is tried once from your computer.
  - If Senate eFD blocks it: senators show "Not graded yet: Senate reports can't be read automatically" on Unbought.
- **No paid data:** Quiver Quantitative and Disclosed Capitol's API aren't used.

**Renamed:**
- **Trade Conflicts** was the Insider Trading Index.
- **Keeps Their Word** was the Promises Delivered grade (and Integrity's Honesty part).
- **Shows Up** was Showing Up.

**Shown, not graded:**
- the money map, receipts, outside spending and bundled gifts;
- net worth, holdings and trades;
- timing flags;
- Donor Loyalty.

**Score history:** past Integrity, Ethics and Promises Delivered values stay in `public/score-log.json`, and the change
is logged as a rule change.

**Dropped, as measures:**
- **Integrity:** split up as above.
- **Fundraising and Personal Finances:** now in Unbought.
- **Vote Donor Alignment:** Donor Loyalty covers it.
- **Statement–action consistency:** it needed a paid OpenAI key and produced no results; Keeps Their Word covers it.
  The code and the saved trial stay in the repo.
- **Key-vote position:** replaced by the issue leans on the Ideology tab.
- **Your Match as a separate grade:** now part of the Ideology tab, built from the issue leans.

**Dropped, as parts of other measures:**
- **The CCI's money parts:** business PAC share and employee giving.
- **The Insider Trading Index's single-stock activity part.**
- **Foreign-agent contacts:** only contributions count now.

**Not to build:** Grassroots, Super PAC Dependence, Worker Backed, Flip-Flop, and Get Things Done as a grade.

**Shown, not scored:** Pants on Fire.

**Build order:**
1. **Campaign promises, steps 2–4,** so Keeps Their Word covers more than 13 of 59 profiles.
2. **The scores.** The Ideology tab and the five grades, the profile tabs above, the renames, the methodology pages
   and the score-log entry, in one change.
3. **Group scorecards:** a reader for each group's published scorecard, run once a year.
4. **Unbought's formula,** with the House and Senate weights and the labeled fill-ins.
5. **Automatic House disclosures,** then the one-time Senate try.
6. **The disclosure reader** for income, gifts and travel (task #13).
7. **The email to IntegrityIndex.us** with the open questions.
