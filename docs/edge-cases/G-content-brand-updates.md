# G. Keeping everyone current: brand updates and content freshness (G-001 to G-100)

*Moksy AI changes brand details, moto, tone. Today there is no mechanism to find out who is up to date. This is the main design gap.*

## What exists
- `knowledge_items(trackId, title, body, version, updatedAt)`; `questions.knowledgeItemId`, `questions.version`.
- Nothing reads `version`/`updatedAt` outside the import script.

## Detecting change
- G-001 ⚠️ Admins can now edit an item at `/admin/freshness`; managers cannot, and creating new items is still script-only.
- G-002 ✅ Re-importing a knowledge file with a changed body updates the item and bumps `version`; existing questions are left alone (`scripts/import-knowledge.ts`).
- G-003 ✅ Every change (UI or import) bumps `version` and records before/after.
- G-004 ⚠️ Learners and admins see before/after text; no highlighted line diff.
- G-005 ✅ Each change is marked material (people must read) or a wording fix.
- G-006 ⚠️ Learners are told in-app (dashboard banner, `/updates`); no email or chat yet.
- G-007 ✅ Dashboard banner lists unread updates.
- G-008 ⚠️ Admin changelog at `/admin/freshness` (latest 30); no per-track learner-facing changelog.
- G-009 ✅ "I have read this" confirmation is stored per person.
- G-010 ✅ Reads are compared to the change by enrolment time and acknowledgement.

## Linked questions
- G-011 ⚠️ Not flagged automatically by design; the admin page shows how many active questions link to a changed item and links to review.
- G-012 ⚠️ Old moto question stays `active`; learners get marked wrong for giving the *new* moto.
- G-013 ⚠️ Old moto question may stay "correct" for a stale answer.
- G-014 ❌ Identify all questions that cite the changed fact. Only direct item→question links, not text search.
- G-015 ❌ Dynamic questions can't use company facts (they are computable-only), so brand facts rely on stored questions.
- G-016 ❌ Auto-regenerate questions for a changed item. `generate:bank` works per track, not per item.
- G-017 ❌ Retire-and-replace preserving history. `retireQuestion` flips status only.
- G-018 ❌ Batch-update 40 Moksy questions after a rebrand. Manual.
- G-019 ✅ New questions can be generated as `review` and approved at `/admin/review/<slug>`.
- G-020 ❌ Approve only the questions touching the change. Approve-all per track.

## Measuring "am I up to date?"
- G-021 ⚠️ Not shown; freshness is driven by read-confirmation, not last pass date.
- G-022 ❌ Compare to `knowledge_items.updatedAt`. Not done.
- G-023 ⚠️ Per change, % read (`/admin/freshness`); no single per-person brand score yet.
- G-024 ❌ Company-level currency score. None.
- G-025 ⚠️ Managers see it per change and on compliance rows; no brand filter.
- G-026 ❌ Refresh quiz containing only changed items. None.
- G-027 ✅ Read-by deadline is 7 days after a material change (`REVIEW_DAYS`).
- G-028 ✅ Read-and-confirm is the refresh; no quiz yet.
- G-029 ❌ Require the social media manager to be current before posting. Soft gate only, and no gate for posting exists anyway.
- G-030 ✅ Dashboard banner shows how many updates are unread.

## What the Moksy example would need
- G-031 ❌ Track *Moksy brand & voice* with knowledge items: moto, tagline, tone, do/don't, colours, claims, legal wording.
- G-032 ❌ Version label ("Brand v4, 3 Oct 2026"). `version` int exists.
- G-033 ❌ Effective-from date ("applies from Monday"). None.
- G-034 ❌ Who approved the brand change. None.
- G-035 ❌ Evidence that old assets were replaced (checklist). None.
- G-036 ❌ Different audiences (staff vs customers) see different parts. Audience is per track not per item.
- G-037 ❌ Public-facing facts vs internal-only facts in one track. Track-level.
- G-038 ❌ Stale content on the website vs gglearn. No sync.
- G-039 ❌ Brand guideline PDF attached to the item. Text only.
- G-040 ❌ Image-based brand rules (logo clear space) tested visually. No image questions.

## Content authoring pipeline
- G-041 ✅ Knowledge JSON files are imported (`import:knowledge`).
- G-042 ✅ Customer content is authored in `scripts/build-customer-content.mjs` and written to `content/customer/*.json`.
- G-043 ⚠️ Authoring lives in code and scripts; non-developers can't contribute.
- G-044 ❌ Admin UI to edit knowledge items. None.
- G-045 ❌ SMEs submit facts through a form. None.
- G-046 ❌ Draft/published states for knowledge items. None.
- G-047 ❌ Scheduled publish. None.
- G-048 ❌ Content owner per item with review-every-90-days reminders. None.
- G-049 ❌ Expired content flagged ("not reviewed in 12 months"). None.
- G-050 ❌ Legal review gate on compliance content. None.
- G-051 ✅ `generate:bank` needs `ANTHROPIC_API_KEY` and stops at the first rejected key.
- G-052 ⚠️ Generated questions are only as good as the knowledge item. Missing facts (README: "Working with GGLink needs real process facts") block authoring.
- G-053 ❌ Track a "facts needed" backlog. In README only.
- G-054 ❌ Collect facts from Slack/docs automatically. None.
- G-055 ❌ Link to the source of truth (Notion/Drive). None.
- G-056 ❌ Third-party content (Claude/ChatGPT features change monthly) auto-refreshed. Manual.
- G-057 ❌ Detect that a Claude/ChatGPT question is outdated by model release. None.
- G-058 ❌ Tag questions with the product version they teach. None.
- G-059 ❌ Subscription to vendor release notes feeding a review queue. None.
- G-060 ❌ Deprecate a tool track (company drops ChatGPT). Hide via code (`SUPERSEDED`), not UI.

## Claude vs ChatGPT specifics
- G-061 ✅ Titan tracks exist for Claude API (2,400 q), OpenAI Platform (2,400 q), ChatGPT (330 q), Claude Code agent (2,400 q).
- G-062 ❌ Claude.ai (the chat app) as opposed to the API. `api-claude-titan` is the API; end-user usage tracks are absent.
- G-063 ❌ Company policy on which AI tool is approved. Governance track is generic.
- G-064 ❌ Learner chooses one and the company wants the other. Not enforceable.
- G-065 ❌ Cost comparison for the company. None.
- G-066 ❌ Data-privacy rules per tool (what may be pasted). Governance track generic.
- G-067 ⚠️ `foundations-chatgpt` is hidden once `chatgpt-titan` exists; a person enrolled in the old one keeps access via direct links.
- G-068 ❌ Tell the person that their old track was superseded. None.
- G-069 ❌ Migrate progress from old track to new. None.
- G-070 ❌ Both tracks counted for a role requirement ("any one AI tool"). Requirements are per track.

## Customer-facing content
- G-071 ✅ Customer start tracks exist for GGLearn, GGSocial, Moksy but are `review`/empty until approved.
- G-072 ❌ Release notes for customers when the product changes. None.
- G-073 ❌ Customer sees only features on their plan. None.
- G-074 ❌ Product UI changed: screenshots in questions go stale. No images.
- G-075 ❌ Customer in-app help links into gglearn. None.
- G-076 ❌ Multiple product versions live at once. One version.
- G-077 ❌ Beta features hidden from non-beta customers. None.
- G-078 ❌ Deprecation notice flow. None.
- G-079 ❌ NPS after finishing. None.
- G-080 ❌ Feedback to product team from wrong-answer clusters. Admin view only.

## Quality over time
- G-081 ✅ Admin sees questions nearly always failed/never failed.
- G-082 ❌ Question age shown ("written 2 years ago"). `createdAt` exists, not shown.
- G-083 ❌ Auto-retire at expiry. None.
- G-084 ❌ A/B test question wording. None.
- G-085 ❌ Track-level health score (coverage, freshness, pass-rate). `npm run coverage` covers counts only.
- G-086 ✅ `npm run coverage [-- --min 100 --fail]` lists levels under 100 questions (CLI).
- G-087 ❌ Surface coverage in the admin UI. CLI only.
- G-088 ❌ Block publishing a track under minimum coverage. None.
- G-089 ❌ Content roadmap visible to staff ("coming soon"). Only careers.
- G-090 ❌ Staff vote for the next track. None.

## Operations of content
- G-091 ❌ Rollback a bad content import. None.
- G-092 ❌ Snapshot before bulk activate. None.
- G-093 ✅ Questions dedupe on (track, level, prompt).
- G-094 ⚠️ Re-importing the questions repo on a track with questions duplicates at shifted levels (README warning).
- G-095 ⚠️ Invalid JSON files are skipped and listed, but no later alert.
- G-096 ❌ Content tests in CI (every track has ≥ N questions). None.
- G-097 ❌ Spell-check/lint for knowledge. None.
- G-098 ❌ Translate brand material. None.
- G-099 ❌ Accessibility review of content. None.
- G-100 ❌ Content licence audit (TrialTest/SkillsTest provenance). Source field only.
