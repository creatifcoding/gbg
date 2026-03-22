# Conductor Chat UX v1 — PR Checkpoint Sequence (01→06)

Owner: Val  
Date: 2026-02-10  
Task: #779

## Sequence Overview

### PR-01 — Shell + Thread Baseline
- tasks: #755 #756 #757 #758
- checkpoint: #759
- output: L3 shell layout + thread architecture + stream collapse + inline rows

### PR-02 — Composer + Precedence
- tasks: #760 #761 #762
- checkpoint: #763
- output: contenteditable composer + slash/mention arbitration + send↔pause + reconnect zone

### PR-03 — Node Isolation + Continuity
- tasks: #764 #765 #766
- checkpoint: #767
- output: strict per-node state ownership and dispatch isolation

### PR-04 — Failure + Motion + A11y
- tasks: #768 #769 #770
- checkpoint: #771
- output: severity/copy map, motion.dev contract, keyboard/live-region guarantees

### PR-05 — Runtime Integration (Governed)
- tasks: #772 #773 #774
- checkpoint: #775
- hard precondition: #754 done (which requires #726-#732 done)

### PR-06 — Regression + Release Docs
- tasks: #776 #777
- checkpoint: #778
- output: full regression evidence + operator runbook/handoff

## Merge Guardrails

- PR-05 must not merge before governance unlock.
- Every PR must include rollback note + evidence links.
- If a checkpoint task is not done, PR is not merge-ready.

## Rollback Anchors

- Runtime behavior rollback anchor: P0 hard-cut evidence and V2-only confirmation
- UX rollback anchor: canonical artifact parity
- Operational rollback anchor: disruption/replay evidence and JSONL/metrics visibility
