# Review packs

Readable handouts for checking the drafted learning content in `business-stops/`, one per kind of reviewer, so nobody has to read JSON. **Generated** by `npm run review:packs`; do not edit these files by hand, edit the JSON and run it again.

| Pack | Items | Questions |
|---|---|---|
| [Accountant or bookkeeper](1-accountant-or-bookkeeper.md) | 8 | 32 |
| [HR or employment adviser](2-hr-or-employment-adviser.md) | 11 | 44 |
| [Solicitor or legal adviser](3-solicitor.md) | 8 | 32 |
| [Compliance, safety or trade adviser](4-compliance-safety-or-trade-adviser.md) | 5 | 20 |
| [Business practitioner (sales, marketing, operations, strategy)](5-business-practitioner.md) | 28 | 112 |

**Total:** 60 items, 240 questions. Every item is in exactly one pack.

## What happens with the feedback

1. Reviewers tick, mark up or comment on the pack for their field (print it, edit the Markdown, or send notes).
2. Someone applies the corrections to the matching JSON file in `business-stops/`, replaces each item's `source` with the real source the reviewer named, and runs `npm run check:review` and `npm run review:packs`.
3. Once an item is approved, import its file (`npm run import:knowledge -- content/review/business-stops/<track>.json`). Because files say `"status": "review"`, the questions are saved **unpublished** until an admin activates them in the question bank. Run it against a copy of the data first if you want to try it.
4. Move approved files out of `content/review/`, then `npm run report:coverage -- --write` so the stop cards show the new coverage.

Nothing in this folder is live, and nothing here is advice: these are teaching drafts, not professional guidance.
