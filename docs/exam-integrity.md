# Exam integrity

How gglearn makes it likely that a real person sat an exam, and what a company, brand or track can ask for. Admin page: `/admin/integrity`.

## What it can and cannot do

A web page cannot see a second phone, a second laptop or a virtual machine, and any browser check can be defeated by someone determined. So this is **evidence plus review, not a lock**:

1. The exam page gathers evidence (window changes, paste attempts, camera stills, timing).
2. The server scores it, and **treats missing evidence as a risk** (an exam that should have been watched but sent no session, no photos or no consent scores high, because that is the cheapest thing to fake).
3. A flagged pass can be **held**: its certificate and rewards wait until an admin clears it.
4. A person makes the final call. Nothing is decided by software alone, and the camera photos are never matched automatically.

For the highest stakes, use "always review passes from level N" and pair it with a short live check or viva.

## Layers: global, company, brand, track

The policy is set in layers, widest first, and **each layer stores only what it sets**:

```
whole academy (global)  ->  company  ->  brand  ->  track
```

- A setting a layer does not set is **inherited** from the layer above; the code defaults sit under everything (all monitoring off, so nothing changes until someone opts in).
- A layer can **lock** a setting. Nothing below it can change a locked setting (a company that must have webcam stills everywhere locks them, and no brand or track can switch them off). A track is the last layer, so it cannot lock.
- Who may set what follows reach (`lib/tenancy.ts`): the whole-academy layer belongs to the platform owner (an admin who runs no particular company); a company admin sets their own company, its brands and tracks. A manager (not an admin) cannot change policy or decide reviews.
- A track's chain is academy, its company (if its brand has one), its brand, then the track. A **role check** spans several tracks, so its chain is the academy, then the person's company when they belong to exactly one.
- The policy an attempt is held to is **frozen on its session when it begins**. Changing the policy later never rewrites what an earlier attempt was held to.

Code: `lib/integrity/policy.ts` (settings, presets, `resolveLayers`).

## Settings

| Setting | Effect |
|---|---|
| Keep the exam fullscreen | Leaving fullscreen covers the questions until the person returns; recorded. |
| Block copy and paste | Copy, cut, paste, drag-drop and the context menu are blocked; attempts are counted. |
| Leaving the exam window | Ignore, record, or record with a limit (leaves beyond the limit count as serious). |
| Random webcam stills | N small JPEG stills at random moments. The person must allow their camera. |
| Selfie at the start | One still before the questions appear, for the reviewer to compare with the profile photo. |
| Watch for automation and bulk text | `navigator.webdriver`, pasted answers, text that appears all at once. |
| Fastest believable pace | Seconds per question below which the whole exam is flagged (server-side, from timestamps). |
| Send to a person at risk score | A passed exam at or above this goes to the review queue. |
| Hold the reward until reviewed | A flagged pass keeps its certificate and rewards back until cleared. Off = given at once, queued for a look. |
| Always review passes from level | High-stakes levels always wait for a person. |
| Keep webcam stills for | Days after the exam is settled; then the images are deleted (the written record stays). |

Ready-made sets (Off, Light, Standard, Strict) fill the form; the admin can change any value afterwards.

## The flow

1. **Exam page** (`/run/[id]`, `/role-exam/[id]`): if the policy asks anything of the browser, the person sees a check screen that lists exactly what is recorded and needs their agreement before the questions appear (`components/ExamGuard.tsx`). It then enters fullscreen and starts the camera if asked.
2. **Evidence** goes to `POST /api/integrity` (`start`, `events`, `snapshot`). The route checks the exam is the caller's own and still open, keeps only known event kinds, accepts only small JPEGs, caps what a session can store, and rejects cross-site posts.
3. **Grading** (`gradeRun`, `submitRoleExam`) calls `finalize` (`lib/integrity/session.ts`): flags and a 0-100 risk score, then `review` for a passed exam at or above the threshold or at a high-stakes level; a held pass skips `awardForPass`.
4. **Review** (`/admin/integrity`): the queue shows who, the flags, the camera stills beside the profile photo and a timeline. **Clear** releases anything held. **Reject** withdraws the pass (the level counts as not passed), revokes a certificate already issued for it, and tells the person. A rejection needs a reason, which the person sees. Nobody reviews their own exam.

A provisional pass still unlocks the next level while it waits for review (rejection withdraws it).

## Scoring

Each kind of evidence adds points and is capped, so one noisy signal cannot flag an exam alone: tab leaves, leaving fullscreen, paste attempts, bulk text, automation, faces (none, several), camera stopped, reloads, too fast. Missing evidence: no session or consent (60), too few photos or no selfie (30 each). Weights and caps live in `lib/integrity/session.ts` (`assess`).

## Privacy

- The learner is told exactly what is recorded and must agree before the exam begins.
- Stills are small (320 px) JPEGs, viewable only by an admin who runs that person, never cached.
- Stills are deleted after the retention period once the attempt is settled; stills awaiting review are never deleted.
- Not covered: deleting a person's evidence when they are offboarded. Do that by policy or add it to offboarding.

## Checks

`npm run check:integrity` tests layer resolution, locks, who may set what, scoring (including missing evidence), holding and releasing rewards, review decisions, snapshot validation and retention. Run `npm run db:push` after pulling: four tables were added (`integrity_policies`, `integrity_sessions`, `integrity_events`, `integrity_snapshots`).

## Not tested in a real browser

Fullscreen, the camera and the start selfie need a real browser with a camera. They were type-checked and reviewed, and the server side behind them is covered by the check script, but a person should try an exam with the Standard set before relying on them.
