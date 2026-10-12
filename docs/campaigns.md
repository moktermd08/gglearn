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

## If production says "Coming soon"
That is a database with no contest rows behind the catalogue (the page links only to contests that exist). After deploying this change, open `/campaigns` once, or run `npm run seed:campaigns` on the server. If a notice says campaigns are hidden, load the missing content with `deploy/seed-content.sh`.
