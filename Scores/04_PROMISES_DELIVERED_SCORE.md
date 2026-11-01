# PROMISES DELIVERED SCORE 📦

<img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> **Done** · <img src="../assets/checkbox-progress.svg" width="20" align="absmiddle" alt="In the works"> **In the works** · <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> **Not started**. To change one, swap the image name in its line: `checkbox-empty` (not started), `checkbox-progress` (in the works) or `checkbox-checked` (done).

Back to [Updates & fixes in need](../.04_UPDATES_&_FIXES_IN_NEED.md). The rules every index follows are in [How the math works](01_HOW_THE_MATH_WORKS.md).

## Updates &/or changes

| Status | Item | Notes |
|---|---|---|
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Promise score | Kept counts 1, partly kept or changed counts ½. Needs 3 counted checks. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | The president graded from PolitiFact's trackers | Both terms counted together. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Statement sources built | Floor speeches, hearings, press releases, Bluesky, YouTube and Threads. Some wait on their keys, and Threads waits on Meta's approval. |
| <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done"> | Fact-check source built | Google Fact Check Tools. Starts once `GOOGLE_API_KEY` is set. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Flip-Flop Index 🩴 | Designed, not built. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Pants on Fire Index 🔥 | Designed, not built. Needs `GOOGLE_API_KEY`. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | New Promises Delivered grade formula | After both indexes are built. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Decide whether Pants on Fire counts in the grade | Or sits beside it (the option in its design). |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Tag true campaign promises separately | Apart from other stated positions. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Money pledges re-checked from the records (step 7 of 9) | Idea from the Integrity Index, which gives a point per anti-corruption pledge. Here a pledge stays a promise check, kept or not by the record. On file now, written by hand: 5 corporate-PAC pledges (Ossoff, Booker, Stratton, Conley, El-Sayed), 9 stock-trading checks (Sullivan, Marshall, Ossoff, Booker, Hickenlooper, Gluesenkamp Perez, Hinson, Pappas, Ricketts) and Booker's single-issue PAC pledge. The plan: each corporate-PAC pledge is rechecked from the FEC's PAC types (`npm run pacs:types`) on every refresh, and each stock-ban statement from the six anti-corruption bills' sponsors and cosponsors and the Stop Insider Trading Act votes. A check changes only after review. To decide first: what counts as keeping a corporate-PAC pledge (no corporate PAC checks at all, or returning the ones that arrive), and whether trade-association and leadership PACs count. Needs the PAC types saved first. |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Check the MAGA-Meter tally against PolitiFact's live page | |
| <img src="../assets/checkbox-empty.svg" width="20" align="absmiddle" alt="Not started"> | Decide the graph for each index | |

---

## Index designs

### Flip-Flop Index 🩴
**Measures:** reversals over time in what they actually did.

- **Record switches (100%, required):** of the issues where they have recorded actions at least 2 years apart, the share where later actions took the opposite side from earlier ones. Recorded actions are votes, bills and official acts. For a president, that means signings, vetoes and executive orders.
- **Changed-position checks:** shown beside the index, not counted in it. They already count at half credit in the promise score.

**Minimum:** 5 issues with 2 or more actions each.

**Example:** 10 issues with actions at least 2 years apart, and on 3 of them later actions took the other side. That gives 3 ÷ 10 = **30**.

**Keys and sources:**
- **Recorded actions and how they're coded by issue:** the reviewed research. No key.
- **Newer votes:** Senate and House roll calls (no key), and `CONGRESS_API_KEY` for bills and House votes from 2023 on.
- **State legislators:** `OPENSTATES_API_KEY` and `LEGISCAN_API_KEY`.
- **A president's executive orders:** the Federal Register. No key.

### Pants on Fire Index 🔥
**Measures:** the average falseness of their fact-checked claims from the last 6 years.

- **Scoring each rating:** True 0, Mostly True 20, Half True 50, Mostly False 80, False 100, Pants on Fire 100.

**Minimum:** 10 ratings.

**Example:** 10 ratings: 2 Mostly True, 3 Half True, 3 Mostly False and 2 False. That gives (2×20 + 3×50 + 3×80 + 2×100) ÷ 10 = **63**.

**Keys and sources:** 
- `GOOGLE_API_KEY`, through Google's Fact Check Tools. It covers PolitiFact, FactCheck.org and other fact-checkers.

### ↓↓↓

### New Promises Delivered grade formula 📦
**Promises Delivered** = Promise score − Flip-Flop deduction − Pants on Fire deduction. It never goes below 0.

- **Promise score:** today's score, unchanged: (kept + ½ × partly kept or changed) ÷ counted checks. For a president, it's PolitiFact's promise trackers instead.
- **Flip-Flop deduction:** Flip-Flop Index × 0.10. At most 10 points.
- **Pants on Fire deduction:** (Pants on Fire Index − 50) × 0.20, only when the index is above 50. At most 10 points. Fact-checkers mostly pick claims that already sound doubtful, so only a mostly-false record costs points.
- The grade still needs today's minimum of 3 counted checks. The indexes adjust a grade but can't create one.
- An index showing "Not enough data" deducts nothing.
- Together the two indexes can take off at most 20 points, the same as trading on the Ethics grade.

**Example:** promise score 80, Flip-Flop Index 30 and Pants on Fire Index 63 give 80 − (30 × 0.10) − ((63 − 50) × 0.20) = 80 − 3 − 2.6 = **74.4, rounded to 74 (C)**.

**Option:** to keep Pants on Fire out of the grade, delete its deduction line and add "The Pants on Fire 🔥 index sits beside the grade, not inside it." The formula then becomes Promise score − Flip-Flop deduction.

### Money pledges (step 7 of 9) 🤝
**Checks:** whether a public pledge about money in politics matches the record. It is an ordinary promise check, so a kept pledge counts 1, a partly kept one ½, and a broken one 0. No separate bonus.

- **Refusing corporate PAC money:** kept when no PAC the FEC records as corporate (its sponsor is a corporation) gave to the campaign in the period after the pledge, or each such check was refunded. Trade-association, membership, cooperative and leadership PACs are listed beside it, but whether they count is still to decide.
- **Banning members' stock trading:** kept when they sponsored, cosponsored or voted for one of the stock-trading bans on the Bills page. A vote against one is reviewed with the reason they gave, not marked contradicted automatically: Senate Democrats called the Stop Insider Trading Act "toothless" for exempting the executive branch, and its final version added a voter-ID section.
- **Refusing single-issue or ideological PAC money:** kept when no PAC with that purpose gave after the pledge, including bundled gifts through a group's PAC.
- **Reviewed before it counts:** the records only suggest a change; the check's verdict changes after review, like every other check.

**Keys and sources:**
- **PAC types:** `FEC_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">, from `npm run pacs:types`.
- **Bundled gifts:** `FEC_API_KEY`, from `npm run funders:bundled`.
- **Sponsors and cosponsors:** `CONGRESS_API_KEY` <img src="../assets/checkbox-checked.svg" width="20" align="absmiddle" alt="Done">, from `npm run bills:cosponsors`.
- **Votes:** Senate and House roll calls. No key.
