# Agent Task Log Persistence — Spec Bundle

This directory now contains the **authoritative design bundle** for persisted log archival + lazy hydration.

If you are implementing, reviewing, or validating this feature, read in this order:

1. `persisted-log-archive-hydration-spec.md`
2. `persisted-log-archive-hydration-implementation-details.md`
3. `persisted-log-archive-hydration-task-plan.md`
4. `persisted-log-archive-hydration-acceptance-matrix.md`
5. `persisted-log-archive-hydration-risk-register.md`
6. `adr/ADR-001-nats-ack-durability-authority.md`
7. `adr/ADR-002-local-archive-backing-persistence.md`
8. `adr/ADR-003-newest-first-hydration-window.md`

Cross-reference source research:

- `../../persisted-logs-research.md`

---

## Bundle Contents

### 1) `persisted-log-archive-hydration-spec.md`

Primary architecture + contract doc.

Contains:

- locked decisions
- data/schema contracts
- service APIs
- atom/stx integration
- UI controller semantics
- failure and recovery semantics
- observability contract
- strict acceptance gates

Use when:

- implementing services
- adding atom state
- wiring controller hydration behavior
- reviewing architecture alignment

---

### 2) `persisted-log-archive-hydration-implementation-details.md`

Effect-docs-locked implementation contract.

Contains:

- exact Effect API signatures in use
- concrete service method shapes
- file-level coding blueprint
- lane-by-lane execution semantics
- merge/redaction algorithm locks

Use when:

- coding service internals
- wiring atom/controller boundaries
- reviewing API-level correctness before merge

---

### 3) `persisted-log-archive-hydration-task-plan.md`

Execution-grade work plan.

Contains:

- EDIN/WBS decomposition
- dependency graph
- thin-slice implementation plan
- test strategy
- commit strategy
- execution checklists

Use when:

- scheduling implementation
- assigning work slices
- tracking completion and evidence

---

### 4) `persisted-log-archive-hydration-acceptance-matrix.md`

Strict gate matrix with explicit verification rows.

Contains:

- gate IDs
- assertions
- test/evidence mapping
- pass/fail criteria

Use when:

- preparing closure evidence
- doing release signoff
- running regression reviews

---

### 5) `persisted-log-archive-hydration-risk-register.md`

Operational and technical risk ledger.

Contains:

- risk catalog
- probability/impact scoring
- mitigation playbooks
- fallback triggers

Use when:

- planning rollouts
- evaluating degraded modes
- preparing incident responses

---

### 6) `adr/*.md`

Decision records that lock the non-negotiables.

Current ADR set:

- `adr/ADR-001-nats-ack-durability-authority.md`
- `adr/ADR-002-local-archive-backing-persistence.md`
- `adr/ADR-003-newest-first-hydration-window.md`

Use when:

- validating whether a code change violates a locked decision
- understanding why alternatives were rejected
- auditing rollout/regression decisions

---

## Locked Direction (Summary)

- NATS JetStream is durability authority
- local archive writes are **ack-gated**
- hot buffer limits remain unchanged:
  - `1000/task`
  - `64 task buffers`
  - `15m idle TTL`
- spill cadence: every `100` entries
- hydration: newest-first anchor with `±500` window
- hydration cache TTL: `5m`
- quota strategy: evict oldest chunks and continue
- dedupe identity: `id+timestamp`
- local redaction for sensitive metadata/payload fields

---

## Governance Notes

- This bundle is intended to be substantial and implementation-authoritative.
- API-level behavior is locked against Effect docs in `persisted-log-archive-hydration-implementation-details.md`.
- Any future decision drift should be captured by appending sections, not silent edits.
- If a decision changes, update:
  - spec locked decisions,
  - task plan dependencies,
  - acceptance matrix gate rows,
  - risk register mitigations.

---

## Related Runtime Surfaces

- Atoms: `src/lib/agents/tasks/atoms/surface.ts`
- Services: `src/lib/agents/tasks/services/`
- Controller hook: `src/lib/agents/tasks/views/use-inline-task-log-controller.ts`
- Tail controls: `src/lib/agents/tasks/views/log-tail-controls.tsx`
- View styling: `src/lib/agents/tasks/views/log-view.css`

---

## Validation Baseline

At minimum before closure:

- targeted vitest suites pass
- `bunx tsc --noEmit --pretty false` passes
- strict gate evidence rows are fully mapped

---

End of bundle README.
