# Growing the term lists to about 1,000 per role

A role's list is the banks made for that role plus the banks for everyone, limited to the ranks the chosen level reaches. So a list grows by adding banks, not by editing code.

**Adding a bank is adding one file**: `content/cards/<slug>.json` in the card format (see `content/cards/AUTHORING.md`) with a `termBank` block that names it, says which roles it is for, and names its groups:

```json
"termBank": { "name": "Policy profession", "description": "...", "roles": "civil service,policy advisor", "order": 12,
              "headings": { "cycle": "The policy cycle and evidence", "anal": "Appraisal and analysis" } }
```

Then `npx tsx scripts/ai/check.ts --cards <slug> --sample` must print OK, and `npm run import:terms` loads it. A super admin edits terms afterwards in `/admin/terms`.

## Where each role stands

100 terms a bank. "Written" means the file exists and passes the checks; **it still needs a subject expert's review before it is relied on.**

| Role family | Written | Total | Still to write for about 1,000 |
|---|---|---|---|
| **Everyone** | Office core, Office core 2 (working life) | 201 | A third set only if reviewers find gaps |
| **CTO** (and CIO) | Office core 1 and 2, CTO core, Security core, Engineering management, Data and AI leadership, Cloud and infrastructure leadership | **701** | Strategy and architecture 2, Governance, risk and compliance for leaders, Finance and commercial for leaders, Product and delivery, Board and executive communication |
| **Software developer** (developer, backend, frontend, mobile, engineer, AI and data engineers) | Office core 1 and 2, Programming fundamentals, and for full stack Full stack core | **301** (full stack **401**) | Data structures in practice, Frontend, Backend and APIs, Databases and SQL, Cloud and DevOps, Testing and quality, Secure development, Architecture and design patterns, Agile and engineering practice |
| **Full stack developer** | as above, plus Full stack core | **300** | as software developer |
| **Civil Service** (AO to Grade 6, policy advisor) | Office core 1 and 2, Civil Service core, Policy profession | **401** | Operational delivery and casework, Public finance and procurement, Digital, data and technology in government, Law, constitution and Parliament, Leadership and people management, Communications and engagement, Programme and project delivery, Equality, ethics and standards, Security and information assurance |

By level, the lists today are:

| Role | Level 1 | Top level |
|---|---|---|
| CTO | 125 (before Office core 2) | 701 |
| Developer | 132 (before Office core 2) | 301 |
| Full stack developer | 132 (before Office core 2) | 401 |
| Civil Service | AO 92 (before Office core 2) | Grade 6 401 |

## What to check when reviewing a batch

- **Facts**: each card's first line is the meaning and the other lines are facts; the "not" line must be false of that term. Nothing may be tied to a date, price or version.
- **Look-alikes** (the `like` list): terms that could be confused. The generator will pick one as the other's wrong answer only at the hardest ranks, so check that the two really do differ on every line.
- **Tiers**: 1 and 2 are what someone starting out needs, 3 a working practitioner, 4 and 5 senior and leadership. The tier decides which level a term first appears at.
- **UK wording**: the Civil Service and finance banks use UK terms.

## Order I would write the rest in

1. ~~Office core 2~~ (written).
2. The remaining CTO banks (the list nearest to the goal).
3. The software developer banks (shared by about nine roles).
4. The remaining Civil Service banks.
