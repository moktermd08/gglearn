# CV manager: analysis and design

## What this is for

gglearn already holds the strongest evidence a CV can carry and no CV does anything with it: timed exams passed at 20 levels, certificates anyone can verify (signed, revocable, with expiry), a streak and activity record, a stated career goal and route plan, and the written judgement of mentors and managers who have read the person's answers. A CV built from that is more believable than one a person types from memory, because the reader can check it.

The job: let anyone turn what they do on the platform, plus what they add by hand, into a CV they can keep online, share by link (open, private, or behind a passcode), and download as a PDF, with full control over what each reader sees.

## Who it must work for, and what each needs

**The owner (a learner or staff member).**
- Does not want to start from a blank page: the platform should already offer a headline, a summary, skills and certificates, and tell them what is missing.
- Must stay in control. Public by default would be wrong: a CV carries a name, contact details and a work history. Everything is private until they share it, and different readers can be shown different things (a recruiter gets contact details, a public link does not).
- Needs to add what the platform cannot know: jobs, education, projects, languages, volunteering.
- Needs a PDF that survives an applicant tracking system: one column, real text, standard headings, no images of text.

**The reader (a recruiter or hiring manager).**
- Has about thirty seconds. Wants name, headline, what they have done, how recently, and whether to believe it.
- Needs a page that loads fast, needs no account, works on a phone, prints cleanly, and can be downloaded as PDF when the owner allows it.
- Believes what can be checked: every platform credential links to its public verification page, and the page shows live status (a revoked or expired certificate is never shown as valid). The page says plainly how things were assessed.
- Must never see what the owner hid, and must not be able to guess other people's links.

**A mentor or manager.**
- Their words should be able to work in the person's favour, but only with their say-so. A note written to a learner for coaching is not a public reference. So: when a reviewer writes praise on an answer they choose whether it may be quoted on the person's CV (off by default); the owner then chooses whether to feature it; the reviewer can withdraw it. A quote always carries the reviewer's name and the fact that it came from reviewing real answers.
- Later: a mentor the owner has let in can comment on CV sections (same pattern as notes on exam answers), and write a free-text endorsement.

**The platform and its operators.**
- Nothing that is private may leak through the CV: not through the public page, the PDF, the link, a search engine, or a referrer header.
- Not an identity risk: a super admin viewing as someone cannot create share links or change a CV in their name.

## Design decisions

1. **One builder, three outputs.** A single function turns a person, their saved CV content, platform data and a *view* (what this reader may see) into a plain document structure. The web page, the PDF and the owner's preview are all rendered from that structure. Anything hidden is removed there, once, so no output can disagree with another or leak.
2. **Visibility is layered.** An item must be visible on the CV (not hidden by the owner) and its section must be allowed in the view the reader is using. Contact details (email, phone, location, links) each have their own switch per view.
3. **Share links are rows, not secrets in a table.** A link is a row id plus a signature (like team join links): not guessable, revocable at once, expirable, countable. Three kinds: *public* (can be found by search engines if the owner says so), *private* (unlisted, anyone with the link), *passcode* (link plus a code the owner tells the reader; stored as a salted hash, attempts rate-limited). Each link carries its own view and whether the PDF may be downloaded. A revoked, expired or unknown link answers 404, the same as no such page.
4. **Platform data is derived live, and honest.**
   - Verified certificates, with code, score, dates and a link to the public check. Revoked ones never appear; expired ones are labelled.
   - Assessed skills: each topic with the highest level passed (of 20) and its title, strongest first. Passing a level means passing a timed exam; the page says so.
   - Optional highlights: levels passed, certificates held, how many of the last twelve weeks they were active. Streak and XP are off by default (they read as a game, and the owner may not want them in front of an employer).
   - Career goal, off by default for public views.
   - Quoted reviewer praise, only when quotable and featured.
   - Nothing derived from required company training: that is an employer's record, not the person's to publish.
5. **Smart, but not presumptuous.** The editor suggests: a headline (from role and goal), a summary written from their real numbers (editable text, never auto-published), skills worth featuring, an experience entry for the company they belong to on the platform (a one-click suggestion, never added silently), and a completeness score with the next three things to do. No AI is needed for this; an optional AI rewrite can follow.
6. **ATS-safe PDF.** A4, single column, selectable text, standard section names, an embedded font so names with accents survive, links as text (the verification address printed in full). Generated on the server from the same document structure, so it matches the web view and honours the link's visibility.
7. **Privacy by default.** Everything starts private. No photo (opt-in later; photos on CVs are discouraged in many hiring contexts and add bias risk). Contact email on a CV is a separate address the owner chooses, not their login email. Private and passcode pages are `noindex` and send no referrer, so a link in the CV cannot leak the CV's own address. External links are `noopener noreferrer`. No viewer IPs are stored: only a count and a last-viewed time.
8. **Standalone reader layout.** The reader's page has no site chrome and no login prompts: it is a document.

## What is built now, and what follows

Now: content editor (summary, headline, experience, education, projects, volunteering, awards, languages, skills, links), derived platform sections with per-item hide, suggestions and completeness, templates (three), share links (public, private, passcode) with per-link view, expiry, PDF permission, counts and revoke, the reader page, the PDF, quoting of reviewer praise.

Next (deliberately not rushed): free-text endorsements from mentors and managers; mentor comments on CV sections; AI-assisted rewriting; import from LinkedIn or JSON Resume; per-link view history; a photo option.
