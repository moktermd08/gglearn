# 1,000 edge cases for GGLearn: set up a company, add staff, build a trained workforce

Companion to `docs/journeys.md`. Ten files of 100 cases each, in the order a company lives through the product.
Statuses come from reading the code and the live DB on 2026-10-11; **nothing was run in a browser**. Items marked "verify" or "unverified" are things I could not confirm from the code I read.

Legend: ✅ works today · ⚠️ partial, manual or risky · ❌ gap.

| File | Theme | IDs |
|---|---|---|
| [A-company-setup.md](edge-cases/A-company-setup.md) | Company, goals, time, admin experience | A-001 to A-100 |
| [B-invites-joining.md](edge-cases/B-invites-joining.md) | Adding staff, invites, accounts | B-001 to B-100 |
| [C-onboarding.md](edge-cases/C-onboarding.md) | First 90 days, role-by-role | C-001 to C-100 |
| [D-learning-assessment.md](edge-cases/D-learning-assessment.md) | Tracks, placement, exams, grading | D-001 to D-100 |
| [E-paths-scopes-compliance.md](edge-cases/E-paths-scopes-compliance.md) | Required paths, scopes, compliance | E-001 to E-100 |
| [F-careers-roles.md](edge-cases/F-careers-roles.md) | Promotion, role changes | F-001 to F-100 |
| [G-content-brand-updates.md](edge-cases/G-content-brand-updates.md) | Brand updates, content freshness | G-001 to G-100 |
| [H-teams-engagement.md](edge-cases/H-teams-engagement.md) | Teams, contests, engagement | H-001 to H-100 |
| [I-offboarding.md](edge-cases/I-offboarding.md) | Offboarding, handover, return | I-001 to I-100 |
| [J-security-ops-misc.md](edge-cases/J-security-ops-misc.md) | Security, privacy, operations, customers | J-001 to J-100 |

## The cases that matter most (fix these first)

1. ~~G-010 to G-030: no "am I up to date?"~~ **Built 2026-10-11** (read-and-confirm, `/admin/freshness`, `/updates`). Still open: a refresh quiz, email/chat notice, per-person brand score.
2. **E-048 / C-041: a role with no tracks looks "compliant".** Social media manager shows state "none".
3. **A-075 / C-043 / C-044: required tracks with 0 questions are silently ignored**. Most GGLink/Guru/Moksy company tracks are in this state.
4. **A-008 / J-024 / J-025: no tenancy.** Managers see everyone and can invite into any company.
5. **I-030: a leaver's unused invite links still work for up to 7 days.**
6. **I-012 / I-013: leavers cannot write their own handover** because the account is locked first and only managers can add notes.
7. **B-050 / B-053: no password reset or change**, and `createPerson` temporary passwords can never be replaced.
8. **I-042: rehire is blocked** (email exists, no reactivation).
9. **B-009 / H-062: no email of any kind**, so invites, reminders and overdue warnings depend on people remembering.
10. **J-023: any manager can tick any checklist item**, including their own onboarding.
