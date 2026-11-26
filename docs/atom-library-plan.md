# Stage 1: the atom library

Every term is **one atom**: defined once, usable in any number of topics, linked to related atoms. Everything later (skills, roles, mastery, goals, competitions) is built from these.

## Where we start

Measured on 26 November 2026 from the card files and a copy of the local database. The live database may differ.

| | Count |
|---|---|
| Distinct concepts in the 115 card files (names ignoring "a", "an", "the") | 11,147 |
| Already terms (in the 12 term banks) | 1,195 |
| Not yet terms: look like terms | 6,926 |
| Not yet terms: only in company files | 2,467 |
| Not yet terms: code or identifiers (`DATABASE_URL`, `/admin/freshness`) | 304 |
| Not yet terms: phrases longer than four words | 255 |
| Names used in two or more files | 1,739 |
| of which the first definition differs between files | 1,697 |
| Generated questions that can be traced back to a concept (used in stage 2) | 219,891 of 300,712 |

"Look like terms" is a rule of thumb on the name alone, **not** a quality judgement. Some will be rejected in review.

So the 10,000-atom foundation does not mostly need writing. It needs **sorting, merging and checking**.

## What stage 1 delivers

1. One library in which each public term exists once.
2. A term can sit in many topics.
3. Typed links between terms.
4. A review step: learners only see checked atoms (the 1,201 already live stay visible, marked as not yet reviewed).
5. Company terms kept private to their company.
6. Nothing learners have done is lost.

**Not in stage 1:** linking questions to terms, skills built from atoms, one mastery record across all exams, roles and goals computed from it. Those are stages 2 to 5.

## Rules for an atom

| Rule | Detail |
|---|---|
| Identity | A name plus, only when needed, a **sense**: "agent (AI)" and "agent (estate)" are two atoms. |
| Other names | Aliases point to the one atom: "KPI" and "key performance indicator". |
| Content | Meaning, rank (1 to 5), facts, when to use it, common mistakes. Meaning and rank are required to publish. |
| Size | One idea. A procedure ("how to raise a purchase order") is not an atom; it is a molecule, handled later. |
| Owner | Public, a company's own, or a person's own. |
| State | Draft, reviewed, or rejected. |

## Data changes

All additive, so the deploy's schema push applies them without deleting anything. The `terms` table stays the atom table, so every existing id, study record and exam answer keeps pointing at the same term.

| Change | Purpose |
|---|---|
| `terms`: add `slug`, `sense`, `company_id`, `review`, `reviewed_at`, `source` | identity, privacy, review |
| New `term_places` (term, topic set, group heading, order) | many topics per term; filled from today's `bank_id` and `group_name` |
| New `term_aliases` (term, alias) | other names |
| New `term_links` (from, to, kind) | "confused with", "part of", "kind of", "needs"; "confused with" is filled from today's list |

The old `bank_id`, `group_name` and `similar` columns stay until the new tables have run live, then go in a later change.

Watch out: a new column that must not be empty needs a text default. `drizzle-kit` treats a numeric default of 0 as no default and fails the deploy (this has happened here).

## Steps

Each step is one pull request that can be deployed and checked on its own.

### 1a. New structure, no visible change
- Add the tables and columns, and a script that fills them from today's data (safe to run twice).
- Role lists, study, exams and the admin read topics through `term_places`.
- **Done when:** every term has a place; role list sizes are unchanged (for example CTO 701, Casework Officer level one 141); all term checks pass; study history and results are identical before and after on a copy of the database.
- **Built.** After the deploy, run `npm run backfill:atoms` on the server. The app behaves the same before and after it is run (a term with no recorded place is where its own columns say). `npm run import:terms` runs it too.
- Found by the fill-in: 6 words are used by two terms each (cross-site scripting, least privilege, policy, scope, segregation of duties, SQL injection), to be merged or told apart in review.

### 1b. Ready for ten thousand
- The Terms page, picker and role pages currently load every term at once. Load by topic and on search instead.
- **Done when:** with 10,000 test terms, those pages are about as heavy and quick as today.

This comes before any bulk loading.

### 1c. Candidate report (no database change)
- A script reads all card files and writes one candidate list: the proposed atom, its sources, its kind (term-like, phrase, code, company) and any name clash.
- Clashes are grouped: near-identical definitions are proposed as one atom; clearly different ones as separate senses.
- **Done when:** you have read a sample from each kind and agreed the rules.

### 1d. Review screen
- For a super admin, one topic at a time: approve, edit, merge, split into senses, reject.
- Drafts are invisible to learners and left out of role lists and exams.
- **Done when:** a topic of ten can be reviewed in a few minutes, and a merge keeps both terms' study history.

### 1e. Load and publish in batches
- Load drafts one subject area at a time, starting with general office work, then software.
- Company-only candidates load into their company's private layer.
- A topic appears to learners when it is reviewed.
- **Done when:** each batch's published atoms have no duplicate names without a sense.

## Review effort

At roughly one minute a term, 6,926 candidates is about 115 hours of reading. This is an estimate, not a measurement. Options: review only what a role actually needs first; have AI draft merges and flag doubtful ones for a person; bring in subject experts per area.

## Risks

| Risk | Guard |
|---|---|
| Two meanings merged into one | Merge needs a person when definitions differ; a split is possible afterwards |
| Learners flooded with unchecked terms | Drafts are hidden; role lists change only when a topic is published |
| Study history lost in a merge | Records move to the surviving atom; tested on a database copy first |
| Company details becoming public | Anything found only in company files loads as private; a public atom is checked for company names before publishing |
| A deploy failing on the schema | Additive changes only, rehearsed against a copy of the live database |

## Decisions needed

| Decision | Suggested |
|---|---|
| Who reviews atoms | You for general terms; a subject expert per specialist area |
| Company-only concepts | Load as private company terms |
| First area to publish | General office work |
| Can a topic give a term a different rank | No: one rank per atom for now |
