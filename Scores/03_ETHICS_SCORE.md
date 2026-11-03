# Ethics ⚖️ and its indices

**Status: historical published grade, preserved without recalculation.** Ethics is no longer a current headline grade. Its indices live on inside [Integrity](08_INTEGRITY_SCORE.md): the **Legal Trouble Index** is deducted from Integrity at full strength, and the **Insider Trading Index** and **Stock Disclosure Dodger Index** are part of its Personal Finances component. Its reviewed legal and trading evidence remains accessible in the corresponding Integrity sections. Its percentage is not part of the Integrity calculation.

```text
Ethics = max(0, round(100 − Legal Trouble − 0.10 × Insider Trading
                            − 0.10 × Stock Disclosure Dodger))
```

Only the final grade is rounded. Each index can cost at most 10 points in this formula. Under the existing Ethics method, an unavailable trading index creates no deduction; do not confuse this with the stricter unknown-data requirements of the Integrity preview.

## Legal Trouble Index 🚨

Each reviewed case contributes `status points × case-kind multiplier × age multiplier`; total is capped at 100.

| Reviewed status | Points |
|---|---:|
| Confirmed finding | 20 |
| Open official investigation | 15 |
| Closed without finding | 5 |
| Allegation with no official action | 0; listed, not scored |

| Case kind | Multiplier |
|---|---:|
| Criminal | 1.5 |
| Ethics or civil | 1.0 |
| Technical disclosure/reporting issue | 0.5 |

A non-open case whose latest status change was more than 10 years before the reviewed research is multiplied by 0.5. Open cases count in full. A case is counted once at its current status; related duplicate matters should be consolidated to one case. Leads from news, enforcement, or court feeds do not count until reviewed against a source.

## Insider Trading Index 📈

This measures reviewed congressional trades overlapping with committee jurisdiction, votes, donors, and single-stock activity. It does not claim that trading itself is wrongdoing.

| Part | Weight | Calculation |
|---|---:|---|
| Committee conflicts | 40% | Share of individual-stock trade value in sectors the member's committees oversee; use disclosed amount midpoints where all values are readable, otherwise count trades |
| Near-vote trades | 25% | Share of reviewed trades within 30 days of a related vote/action |
| Trades in donor companies | 20% | Share of reviewed trades in companies whose PAC/group is a tracked donor |
| Single-stock activity | 15% | Annualized individual-stock trade count; 50 per year reaches 100 |

At least five reviewed trades are required. With confirmed congressional disclosure coverage and no trades, the published Ethics index is 0. No coverage is unavailable, not a verified zero. Spouse/dependent trades are included and labeled. Qualified blind-trust trustee trades after the effective date are excluded only when verified; outside and pre-trust trades remain. No-stock status is a description, not a bonus. Presidential OGE trades are shown but not scored by these congressional methods.

## Stock Disclosure Dodger Index 🙈

Measures late/missing Periodic Transaction Reports and late annual disclosures. Trade reports are late after the 45-day deadline or if missing. Trade-report violations have 70% weight and annual disclosure lateness 30%; weights are normalized over available filing types. At least three required filings and covered trade reporting are needed. Missing due/filed dates are not assumed timely. Once trades are reviewed, a covered STOCK Act case moves out of Legal Trouble and into this index to avoid counting the same disclosure failure twice.

## Coverage notes

The app preserves case sources, status, case type, dates, trade filings, deadlines, annual holdings/disclosures, and reviewed trust status. Holdings and trades are not themselves part of the published Ethics grade; the two trading indices are. Net-worth ranges are displayed for context and do not determine this grade.

See [Integrity](08_INTEGRITY_SCORE.md) for why it requires a sourced Legal Trouble review and for its different finance weights and missing-data rules. See the [canonical methodology](00_POLITICAL_SCORECARD_METHODOLOGY.md) for all outputs.
