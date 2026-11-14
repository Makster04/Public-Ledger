# 5. Plays by the Rules

**Purpose:** whether their own money is tied to the power of their office, whether they follow the disclosure rules, and whether they're in legal trouble. It shows overlap and rule-following, not proof of wrongdoing.

**What it uses:**

- Disclosures: outside pay, board seats, gifts and paid trips, trades and filing dates.
- Lobbying reports, federal contracts and foreign-agent filings.
- Their committees and votes.
- Court, ethics and enforcement cases.

**What the tab shows:** the four indexes, every legal case ranked most serious first, and the trade checks.

**How it's calculated** (each index runs 0 to 100, higher is worse):

```text
100 − (0.35 × Outside Income & Conflicts + 0.20 × Gifts & Travel
       + 0.25 × Trade Conflicts + 0.20 × Stock Disclosure Dodger) − Legal Trouble
```

- **Trade Conflicts:** trades in their committees' sectors (45%), within 30 days of a related vote (30%), or in donors' companies (25%). Needs 5 trades.
- **Stock Disclosure Dodger:** trade reports filed more than 45 days late or never (70%), and late annual reports (30%).
- **Legal Trouble:** the sum over all cases, capped at 100. Each case = status × kind × age:
  - **Status:** confirmed finding 20, open investigation 15, unresolved allegation 15, closed without a finding (acquitted, dismissed, declined or dropped) 5. Context (a reported tie with no accusation of breaking a rule) is shown, not scored.
  - **Kind:** criminal × 1.5, ethics or civil × 1, technical × 0.5.
  - **Age:** half for a closed case decided over 10 years ago. Open cases and unresolved allegations always count in full.
- **Outside Income & Conflicts and Gifts & Travel** need the disclosure reader, which isn't built yet. For now only the two trading indexes and Legal Trouble count. A missing index drops out and the others are rescaled.
- **Needs:** a dated, sourced legal review (done Nov. 14, 2026 for every profile but the president's) plus at least one index.
