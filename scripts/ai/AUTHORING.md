# Authoring an AI track

Each track is one file, `scripts/ai/data/<slug>.ts`, exporting a `TrackSpec` (see `types.ts`). The engine (`engine.ts`) turns
every card into ~20 different multiple-choice questions (true/false, "complete the statement", "which X does Y", contrasts,
"which is NOT true", scenarios, classification) and spreads them over 20 levels by tier and form. Questions are only as good
as the cards, so **accuracy and distinctness of cards is the whole job.**

Goal per track: **110-140 cards**, 8-16 groups of 6+ cards each, spread across tiers 1-5 (roughly 15% / 25% / 30% / 20% / 10%),
plus **30-60 hand-written `qa` questions** (code, outputs, workflows, "what happens when"), plus `calc` ids if numbers apply.
`npm run check:ai -- <slug> --sample` must print `OK` (at least 100 questions on every level) with no group warnings.

## File shape

```ts
import type { TrackSpec } from "../types";

const spec: TrackSpec = {
  slug: "llm-prompting-titan",              // must equal the file name
  name: "Prompt Engineering: Novice to Titan",
  description: "One sentence on what the track covers.",
  roles: "developer",                       // developer | designer | manager | sales, comma separated
  groups: {                                 // key -> singular noun phrase used in "Which ___ ...?"
    technique: "prompting technique",
    param: "sampling parameter",
  },
  cards: [
    {
      group: "param", subject: "Temperature", tier: 1,
      says: [
        "scales the logits to control how random sampling is",
        "makes output closer to deterministic as it approaches zero",
        "makes lower-probability tokens likelier as it rises",
      ],
      use: "want repeatable, near-deterministic output",
      not: ["sets the maximum length of the reply"],
      like: ["Top-p"],
    },
    // ...
  ],
  qa: [
    { q: "What does this return?", code: "...", right: "...", wrong: ["...", "...", "..."], tier: 3, why: "..." },
  ],
  calc: [],   // optional extra generator ids from calc.ts (slug prefixes llm-, api-, rag-, vec-, ml-, tune-, agent-, image-, eval- add sets automatically)
};
export default spec;
```

## Card rules (the engine builds sentences from these, so grammar matters)

1. `says` entries are **verb-first, third person singular predicates, no trailing period**. They must read after the subject
   ("Temperature **scales the logits ...**") AND after "Which sampling parameter **scales the logits ...**?". Good:
   `"retrieves relevant documents and adds them to the prompt"`. Bad: `"A technique for retrieval"`, `"is used when..."`-style
   fragments that only work in one direction, or anything starting with a noun.
   For plural subjects write the card so that `"<subject> <predicate>"` still reads right, or avoid plural subjects.
2. 2-4 `says` per card. Each is a **different, specific, always-true** fact. Prefer distinguishing facts (what makes this thing
   different from its neighbours) over generic ones that would also fit its group-mates ("is used in AI" is useless).
3. **A predicate used as a wrong answer for another card must be false for it.** The engine borrows predicates from other cards
   in the same group as distractors. If two cards could both truthfully say something, rephrase one so it is specific, or list
   the two in each other's `like` so they are never paired. Do not write predicates like "helps improve results" that fit everything.
4. `use` (optional but valuable, aim for 60% of cards): a situation, reading after "when you ..." / "You ...", that points to
   this card and ideally no other card in the group. e.g. `"need the model to return strictly valid JSON"`.
5. `not` (0-2 per card): a believable misconception about THIS subject, phrased like a `says` predicate and genuinely false.
   These make the best distractors. Never write a `not` that is true in some products/versions.
6. `subject` is a short name as written mid-sentence (`"Temperature"`, `"the system prompt"`, `"LoRA"`). Unique per track.
7. `group` labels are singular noun phrases that read after "Which ___" / "What kind of thing is X?":
   `"retrieval technique"`, `"Python class"`, `"configuration option"`, `"failure mode"`, `"CLI command"`, `"vector database"`.
   Every group needs **6+ cards** (more is better) and at least 3 groups per track.
8. `tier`: 1 = what it is / first steps, 2 = core everyday knowledge, 3 = working practitioner details and trade-offs,
   4 = advanced configuration, failure modes, internals, 5 = expert/edge cases. Fill all five tiers.

## QA rules

Hand-written MCQs: `right` plus exactly three plausible `wrong` (each a believable mistake, none partially correct). Include code
(`code:` field, real syntax) for how-do-I / what-does-this-output / spot-the-bug questions wherever the subject has code or
commands. Add `why`. 30-60 of them, spread across tiers 1-5. Keep prompts unique.

## Accuracy policy (important)

This bank teaches real people. Today is late 2026 and AI products change monthly.
- Teach **durable knowledge**: concepts, architectures, APIs/commands/parameters that have been stable for a long time, trade-offs, failure modes, vocabulary.
- **Do not include**: prices, rate limits, specific model names or version numbers, benchmark rankings, release dates, company org facts, context-window sizes, or "latest/newest" claims. Refer to model families generically ("a large language model", "a reasoning model").
- If you are not highly confident something is true and long-lived, leave it out. No guessing, no invented function names, flags or fields.
- Code must be correct for the current mainstream version of the library; prefer the simplest stable API surface.
- Use plain, neutral wording. No marketing claims ("best", "fastest").

## Workflow

1. Write the file in one go (or build it in a few `cat >>`-style appends), then run
   `npm run check:ai -- <slug> --sample` from the repo root and fix every FAIL/warning (small groups, unknown group keys, too few cards).
2. Read the sample output for sense: grammar, a distractor that is also true, duplicated meaning between cards.
3. Do not edit any file other than your own `scripts/ai/data/<slug>.ts` files. Never touch the database.
