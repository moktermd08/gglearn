# Content waiting for review

Everything in this folder is a **draft**. Nothing here is in the question bank, and nothing here can reach a learner or an exam
until a person has checked it and an admin has activated it.

## What is here

`business-stops/` holds draft teaching passages and questions for stops of the business map that the question bank barely covers
(see `npm run report:coverage`): 60 stops, one passage each, four multiple-choice questions at levels 1, 3, 5 and 8 (240 questions). Four thin stops are deliberately left out because their names are too generic to write about without more context (Email & Web Address, Data Skills, Better Governance, Sustainability & Responsibility). They were written
by an AI assistant from general UK small-business knowledge, **not from cited documents**. Treat every fact as unverified.

Each file is shaped for `npm run import:knowledge`: `{ trackSlug, status: "review", items: [{ title, stop, body, questions }] }`.
`stop` (which stop of the business map the item is for) and `draftNote` are extra keys the importer ignores.

## Review packs

`packs/` holds readable handouts generated from these files, one per kind of reviewer (accountant, HR or employment adviser, solicitor, compliance and safety adviser, sales and marketing practitioner, and operations and strategy practitioner), so nobody has to read JSON. Give each reviewer the pack for their field; `handoff/` has a ready-to-send cover note for each and a tracker. `npm run review:packs` regenerates them, and `npm run check:review` fails if they are out of date. See `packs/README.md`.

## How to review

1. Read each passage as someone who does this work (an accountant for bookkeeping and tax, an HR adviser for the people items, a
   solicitor for the legal ones). Fix or delete anything wrong, out of date or not true outside the UK. Rules and thresholds change.
2. Check each question has one clearly right answer that the passage supports, and that the wrong answers are plausible, not jokes.
   (The level 1 distractors are deliberately easy; make them better if you like.)
3. Replace the `source` text of an item with the real source you checked it against (a GOV.UK page, a regulator's guidance).
4. Run `npm run check:review`. It checks structure only (not accuracy): every file is `status: "review"`, tracks and stops exist, four
   distinct options a to d, the answer is one of them, no duplicates with the live bank, answers spread across a to d.

## How to publish a reviewed file

```bash
npm run import:knowledge -- content/review/business-stops/people-operations.json
```

Because the file says `"status": "review"`, the questions are saved **unpublished**. An admin activates them in the question bank
(`/admin/bank`) once happy. Only then do they enter exams, so run this against a copy of the data first if you want to try it.
Then move the file out of `content/review/`, and re-run `npm run report:coverage -- --write` so the stop cards show the new coverage.

## How far this gets

A stop is "thin" below 15 matching questions. Four drafted questions per stop is a start, not a fix: about eleven more per stop are
needed to leave "thin". `npm run report:coverage` shows what is drafted per stop.
