# Behaviour stories (STAR) for Civil Service applications

## What this is for

Civil Service applications are scored on *behaviours* (Success Profiles), usually by a written statement per behaviour and again at interview. The hard part is not writing: it is having honest, specific examples ready, knowing which behaviour each one proves, and tailoring them to each job without losing track. gglearn already holds a person's CV; this adds the examples and an application pack that goes with it.

## Who it must work for

- **A person preparing to join, or move within, the Civil Service.** Wants to write each example once, see which behaviours are still uncovered, get plain advice on what makes a story weak, and for each job pick a story per behaviour, fit it to the word limit and download it.
- **Their privacy.** A story names real colleagues and real problems. It is private: no share link, never on the CV page, the CV PDF, JSON Resume export or any reader view. Only the owner (or a super admin viewing as them, logged under the super admin) can read or change it.

## Decisions

1. **A story is separate from an answer.** A story (`star_stories`) is the true account in four parts: Situation, Task, Action, Result, tagged with up to four behaviours. An *answer* is the wording for one behaviour in one application (`star_picks`). If the person has not edited it, the answer follows the story; if they have tailored it, their wording is kept, even if the story is deleted.
2. **The coach is fixed rules, not AI** (`lib/star/coach.ts`): missing or very short parts, “we” more than “I” in the action, an action under about 40% of the words, no measurable result, no learning, vague wording, over-long. Each tip says why. It never blocks saving. It does block *marking a story ready* while a “fix” remains, and while no behaviour is chosen. An AI rewrite is deliberately not here (the person's voice and honesty are the point; a made-up result in an application is a real risk).
3. **Behaviour descriptions are our own short wording**, not the official text; the page tells people to check the advert for which behaviours and which level. Grades are stored as a hint only.
4. **Coverage** shows, per behaviour, ready stories, drafts, and none, with a link to write one using prompts for that behaviour.
5. **Applications** hold the job, grade, closing date, advert link, a limit per behaviour, counted in words (default 250) or characters with spaces (default 1,250), whichever the advert uses, status, and the behaviours asked for. Changing the ticked behaviours keeps the story and wording of those still ticked and removes the rest.
6. **Export** (`/profile/behaviours/applications/[id]/export`): written statements or an interview cue sheet (short S, T, A, R lines), as PDF or plain text (to paste into a form). A PDF may have the person's CV (recruiter view) in front, and may leave their name and contact details off for applications marked without names; employers and other details remain, and the page says so. Downloads are private, uncached, not indexed, and rate-limited.
7. **Nothing leaves the person's control.** No sending to anyone, no review by others in this version. The person can download all their stories and applications as JSON (`/profile/behaviours/export`) and erase them for good, and can erase their whole CV (`lib/cv/erase.ts`, which also ends every share link). Offboarding by an administrator ends access but keeps records, so a returning employee finds them; erasing is the person's own choice.

## Not built yet

Practice mode (a random behaviour question with the story hidden and a timer); a mentor or manager commenting on a story, as they can on a CV draft (`lib/cv/review.ts`); strengths-based and technical question sets; Word export; importing existing statements.
