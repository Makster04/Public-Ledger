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

- **Trade Conflicts (0–100):** 0.45 × the share of trades in their committees' sectors + 0.30 × the share within 30 days of a related vote + 0.25 × the share in donors' companies. Needs 5 trades: with none, or fewer, it isn't counted (no trades isn't a clean score; since Nov. 20, 2026).
- **Stock Disclosure Dodger (0–100):** 0.70 × the share of trade reports filed more than 45 days late or never + 0.30 × the share of annual reports filed late.
- **Legal Trouble:** the points all cases take off, up to 100. Each case = status × kind × age:
  - **Status:** confirmed finding 20, open investigation 15, unresolved allegation 15, closed without a finding (acquitted, dismissed, declined or dropped) 5. Context (a reported tie with no accusation of breaking a rule) is shown, not scored.
  - **Kind:** criminal × 1.5, ethics or civil × 1, technical × 0.5.
  - **Age:** half for a closed case decided over 10 years ago. Open cases and unresolved allegations always count in full.
- **Outside Income & Conflicts and Gifts & Travel (since Nov. 25, 2026):** read from the latest annual reports of sitting members with committee seats (13 so far), counting only organizations reviewed as interested: they lobbied in 2024–2025 on an issue one of the member's committees handles, work in an industry those committees oversee, or hold federal contracts from an agency they oversee. Outside Income & Conflicts = 60 × Hill(income from interested organizations, $50,000) + 20 for each board seat with one, or each income source from one with no amount given (spouse pay is listed only as "over $1,000" or "N/A"), at most 40 together + 40 for an agreement with one. Gifts & Travel = 60 × Hill(value, $10,000) + 10 a gift or trip, at most 40. Everyone else's are not counted yet; a missing part drops out and the others are rescaled.
- **Needs:** a dated, sourced legal review (done Nov. 14, 2026 for every profile but the president's) plus at least two of the four parts (since Nov. 20, 2026: one part alone, or no trades at all, had given 100%).

## THINGS STILL NOT ADDED, UPDATED, OR CALCULATED YET

- **Outside Income & Conflicts (35%) and Gifts & Travel (20%)** cover only the 13 sitting members whose reports are read and reviewed. Since Nov. 28, 2026, the export takes every senator and House member in office whose reports the refresh has read, and each organization on them gets a proposed decision from its lookup (lobbying on an issue their committees handle, or contracts from an agency they oversee; whether it works in an industry they oversee is left for review), which counts once approved. Lobbyist Overlap, Contracts for Donors and Foreign Agent aren't matched yet. A grade also needs the legal-record review, which only the full profiles have.
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
