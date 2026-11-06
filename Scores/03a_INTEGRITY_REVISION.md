# Integrity revision: five parts (approved structure, formulas for sign-off)

Status: the structure below was approved on November 5, 2026, and the five weights, Get It Done and the Conflicts of
Interest formulas now run (`public/integrity.js`). Get It Done needs its file built (`npm run getitdone:build`).
Conflicts of Interest is not graded for anyone until the reader that fills `public/conflicts.json` from the disclosures
and its organization review are built; its formulas are in place. Parts still marked **To build** below don't run yet. Integrity stays provisional and uncalibrated, adapting the structure of
[IntegrityIndex.us](https://integrityindex.us/methodology) with Public Ledger's own additions.

## The grade

```text
Integrity = clamp( weighted average of the complete parts − Legal Trouble Index, 0, 100 )

weights:  Honesty 20% · Personal Finances 20% · Fundraising 25% · Showing Up 15% · Conflicts of Interest 20%
```

Each part is a score from 0 to 100, higher is better. Each index inside a part runs from 0 to 100, higher is worse.
A part without enough evidence is left out and the other weights are rescaled; at least two parts must be complete,
and a dated, sourced Legal Trouble review is required. Missing or unread data is unknown, never a clean zero. Only the
final grade is rounded. Letter grades use the usual 90/80/70/60 cut-offs.

| Part | Weight | Indexes inside | Status |
|---|---:|---|---|
| Honesty | 20% | Promises Delivered; Flip-Flop and Pants on Fire planned | Built (Promises Delivered) |
| Personal Finances | 20% | Holdings and trading penalties, Insider Trading, Stock Disclosure Dodger | Built; additions to build |
| Fundraising | 25% | D, P, R, E, pledges; Super PAC Dependence planned | Built |
| Showing Up | 15% | Attendance (No-Show), Get It Done | Built; both need their files built |
| Conflicts of Interest | 20% | Outside Income & Conflicts, Gifts & Travel | Formulas built; disclosure reader and review to build |
| Subtracted | — | Legal Trouble | Built |

## Shared definitions

- **The window.** 2018 through the current year (2018–2026 now; `WINDOW_FROM` in `public/integrity.js`), the years Showing Up and Get It Done count, unless a part says
  otherwise. Campaign money uses the same two-year cycle as Fundraising.
- **Their committees.** The committees and subcommittees the member sat on during the window (`public/committees.json`),
  and the sectors those committees oversee (`public/committee-sectors.json`).
- **An interested organization** (for Conflicts of Interest): in the window, one that
  1. is a registrant or client on a Lobbying Disclosure Act report (LDA.gov) listing a bill referred to one of their
     committees, or lobbying the agencies those committees oversee; or
  2. is a company whose SEC industry code (`public/sectors.js`) falls in a sector one of their committees oversees; or
  3. received federal contracts from an agency one of their committees oversees (USAspending).

  Every match from a name on a form to an organization is reviewed and cited before it counts; an automatic name match
  is a lead until then.
- **Candidates** (no committees): an interested organization is one that lobbied the chamber they are running for in
  the window (test 1 without the committee condition). Tests 2 and 3 don't apply.
- **Disclosure records.** Senate eFD reports (annual Parts 1–10, periodic transaction reports, due-date extensions,
  blind-trust documents, and "Other Documents" once their contents are known), and the House Clerk's annual reports
  (Schedules A–J) and periodic transaction reports. Each document counts once; for each year an amendment replaces the
  original, and both are kept so what an amendment added can be seen.

## 1. Honesty (20%) — Built

```text
Promises Delivered = 100 × (kept + 0.5 × partly kept or changed) ÷ counted checks      (at least 3 counted checks)
```

Unchanged from [03_INTEGRITY_SCORE.md](03_INTEGRITY_SCORE.md). Flip-Flop 🩴 and Pants on Fire 🔥 are planned additions;
each gets its own formula for sign-off before it is built (both need `GOOGLE_API_KEY` for the Fact Check Tools API).

## 2. Personal Finances (20%) — Built; additions to build

```text
Personal Finances = clamp( 100 − S − T − 0.20 × Insider Trading − 0.20 × Stock Disclosure Dodger, 0, 100 )
S = 20 × Hill(individual-stock value, $400,000)
T = 20 × Hill(trade count, 50) + 20 × Hill(trade value, $1,000,000)
Hill(x, m) = x^0.745 / (m^0.745 + x^0.745)
```

The formula, the Insider Trading Index (committee conflicts 40%, trades within 30 days of related votes 25%, trades
in donor companies 20%, single-stock activity 15%) and the evidence minimums are unchanged. Additions to build:

- **The annual report's trades** (Senate Part 4b, House Schedule B) join the trade reports, each trade once (same
  asset, owner, type and amount range, dated within 3 days).
- **Stock Disclosure Dodger, the real due date:** an annual report is due May 15, or on the date a granted extension
  gives (up to 90 days later). Filing within an extension is on time.
- **Stock Disclosure Dodger, a missing trade report:** a trade on the annual report that required a periodic
  transaction report (a reportable asset over $1,000; widely held funds excepted, as the form excepts them) with no
  matching report counts as a trade report never filed.
- **Stock Disclosure Dodger, what an amendment added:** an amendment that adds a holding or trade left off the
  original counts as one late filing for each item added, dated from the original's due date. An amendment that only
  corrects a value or a typo doesn't count.

## 3. Fundraising (25%) — Built

```text
Fundraising = clamp( 75 + D − P − R − E + pledges, 0, 100 )
```

Unchanged from [03_INTEGRITY_SCORE.md](03_INTEGRITY_SCORE.md): D donor-size credit (capped at 14), P PAC-type penalty
(capped at 30), R = 10 × Hill(PAC share, 20%), E earmarked-gift penalty (capped at 30), pledges +1 kept / −1 broken
per category. Super PAC Dependence 💸 is planned; its formula comes for sign-off before it is built.

## 4. Showing Up (15%) — Built

```text
Showing Up = 0.75 × Attendance + 0.25 × Get It Done      (Attendance alone when Get It Done isn't available)
```

**Attendance (the No-Show Index 🪑), built:** `clamp(100 − 5 × missed %, 0, 100)`, where missed % is the share of
roll-call votes missed while in office in the window (2018 on) (Voteview, both chambers, `npm run attendance:build`). "Not
voting", paired and announced votes are missed; Present counts as there. Votes missed while campaigning count. A
reviewed absence with a cited source for medical leave, a birth or adoption, a death in the family, or military duty is
left out of both the votes and the misses for its dates. At least 50 votes in office. The record shows that a vote was
missed, not why or where the member was.

**Get It Done ✅, built (`npm run getitdone:build` writes `public/get-it-done.json`):**

```text
advanced rate  r = bills advanced ÷ bills sponsored, over the window's Congresses
typical rate   m = the median r of the members of their party in their chamber, Congress by Congress,
                   weighted by the member's own bills in each Congress
Get It Done    = 100 × min(1, r ÷ m)
```

- **Counted:** bills and joint resolutions they sponsored (H.R., S., H.J.Res., S.J.Res.). Simple and concurrent
  resolutions (commemorations, rules) are left out.
- **Advanced:** reported by a committee, passed either chamber, or became law (Congress.gov actions or GovInfo's bill
  status files). A bill counts once, at the furthest step.
- **Minimum:** 10 sponsored bills in the window. With fewer, or when the typical rate is 0, Get It Done is not
  available and Showing Up is Attendance alone.
- **Why against their own party in their chamber:** the majority party advances more bills; comparing within the party
  keeps the minority from being marked down for being the minority.

## 5. Conflicts of Interest (20%) — Formulas built; the disclosure reader to build

```text
Conflicts of Interest = clamp( 100 − (0.60 × Outside Income & Conflicts + 0.40 × Gifts & Travel), 0, 100 )
```

It needs a readable annual (or candidate) report for the latest report year and the reviewed organization matches for
it, in `public/conflicts.json`:

```text
people: {id: {report: {year, url}, reviewed: {at, src},
              income: [{payer, amount, interested, src}], positions: [{org, position, interested, src}],
              agreements: [{org, kind, interested, src}], gifts: [{source, value, interested, src}],
              travel: [{sponsor, dates, value, interested, src}],
              lobbyistOverlap: {sharePct}, contractsForDonors: {companies}, foreignAgent: {filings}}}
```

`interested` is true only for a reviewed match; anything else counts for nothing. Either index may be unavailable; the other is then used alone. With neither, the part is not complete.

### Outside Income & Conflicts Index

```text
Outside Income & Conflicts = 0.40 × I + 0.25 × Lobbyist Overlap + 0.20 × Contracts for Donors + 0.15 × Foreign Agent
                             (weights rescaled over the parts available; I is required)
```

**I, income, board seats and agreements** (latest report year; Senate Parts 1, 2, 8, 9, 10 / House Schedules C, E, F,
I, J), capped at 100:

```text
I = 60 × Hill(income from interested organizations, $50,000)
  + 20 for each board seat or officer position with an interested organization (at most 40)
  + 40 for an agreement with one: future employment, a leave of absence, or continuing payments (at most 40)
```

Income counts earned and non-investment income and compensation over $5,000 from one source (on first and candidate
reports). Investment income is left out (it is in Personal Finances). An unpaid seat on a charity's board counts only
when the charity is itself an interested organization. Payments to charity in lieu of honoraria (Part 1) are shown;
they count as income only when an interested organization paid them.

**Lobbyist Overlap 🏛️:** `100 × Hill(share of campaign receipts from interested organizations' PACs and employees,
25%)`, over the Fundraising cycle, with employees matched to their employers from FEC records. Needs the cycle's
receipts and its employer-matched donors.

**Contracts for Donors 📝:** `100 × Hill(donor companies with contracts, 5)`. A donor company gave $10,000 or more in
the cycle (PAC plus employees) and received over $1 million in federal contracts during their time in office from an
agency one of their committees oversees. It shows the overlap; it does not claim the member steered a contract. Needs
the reviewed table of agencies and the committees that oversee them.

**Foreign Agent Flag 🚩:** `25 × reviewed filings, at most 100`: Foreign Agents Registration Act filings (efile.fara.gov)
reporting a contact with the member or their office, or a contribution to their campaign, in the window. Unreviewed
filings and allegations count 0.

### Gifts & Travel Index

```text
Gifts & Travel = 60 × Hill(value of gifts and paid travel from interested organizations, $10,000)
               + 10 for each such gift or trip (at most 40)                                  capped at 100
```

Over the latest two report years (Senate Parts 5 and 6, House Schedules G and H). Gifts the form excepts (from
relatives, personal friendship, and the like, as reported) are left out. A trip the Ethics Committee approved is legal
and still counts when its sponsor is an interested organization: the index measures exposure to interested sponsors,
not a rule broken. A trip's dates are shown beside any roll calls missed then; those misses already count in Showing
Up and are not counted again.

## Subtracted: Legal Trouble Index 🚨 — Built

Each reviewed case scores status (finding 20, open 15, closed without finding 5, allegation 0) × kind (criminal 1.5,
ethics or civil 1, technical 0.5) × age (a closed case decided over 10 years ago counts half), summed and capped at
100. Unchanged.

## Shown, not scored

Across the Aisle 🌉 and Party Rebel 🤠 (beside the grade); net worth by year, holdings and trades; Donor Loyalty, Vote
Donor Alignment and the planned Speech Donor Alignment (Money & Influence); the Corporation Compromised Index (inside
People First); statement–action consistency, DW-NOMINATE and key-vote positions. eFD's "Other Documents" are placed
once their contents are known: corrections go to Stock Disclosure Dodger, notices of negotiating a future job to
Outside Income & Conflicts, gift or travel papers to Gifts & Travel, Ethics Committee letters to Legal Trouble (as a
reviewed case or a lead), and routine papers are shown only.

## Worked example

A senator with Honesty 80; holdings penalty 8, trading penalty 6, Insider Trading 40, Stock Disclosure Dodger 20;
Fundraising 70; 2% of votes missed, and bills advanced at twice their party's typical rate; $80,000 in consulting
income and a board seat from a company that lobbies their committee; 15% of campaign receipts from interested
organizations; three donor companies with contracts; no foreign-agent filings; two paid trips worth $12,000 from
interested sponsors; Legal Trouble 5.

```text
Personal Finances  = 100 − 8 − 6 − 0.20×40 − 0.20×20                                    = 74
Showing Up         = 0.75 × (100 − 5×2) + 0.25 × 100                                     = 92.5
I                  = 60 × Hill($80,000, $50,000) + 20 = 35.2 + 20                         = 55.2
Lobbyist Overlap   = 100 × Hill(15%, 25%)                                                 = 40.6
Contracts          = 100 × Hill(3, 5)                                                     = 40.6
Outside Income & Conflicts = 0.40×55.2 + 0.25×40.6 + 0.20×40.6 + 0.15×0                   = 40.3
Gifts & Travel     = 60 × Hill($12,000, $10,000) + 10×2 = 32.0 + 20                       = 52.0
Conflicts          = 100 − (0.60×40.3 + 0.40×52.0)                                        = 55.0
Integrity          = 0.20×80 + 0.20×74 + 0.25×70 + 0.15×92.5 + 0.20×55.0 − 5 = 73.2 − 5  = 68 (D)
```

## Build order

1. Read every part of each annual report (Senate Parts 1–10, House Schedules A–J), extensions and amendments, into
   each person's yearly disclosure record; add the annual report's trades and the new Stock Disclosure Dodger checks.
2. The interested-organization matches (LDA.gov reports, SEC industry codes, committee sectors) with their review
   step; then Outside Income & Conflicts (I first) and Gifts & Travel; then Lobbyist Overlap, Contracts for Donors (after
   the agency-to-committee table) and Foreign Agent Flag.
3. Get It Done inside Showing Up.
4. The five weights, the Integrity tab's sections, the methodology pages and the monthly preview log, in one change.
