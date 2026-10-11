# Authoring a card track (company, product, service, process, tool, leadership)

A card track is one JSON file, `content/cards/<slug>.json`. The engine (`scripts/ai/engine.ts`) expands every card into about 20 multiple-choice questions and spreads them over the 20 levels. **Read `scripts/ai/AUTHORING.md` first**: its card rules, QA rules and accuracy policy apply here unchanged. This file only covers what differs.

## Floor

At least **1000 questions in all and 50 on every level** (`minPerLevel` defaults to 50 for card tracks). In practice that means **100 to 140 cards** in **8 to 16 groups of 6+ cards**, spread over tiers 1 to 5 (about 15 / 25 / 30 / 20 / 10 percent), plus **40 to 60 hand-written `qa`** scenario and application questions. Check with:

```
npx tsx scripts/ai/check.ts --cards <slug> --sample
```

It must print `OK` with no warnings. Fix every warning (small groups, unknown group keys, repeated subjects).

## File shape

Same as `TrackSpec` in `scripts/ai/types.ts`, as JSON, plus these optional fields:

```json
{
  "slug": "tech-strategy-roadmap",
  "name": "Technology Strategy and Roadmaps",
  "description": "One sentence.",
  "roles": "cto,architect",
  "kind": "subject",
  "brand": "foundations",
  "audience": "staff",
  "tier": "role",
  "scope": "company",
  "groups": { "framework": "strategy framework", "decision": "build-or-buy factor" },
  "cards": [ { "group": "framework", "subject": "Wardley mapping", "tier": 3, "says": ["..."], "use": "...", "not": ["..."], "like": ["..."] } ],
  "qa": [ { "q": "...", "right": "...", "wrong": ["...", "...", "..."], "tier": 3, "why": "..." } ]
}
```

- The slug must equal the file name.
- **A track that already exists in the database keeps its own name, brand, kind, roles, tier and scope**: the card file only adds questions. Copy its `name`, `description`, `roles` from the database so the file is self-consistent:
  `sqlite3 data/gglearn.db "select name, kind, roles, description, audience from tracks where slug='<slug>'"`
- For a **new** track choose `kind` (`subject` for leadership topics, `process`, `service`, `tool`, `product`, `technology`), `brand` (`foundations` for anything not owned by one company), `tier` (`role` when it is core to a job, else `growth`) and leave `scope` as `company` unless it belongs to one brand.
- JSON strings only: escape `"` and newlines, no trailing commas, no comments. Use straight quotes inside text where you can.

## Where the facts come from

1. **Company, product, service and tool tracks**: ground every card in what the company actually says. Read, in this order:
   - the track's knowledge items: `sqlite3 data/gglearn.db "select title, body from knowledge_items where track_id=(select id from tracks where slug='<slug>')"`
   - the matching file under `content/` (`content/products`, `content/lifecycle`, `content/tools`, `content/brand`, `content/gglink`, `content/guru`, `content/customer`) and any `scripts/build-*-content.mjs` that generated it
   - the product repositories' READMEs referenced in those sources, when they exist next to this repo
   Never invent a company specific (a price, a policy, a feature, a person, a date). If the sources do not say it, it does not go in. Generic good-practice cards that surround the company specifics are welcome and should make up the larger part of a thin source.
2. **Leadership, process, tool and technology tracks**: durable, widely agreed professional knowledge. Frameworks, practices, trade-offs, failure modes, vocabulary, numbers that are definitional (not market data). No prices, salaries, benchmark percentages, vendor version numbers or "latest" claims.

## Questions have to fit the role being examined

These tracks feed role exams (`content/blueprints`). A CTO is asked judgement questions; a junior developer is asked recognition and how-to questions. Make the tiers do that work:

- tier 1 to 2: what it is, vocabulary, the first steps.
- tier 3: how a working practitioner applies it, trade-offs.
- tier 4 to 5: judgement under constraints, second-order effects, what goes wrong, what you would check first. At least a third of the `qa` should be written as short situations ("A team ... what should you do first?") whose wrong answers are things people really do.

## Rules that save you a rerun

- Every predicate in `says` is verb-first, third person singular, no trailing period, and true of that subject only (see the main guide; a predicate that fits every card in the group is a bad predicate).
- Give `like` to cards in the same group that can be confused, so they are never used as each other's wrong answers.
- Subjects are unique within the file. Group labels are singular noun phrases that read after "Which ___".
- Do not write the same fact twice with different words; the engine will turn both into near-duplicate questions.
- Do not edit any file except your own `content/cards/<slug>.json`. Never touch the database or run the seed.

## Lint (the check fails you on these)

- `use` must start with a verb: the engine writes "Which X fits best when you <use>?" and "You <use>. Which X should you reach for?". Good: `"need to roll back a release within minutes"`, `"hear a vendor claim full coverage"`. Bad: `"a vendor claims..."`, `"the team is..."`.
- `says` starts lower-case with a verb ("reduces ...", "is ...").
- Prefer the **specific** over the generic: a predicate that would also be true of three neighbouring cards produces arguable questions. Make each `says` distinguish its subject from the others in the group.
- Run the check before you reply and read at least 15 of the sample questions at the end (`--sample` shows a few; reading your own cards aloud as "Subject + says" catches the rest).

## Working files

Many authors work at the same time in one shared scratch directory. If you generate the JSON with a helper script, name every helper and temp file with your track slug (`<slug>.build.js`, `<slug>.tmp.json`); never use generic names like `build.js`, `out.json` or `cards.json`. Before you reply, confirm your file still starts with your own slug and that `npx tsx scripts/ai/check.ts --cards <slug>` is clean.

## Standard brief for an EXISTING track

1. Metadata: `sqlite3 data/gglearn.db "select t.name, t.kind, t.roles, t.description, t.audience, t.tier, b.slug from tracks t join brands b on b.id=t.brand_id where t.slug='<slug>'"`; copy name, description, roles, kind, brand (slug), audience, tier into the JSON.
2. Company specifics only from: `sqlite3 data/gglearn.db "select title, body from knowledge_items where track_id=(select id from tracks where slug='<slug>')"`, the matching file under `content/`, and any file those cite. Surround them with accurate durable general knowledge of the subject so the track reaches the floor.
3. Write `content/cards/<slug>.json`: 110-140 cards in 10-14 groups across tiers 1-5 (about 15/25/30/20/10 percent), 45-60 qa (a third or more short realistic situations, with code/config snippets where the subject has them).
4. `npx tsx scripts/ai/check.ts --cards <slug> --sample` until OK with ZERO warnings; read at least 15 generated questions and fix wrong, arguable or duplicate ones.
5. Edit no other file, never write to the database (read-only queries are fine), do not run a seed. Another process may be editing scripts/ai/engine.ts; ignore it. Reply in 4 lines: check summary line, group count, number of company-specific cards, concerns.
