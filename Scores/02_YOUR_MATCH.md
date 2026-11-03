# Your Match 🎯

**Status: published grade.** Your Match compares one politician's documented record with the issue positions and importance selected by the visitor. It is personalized: choices are saved in that visitor's browser and are not a universal candidate score.

## Calculation

For each chosen issue, compute the share of the politician's weighted evidence that matches the visitor's side. Multiply that share by the issue's importance (Low = 1, Medium = 2, High = 3). The displayed percentage is matching importance-weighted evidence divided by the total available importance-weighted evidence, times 100.

```text
Your Match = 100 × sum(issue importance × matching share × evidence weight)
                  / sum(issue importance × evidence weight)
```

Evidence weights are 1 for an action and 0.5 for a statement. Votes, bill sponsorships/cosponsorships, and official acts count as actions. Statements are considered only when that issue has no recorded action. A bill gets one credit even if both sponsorship and vote are present; the vote wins. An issue without evidence is omitted rather than treated as a mismatch.

## Minimum evidence

A grade requires evidence on at least three selected issues and coverage of at least half of the visitor's total selected importance. The required issue count is capped by the number of issues the visitor selected. If the visitor has not chosen issues or the evidence minimum is unmet, the grade is unavailable.

## What the score does not mean

It measures agreement with the visitor's selected positions, not honesty, ethics, legislative effectiveness, or agreement with the general electorate. DW-NOMINATE, key-vote position, and issue-position charts are context and do not alter this grade.

## Evidence and implementation

Each issue row links to its underlying votes, bills, actions, statements, and sources. Liberal/conservative marks for the separate key-vote chart are recorded in `public/research.json`; they do not define a visitor's chosen side in Your Match. Calculation: `matchScore` in `public/grades.js`.

See also [the complete score inventory](00_POLITICAL_SCORECARD_METHODOLOGY.md) and [how missing data works](01_HOW_THE_MATH_WORKS.md).
