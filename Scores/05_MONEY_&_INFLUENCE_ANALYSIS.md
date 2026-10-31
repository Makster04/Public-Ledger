# MONEY & INFLUENCE ANALYSIS 💰

<img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> **Done** · <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> **Still in the works**. To check one off, change `checkbox-empty` to `checkbox-checked` in its line.

Back to [Updates & fixes in need](../.04_UPDATES_&_FIXES_IN_NEED.md). The rules every index follows are in [How the math works](01_HOW_THE_MATH_WORKS.md).

## Updates &/or changes

| Status | Item | Notes |
|---|---|---|
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Kept as an analysis, not a grade | Choice A. Labeled **Correlation, not cause**. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Insider Trading Index 📈 shown beside the trade list | The same number as the Ethics tab, with a link to it. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Money sources built | Donors by employer and by month, lobbying, foreign-agent registrations, contracts, rule comments, and the groups behind outside spending. Some wait on their keys. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> | Donor Loyalty Index 🤝 | Build next. The Corporation Compromised Index depends on it. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> | Super PAC Dependence Index 💸 | Replaces the withdrawn super PAC share. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> | Lobbyist Overlap Index 🏛️ | |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> | Contracts for Donors Index 📝 | Needs a table matching agencies to the committees that oversee them. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> | Foreign Agent Flag 🚩 | |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> | Donor hover details | Three bullets: sector, what they do, and political stance with a cited source. Today the hover is one sentence. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Treemap of itemized PAC contributions by sector | On the Money & Influence tab, colored People-aligned, Profit-aligned or Other. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> | SAM.gov: look up each organization once, then recheck monthly | Saves its 1-request-a-run limit. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> | Check for Epstein-linked donors in FEC records | Offered, not started. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not done"> | Decide the graph for each index | |

---

## Index designs

These stay beside the grades and carry the **Correlation, not cause** label.

### Stock trades (from the Ethics tab) 📈
Not a separate index:
- **What's shown:** the Insider Trading Index number from the Ethics tab, beside the existing "Stock holdings and trades" list and the "Stock in donors" stat.
- **Breakdown:** a link to the Ethics tab, which has the parts and the math.
- **Nothing calculated here:** the trade list and its donor flags stay context only. They feed the "Trades in donors" part of the Insider Trading Index, so the two tabs always agree.

**Keys and sources:** the same as the Insider Trading Index 📈 on the Ethics tab.

### Donor Loyalty Index 🤝
**Measures:** how much more they vote with their funders than members of their own party do.

1. For each funder that took public positions, take the person's rate of voting its way minus their party's average on those same votes.
2. Weight each funder by the money it gave or spent for them.
3. Only the amount above the party average counts. The ceiling is 25 points above.

**Minimum:** 5 compared votes.

**Keys and sources:**
- **Money from each funder:** `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> for contributions and outside spending, plus the FEC's bulk files for earlier years (no key).
- **Funders' positions:** the reviewed research (their scorecards and key-vote letters). No key.
- **Votes:** Senate and House roll calls (no key), and `CONGRESS_API_KEY` for House votes from 2023 on.

### Super PAC Dependence Index 💸
**Measures:** super PAC spending for them ÷ (campaign funds raised + all outside spending for them), × 100.

- **Dates:** Jan. 1, 2025 – Sept. 30, 2026. The Q3 reports are in, so both sides now cover the same dates.
- **Covers:** general-election spending only.
- **Not shown:** for three-way races or races marked incomplete.

This replaces the withdrawn super PAC share.

**Keys and sources:** `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">, for campaign totals and independent expenditures.

### Lobbyist Overlap Index 🏛️
**Measures:** bills they sponsored, cosponsored or voted on that a top 20 donor organization lobbied on ÷ all bills they acted on in the same period.

- **Ceiling:** 20%.
- **Exposure only:** lobbying reports don't say which side the lobbyist wanted.

**Keys and sources:**
- **Lobbying reports:** `LDA_API_KEY` (optional).
- **Top donor organizations:** `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">.
- **Their bills:** `CONGRESS_API_KEY`.
- **Their votes:** Senate and House roll calls. No key.

### Contracts for Donors Index 📝
**Measures:** the number of their top 20 donor organizations that got federal contracts from agencies their committees oversee, ÷ 20, × 100. The total contract dollars are shown beside it.

**Needs:** a small new table matching agencies to the committees that oversee them.

**Keys and sources:**
- **Top donor organizations:** `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">.
- **Companies' federal IDs:** `SAM_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">.
- **Federal contracts:** USAspending. No key.
- **Their committees:** congress-legislators. No key.

### Foreign Agent Flag 🚩
A flag, not an index:
- **Yes or no:** whether any top donor organization, or a lobbyist working for one, is registered as a foreign agent (FARA).
- **Details:** each registration is listed.

**Keys and sources:**
- **Foreign-agent registrations:** FARA. No key.
- **Top donor organizations:** `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">.
- **Their lobbyists:** `LDA_API_KEY` (optional).
