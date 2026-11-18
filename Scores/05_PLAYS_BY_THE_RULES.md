# 5. Plays by the Rules

**Purpose:** whether their own money is tied to the power of their office, whether they follow the disclosure rules, and whether they're in legal trouble. It shows overlap and rule-following, not proof of wrongdoing.

**What it uses:**

- Disclosures: outside pay, board seats, gifts and paid trips, trades and filing dates.
- Lobbying reports, federal contracts and foreign-agent filings.
- Their committees and votes.
- Court, ethics and enforcement cases.

**What the tab shows:** the four parts, every legal case ranked most serious first, and the trade checks.

**How it's calculated** (the grade is a percentage to one decimal; each part is a number from 0 to 100 with one decimal and no % sign, and higher is worse):

```text
100% − (0.35 × Outside Income & Conflicts + 0.20 × Gifts & Travel
       + 0.25 × Trade Conflicts + 0.20 × Stock Disclosure Dodger) − Legal Trouble
```

- **Trade Conflicts (0–100):** 0.45 × the share of trades in their committees' sectors + 0.30 × the share within 30 days of a related vote + 0.25 × the share in donors' companies. Needs 5 trades.
- **Stock Disclosure Dodger (0–100):** 0.70 × the share of trade reports filed more than 45 days late or never + 0.30 × the share of annual reports filed late.
- **Legal Trouble:** the points all cases take off, up to 100. Each case = status × kind × age:
  - **Status:** confirmed finding 20, open investigation 15, unresolved allegation 15, closed without a finding (acquitted, dismissed, declined or dropped) 5. Context (a reported tie with no accusation of breaking a rule) is shown, not scored.
  - **Kind:** criminal × 1.5, ethics or civil × 1, technical × 0.5.
  - **Age:** half for a closed case decided over 10 years ago. Open cases and unresolved allegations always count in full.
- **Outside Income & Conflicts and Gifts & Travel** need the disclosure reader, which isn't built yet. For now only Trade Conflicts, Stock Disclosure Dodger and Legal Trouble count. A missing part drops out and the others are rescaled.
- **Needs:** a dated, sourced legal review (done Nov. 14, 2026 for every profile but the president's) plus at least one of the four parts.

## THINGS STILL NOT ADDED, UPDATED, OR CALCULATED YET

- **Outside Income & Conflicts (35%) and Gifts & Travel (20%)** need the disclosure reader, which isn't built: every part of the annual reports into `public/conflicts.json`, matched against lobbying, contracts and foreign-agent filings.
- **Committee sectors** (which industries each committee oversees, for Trade Conflicts) are a draft that needs review.
- **Senate annual reports' due and filed dates** for the last 3 years, for Stock Disclosure Dodger's annual part.
- **Legal cases:**
  - Every case's tags (kind, year decided, open or closed) still need review.
  - The placeholder weights (criminal × 1.5, technical × 0.5, half after 10 years) need confirming.
  - Who confirms legal leads before they count is still to be decided.
- **The president:**
  - Their Legal Trouble review needs a dated recheck.
  - Their trades need a spot-check against the OGE reports, and a decision on whether to score them.
- **Lobbyists' honorary and event spending for them** (LD-203) is shown on the Big Money Independence tab. Whether it should count toward Gifts & Travel isn't decided.
