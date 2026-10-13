# Notifications and share cards

## Notifications (`/notifications`, the bell in the header)
In-app only: no email or push. Logic: `lib/notifications.ts`.
- **Events**: a badge earned, a player level up, a season result (only for a season that ended in the last 3 days), and a contest invitation to an existing account.
- **Stored once per event**: each row has a `key` (`badge-streak-3`, `level-12`, `season-week-2026-W41`, `invite-<id>`), unique per person, so the code that notices an event can run any number of times.
- **No backfill spam**: the first time someone opens progression, what they already had is filed as read.
- **Streak reminder** is not stored: when a streak is alive but today has no activity, the notifications page shows a reminder computed on read.
- The bell shows the unread count; "Mark all read" clears it.

## Share cards (`/s/<code>`, `/s/<code>/image`)
A person presses **Share** on a badge, their player level, their streak or a season result.
- The card is **rebuilt server-side from real data** at that moment (`snapshotFor` in `lib/share.ts`): nothing unearned can be shared, and the browser supplies only a kind and a key.
- It is a **frozen snapshot** (`share_cards`) showing first name and initial and the achievement. No email, photo or full name.
- The public page and the 1200x630 PNG (`next/og`) need no sign-in; the page is `noindex` and carries Open Graph and Twitter tags so links preview well.
- The owner can copy the link, post to LinkedIn or X, download the PNG, and **stop sharing** (page and image return 404 at once; shared caches may hold the image for up to 5 minutes). Active cards are listed on `/achievements`.
- Pressing Share again for the same thing refreshes the same link. Creation is rate limited (30 per hour per person, in memory).
- Set `SITE_URL` in production so absolute links are correct behind a proxy.

Run `npm run db:push` to create `notifications` and `share_cards`.
