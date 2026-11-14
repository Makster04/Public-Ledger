# Money & Influence: descriptive analysis

Money & Influence is not an overall grade. Campaign receipts, PACs, outside spending, donations, holdings, trades, and timing comparisons describe records or identify topics for review. Association and timing do not establish that money caused a decision. Only what a grade's formula names counts: Big Money Independence's donor, PAC, earmark, stock and trade parts and the CCI in People First (see [Scores/06](06_SIX_GRADES_PROPOSAL.md)). Everything else here, the Trackers included, is shown, not graded.

## Vote Donor Alignment

For campaign funders with a recorded position on a vote, this is the share of compared votes where the politician voted the funder's way:

```text
matching votes / compared votes × 100
```

PAC direct gifts and routed/bundled gifts identify qualifying funders. Each compared vote counts once; missed votes are omitted. It does not compare the politician with their party, and it is not a grade.

## Donor Loyalty Index 🤝

For each funder, compare the politician's fraction of votes matching the funder's recorded position with the rest of the politician's party's fraction on those same votes. The politician's vote is removed from the party tally. Each funder's difference is weighted by money given, bundled/routed, or spent for the politician; one funder cannot receive more than half the total weight. Average the differences, discard values at or below the party average, and scale the positive difference so 25 points above the party is 100. At least five compared votes are required. Independents are compared with their caucus party. This is descriptive association, not causation.

The index is higher when donor alignment is greater. It is a distinct measure from Vote Donor Alignment and is used as an input to CCI for business funders. It does not directly change Ethics or the published Integrity formula.

## Other displayed money evidence

- **Campaign receipts and gift-size bars:** FEC amounts by reporting period and gift size; descriptive only unless used as same-period shares in Integrity Fundraising.
- **PAC contributions by type:** PAC committee type from FEC registration or reviewed fallback classification. These amounts feed Integrity's fundraising penalty only when reviewed and reconciled to the same-period PAC total.
- **Outside spending:** independent expenditures for/against the candidate. Shown separately from campaign receipts; not treated as money controlled by the campaign and not included in the described grades.
- **Bundled/routed gifts:** selected conduit committee reports are currently partial. A partial list cannot establish complete earmark coverage or prove no earmarks.
- **Monthly donation series, donor-company trading, lobbyist overlap, employer giving, contracts, and flags:** shown as data or review leads only unless a guide explicitly says an implemented score consumes that field. No proposed “Super PAC Dependence,” “Lobbyist Overlap,” “Contracts for Donors,” or “Foreign Agent” measure is currently a graded index.
- **Net worth and holdings:** sourced annual disclosure ranges and asset descriptions are shown, but net worth is not part of any grade. Individual stock holding values enter only Integrity's Personal Finances component when a reviewed snapshot has complete coverage and readable individual-stock ranges.

## Trackers

Seven lobbies whose money to each campaign is followed (`public/trackers.js`; the lists and what each leaves out are in the README's Trackers section): **Pro-Israel Lobby** 🇮🇱, **Big Pharma + Insurance** 💊, **Big Oil** 🛢️, **Big Tech + AI** 🤖, **Crypto** 🤑, **Big Defense** 🪖 and **Wall Street** 💰. A tracker's PACs are matched by FEC committee ID (each checked by hand) or by name; for the Pro-Israel Lobby, the gifts AIPAC, NORPAC, JACPAC and the RJC collected from donors and passed on to the campaign count too, and so do the named donors' own checks (Miriam and Sheldon Adelson). None of it changes a grade, and money taken isn't treated as proof that a vote was bought.

### Summary of Major Lookouts

On each profile's Big Money Independence tab, one line per tracker: ✕ when the campaign took PAC checks or passed-on gifts from it in the period picked, ✓ when it took none, and … while a record it needs isn't read yet (never ✓ on missing records). Employees' own gifts show as a smaller number and don't change the mark. Each line also shows the person's Career Totals club and rank.

### Career Totals

Since November 13, 2026 (the Trackers page's second tab, `public/career.js`): every sitting member ranked within their chamber by what their campaigns have taken from a tracker over their whole career, in five dollar clubs.

```text
career total = Σ over every cycle since 1979–80, under every candidate ID they've had:
                 checks from the tracker's PACs (refunds subtracted)
               + for AIPAC: the gifts it passed on (since its PAC began giving, 2021–22)
club:  ≥ $1,000,000 Million Dollar Club · ≥ $500,000 Half-Million Club · ≥ $100,000 Six-Figure Club
       · > $0 Under $100,000 · $0 None, ever
```

Members with the same total share a rank. A member's candidate IDs are those congress-legislators lists for them plus the links found in the FEC's candidate files (the same campaign committee in the same state, a House incumbent's ID with the same name and state, or this cycle's Senate run with the same name, state and party), so a senator's House races count. The FEC's bulk files start with the 1979–80 cycle, so a career that began earlier is counted from then. Until AIPAC's passed-on gifts are read for every cycle since 2021–22, its page says which are missing and the profiles' AIPAC tag waits.

### Spent to help them win

Since November 13, 2026, under the Pro-Israel Lobby, Crypto and Big Tech + AI, which spend heavily through their own super PACs (`helpToWin` in `public/trackers.js`, from `public/super-pac-races.json`, built from the FEC's independent-expenditure file):

```text
Spent to help them win = Σ over the tracker's super PACs:
    what it spent for them
  + what it spent against an opponent in an election they were in,
      when that super PAC spent nothing against them in that election
      and either spent for them there or the race had just two candidates with outside spending
Spent against them = what the tracker's super PACs spent against them
```

Each super PAC is judged on its own, since a tracker can have super PACs on both sides of one race. In a primary or runoff only their own party's candidates are opponents (except in California, Washington and Alaska, where every party runs in one primary). One person filed under two IDs in one seat counts once. Spending in their races that doesn't qualify is listed, not counted. None of this money goes to the campaign, so it doesn't change the ✕ or ✓, a grade or a career total. This cycle only.

## Data limits

FEC rows, conduit records, outside spending, and official filing imports retain their own source periods. Do not combine numerator and denominator periods. A missing donor-size fetch does not mean unsorted gifts. An absent selected conduit is not proof of zero earmarks. Career Totals count PAC checks and AIPAC's passed-on gifts only: not individual donors, whom the FEC doesn't label by industry. (OpenSecrets' industry totals add individual donors by its own labeling, so its figures run higher; its API closed to new sign-ups in 2025, and its data isn't used here.) Super PAC spending is counted only for the trackers' own super PACs, this cycle. Detailed current limitations are in [Integrity](03_INTEGRITY_SCORE.md) and the [canonical methodology](00_POLITICAL_SCORECARD_METHODOLOGY.md).
