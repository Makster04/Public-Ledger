# Money & Influence: descriptive analysis

Money & Influence is not an overall grade. Campaign receipts, PACs, outside spending, donations, holdings, trades, and timing comparisons describe records or identify topics for review. Association and timing do not establish that money caused a decision. Only the explicitly named CCI is an index used in a published grade (People First); Integrity's Fundraising component is a separate preview calculation.

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
- **Net worth and holdings:** sourced annual disclosure ranges and asset descriptions are shown, but net worth is not part of the published Ethics grade. Individual stock holding values enter only the Integrity preview when a reviewed snapshot has complete coverage and readable individual-stock ranges.

## Data limits

FEC rows, conduit records, outside spending, and official filing imports retain their own source periods. Do not combine numerator and denominator periods. A missing donor-size fetch does not mean unsorted gifts. An absent selected conduit is not proof of zero earmarks. Detailed current limitations are in [Integrity](03_INTEGRITY_SCORE.md) and the [canonical methodology](00_POLITICAL_SCORECARD_METHODOLOGY.md).
