# How the calculations work

This project has grades, indices, per-statement analyses, and context measures. They are different things; a number shown in a chart is not automatically an overall grade. The canonical inventory and equations are in [the score methodology](00_POLITICAL_SCORECARD_METHODOLOGY.md).

## Shared rules

- **Keep unknowns unknown.** Missing, unreadable, unreviewed, or uncovered data is not automatically zero, a clean record, or evidence of no activity. Each score has its own requirements. If they are not met, the app says why it is unavailable.
- **Use reviewed evidence.** New API or official-source records are leads until checked. Calculated outputs retain the sources, dates, and evidence used where the data model supports them.
- **Avoid duplicate credit.** Repeated underlying events are deduplicated where the method requires it. A vote supersedes sponsorship or a statement on the same bill; one bill is credited once.
- **Weights and normalization are explicit.** Only methods that specify reweighting renormalize around missing parts. Do not carry a default score into a missing component.
- **Round at display time.** Keep the underlying calculation precise where possible; apply each method's stated rounding only to its displayed result.
- **Separate official history from experiments.** Published grade changes go to `public/score-log.json`. Integrity comparisons go to `public/integrity-preview-log.json`; they are not official grade history.

## Actions and statements

For issue matching and People First actions: votes, sponsorships/cosponsorships, and official acts count 1.0. Public statements count 0.5 and are used only where no action is recorded for that issue. One bill receives one credit. The full rules are described in [Your Match](02_YOUR_MATCH.md) and [People First](07_PEOPLE_FIRST_SCORE.md).

## Weighting and 0–100 scales

A weighted average is `sum(weight × value) / sum(available weights)`. Missing parts drop out only where the method explicitly permits reweighting. A cap maps a stated reference threshold to 100; it is not evidence that values beyond the cap are equivalent in the real world. Provisional thresholds and uncalibrated settings are identified as such in the relevant guide.

## Letter grades

| Grade | Displayed percentage |
|---|---:|
| A | 90–100 |
| B | 80–89 |
| C | 70–79 |
| D | 60–69 |
| F | 0–59 |

The grade is assigned after rounding the final percentage. Insufficient evidence is shown as “Not graded,” never as 0%.

## Current boundaries

- Your Match depends on each visitor's private, local alignment choices.
- Ethics and Promises Delivered remain published grades while the Integrity comparison period runs.
- Integrity is a provisional preview. It requires two complete components and a dated, sourced Legal Trouble review; missing legal coverage prevents an overall score.
- Statement–action consistency is calculated separately for each statement and does not roll up to a politician grade.
- DW-NOMINATE and key-vote positioning describe political position, not quality or performance.

See [Ethics](03_ETHICS_SCORE.md), [Promises Delivered](04_PROMISES_DELIVERED_SCORE.md), and [Integrity](08_INTEGRITY_SCORE.md) for their evidence rules and formulas.
