# Conductor Chat UX v1 — Governance Lock Policy

Owner: Val  
Date: 2026-02-10  
Feature: #F209 / #F214

## Policy Statement

No runtime-expansion merge for Conductor Chat UX v1 is allowed until P0 runtime hard-cut tasks are complete and verified.

## Blocking Set (must be DONE)

- #726 Remove old prompt timeout/poll runtime path
- #727 Finalize reconnect + resumeFromSeq + snapshot resync
- #728 Emit V2 lifecycle JSONL logs end-to-end
- #729 Add reliability metrics
- #730 Run/automate 20-turn + reconnect replay suite
- #731 Execute Tauri Conductor manual checklist
- #732 Promote V2 as only active Conductor runtime path

## Unlock Task

- #754 is the governance unlock task.
- #754 may be marked done only when all blocking tasks above are done and evidence is indexed.

## Required Evidence Bundle for Unlock

1. Test/soak output proving reconnect + replay continuity (incl. disruption path)
2. JSONL correlation logs showing request/session/message linkage
3. Metrics output covering ack latency, stream lag, replay depth, connection churn
4. Tauri checklist completion notes
5. Confirmation that legacy polling path is unreachable

## CI/Review Enforcement

For runtime-scope PRs (PR-05 onward):
- Reviewer must reject merge if #754 is not done.
- PR must include link to this policy doc and evidence bundle.
- Missing evidence => gate fail.

## Scope Clarification

Allowed before unlock:
- UI-only canonicalization work (shell, thread, composer structure)
- state-model scaffolding that does not expand runtime path behavior

Blocked before unlock:
- runtime event wiring changes that alter execution semantics
- reconnect/resync/replay behavior merges
- observability/metrics claims without evidence
