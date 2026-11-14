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
- **Not graded:** delegates (D.C., Guam, the Virgin Islands, American Samoa, the Northern Mariana Islands) and Puerto Rico's Resident Commissioner, who can't vote on most House roll calls, such as final passage.
