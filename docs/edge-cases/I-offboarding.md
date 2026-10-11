# I. Offboarding, handover, leave and return (I-001 to I-100)

## What exists today (`offboard`, `addHandover`, `toggleChecklist`)
- I-001 ✅ Offboarding sets `status = offboarded` and bumps `sessionVersion`: every session dies on the next request.
- I-002 ✅ Four checklist items are created: handover notes, transfer ownership, record answers to 10 questions, return equipment/revoke tool access.
- I-003 ✅ Handover notes (≤ 8000 chars) can be tied to a track.
- I-004 ✅ An offboarded person cannot log in (login spends a hash and returns the same wrong-password message).
- I-005 ✅ You cannot offboard yourself.
- I-006 ✅ A manager can only offboard learners; admins can offboard anyone.
- I-007 ✅ Offboarding twice is a no-op.
- I-008 ⚠️ Compliance excludes offboarded users, so their overdue items disappear from reports.
- I-009 ✅ History (runs, certificates, answers) is kept.

## Trigger and timing
- I-010 ❌ Scheduled offboarding on the last working day. Immediate only; the manager must act at the right minute.
- I-011 ❌ Notice-period mode (limited access, handover focus). None.
- I-012 ❌ Offboarding too early locks the person out of writing their handover. Notes are added by managers, so the leaver can't write their own after offboarding. A leaver should write notes *before* the lock.
- I-013 ❌ Leaver writes handover notes themselves. `addHandover` requires a manager.
- I-014 ❌ Handover notes visible to the successor. Shown in `/admin/people` only.
- I-015 ❌ Assign a successor. No field.
- I-016 ❌ Handover linked to tracks the leaver owned. Optional trackId only.
- I-017 ❌ Handover template per role. Four generic checklist lines.
- I-018 ❌ "10 questions only you know" captured as structured Q&A that become real questions. Plain text.
- I-019 ❌ Turn handover knowledge into a track automatically. Possible by hand via knowledge import.
- I-020 ❌ Offboarding checklist tied to IT systems. Text only.

## Access
- I-021 ✅ gglearn access ends instantly.
- I-022 ❌ Revoke access to *other* tools (GitHub, Slack). Out of scope; checklist text only.
- I-023 ❌ Confirmation that the checklist is complete before archiving. Items can stay open indefinitely.
- I-024 ❌ Flag leavers with open checklist items after 14 days. None.
- I-025 ❌ Remove public data: profile photo stays in `user_avatars`.
- I-026 ❌ Hide the leaver's name from live leaderboards. They still appear in contest rows (`status` unchanged).
- I-027 ❌ Remove a leaver from contests and invites. Contest membership and email invites remain.
- I-028 ❌ Competitions the leaver organised are orphaned (cancel/transfer). No transfer.
- I-029 ❌ Prizes owed to a leaver. Not tracked after exit.
- I-030 ❌ Pending invites the leaver created keep working until expiry (`createdBy` stays). A leaver's still-valid invite links can create accounts for 7 days. Real risk.

## Certificates and records
- I-031 ❌ Certificates remain publicly verifiable after leaving. Probably desirable; no choice.
- I-032 ❌ Revoke certificates for a dismissed-for-cause person. None.
- I-033 ❌ Provide the leaver a transcript. None.
- I-034 ❌ Reference letter data. None.
- I-035 ❌ Employment-duration records. Created date only.
- I-036 ❌ Retention policy (delete after 2 years). None.
- I-037 ❌ Right-to-erasure vs legal retention. None.
- I-038 ❌ Anonymise answers but keep stats. None.
- I-039 ❌ Offboarded user's answers still feed question statistics. Yes, stays in `answers`.
- I-040 ❌ Export leaver's data. None.

## Return and rehire
- I-041 ❌ Reactivate. No action; DB edit only.
- I-042 ❌ Rehire with the same email: invite refused ("already has an account").
- I-043 ❌ Rehire preserves history. Only via DB edit.
- I-044 ❌ Rehire resets checklist and required tracks. Checklist not recreated.
- I-045 ❌ Rehire after 2 years: stale passes count as current.
- I-046 ❌ Boomerang employee at a new role. No role-change UI.
- I-047 ❌ Contractor between contracts (access paused, not ended). None.
- I-048 ❌ Parental leave (suspend, keep progress, extend deadlines). None.
- I-049 ❌ Sabbatical. None.
- I-050 ❌ Garden leave. None.

## Special leavers
- I-051 ✅ A leaver who is the only admin can't be offboarded by a manager; another admin could, leaving none.
- I-052 ❌ Guard "last admin". None.
- I-053 ❌ A manager leaves: their reports need a new manager. No manager relation.
- I-054 ❌ A leaver owns a track (content owner). No owner field.
- I-055 ❌ A leaver is the only SME on a track. Not identified.
- I-056 ❌ A leaver is mid-exam. Lost answers.
- I-057 ❌ A leaver has a promotion pending. Cannot be promoted (blocked).
- I-058 ❌ A leaver is dismissed for misconduct and must be locked out while notes are written by others. Fine.
- I-059 ❌ A customer cancels their subscription. Same offboard action; checklist is the staff one (offboard uses OFFBOARDING for everyone).
- I-060 ⚠️ Customer offboarding gets staff wording: "Return equipment and revoke tool access".

## Offboarding sequence done well (target flow)
- I-061 ❌ Day -14: leaver gets "handover mode" with a guided template.
- I-062 ❌ Day -7: successor assigned, shadowing tracked.
- I-063 ❌ Day -3: knowledge capture quiz: "answer these 10 questions".
- I-064 ❌ Day 0: access ends, checklist assigned to IT/HR.
- I-065 ❌ Day +7: audit that nothing is left (ownership transferred).
- I-066 ❌ Day +30: automatic archive.
- I-067 ❌ Day +90: exit survey. None.
- I-068 ❌ Alumni mode. None.
- I-069 ❌ Handover completeness score. None.
- I-070 ❌ Turn the leaver's answers into new questions after review. Manual.

## Ownership transfer
- I-071 ❌ Accounts/files/customers transferred: just text in checklist.
- I-072 ❌ Contest ownership transfer. None.
- I-073 ❌ Invites created by the leaver revoked. None.
- I-074 ❌ Promotions decided by the leaver remain; `decidedBy` is a stable user id, fine.
- I-075 ❌ Notes authored by the leaver remain. Yes.
- I-076 ❌ Replace the leaver's name on content they authored. N/A.
- I-077 ❌ Reassign people they managed. No relation.
- I-078 ❌ Reassign review queues. N/A.
- I-079 ❌ Their scheduled contests. Continue.
- I-080 ❌ Their API keys/tokens. None exist.

## Legal and audit
- I-081 ❌ Audit trail of who offboarded whom, when, why. Only the status change and checklist rows; no actor, no reason.
- I-082 ❌ Reason code (resigned, dismissed, contract ended). None.
- I-083 ❌ Offboarding approval by HR. None.
- I-084 ❌ Evidence of access revocation timestamp. `sessionVersion` only.
- I-085 ❌ Notify security automatically. None.
- I-086 ❌ Scheduled access review ("who still has access?"). Compliance lists active only.
- I-087 ❌ Dormant account detection (no login for 90 days). No last-login field.
- I-088 ❌ Bulk offboard at contract end. One by one.
- I-089 ❌ Offboard a whole project team when a contract ends. One by one.
- I-090 ❌ Customer churn bulk offboard. One by one.

## Reporting
- I-091 ❌ Leaver turnover stats. None.
- I-092 ❌ Knowledge loss risk (people leaving who are sole holders). None.
- I-093 ❌ Handover completeness by manager. None.
- I-094 ❌ Time from decision to lockout. None.
- I-095 ❌ Offboarded users list with filters. `/admin/people` shows them; filtering unverified.
- I-096 ❌ Re-enable for 24h to retrieve something. None.
- I-097 ❌ Offboard in a different timezone. UTC.
- I-098 ❌ Accidental offboarding undo. None.
- I-099 ❌ Confirmation dialog before offboarding. UI unverified.
- I-100 ❌ Two-person approval for admin offboarding. None.
