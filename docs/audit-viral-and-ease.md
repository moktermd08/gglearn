# gglearn audit: viral, easy, fun

Walked as: individual, group, new, existing, invited, uninvited, contest, campaign, company, brand.
Method: ran the app (desktop and phone width) and read the code for each journey. Nothing is fixed yet; this is the list.
Status column: `open` until fixed, then `done` with the commit.

## A. Getting in (the biggest blocker)

| # | Issue | Evidence | Status |
|---|---|---|---|
| A1 | No self sign-up. An uninvited individual, student or friend cannot create an account at all. | Landing: "accounts are created by your admin". Login: "ask whoever runs your team". Only `joinWithInvite` creates users (`app/actions.ts`). | done (/signup, open registration as a no-company account) |
| A2 | The main button for a signed-out visitor, "Go to my path", leads to a login wall. `/start`, `/tracks`, `/campaigns` joins all need an account (`requireUser`). | `app/(site)/start/page.tsx` | done (landing, header: Start free) |
| A3 | No taste before commitment: a visitor cannot answer one question and see a result. | Landing has only descriptions and a sample card. | done (/try: three real questions on any public topic with instant feedback and no account; the sign-up that follows starts them on that topic; button on the landing page) |
| A4 | Password reset needs an admin; no self-serve reset or magic link, although email sending exists. | Login copy; `lib/mail.ts` | done (/forgot and /reset/<token>: emailed one-hour single-use link, same reply for any address, rate limits, signs out other devices, change notice; manager-set temporary password still works) |
| A5 | No Google, Microsoft or Apple sign-in, and no passwordless option. | `app/actions.ts` has password only | partly done: passwordless sign-in by an emailed one-time link (/signin); a company can now use Google Workspace, Microsoft Entra ID or any OpenID Connect provider for its own people (D3). Personal Google, Microsoft and Apple sign-in for individuals is not built: it needs client credentials registered by the platform owner with those companies |
| A6 | The landing page speaks only to staff and "your role"; individuals, groups, brands and customers are not addressed. | Hero copy, "One platform, three kinds of people" | done (landing copy, six audiences) |
| A7 | A person invited to a race who already has an account, or who is invited to a second company, gets no clear "you are in two places" explanation. | Arena rules in README | done (a plain-language "Where you belong" on the profile, a one-line note for people in several companies on the dashboard, league and seasons, and a notification when a manager changes which companies someone belongs to; the words are checked against the real arena and look rules) |

## B. Speed and ease (123-easy)

| # | Issue | Evidence | Status |
|---|---|---|---|
| B1 | Time to the first win is long: pick topic, choose who, 3-5 level-check rounds of 5 questions, set finish line, then race. | `/start` five-step flow | done (new sign-ups land on /try?first=1: pick a topic, three questions, +30 XP, enrolled, streak and welcome freeze, about eight taps; the level check now has a full "skip and start now" button) |
| B2 | No one-tap "quick race" or "play now" (random topic, auto level, 1 minute). | `/start` and `/competitions/new` | done (Surprise me, Race now and Race a friend on /start and on every topic page; skips the level check and the form) |
| B3 | Race creation shows about 14 sections at once and a raw dropdown of 100+ topics. | `/competitions/new` | done (the race form shows topic with popular shortcuts, goal chips and length chips; the name is optional and defaults to the topic; everything else is under a closed More options that is still part of the same form) |
| B4 | Topic list is messy: typo "AWS Lamda", lowercase "css", "dynamics", near-duplicates (Git and "Git: Novice to Titan", AWS and AWS Lambda, Github), mixed naming styles. | `/start`, `/competitions/new` | done (18 names corrected through fix:names, which deploy runs last; readable labels and natural order in the pickers, share text and previews; numbering and the suffix are kept in the stored names) |
| B5 | Dashboard is very long (about 20 sections). A new person sees 18 required tracks all due in 23 days and no single next action. | `/dashboard` as Demo Learner | done (one ranked "Your next step" card at the top, with an order covered by check:nextaction; the old Continue card now only shows when the next step is something else) |
| B6 | Daily goal "0/3" has no one-tap "start today's first quest". | Dashboard hero | done (the next-step button goes straight to today's first quest, for example the drill) |
| B7 | Exams are 10 questions at 80% to pass; no short "1 minute" or "5 question" competitive mode outside the drill. | `lib/levels.ts`, README | done (live duels are a five-question head-to-head that takes about two minutes; level exams stay as they are) |
| B8 | No search across the whole site, no global "what should I do now" command. | Header nav | done (header search and Ctrl/Cmd+K: pages, topics, races, your teams and certificates; follows what the asker may see; never people; plain /search page too) |
| B9 | No installable app (no manifest or service worker), no bottom navigation on phones. | `ls app`, phone screenshots | partly done: web manifest and icons so it can be installed; bottom navigation and offline still open |

## C. Viral loops

| # | Issue | Evidence | Status |
|---|---|---|---|
| C1 | Sharing exists only on the achievements and seasons pages. No share at the moment of delight: level pass, exam result, certificate, race finish or win, record, joining a race. | `ShareButton` used in 2 pages only | done: level pass, certificate, race progress, race result and joining a race all share; time records are still not shareable |
| C2 | Share targets are only LinkedIn and X plus the image. No WhatsApp, Telegram, Facebook, email, QR code or the phone's native share sheet. | `app/(site)/s/[code]/page.tsx` | done (ShareBar: native share, copy, WhatsApp, Telegram, Facebook, LinkedIn, X, email) |
| C3 | Certificates have no share or "Add to LinkedIn profile" button. | `cert/[code]` not in ShareButton users | done (share button and an "Add to LinkedIn profile" button for the holder, hidden once a certificate is expired, revoked or altered) |
| C4 | No personal referral or "invite a friend" link with a reward (XP, streak freeze, cosmetic). | No referral code anywhere | done (personal link on the achievements page; credited from sign-up, share cards, race pages and race links; Recruiter badges only count friends who pass a level by exam; no cash or XP reward yet) |
| C5 | The race invite link is off until the organiser creates it, is blocked for company topics, and is copy-paste only. | `lib/guestLink.ts`, contest page | done (guided and quick races turn the link on; the full form has an invite-link tick, on by default, for topics safe to show an outsider) |
| C6 | No "challenge a friend" 1v1 from a result, a profile or a share card. | Not found | done (1v1 challenge: two places, no simulated rival, link ready; on the exam result page and every topic page) |
| C7 | Share card page offers "Start learning" but the destination (landing, then login wall) cannot convert the visitor. | Share page links to `/` | done (share card and contest pages point to /signup) |
| C8 | No per-page link previews for the landing page, campaigns, public contests or subjects; share cards are `noindex`. | `generateMetadata` in 3 files only | done (link previews for landing, public topics and public races; private races and company topics show the plain brand picture) |
| C9 | No sitemap, robots or manifest, so the 118 subjects and 300 campaigns cannot be found through search. | `ls app` | done (sitemap.xml, robots.txt; SITE_URL must be set in production) |
| C10 | No reminders or return hooks: no streak-at-risk email or push, no "your rival passed you", no weekly recap. | Mail is invites only | done (opt-in Monday recap and evening streak reminder by email, one email each per period, one-click unsubscribe; needs SITE_URL, RESEND_API_KEY, MAIL_FROM and the new gglearn-nudges pm2 job; no push notifications yet) |
| C11 | No friends or follow, activity feed, cheers or reactions. | Not found | done (mutual friends by a personal friend link or an accepted request; a weekly board of XP and streaks; a feed of real achievements from friends with topic names shown only if you could see them; one-tap cheers with a notice; no public follows) |
| C12 | Cold start looks empty: "0 people" on live public contests, 300 campaigns with no social proof. | Landing | done (real aggregate numbers only when at least five people are behind them, on the landing page and topic pages; empty races say "Be the first to join"; simulated rivals are labelled; nothing invented; the stale "accounts are created by your admin" line is gone) |

## D. Group, company and brand

| # | Issue | Evidence | Status |
|---|---|---|---|
| D1 | No one-tap team or class with a join code for people outside a company (study group, class, community). | Groups are admin-managed | done (/teams: anyone starts a team with a join link, a weekly board and a team race that invites everyone; up to 30 people; the owner can switch joining off, remove people or close it) |
| D2 | A company cannot self-start: setup is admin-only, one person at a time; no bulk (CSV) invite or domain auto-join. | `/admin/setup`, `/admin/people` | partly done: paste or upload a list of up to 300 people with a role per line, and one reusable team link (learner access only, capped, expiring, switch-off); single sign-on and domain auto-join are still open |
| D3 | No single sign-on or directory sync for companies. | Not found | done: single sign-on (`lib/sso.ts`) and directory sync (`lib/scim.ts`) |
| D4 | No public branded entry for a brand or company (for example `/b/moksy` with its look and a join button). Branding skips the sign-in and landing pages and the level names. | README "Not yet branded" | partly done: each company can switch on a public page at /c/<name> in its own name, logo and colour, with a one-step customer sign-up that starts them on its customer topics; brand-level pages, the sign-in page and the 20 level names are still unbranded |
| D5 | Customers and partners can only arrive by an admin invitation. | Customer audience rules | partly done: customers can now join on a company's public page, when the company switches it on; partners and resellers still need an invitation |
| D6 | `/campaigns` and competition admin controls are not company-scoped. | README | done (an admin cancels or switches off the link of a contest only if its organiser is someone they run; /admin/contests lists exactly those; campaigns are owned by the platform owner, never a company admin, and the setup notes on /campaigns are for the platform owner only) |
| D7 | No teacher, parent, mentor or sponsor role. | Roles are admin, manager, learner | done: teachers (classes), mentors, parents and sponsors |
| D8 | Team-versus-team and company-versus-company contests are limited by arenas; no opt-in cross-company public league. | `lib/arena.ts` | done: opt-in cross-company league (`lib/openLeague.ts`) |

## E. Fun and rewards

| # | Issue | Evidence | Status |
|---|---|---|---|
| E1 | Rewards depend on an organiser paying: vouchers or money, sent by hand. No built-in instant rewards (streak freeze, XP boost, avatar items, titles). | `lib/rewards.ts` | partly done: streak freezes (welcome freeze, one per 7-day streak, hold 2, spent automatically, never wasted); XP boosts, titles and avatar unlocks are still open |
| E2 | No live head-to-head; races are asynchronous leaderboards. | Contest design | done (live duels: five questions, same moment, server clock, early close when both answer, hidden answers until reveal, simulated labelled rival so it is playable at once; entry on every topic page; polling, no websockets) |
| E3 | Leagues, promotion and relegation are not visible as a loop (seasons exist, but no "move up a league" feeling). | `/seasons` | done (weekly league: 8 tiers Bronze to Diamond, cohorts of up to 30, top fifth up and bottom fifth down with small groups protected, /league page, dashboard card, promotion and relegation notices; built on the season points; check:league) |
| E4 | Celebrations happen on pages, not as a shareable moment with a prompt. | See C1 | done (a one-time celebration toast with confetti and a one-tap share for badges, player level-ups, league promotions and top-three season finishes; new share cards for league promotions and duel wins; duel results have a share button) |

## Suggested fix order

1. A6, A2, C7: landing and call-to-action copy for every audience (no new data).
2. C1, C2, C3: share at every moment of delight, with WhatsApp, native share and copy.
3. C9, C8: sitemap, robots, manifest, link previews.
4. B4: clean topic names and duplicates.
5. B2, B5, B6: quick race, one next action, today's quest button.
6. A1, A3, A4: self sign-up, guest taste, self-serve reset (needs a product decision first: open registration changes arenas and tenancy).
7. C4, C5, C6: referral, default-on race links, challenge a friend.
8. D1, D2, D4: teams with join codes, bulk invite, branded public entry.
9. C10: reminders and recap emails.
10. The rest.

## Found while fixing (not in the lists above)

| # | Issue | Status |
|---|---|---|
| X1 | A signed-out visitor saw every topic on the landing page, including company-only ones, and could open their pages. Now only topics made for outsiders show; the rest ask for sign-in. | done |
| X2 | The referral code could not be read back for about one person in four, because its signature can contain a dash and the code was split on every dash. Found by a flaky check; fixed, and tested over 400 ids. | done |
