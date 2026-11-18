# 3. Shows Up

**Purpose:** whether they cast their votes and move the bills they sponsor.

**What it uses:** Voteview roll-call records from 2018 on, and Congress.gov's record of how far each sponsored bill got.

**What the tab shows:** missed votes by year, any excused absences with their sources, and how many of their bills advanced compared with their party's typical member.

**How it's calculated:**

```text
Shows Up = 0.75 × Attendance + 0.25 × Get It Done      (Attendance alone if Get It Done is missing)
Attendance  = 100% − 5 × (% of votes missed)            e.g., missing 2% scores 90.0%
Get It Done = 100% × min(1, their share of bills advanced ÷ their party's typical share in their chamber)
```

- **Advanced** means reported by a committee or got further: put on a calendar, passed a chamber, or became law.
- **Excused absences** are removed, such as a documented medical or family leave.
- **Minimums:** 50 roll-call votes for Attendance, 10 sponsored bills for Get It Done.
- **Attendance only (since Nov. 18, 2026):** a grade without Get It Done is marked "attendance only" on the tab, the home card and the Scores page, and the Rankings page ranks those apart from grades with both parts (a "Graded on" menu picks which). A perfect attender with no Get It Done would otherwise outrank someone held to both.
- **Not graded:** delegates (D.C., Guam, the Virgin Islands, American Samoa, the Northern Mariana Islands) and Puerto Rico's Resident Commissioner, who can't vote on most House roll calls, such as final passage.

## THINGS STILL NOT ADDED, UPDATED, OR CALCULATED YET

- **Excused absences:** none has been reviewed yet for anyone, so every missed vote counts.
- **Get It Done for everyone:** 72 people have it. Everyone else is graded on Attendance alone, and ranked apart. The Nov. 8 run read only about 70 members before Congress.gov stopped answering, so the party medians rest on 11 senators per party and 24 House members per party. Since Nov. 18 the build reads one request a second, waits and tries again when Congress.gov is busy, saves its progress (`.local/get-it-done-cache.json`), and writes nothing until every member is read. Run `npm run getitdone:build` on the Mac (about 30–45 minutes; run it again if it stops, and it picks up where it left off), then commit `public/get-it-done.json`.
- **Older votes:** roll calls are read from 2018 on. Earlier years can be added with `npm run attendance:build -- --from 2016`.
- **Committee hearing attendance** isn't counted: there's no complete public record of it.
