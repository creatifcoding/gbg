# Persisted Log Archive + Hydration — Detailed Task Plan (EDIN + WBS)

Status: Draft v2 (execution-grade)  
Parent spec: `./persisted-log-archive-hydration-spec.md`  
Implementation contract: `./persisted-log-archive-hydration-implementation-details.md`  
Execution policy: thin slices, reversible commits, evidence-first closure

---

## Table of Contents

1. [Execution Model](#1-execution-model)
2. [Work Breakdown Structure](#2-work-breakdown-structure)
3. [Dependency Graph](#3-dependency-graph)
4. [Phase E — Experiment](#4-phase-e--experiment)
5. [Phase D — Design](#5-phase-d--design)
6. [Phase I — Implement](#6-phase-i--implement)
7. [Phase N — Negotiate](#7-phase-n--negotiate)
8. [Test and Validation Strategy](#8-test-and-validation-strategy)
9. [Commit Strategy (Micro-Slice)](#9-commit-strategy-micro-slice)
10. [Risk Register and Mitigations](#10-risk-register-and-mitigations)
11. [Definition of Done](#11-definition-of-done)
12. [Execution Checklist](#12-execution-checklist)
13. [Evidence Artifact Templates](#13-evidence-artifact-templates)

---

## 1) Execution Model

We execute this as an EDIN cycle, each phase producing hard artifacts:

- **E (Experiment)**: reduce uncertainty with measurable probes.
- **D (Design)**: lock contracts and seams.
- **I (Implement)**: deliver thin, testable slices.
- **N (Negotiate)**: evaluate outcomes, accept/reject, and codify follow-ons.

### Rules

1. No broad refactors hidden inside feature slices.
2. No schema-less persistence payloads.
3. No UI behavior drift for tail/inspect/unread semantics.
4. No archive writes before JetStream durability ack.
5. No unbounded caches.

---

## 2) Work Breakdown Structure

### Epic

- **EPIC-AH1**: Persisted Archive + Lazy Hydration for Agent Task Logs

### Features

- **F-AH1**: Durability lane (NATS ack authority)
- **F-AH2**: Local archive lane (chunked + quota-aware)
- **F-AH3**: Hydration lane (window planner + cache + fallback)
- **F-AH4**: UI/controller integration
- **F-AH5**: Observability + evidence gates

### Tasks (Detailed)

| Task ID | Feature | Title | Output |
|---|---|---|---|
| AH1-T01 | F-AH1 | Durability probe harness | latency + retry evidence |
| AH1-T02 | F-AH2 | localStorage quota probe | eviction behavior evidence |
| AH1-T03 | F-AH3 | Hydration trigger probe | threshold behavior evidence |
| AH1-T04 | F-AH1 | Define durability schemas | schema file + tests |
| AH1-T05 | F-AH2 | Define archive schemas | schema file + tests |
| AH1-T06 | F-AH3 | Define hydration schemas | schema file + tests |
| AH1-T07 | F-AH1 | Implement `AgentTaskLogDurabilityService` | service + layer + tests |
| AH1-T08 | F-AH2 | Implement `LogArchiveStoreService` | service + layer + tests |
| AH1-T09 | F-AH3 | Implement `LogHydrationService` | service + layer + tests |
| AH1-T10 | F-AH1/F-AH2 | Integrate ack-gated spill | atom/service wiring |
| AH1-T11 | F-AH3 | Add hydration cache atoms | atoms + TTL tests |
| AH1-T12 | F-AH4 | Controller hydration trigger | hook tests |
| AH1-T13 | F-AH4 | Loader row + status states | view tests |
| AH1-T14 | F-AH3/F-AH4 | Merge/dedupe integration | deterministic merge tests |
| AH1-T15 | F-AH2 | Redaction transform | security tests |
| AH1-T16 | F-AH5 | Spans + metrics wiring | trace assertions |
| AH1-T17 | F-AH5 | Strict gate evidence docs | docs/specifications artifacts |
| AH1-T18 | F-AH5 | Final validation run | tsc + vitest logs |

---

## 3) Dependency Graph

```text
AH1-T01  ─┐
AH1-T02  ─┼──> AH1-T04/05/06 ──> AH1-T07/08/09 ──> AH1-T10 ──> AH1-T14 ──> AH1-T17 ──> AH1-T18
AH1-T03  ─┘                           │              │           │
                                      │              └──> AH1-T11 ──> AH1-T12 ──> AH1-T13 ──┘
                                      └────────────────────────────────> AH1-T15 ──> AH1-T17

AH1-T16 depends on AH1-T07/08/09/10/12/13/14
```

Critical path:

`T04/05/06 -> T07/08/09 -> T10 -> T14 -> T17 -> T18`

---

## 4) Phase E — Experiment

### AH1-T01: Durability Handshake Probe

**Objective**  
Measure JetStream publish+ack envelope under normal and degraded conditions.

**Inputs**
- current NATS transport wiring
- representative log throughput patterns

**Procedure**
1. emit controlled stream of entries (`n=1k`, `n=10k`)
2. record publish start -> ack receive latency
3. inject transient broker disconnect/reconnect
4. verify retry lane behavior

**Outputs**
- p50/p95/p99 ack latency
- retry counts
- drop/dup observations

**Definition of Done**
- evidence written with timestamps and scenario labels

---

### AH1-T02: localStorage Quota Probe

**Objective**  
Validate oldest-chunk eviction behavior when quota is hit.

**Procedure**
1. force archive writes until quota exception
2. run eviction path
3. retry write
4. validate manifest and chunk continuity

**Expected**
- no process crash
- no hot lane corruption
- archive degrades gracefully if recovery fails

---

### AH1-T03: Hydration Trigger Probe

**Objective**  
Confirm top-threshold prefetch behavior without tail regressions.

**Procedure**
1. put view in inspect mode
2. scroll near top threshold
3. verify hydration trigger exactly once per coalesced window
4. ensure jump-to-latest restores tail semantics

---

## 5) Phase D — Design

### AH1-T04/T05/T06: Schema Contract Pack

**Files to add**
- `src/lib/agents/tasks/schemas/log-archive.ts`
- `src/lib/agents/tasks/schemas/durability-receipt.ts`
- `src/lib/agents/tasks/schemas/hydration-window.ts`

**Requirements**
- tagged structs/classes where appropriate
- branded IDs for task/chunk/offset
- decode/encode tests

**Deliverable**
- compile-clean schema pack + tests

---

### D2: Service Contracts

**Files to add**
- `src/lib/agents/tasks/services/AgentTaskLogDurabilityService.ts`
- `src/lib/agents/tasks/services/LogArchiveStoreService.ts`
- `src/lib/agents/tasks/services/LogHydrationService.ts`

**Contract stance**
- explicit error channels
- no hidden mutable UI state
- layer-friendly constructors

---

### D3: Atom Surface Design

**Files to modify**
- `src/lib/agents/tasks/atoms/surface.ts`
- optionally `src/lib/agents/tasks/atoms/index.ts` exports

**New state primitives**
- durability pending/error atoms
- archive manifest snapshot atom
- hydration cache + ttl metadata atoms
- hydration loading/error atoms

---

## 6) Phase I — Implement

## Slice I1 — AH1-T07 `AgentTaskLogDurabilityService`

**Scope**
- publish to JetStream, await ack, emit receipt

**Do not include**
- local archive logic
- hydration logic

**Tests**
- success path
- transient retry
- timeout failure classification

**Acceptance for slice**
- deterministic receipt shape
- span coverage present

---

## Slice I2 — AH1-T08 `LogArchiveStoreService`

**Scope**
- manifest/chunk keying
- read/write codecs
- quota eviction helper

**Tests**
- manifest init/update
- sequential chunk append
- oldest eviction behavior
- decode failure recovery

---

## Slice I3 — AH1-T09 `LogHydrationService`

**Scope**
- plan window (`±500`, newest-first)
- hydrate from cache/local/fallback
- return normalized slice

**Tests**
- planner boundary clamp
- cache hit path
- cache miss local hit
- local gap fallback path

---

## Slice I4 — AH1-T10 Ack-Gated Spill Wiring

**Scope**
- integrate durability receipt into spill eligibility
- ensure pre-ack entries cannot spill

**Files**
- `surface.ts`
- service composition layer

**Tests**
- pre-ack no-spill assertion
- post-ack spill checkpoint assertion

---

## Slice I5 — AH1-T11 Hydration Cache Atoms

**Scope**
- TTL cache structure in atoms
- stale eviction on touch

**Tests**
- ttl expiry
- per-task cap
- lru within task

---

## Slice I6 — AH1-T12 Controller Trigger

**Scope**
- top-threshold auto hydration trigger
- request coalescing

**Tests**
- trigger only in inspect mode near top
- no duplicate trigger while in-flight

---

## Slice I7 — AH1-T13 Loader UI

**Scope**
- loading indicator row
- error indicator row

**Rules**
- no shared RVN class clobbering
- preserve compact mode readability

**Tests**
- loading state visible and removed
- error state visible and recoverable

---

## Slice I8 — AH1-T14 Merge + Dedupe Integration

**Scope**
- integrate dedupe key `id+timestamp`
- deterministic stable ordering in view model

**Tests**
- overlap from all lanes
- ordering ties deterministic

---

## Slice I9 — AH1-T15 Redaction Integration

**Scope**
- local archive redaction transform
- preserve structure while masking sensitive fields

**Tests**
- key matcher coverage
- nested structure traversal
- no-redaction path when mode disabled

---

## Slice I10 — AH1-T16 Observability

**Scope**
- required spans and counters

**Tests**
- span names emitted
- counters increment on expected paths

---

## 7) Phase N — Negotiate

### AH1-T17 Strict Gate Evidence

Produce evidence docs capturing:

1. correctness
2. durability semantics
3. resource bounds
4. failure semantics
5. schema discipline
6. observability

Recommended location:
- `docs/specifications/` feature-scoped markdown files.

---

### AH1-T18 Final Validation

Run and capture:

- targeted vitest suites
- `bunx tsc --noEmit --pretty false`
- optional smoke scenario logs for hydration scroll interaction

Outcome:
- explicit go/no-go summary

---

## 8) Test and Validation Strategy

### 8.1 Unit Tests

- service behavior per lane
- schema encode/decode
- pure planner/merge/reduction functions

### 8.2 Integration Tests

- atom + service wiring
- controller + hydration trigger
- dedupe across lanes

### 8.3 UX/Behavior Tests

- tail/inspect transitions
- jump-to-latest semantics
- unread count invariants

### 8.4 Negative Tests

- corrupted archive chunk
- quota throw loops
- JetStream timeout/retry exhaustion

### 8.5 Regression Set (must stay green)

- existing `inline-task-log-view.tail.test.tsx`
- existing compound tests for row/detail/filter bar/log view

---

## 9) Commit Strategy (Micro-Slice)

One slice, one commit, one proof.

Suggested commit sequence:

1. `feat(tasks/logs): add archive+durability schema contracts`
2. `feat(tasks/logs): add AgentTaskLogDurabilityService with ack receipts`
3. `feat(tasks/logs): add local archive store service with quota eviction`
4. `feat(tasks/logs): add hydration planner service and cache pathways`
5. `feat(tasks/logs): wire ack-gated spill into atom surface`
6. `feat(tasks/logs): add hydration cache atoms with ttl/lru`
7. `feat(tasks/logs): integrate controller hydration trigger`
8. `feat(tasks/logs): add loader/error hydration indicators`
9. `feat(tasks/logs): enforce id+timestamp dedupe and deterministic merge`
10. `feat(tasks/logs): add local redaction transform for archive writes`
11. `chore(tasks/logs): add observability spans and counters`
12. `test(tasks/logs): add strict gate evidence and validation docs`

---

## 10) Risk Register and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| JetStream ack latency spikes | delayed spill | medium | bounded retries + degraded flag + metrics |
| localStorage quota fragmentation | spill failures | high | oldest-chunk eviction + retry once |
| hydration over-trigger | UI jitter | medium | in-flight coalescing + threshold gating |
| merge nondeterminism | flaky tests/UI churn | medium | stable sort tie-break + deterministic key |
| redaction overreach | debugging loss | low | profile-driven mode + allowlist option |
| redaction underreach | sensitive data leak | medium | key matcher tests + policy review |
| stale cache memory creep | resource drift | medium | TTL + per-task window cap |
| style collisions | UI regressions | medium | scoped class changes only |

---

## 11) Definition of Done

All must be true:

1. Ack-gated spill is enforced.
2. Hot bounds unchanged and verified.
3. Hydration works lazily with cache/local/fallback order.
4. Dedupe key `id+timestamp` proven by tests.
5. Redaction applied only on local archive writes.
6. Tail/inspect semantics unchanged.
7. Strict acceptance evidence published.
8. Typecheck and targeted tests are green.

---

## 12) Execution Checklist

### Preflight

- [ ] branch created
- [ ] target files identified
- [ ] existing tests baseline recorded

### During implementation

- [ ] each slice scoped narrowly
- [ ] tests added with slice
- [ ] no unrelated refactors

### Pre-merge

- [ ] targeted tests green
- [ ] `bunx tsc --noEmit --pretty false` green
- [ ] evidence docs updated
- [ ] rollout notes recorded

---

## 13) Evidence Artifact Templates

### 13.1 Durability Evidence Template

```md
# Durability Evidence

- Scenario: normal publish/ack
- Count: N
- Ack latency: p50 / p95 / p99
- Retry events: X
- Failures: Y
- Result: pass/fail
```

### 13.2 Quota Recovery Evidence Template

```md
# Quota Recovery Evidence

- Trigger method: forced quota exceed
- Initial write result: failure(expected)
- Eviction executed: yes/no
- Retry result: success/failure
- Archive degraded mode entered: yes/no
- Result: pass/fail
```

### 13.3 Hydration UX Evidence Template

```md
# Hydration UX Evidence

- Mode: inspect
- Trigger threshold: value
- Trigger count: expected vs actual
- Loader behavior: pass/fail
- Tail semantics after jump: pass/fail
- Result: pass/fail
```

---

End of task plan.
