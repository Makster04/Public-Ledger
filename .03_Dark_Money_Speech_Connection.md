# Connecting Dark Money to Politicians' Speeches in Public Ledger

The strongest way to improve Public Ledger would be to connect **political funding → interest groups → documented policy positions → politicians' speeches and public statements**, with dark-money funding clearly distinguished from publicly disclosed contributions.

After reviewing your repository, you already have much of the infrastructure needed. The major opportunity is to connect financial relationships with specific statements, policy positions, and changes in political rhetoric over time.

## 1. Build a Money-to-Speech Tracker

Instead of simply showing how much financial support a politician received, Public Ledger could let visitors investigate **which organizations supported their election, what policy positions those organizations advocated, and whether the politician's public statements aligned with those positions**.

**Original funding source**

Disclosed, partially disclosed, or unknown

↓

**Nonprofit / political organization**

Identifiable intermediary, policy interests, and public advocacy

↓

**PAC / Super PAC / independent election spending**

Documented candidate support or opposition

↓

**Politician**

Candidate who benefited from or was opposed by spending

↓

**Speeches and public statements**

Congressional speeches, debates, interviews, rallies, press releases, and public posts

↓

**Policy Position Analysis**

Topics discussed, positions expressed, changes over time, and agreement with organizations' documented positions

*Conceptual relationship map. Each relationship requires independent evidence. A financial connection and a matching public statement do not prove that an organization influenced the politician's speech.*

This would answer more useful questions than simply "Who funded this politician?"

For example:

- Which organizations independently spent money supporting this politician?
- What policy positions did those organizations publicly advocate?
- Has the politician spoken publicly about those same issues?
- Did their statements agree or disagree with the organizations' documented positions?
- Did the politician's rhetoric change before or after significant financial activity?
- Did the politician begin discussing certain issues more frequently?
- How did their public statements compare with other members of their party?
- Did their speeches match their subsequent legislative actions?

**The critical distinction:** Independent election spending is not a contribution to a candidate's campaign. A politician sharing an organization's policy position does not demonstrate coordination, and an unidentified original donor must not be treated as a known source of influence.

## 2. What Public Ledger already does, and what's missing

I examined your existing [Money & Influence Analysis](https://github.com/Makster04/Public-Ledger/blob/main/public/influence.js), [statement-export script](https://github.com/Makster04/Public-Ledger/blob/main/scripts/export-statements.mjs), and [statement-analysis pipeline](https://github.com/Makster04/Public-Ledger/blob/main/docs/STATEMENT_ACTION_PIPELINE.md).

| Existing functionality | What I would improve |
|---|---|
| Congressional Record Speeches | Analyze speech content to identify policy issues, explicit positions, and changes over time |
| Speech Donor Alignment (planned) | Implement organization-to-speech matching using documented policy positions and verified financial relationships |
| Statement and Issue Tagging | Extend existing classification to connect speeches with specific organizational interests |
| Promises vs. Actions | Compare statements associated with documented funding relationships against subsequent legislative actions |
| Donation Timing Flags | Incorporate speech dates, changes in policy positions, and independent spending activity |
| Lobbying Reports | Match organizations' publicly documented policy interests with politicians' statements on corresponding issues |
| Super PAC Tracking | Connect independent election spending with politicians' public statements while preserving the distinction between outside support and campaign contributions |
| ProPublica Nonprofit Explorer | Investigate nonprofit financial relationships and connect their documented advocacy positions with political statements |

The key missing component is a **unified, documented relationship between a political organization's funding activities, its policy objectives, and an elected official's public statements**.

Your repository already identifies *Speech Donor Alignment* as planned, rather than an operational measurement. Congressional speeches are collected, but they still need reliable issue and position classification before the proposed analysis can be completed.

## 3. Five additions I would prioritize

### A. Funding Source Transparency

Track money across nonprofits, PACs, Super PACs, and other reporting entities using FEC committee IDs and nonprofit EINs.

Identify publicly documented financial relationships and the last verifiable funding source.

Distinguish funding provided directly to political campaigns from independent election spending. Where original donors are not publicly identifiable, mark them as unknown.

This would establish which organizations have documented financial relationships to a politician's election before comparing those organizations' interests with the politician's statements.

### B. Speech and Policy Interest Matching

Record which political issues and specific policy positions an organization publicly supports or opposes.

Then analyze politicians' speeches to identify statements addressing those same policies.

Use:

- Official Congressional Record transcripts.
- Congressional hearing statements.
- Verified campaign speeches.
- Debates and interviews.
- Press releases and official statements.
- Publicly available posts.
- Lobbying disclosures and organizational policy statements.

For example, if an organization publicly opposes a particular healthcare regulation, Public Ledger could identify speeches in which a politician explicitly supports or opposes that regulation.

The analysis should distinguish between **mentioning an issue, expressing an opinion, and advocating a specific legislative position**.

A politician discussing pharmaceutical prices does not necessarily mean they support the pharmaceutical industry's position.

### C. Funding and Speech Timeline

Place verified financial activity alongside the politician's public statements on a chronological timeline.

This could include:

- Campaign contributions.
- Nonprofit transfers.
- Independent expenditures.
- Public policy statements from organizations.
- Politicians' speeches and interviews.
- Changes in a politician's expressed position.
- Legislative announcements.
- Sponsorships and congressional votes.

For example, visitors could investigate whether a politician began discussing a particular policy more frequently after receiving publicly disclosed financial support or benefiting from independent spending.

The system should also identify whether similar statements existed before the financial activity.

**A change in rhetoric following a financial event is a timing relationship, not proof that the funding caused the change.**

### D. Speech Alignment Analysis

Compare politicians' statements with organizations' documented positions on the same policy questions.

Show historical statements, party patterns, disagreements, and changes over time.

Potential measurements include:

- Percentage of clearly classified statements agreeing with an organization's documented positions.
- Percentage disagreeing.
- Number of relevant statements.
- Changes in speech frequency by issue.
- Changes in expressed positions over time.
- Comparison with other politicians discussing the same issue.

Importantly, the analysis should recognize when a politician has not taken a clear position.

Where a statement is ambiguous, display **Position unclear**.

Where an organization has no documented position, display **No documented position**.

Statements should not be classified as supportive or opposing solely because they mention an organization's preferred issue.

### E. Evidence and Speech Verification

Every connection should link to the original financial records, policy statements, and politicians' speeches.

Distinguish:

- Verified financial transactions.
- Documented organizational policy positions.
- Direct quotations from a politician.
- Contextually verified speech-position matches.
- Changes in stated positions.
- Timing correlations requiring further review.

Speech analysis should preserve the speaker's meaning, including negation, qualifications, sarcasm, and quotations of other people's positions.

For instance, a politician saying "Some people support eliminating Medicare, but I disagree" must not be classified as supporting the elimination of Medicare.

**AI and natural language processing can help identify relevant statements, but ambiguous or consequential interpretations should be reviewed against the original transcript.**

## 4. Example of what visitors could see

### Money & Speeches

*Illustrative example*

**Hypothetical Organization X • Hypothetical Healthcare Policy**

**Reported nonprofit → Super PAC transfer**

$5M

**Independent spending supporting candidate**

$2M

**Original donor identity**

Not publicly disclosed

**Organization's policy position**

Publicly opposes a proposed federal prescription-drug pricing regulation, documented in an official policy statement.

**Politician's speech**

In a congressional speech, the politician explicitly argues against the same proposed regulation.

**Documented agreement**

The politician's stated position matches Organization X's publicly documented position.

**Speech history**

Earlier speeches are examined to determine whether the politician expressed the same position before the organization supported their election.

**Related legislative action**

The politician subsequently votes against the proposed regulation.

### Interpretation

The records establish a funding connection between the nonprofit and Super PAC, independent electoral support for the candidate, and agreement between the organization's documented policy position and the politician's speech.

The politician's subsequent vote also agrees with that position.

These findings do not establish that the unidentified donor requested or influenced the politician's statements or legislative decisions.

This would make the relationship between financial support, political rhetoric, and legislative behavior easier to understand while keeping documented facts separate from suggested influence.

## 5. How I would implement this in your GitHub project

You wouldn't need to rebuild Public Ledger from scratch.

Your repository already includes:

- `public/influence.js`
- `scripts/export-statements.mjs`
- `scripts/question-statements.mjs`
- `scripts/find-promises.mjs`
- `src/feeds.mjs`
- `src/refresh.mjs`
- `public/research.json`
- Congressional Record speech collection.
- Public statement and promise analysis.
- FEC campaign finance information.
- Lobbying and congressional legislative data.

I'd extend that infrastructure with four related datasets:

| New dataset | Information to store |
|---|---|
| `funding_links` | Source organization, receiving organization, amount, date, record URL, donor disclosure status |
| `group_policy_positions` | Organization ID, issue, specific policy position, support/opposition, position date, evidence URL |
| `politician_speech_positions` | Politician ID, speech ID, date, source, issue, quotation, expressed position, classification confidence |
| `money_speech_connections` | Linked organization, politician, policy issue, funding pathway, matching or opposing statements, supporting records |

Each political organization should have stable identifiers and verified aliases to prevent accidentally linking unrelated groups.

Each speech should have a unique identifier, an original transcript or recording URL, an event date, and a verified speaker identity.

Importantly, `money_speech_connections` should be a **derived dataset** generated from the other three rather than an independent source of claims.

### How the analysis would work

1. **Identify financial relationships.** Collect publicly reported contributions, nonprofit transfers, and independent expenditures. Trace funding only as far as reliable records allow.

2. **Identify organizational policy positions.** Match each political organization to issues and policies it explicitly supports or opposes using lobbying disclosures, published statements, and other reliable sources.

3. **Collect politicians' speeches.** Retrieve Congressional Record transcripts, public speeches, interviews, debates, press releases, and other verifiable statements.

4. **Classify speech content.** Use natural language processing to identify policy topics, extract relevant passages, and determine whether a politician explicitly supports, opposes, or remains neutral or unclear on a particular policy.

5. **Connect the records.** Match the same politician, organization, policy issue, and relevant dates to identify documented agreement or disagreement.

6. **Evaluate the evidence.** Distinguish direct speech-position matches from broad topical similarities, timing correlations, or relationships requiring further investigation.

7. **Display the findings.** Present the financial pathway, relevant speech excerpts, policy positions, timeline, and original sources together.

One additional improvement: record *when an organization publicly expressed its policy position and when a politician first expressed a similar position*.

A statement made before the organization supported the politician may indicate a preexisting policy agreement rather than a change associated with financial activity.

## 6. The feature I would introduce: Money & Speech Influence

I would make this a dedicated section under a politician's existing **Money & Influence Analysis** tab, rather than creating an entirely separate scoring system.

It could contain three connected views.

### Funding & Speech Network

An interactive diagram showing disclosed donors, nonprofits, Super PACs, lobbying organizations, and their documented financial relationships with political campaigns or independent spending.

The diagram would also connect organizations' documented policy positions with politicians' relevant speeches.

Users could select an organization to see which policy positions it advocates and which public statements by a politician agree or disagree with those positions.

Unidentified original donors would remain marked as unknown.

### Speech Connections

A searchable table containing politicians' statements, organizations' documented policy positions, financial relationships, and supporting evidence.

| Speech | Organization | Documented Position | Politician's Statement | Relationship |
|---|---|---|---|---|
| Healthcare speech | Organization X | Opposes regulation | Explicitly opposes regulation | Agreement |
| Energy policy speech | Organization Y | Supports bill | Explicitly opposes bill | Disagreement |
| Taxation speech | Organization Z | No documented position | Supports tax proposal | Unknown |

*All entries are hypothetical.*

Visitors could filter by healthcare, housing, taxation, defense, energy, technology, immigration, and other policy categories.

They could also filter by speech date, source, organization, funding disclosure status, and type of agreement.

Every displayed statement should link to its full transcript or original recording.

### Money & Speech Timeline

A chronological visualization showing financial activity, organizational statements, and politicians' speeches.

For example:

**January:** Organization X publicly opposes a healthcare regulation.

↓

**February:** A Super PAC receives a reported contribution from a nonprofit.

↓

**March:** The Super PAC independently spends money supporting a politician's election.

↓

**April:** The politician publicly argues against the same healthcare regulation.

↓

**May:** The politician votes against legislation containing that regulation.

This would allow users to examine whether funding relationships and political rhetoric changed around the same period.

The timeline should also include older speeches to establish whether the politician previously held the same position.

## 7. An important statistical improvement: compare politicians' speeches against a baseline

This is where Public Ledger could become particularly useful for political research.

Suppose a politician's clearly classified policy statements agree with a financial supporter's documented positions **85% of the time**.

That percentage alone doesn't tell us much.

If **90% of comparable statements by politicians in the same party express the same positions**, the observed agreement might primarily reflect shared ideology rather than anything distinctive about the politician's financial relationships.

But if **only 40% of comparable statements from the same party express those positions**, the difference could warrant closer examination.

The comparison should use the same policy questions and a comparable period, rather than comparing unrelated speeches.

You already have a related approach in the repository's **Donor Loyalty** calculations. I would expand that logic to public statements while keeping speech analysis descriptive rather than treating it as proof of financial influence.

### Additional Statistical Analyses

**Speech Frequency Analysis**

Measure how frequently a politician discusses a particular policy before and after significant financial events.

**Position Change Analysis**

Identify whether a politician's expressed position changes over time, using statements made before and after relevant financial activity.

**Text Similarity Analysis**

Use natural language processing to compare the language used in politicians' speeches with publicly available statements from organizations that supported their elections.

Similar wording should be treated as a research lead, not proof of shared authorship or coordination.

**Party and Ideology Comparisons**

Compare politicians with similar party affiliations, ideological positions, committee memberships, and legislative responsibilities.

**Longitudinal Analysis**

Examine how funding relationships, public statements, and legislative activity evolve across multiple election cycles.

For more rigorous analysis, Public Ledger could eventually use statistical models to investigate whether financial support is associated with changes in speech frequency or expressed policy positions after accounting for factors such as party affiliation, legislative events, and historical positions.

One important concern is that a politician may speak more frequently about an issue simply because it has become more prominent nationally.

**Even a statistically significant association would not, by itself, establish that funding caused a politician to change their rhetoric or policy positions.**

## 8. Suggested development priorities

| Priority | Improvement | Why |
|---|---|---|
| 1 | Organization-to-policy matching | Establishes documented connections between political organizations and their policy objectives |
| 2 | Speech content classification | Identifies specific policy positions expressed in speeches, rather than simple keyword mentions |
| 3 | Funding-to-speech matching | Connects documented financial relationships with relevant political statements |
| 4 | Funding transparency labels | Identifies which financial relationships are disclosed and which remain unknown |
| 5 | Unified Money & Speech Timeline | Makes changes in funding and political rhetoric understandable over time |
| 6 | Interactive Speech Network | Helps visitors explore complicated relationships between organizations, policy positions, and politicians |
| 7 | Statistical relationship analysis | Provides comparisons accounting for party ideology, legislative context, and historical positions |

I would implement these incrementally, using the existing FEC, GovInfo, Congressional Record, lobbying-disclosure, and public statement infrastructure before adding additional APIs.

The first practical step would be implementing the already-planned **Speech Donor Alignment** feature using a small set of organizations with clearly documented policy positions and speeches that have been manually verified.

## 9. What Public Ledger would ultimately help answer

The platform would go beyond reporting how much money was involved in a politician's election or simply collecting their public statements.

It could help the public investigate:

- Who financially supported a politician's election, directly or independently?
- Which original funding sources can be identified, and which remain undisclosed?
- What policy positions did those organizations publicly advocate?
- Has the politician publicly addressed those same issues?
- How closely did their statements align with organizations' documented positions?
- Did the politician express those positions before or after relevant financial activity?
- Did their speech frequency or rhetoric change around significant financial events?
- Were those positions consistent with their earlier statements?
- How did their statements compare with other politicians in the same party?
- Did their speeches align with their subsequent legislative actions?

### The larger vision

**Public Ledger could become a public research platform connecting political money to politicians' public rhetoric, from documented financial transactions to speeches, policy positions, and legislative actions.**

The most valuable distinction would be separating three questions:

**Who funded the political activity? What policy positions did the organization advocate? What did the politician actually say?**

A fourth question could then connect this analysis to the existing Money-to-Legislation Tracker:

**Did the politician's legislative actions match what they said publicly?**

Where the evidence supports a relationship, Public Ledger would show it. Where evidence is incomplete, it would explain what remains unknown.

That approach would allow Public Ledger to investigate dark-money networks and their relationships to politicians' speeches without overstating what public records can prove.
