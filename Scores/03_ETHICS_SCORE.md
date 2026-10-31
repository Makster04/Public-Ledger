# ETHICS SCORE ⚖️

<img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> **Done** · <img src="../assets/checkbox-progress.svg" width="20" align="absmiddle" alt="In the works"> **In the works** · <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> **Not started**. To change one, swap the image name in its line: `checkbox-empty` (not started), `checkbox-progress` (in the works) or `checkbox-checked` (done).

Back to [Updates & fixes in need](../.04_UPDATES_&_FIXES_IN_NEED.md). The rules every index follows are in [How the math works](01_HOW_THE_MATH_WORKS.md).

## Updates &/or changes

| Status | Item | Notes |
|---|---|---|
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Legal Trouble Index 🚨 | Status points × kind of case × age, ceiling 100. Keeps its exact value, so only the grade is rounded. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Insider Trading Index 📈 | Committee conflicts, trades near votes, trades in donors and single-stock activity. Needs 5 reviewed trades. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Stock Disclosure Dodger Index 🙈 | Late or missing trade reports and late annual disclosures. Needs 3 filings. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | New Ethics grade formula | 100 − Legal Trouble − a tenth of Insider Trading − a tenth of Stock Disclosure Dodger. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Each case tagged with its kind and the year it was decided | In the reviewed research. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Indexes shown on the Ethics tab, Money & Influence tab and Scores page | The same numbers everywhere, with the math on the Ethics tab. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Trades read from the official House and Senate reports | House Clerk PDFs and Senate eFD, no key. Their dates win over the trade services. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | "Reports to check by hand" list | Paper or scanned reports that can't be read as text. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Decide the graph for each index | Today: case timeline, trades and votes, days from trade to disclosure, and points lost by kind. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | First live run of the trade readers | The cloud sandbox can't reach the House and Senate sites, so the first run on your computer is the real test. Senate.gov turned scripts away (HTTP 403) for the vote files, so watch for the same on the Senate eFD reader. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Review every case's tags | Kind, decided year, and open or closed. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Confirm the placeholder weights | Criminal × 1.5, technical × 0.5, half after 10 years, and a tenth for each trading index. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Senators' annual financial disclosures | Not imported yet, so that part of the Stock Disclosure Dodger Index drops out for senators. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Decide who confirms leads before they count | Court records, FEC enforcement records and DOJ press releases. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | The president's trades listed | From Disclosed Capitol's open dataset of the OGE 278e and 278-T reports (`npm run exec:build`), on the Ethics tab. Not scored. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Score the president's trades? | Decide what replaces the committee-conflict rule for a president, and whether 278-T reports filed after 45 days count. Spot-check the dataset against the OGE PDFs first. |

---

## Index designs

### Legal Trouble Index 🚨
**Measures:** how serious their legal and ethics cases are, from official records.

Each case is worth its **status points × kind of case × age**:

- **Status points:**
  - Confirmed finding: 20 (a conviction, guilty plea, ethics committee finding, agency penalty, or the person admitting it).
  - Open investigation: 15 (an indictment not yet resolved, an active probe or a pending lawsuit).
  - Closed without a finding: 5 (acquittal, dismissal, no charges, or a settlement without admitting anything).
  - Allegation: 0. Listed, but no official body acted on it.
- **Kind of case:**
  - Criminal: × 1.5 (indictments, convictions, guilty pleas).
  - Ethics or civil: × 1 (House or Senate Ethics, agency enforcement, civil lawsuits).
  - Technical: × 0.5 (FEC fines for late reports, disclosure mistakes that were corrected).
- **Age:** × 0.5 if the case's latest status change was more than 10 years ago. Open cases always count in full.

The index is the total of every case's points, with a ceiling of 100.

| Status | Criminal | Ethics or civil | Technical |
|---|---|---|---|
| Confirmed finding | 30 | 20 | 10 |
| Open investigation | 22.5 | 15 | 7.5 |
| Closed without a finding | 7.5 | 5 | 2.5 |

**Rules:**
- **Each case counts once, at its current status.** When an indictment ends in a conviction, the entry is updated, not added again.
- **One matter is one case.** If the same conduct leads to both a DOJ case and an ethics probe, only the more serious one counts.
- **Leads don't count.** Court records, DOJ press releases and FEC enforcement records from the daily refresh count only after their status is confirmed from an official record.
- **No cases** scores 0, shown as "No recorded cases".

**Example:** an open criminal investigation (15 × 1.5 = 22.5), an ethics finding from 12 years ago (20 × 1 × 0.5 = 10) and a closed FEC late-filing case (5 × 0.5 = 2.5) give 22.5 + 10 + 2.5 = **35**.

**Keys and sources:**
- **The cases themselves:** the reviewed research. No key.
- **New leads to review:**
  - `COURTLISTENER_API_TOKEN`: court records.
  - `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">: FEC enforcement records.
  - DOJ press releases: no key.

### Insider Trading Index 📈
**Measures:** stock trades that overlap with the person's power, donors or votes.

- **Committee conflicts (40%, required):** the dollar value of trades in single companies' stock, in sectors their committees oversee, ÷ the dollar value of all their single-company trades. Each trade's dollar value is the middle of its disclosed range. For example, "$1,001–$15,000" counts as $8,000.
- **Trades near related votes (25%):** the share of trades made within 30 days before or after a vote or bill action of theirs that affects that company's sector.
- **Trades in donors (20%):** the share of trades in a company whose PAC or employees gave to them, or that lobbied on a bill they acted on.
- **Single-stock activity (15%):** single-company trades per year, with a ceiling of 50 trades a year. Funds, ETFs and bonds don't count.

**Rules:**
- Spouse and dependent-child trades count and are labeled.
- Fewer than 5 reviewed trades means "Not enough data", with the raw flags still listed.
- No trades at all scores 0, shown as "No trades".
- People not in Congress show "No trading data". A president shows "Not scored for a president", with the trades listed.
- Trades that made unusually good returns are shown as leads only, never scored.

**Also shown on:** the Money & Influence tab, beside the trade list. It's the same number, not a second score.

**Example:** conflicts 30, near votes 20, donors 10, activity 24 gives (0.4×30) + (0.25×20) + (0.2×10) + (0.15×24) = **23**.

**Keys and sources:**
- **Trades:**
  - The members' own trade reports, from the House Clerk and Senate eFD: no key.
  - Cross-checks: `BARGO_API_KEY`, `EULERPOOL_API_KEY` and `FMP_API_KEY`, all optional.
  - Not used: `DISCLOSED_CAPITOL_API_KEY`. Its free credits are a one-time trial.
  - The president's trades: Disclosed Capitol's open dataset of the OGE reports, no key (`npm run exec:build`).
- **Company sectors:** `SEC_USER_AGENT`, your name and email (not a key).
- **Committees and the sectors they oversee:** congress-legislators and the Senate and House committee lists. No key.
- **Votes and bill actions:**
  - Senate and House roll calls: no key.
  - `CONGRESS_API_KEY`: bill actions and House votes from 2023 on.
- **Donors:** `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> for PAC money and donors by employer.
- **Lobbying:** `LDA_API_KEY` (optional).

### Stock Disclosure Dodger Index 🙈
**Measures:** stock and holdings reports that were filed late or never filed.

- **Late or missing trade reports (70%, required):** the share of trades reported after the 45-day deadline, or never reported.
- **Late annual financial disclosures (30%):** the share of the last 3 years' annual reports filed after the deadline, extensions included. These are the yearly reports that list holdings, including stocks. They come from the House disclosure index.

**Rules:**
- **Minimum:** at least 3 required filings.
- **People not in Congress:** "No trading data."
- **Late FEC campaign reports:** not part of this index, because they're campaign money, not stock. An FEC fine for late reports counts in the Legal Trouble Index 🚨 as a technical case once it's reviewed.

Late trade reports are counted here, not in the Insider Trading Index, so nothing is counted twice.

**Keys and sources:**
- **Trade and filing dates:** the members' own trade reports, from the House Clerk and Senate eFD (no key). The trade services above are optional cross-checks.
- **Annual disclosures:** the House disclosure index. No key.
- **Senators:** their trade reports are read from Senate eFD, but their annual disclosures aren't imported yet. For senators, the annual-disclosure part drops out and only the trade-report part counts.

### ↓↓↓

### New Ethics grade formula ⚖️
**Ethics** = 100 − Legal Trouble Index − (Insider Trading Index × 0.10) − (Stock Disclosure Dodger Index × 0.10). It never goes below 0.

- **Cases count in full.** They're the main part of the grade, and serious enough cases alone can bring it to 0.
- **Trading can cost at most 20 points,** the same as today. The deduction now reflects how serious the trading is, not just how many bad trades there were.

**Example:** Legal Trouble Index 35, Insider Trading Index 23 and Stock Disclosure Dodger Index 40 give 100 − 35 − 2.3 − 4 = **58.7, rounded to 59 (F)**.

The three indexes don't overlap:
- **Legal Trouble Index 🚨:** official findings, investigations and charges.
- **Insider Trading Index 📈:** what they traded, and whether it overlaps with their committees, votes or donors.
- **Stock Disclosure Dodger Index 🙈:** whether they reported it on time.
