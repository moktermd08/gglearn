# Campaigns

The catalogue of 300 public contests lives in `content/campaigns/` (100 career, 100 general, 100 AI). Page: `/campaigns`. Logic: `lib/campaigns.ts`.

## How the contests get created
Each campaign is backed by a normal public, open-join contest (`competitions` row, slug `camp-<id>`). `syncCampaigns()` keeps them in step:
- **No contest yet** -> round 1 is created, with the campaign's prizes.
- **Latest round has ended** -> the next round (`camp-<id>-r2`, "... · Round 2") starts now. **Renewals are certificate-only**: prizes are paid by the organiser, so they are offered once per campaign, not on every round.
- **Track not in this database** -> the campaign is skipped and hidden (admins see a notice), so a database with fewer tracks still works.
- **No active admin** -> nothing is created (admins see a notice); contests need an owner.
- Inserts ignore slug conflicts, so concurrent requests cannot create a round twice.

It runs on demand when `/campaigns` is opened (at most once a minute per server process) and from `npm run seed:campaigns [-- --dry]`, which `deploy/seed-content.sh` also runs. Nothing needs to be seeded by hand for the page to work, as long as an admin exists and the tracks do.

## Weekly and monthly cadence
How a campaign repeats comes from its length in the catalogue (`cadenceOf` in `lib/campaigns.ts`):
- **7 days -> weekly** (22 campaigns): every calendar week, Monday to Sunday, UTC.
- **28 to 31 days -> monthly** (105 campaigns): every calendar month, from the 1st.
- **Anything else -> rolling** (173): the next round starts when the previous one ends, for the same number of days.

Round 1 starts when it is first created and runs its full length, so it never overlaps the calendar rounds and keeps its prizes. After every round has ended, the next calendar round is created for the week or month that is running, **counted from its first day**: a visit on Wednesday creates the week that began on Monday, so everyone races over the same window and Monday's work counts. Slugs: `camp-<id>` (round 1), `camp-<id>-r2` (rolling), `camp-<id>-2026-W43` (weekly), `camp-<id>-2026-11` (monthly). Titles end with "Round 2", "Week 43" or "November 2026".

The sync runs at most once a minute per server process, from the site layout and `/campaigns`, so rounds roll over on whichever page someone opens first. There is no scheduler: if nobody opens the site during a week, that week has no contest. The page always shows what the current round really offers (a renewal shows "Certificate", never the catalogue prize).

## Scheduled run (pm2)
`ecosystem.config.cjs` has a second pm2 app, `gglearn-campaigns`, that runs `scripts/seed-campaigns.ts` at **01:05 every day** (server time) and once on every deploy (`pm2 startOrRestart`). It exits after each run and pm2 starts it again at the next cron time, so `pm2 list` shows it as **stopped** between runs, which is normal. This is what creates the weekly round on Monday and the monthly round on the 1st when nobody has opened the site.
- Daily rather than weekly, so monthly and rolling rounds are covered too. 01:05 rather than 00:05 so it is past midnight UTC whether the server clock is on GMT or BST.
- Check it on the server with `pm2 list` and `pm2 logs gglearn-campaigns --lines 20 --nostream`. A normal run prints "create N and renew N of 300 campaigns".
- It needs `.env.local`, an active admin and the tracks, like the page sync. With no admin it logs a message and does nothing.
- Tested in an isolated pm2 instance: it ran at start, exited, and pm2 started it again on the next cron tick.

## If production says "Coming soon"
That is a database with no contest rows behind the catalogue (the page links only to contests that exist). After deploying this change, open `/campaigns` once, or run `npm run seed:campaigns` on the server. If a notice says campaigns are hidden, load the missing content with `deploy/seed-content.sh`.
