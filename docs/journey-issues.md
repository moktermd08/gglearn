# Journey walk-through: issues found

Walked on 2026-10-11 in a browser against a copy of the dev database, as each person in `docs/journeys.md`:
an admin inviting people, then Ayesha (individual, Claude vs ChatGPT and Facebook marketing), Sam (Moksy social media manager),
four Guru Graphics sales people (Priya, Marcus, Lena, Tom), Dev (junior full-stack developer), and the brand-update journey.
Severity: **A** breaks trust in results · **B** blocks or misleads a journey · **C** friction.
Status is updated as each is fixed.

| # | Sev | Journey | Issue | Evidence | Status |
|---|---|---|---|---|---|
| 1 | A | 1 | **Placement can be gamed and never goes down.** One lucky first round (2 of 3 guesses) moved Ayesha from level 0 to 8; three rounds of blank answers did not lower it. The same effort on ChatGPT placed level 0. Placement counts as "passed" for required learning, career steps, dashboard stats ("8 levels passed", "+8 ahead") and contests. | Claude: round 1 "Narrowing from level 0 to 15" then "8 to 15" after three blank rounds → "Level 8 · Capable". ChatGPT: level 0. | **Fixed.** Moving up now needs 3 of 3 (a guessing learner averages level 0.2, was 2.3; 0.7% reach level 5+, was 20%). Required learning and promotion steps count real exams only (`levelsEarned`); placement only decides where to start. |
| 2 | B | 2, 4, 5 | **A role that is not exactly `developer`, `sales`, `designer` or `manager` gets no role learning, and nobody can fix it.** "junior full stack developer" and "social media manager" appear under "No ladder for their role". The People page has no way to change a role. The invite form takes free text with no hint which roles have content. | `/admin/careers`: "No ladder for their role: Dev Patel (junior full stack developer), Sam Carter (social media manager)". | **Fixed.** Managers can change a role (People → Change role); role fields suggest roles that have learning; invite shows a warning when a role has none. |
| 3 | B | 2, 5 | **Silent empty path.** Sam and Dev see only "Governance and compliance". The onboarding item "Pass level 3 in your first recommended track" cannot be done (no recommended track). Compliance shows them "In progress", the same as someone with a full path. | Dashboards for Sam, Dev; `/admin/compliance`. | **Fixed.** Dashboard shows "Nothing is set up for your role yet"; People and Compliance show a "no role learning" flag. |
| 4 | B | 4 | **Inviting a team is slow and error-prone.** One person per invite; after each one the form clears role and scope; the old "Invite ready" banner and the previous person's link stay on screen with no name next to them. | Created 5 invites; 3 silently failed on empty role/scope; wrong link shown. | **Fixed.** One form takes a whole team (up to 25 emails); each link is labelled with its email; already-registered addresses are reported, not silently dropped. |
| 5 | B | 2, 5 | **New hire cannot tick their own onboarding checklist**, and items like "Read the brand story and values" have nothing to read. Only a manager can tick. | Dashboard checklist has no controls. | **Fixed.** New hires tick their own onboarding items on the dashboard; managers can still tick anyone's. (Items with nothing to read still need real content.) |
| 6 | B | 1 | **An individual with only a personal brand gets a company-wide mandatory compliance course** with a 30-day deadline, and a checklist about "your manager". | Ayesha's dashboard. | **Fixed.** Staff whose only scope is a personal brand are not required to pass company-wide courses; accounts with no scope at all keep today's behaviour. |
| 7 | B | 1, 3 | **No end-user Claude or ChatGPT content.** "Claude & the Anthropic API" starts with API response IDs and `stop_reason`. Searching "facebook", "lead", "full stack" finds nothing; the only advice is "ask a manager" with no way to request a topic. (Content, not code.) | Placement round 1 text; picker search results. | **Partly fixed.** A search with no match now offers "Ask for X to be added"; managers see the most-asked topics on Question bank. Moksy brand & voice is now written (105 questions, awaiting approval). Facebook marketing is now written (2,400 questions, `facebook-marketing-titan`; a search for "facebook" finds it). Lead generation is now written (`lead-generation-titan`, general craft only), and so is end-user Claude/ChatGPT (`claude-chatgpt-everyday-titan`), which answers Journey 1 (the old "Claude" track is the developer API). GGLink hosting and maintenance for developers is now written from the repo's own deploy docs (`gglink-hosting-maintenance`; website operations only, no client hosting or support commitments), which gives Journey 5's developer something real to learn once approved. Selling Guru Graphics is now written from the studio's own published copy (`guru-graphics-sales`), which gives the four-person sales team (Journey 4) something real to learn once approved; prices, discovery scripts and qualification criteria are still unwritten anywhere and are not covered. Still open remain. |
| 8 | C | 4 | **Organiser cannot see who accepted an invited race.** The leaderboard shows only people who joined; four invited sales reps are invisible until they accept. | Contest page "1 PEOPLE" with 4 invited. | **Fixed.** The organiser sees who has been invited and has not answered, including emails with no account yet. |
| 9 | C | 1 | **Topic picker opens on an alphabetical A–C list** (first 24 of ~130) rather than topics relevant to the person's role. Search works but is not mentioned beyond its placeholder. | `/start`. | **Fixed.** The picker lists required and role-matched topics first, tagged "for you", with a line explaining the list is a subset and search covers all. |
| 10 | C | all | **Radio options in the placement check are announced only as "a", "b", "c", "d"** to screen readers. | Accessibility tree. | **Not an issue.** The option label wraps the input, so the accessible name includes the option text; my tool only showed the key. |
| 11 | C | admin | **Nav does not fit narrow screens**: admin links (Careers, Freshness) are cut off; the Sign out links wrap. | 632px viewport. | **Fixed.** The nav wraps instead of clipping. |
| 12 | C | 4 | **A placeholder track is shown to learners**: "Sales Basics (sample): Placeholder track ... Replace with real content." It has 4 questions, so a race to "gain 3 levels" ends after four answers. | `/tracks/sample-brand-sales-basics`. | **Fixed.** Placeholder seed tracks are hidden from learners (`PLACEHOLDERS` in `lib/tracks.ts`). Thin tracks can still make a race trivially short; see the note below. |
| 13 | C | 2 | **Track pages claim "10 questions per exam"** while a level may have 2-6, and levels above that show "0 Qs". | `moksy-product`: 6/5/6/6/6/4/3/2/2 then zeros. | **Fixed.** The track page now says "up to 10 questions per exam". |
| 14 | C | admin | **People page ships the full track list (~130 options) inside every person's handover form**, making the page huge. | Page text. | **Fixed.** The handover form lists only tracks that person is enrolled in. |
| 15 | C | 1 | **No side-by-side comparison** of two tracks, which is what "Claude or ChatGPT?" needs. (Feature.) | Journey 1. | **Open.** A side-by-side track comparison is a feature, not a fix. |

## Corrections to my earlier docs
- `docs/journeys.md` / D-015: I said the topic picker has no search. It does (`app/start/begin.tsx`); the issue is discoverability (#9).
- A-075: compliance already lists required tracks without enough questions; the gap is only that `/admin/paths` and invites do not warn.

## Worked as intended
Invite and join; single-use links; login and sign-out; compliance and careers pages; group race invitations reaching the invitee's dashboard and accepting; exam flow and results page; brand-update read-and-confirm (see commit a38c2b0).

## Still open
- #7 content authoring and #15 comparison view (above).
- A race can still be created on a track with only a few questions per level (finishing "3 levels" takes four answers). A guard that requires enough questions for the goal would stop it.
- The "Pass level 3 in your first recommended track" checklist text is still generic.

---

# Second walk-through (2026-10-13): every role, in a browser

Walked on a copy of the dev database as each role: a visitor, an admin, a manager, a new staff hire (Sam, social media manager) and a customer (Cara),
plus every route swept with each role's session for crashes and wrong redirects. Fixed items are in the same change; "Open" items need a decision or content.

| # | Role | Sev | Issue | Status |
|---|---|---|---|---|
| 16 | learner | B | **Failing an exam left one button, "Back to the climb".** No retry, no study link; "So close" was shown at 40%. | **Fixed.** Results offer "Try level N again", "Study the guide first" (or "Take level N+1" after a pass); the headline depends on the score. |
| 17 | learner | B | **Exam answers lived only in the page.** A refresh or a dropped connection lost every answer while the clock kept running; submitting with blanks gave no warning. | **Fixed.** Answers are kept as a draft for the tab; submit warns about blanks ("Go to question 3" or "Submit anyway"); 1-4 / A-D and the arrow keys work; options are announced as radios. |
| 18 | learner | C | **Results showed your own answer as a bare lowercase key ("a")** next to "B — False" for the right one. | **Fixed.** Both read "A — True". |
| 19 | learner | B | **Subjects with no live questions were offered everywhere** (landing page, "Start a journey" picked-for-you list) and the track page said "Accept the challenge". | **Fixed.** Hidden from those lists; a direct link says "Coming soon". |
| 20 | learner | C | **A required subject did not say it was required, or by when**, on its own page. | **Fixed.** A banner: "Required for your role: pass level 5. 30 days left (due 12 November)". The page also opens with a "Next up" card (study guide, take the exam). |
| 21 | learner | C | **"Explorer: start 3 subjects" was awarded for being auto-enrolled**, before any exam. A new hire got a badge notification for doing nothing. | **Fixed.** A subject counts once an exam is finished in it. |
| 22 | learner | C | **Profile and dashboard said "Not started" after a failed first exam.** | **Fixed.** "Level 1 in progress". |
| 23 | learner | C | First visit said "Welcome back"; quest buttons were clipped ("Study g…"); a duplicate React key in the skill map ("Tools" twice). | **Fixed.** |
| 24 | customer | A | **A customer invited with only a brand got an empty path and no warning**: getting-started subjects belong to a product (project), which ticking its brand does not cover. The dashboard then showed a checklist item ("Complete your getting-started path") that could never be done. | **Fixed.** The invite says "Nothing is assigned to customers with this scope yet. Also tick the product: moksy.ai"; the dashboard shows a "Start here" card when there is nothing to continue. |
| 25 | all | A | **Nobody could change a password, and a manager could not reset one.** People created with a temporary password were stuck with it; someone who forgot theirs was locked out for good. | **Fixed.** Profile → Password (current password required, other devices signed out). People → "reset their password" (a generated temporary password, copy button, the person is signed out everywhere). Managers reset learners only. |
| 26 | admin | B | **Invite links had to be selected by hand**; no "copy all" for a team. | **Fixed.** Copy link / Copy all links, and the note that no email is sent. |
| 27 | admin | B | **A manager or admin landed on a learner dashboard with nothing about their job.** | **Fixed.** "Needs your attention" at the top: overdue people, people with no path, invites not accepted, unread company updates, questions held for approval, each linking to where it is fixed. The "nothing is set up for your role" notice no longer shows for an admin with no job role. |
| 28 | admin | C | **"What is required" (`/admin/paths`) was reachable only from a button on Compliance.** | **Fixed.** In the Admin menu and footer for admins. |
| 29 | admin | B | **`/admin/careers` was a 7.4 MB page (18 s)**: all 28 ladders with their editors drawn at once. | **Fixed.** Ladders are summary rows; the one you open (`?role=developer`) is drawn in full (about 340 KB). |
| 30 | manager | C | **Freshness told managers to "record it here" but only admins can.** | **Fixed.** The empty state says an admin records it. |
| 31 | invitee | C | Opening an invite while signed in as someone else showed the other person's menu and, on Join, silently swapped the account. The login page was shown to people who were already signed in. | **Fixed.** A warning on the invite; `/login` sends signed-in people to their quest. Show/hide password on both forms. |

## Still open
- A manager cannot tell a customer apart from staff on `/admin/careers` and Compliance without reading the small chip. Not changed.
- Content: **Moksy brand & voice** and **Moksy reviewer onboarding** have questions in "review" only (0 live), so they are hidden from learners until an admin approves them at `/admin/review/<slug>`; people required to take them are not yet counted.
- Question wording from the generated bank is sometimes odd (for example a data-protection item that mentions Moksy's scrub rules). Needs a content review pass; not a code fix.
- `/start`, `/campaigns` and `/admin/paths` are 0.5 to 1.1 MB pages. Usable, but worth paginating.
