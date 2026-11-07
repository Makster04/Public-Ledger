# Six grades: proposal for sign-off

Status: proposed November 7, 2026. Nothing here runs yet. Until it's built, the formulas in the
[score methodology](00_POLITICAL_SCORECARD_METHODOLOGY.md) are what the site uses.

The Integrity grade is retired and split into separate grades. Unbought uses
[IntegrityIndex.us](https://integrityindex.us/methodology)'s published formula, credited to them.

| # | Grade | Definition in one line |
|---|---|---|
| 1 | **Your Match** | How closely their record matches your views |
| 2 | **Keeps Their Word** | How often they did what they promised |
| 3 | **Shows Up** | Whether they vote and get their bills moving |
| 4 | **Unbought** | How independent their money is from special interests |
| 5 | **Above Board** | Whether their money is tied to their office, whether they file on time, and whether they're in legal trouble |
| 6 | **People First** | Whether their votes favor working people over business interests |

**Rules for every grade:**
- **Letter grades:** A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below 60.
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

## 1. Your Match

**Definition:** how closely a politician's record matches the positions you choose, weighted by how much you care about
each issue. It's personal to you. It doesn't measure honesty, ethics, or whether their policies help working people.

**Formula:**

```text
Your Match = 100 × Σ(importance × matching evidence) ÷ Σ(importance × all evidence)

importance  low 1 · medium 2 · high 3
evidence    a vote, bill or official act 1 · a statement 0.5 (only on an issue with no action)
```

**Rules:** each bill counts once.

**Minimum:** 3 issues with evidence, covering at least half the importance you chose.

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
Unbought = max(0, 75 + Donor − PAC − PAC Reliance − Earmarks − Stocks − Trades + Bonuses + Pledges)
```

| Part | House | Senate |
|---|---|---|
| **Donor:** Σ share of receipts × weight | ≤$200 and unitemized 16 · $200–499 12 · $500–999 6 · $1,000–1,999 3 · $2,000+ 2 · gifts the FEC hasn't sorted by size 4.04 · self-funding 1 · joint fundraising 1 | 14 · 10 · 6 · 3 · 2 · 5.2 · 1 · 1 |
| **PAC:** Σ dollars × rate | corporate 0.000015 · lobbyist 0.000008 · trade 0.000002 · political and ideological 0.000001 · union and other 0.00000075 | 0.00001 · 0.000005 · 0.000001 · 0.0000005 · 0.00000025 |
| **PAC Reliance** | 10 × H(PAC share of receipts, 0.20) | same |
| **Earmarks** | earmarked dollars × 0.00002 (ActBlue and WinRed excluded) | same |
| **Stocks** | 20 × H(individual-stock value, $400,000); 0 with a qualified blind trust or a full sell-off | same |
| **Trades** | 20 × H(trade count, 50) + 0.00001 × H(trade value, $8,000) | same |
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
- Donor Loyalty;
- DW-NOMINATE.

**Score history:** past Integrity, Ethics and Promises Delivered values stay in `public/score-log.json`, and the change
is logged as a rule change.

**Dropped, as measures:**
- **Integrity:** split up as above.
- **Fundraising and Personal Finances:** now in Unbought.
- **Vote Donor Alignment:** Donor Loyalty covers it.
- **Statement–action consistency:** it needed a paid OpenAI key and produced no results; Keeps Their Word covers it.
  The code and the saved trial stay in the repo.
- **Key-vote position:** DW-NOMINATE covers it.

**Dropped, as parts of other measures:**
- **The CCI's money parts:** business PAC share and employee giving.
- **The Insider Trading Index's single-stock activity part.**
- **Foreign-agent contacts:** only contributions count now.

**Not to build:** Grassroots, Super PAC Dependence, Worker Backed, Flip-Flop, and Get Things Done as a grade.

**Shown, not scored:** Pants on Fire.

**Build order:**
1. **Campaign promises, steps 2–4,** so Keeps Their Word covers more than 13 of 59 profiles.
2. **The grades.** The six grades, the renames, the methodology pages and the score-log entry, in one change.
3. **Unbought's formula,** with the House and Senate weights and the labeled fill-ins.
4. **Automatic House disclosures,** then the one-time Senate try.
5. **The disclosure reader** for income, gifts and travel (task #13).
6. **The email to IntegrityIndex.us** with the open questions.
