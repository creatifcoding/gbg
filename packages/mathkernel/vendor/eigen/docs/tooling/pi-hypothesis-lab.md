# Pi Hypothesis Lab

> Decision evaluation framework for structured hypothesis testing with Eisenhower co-equal verdicts, trust gates, replay auditing, and human ratification.

**Source:** `src/lib/hypothesis-lab/v1/`, `.pi/agents/`
**Public Alias:** `src/lib/eisenhower/` (re-exports from hypothesis-lab)
**EDIN Phase:** IMPLEMENT
**Last Updated:** 2026-02-09

---

## Overview

The Hypothesis Lab is a decision-quality system that evaluates competing hypotheses (A vs B) through a structured pipeline: seed hypotheses, compile a hook execution plan, collect evidence, draft a decision matrix, evaluate trust gates, ratify the verdict, and replay-audit the entire run for drift.

The system enforces **Eisenhower co-equal decision architecture**: the weighted aggregate score and the Eisenhower quadrant classification are treated as co-equal signals. When they disagree (conflict), the verdict is forced to `Tie` and requires explicit human acknowledgement before proceeding.

---

## Architecture

### Runtime Layer

```
HypothesisLabLive = Layer.mergeAll(
  SqliteLedgerStore.Default,    -- Append-only audit persistence
  JsonLedgerExport.Default,     -- JSON/JSONL export
  HookRegistryService.Default,  -- Hook resolution + versioning
  HookRuntimeService.Default,   -- Stage/event hook execution
  DecisionMatrixService.Default,-- Matrix drafting + trust gates
  AuditLedgerService.Default,   -- Ledger append/read facade
  ReplayService.Default         -- Replay drift classification
)
```

The runtime is exposed as an `Atom.runtime` for reactive integration:

```typescript
export const hypothesisLabRuntimeAtom = Atom.runtime(HypothesisLabLive)
```

### Module Structure

```
src/lib/hypothesis-lab/v1/
  schemas.ts              -- 30+ Effect Schema types (core + audit events)
  errors.ts               -- Typed error classes
  runtime.ts              -- Layer composition + runtime atom
  atoms/
    state.ts              -- Reactive state atoms
    ops.ts                -- Operation atoms
    index.ts              -- Barrel
  builder/
    HookPlanBuilder.ts    -- Hook plan compilation
    HookPlanCompiledSchema.ts -- Compiled plan schema
    index.ts              -- Barrel
  persistence/
    sqlite.ts             -- SQLite-backed append-only ledger
    sqliteLedgerConfig.ts -- SQLite config
    jsonExport.ts         -- JSON/JSONL export
    index.ts              -- Barrel
  services/
    HookRegistryService.ts    -- Hook resolution
    HookRuntimeService.ts     -- Hook execution engine
    DecisionMatrixService.ts  -- Matrix drafting + Eisenhower
    AuditLedgerService.ts     -- Ledger facade
    ReplayService.ts          -- Replay orchestration
    ReplayDriftClassifier.ts  -- Drift detection + classification
    deterministicMerge.ts     -- Parallel-safe deterministic merge
    index.ts                  -- Barrel
```

---

## Run Lifecycle

```
idle -> draft -> validating -> ratification_pending -> finalized
                                                    -> failed
```

| Status | Description |
|--------|-------------|
| `idle` | Initial state |
| `draft` | Hypotheses seeded, hook plan compiled |
| `validating` | Hooks executing, evidence collecting, matrix drafting |
| `ratification_pending` | Verdict drafted, awaiting human ratification |
| `finalized` | Verdict ratified, run complete |
| `failed` | Trust gate failure or unrecoverable error |

---

## Decision Matrix

The `DecisionMatrixService.draftFromEvidence()` method:

1. Validates both hypotheses A and B exist
2. Computes adaptive weights based on evidence confidence:
   - `evidenceWeight = clamp(avgConfidence, 0.25, 0.75)`
   - `clarityWeight = 1 - evidenceWeight`
3. Scores two criteria: `statement_clarity_proxy` and `evidence_confidence_projection`
4. Computes aggregate winner (weighted sum comparison)
5. Classifies Eisenhower quadrants:
   - `>= 0.75` -> Do
   - `>= 0.55` -> Schedule
   - `>= 0.35` -> Delegate
   - `< 0.35` -> Eliminate
6. Detects conflict (aggregate and Eisenhower disagree)
7. If conflict: winner = `Tie`, requires explicit acknowledgement

### Eisenhower Co-Equal Contract

The aggregate score and Eisenhower classification are **co-equal**:
- If both agree -> winner is declared
- If they disagree -> `hasConflict = true`, `winner = Tie`
- Conflict requires human acknowledgement in Phase 1 ratification
- No hidden heuristics; every path is auditable

---

## Trust Gates

Six gates evaluated per matrix draft:

| Gate | Type | Description |
|------|------|-------------|
| `required_rationale` | Hard | Every criterion must include rationale |
| `required_citations` | Hard | Every criterion must cite evidence |
| `required_provenance` | Hard | Model/prompt pins must be present |
| `model_prompt_pinning` | Hard | Pins must use `pin:*` format |
| `dual_run_consistency` | Soft | Awaits Phase 1 ratification |
| `human_signoff` | Soft | Awaits Phase 2 human signoff |

Hard gates fail the matrix draft immediately. Soft gates remain `pending` until ratification.

---

## Ratification Protocol

Two-phase ratification:

| Phase | Action | Required |
|-------|--------|----------|
| `phase1_pending` | Draft created, awaiting acknowledgement | Conflict acknowledgement (if any) |
| `phase1_acknowledged` | Conflict acknowledged, dual-run confirmed | Dual-run consistency check |
| `phase2_final` | Human signs off on verdict | Human signoff |

---

## Replay Audit System

The `ReplayDriftClassifier` enforces replay integrity across two channels:

### Channel Classification

| Channel | Event Types | Tolerance |
|---------|-------------|-----------|
| **Strict** | RunCreated, HypothesisSeeded, HookPlanCompiledEvent, HookInvoked, MatrixDrafted, VerdictRatified | Zero tolerance -- mismatches fail replay |
| **Tolerant** | ReplayEvaluated | Envelope-based tolerance |

### Drift Categories

| Category | Severity | Description |
|----------|----------|-------------|
| `strict_mismatch` | Critical | Value mismatch in strict channel |
| `strict_missing_event` | Critical | Required event missing from trace |
| `tolerant_drift_numeric` | Medium | Numeric value outside epsilon |
| `tolerant_drift_temporal` | Medium | Timestamp outside drift window |
| `schema_drift` | High | Event fails schema decode |
| `config_drift` | High | Multiple planIds or matrixIds in single run |

### Tolerance Envelopes

```typescript
numericAbsEpsilon: 1e-6           // Absolute numeric tolerance
durationRelativeTolerance: 0.05   // 5% relative for duration fields
timestampDriftWindowMs: 250       // 250ms timestamp jitter allowed
tolerantHighCountThreshold: 5     // Promote to high severity
tolerantHighFrequencyThreshold: 0.3 // 30% of events drifting
```

### Escalation Policy

| Condition | Status | Severity | Action |
|-----------|--------|----------|--------|
| Any strict drift | `failed` | Critical | Block finalize, resolve first |
| Schema/config drift | `failed` | High | Rebuild with matching schema |
| High-frequency tolerant | `passed_with_warnings` | High | Manual replay audit |
| Multiple tolerant | `passed_with_warnings` | Medium | Review envelope policy |
| Single tolerant | `passed_with_warnings` | Low | Monitor only |
| Clean | `passed` | Low | No action |

---

## Audit Event Catalog (9 events)

| Event | When |
|-------|------|
| `RunCreated` | New hypothesis run started |
| `HypothesisSeeded` | Hypothesis A or B seeded |
| `HookPlanCompiledEvent` | Hook execution plan compiled |
| `HookInvoked` | Individual hook step executed |
| `MatrixDrafted` | Decision matrix generated |
| `TrustGateEvaluated` | Trust gate checked |
| `RatificationPhaseAdvanced` | Phase transition in ratification |
| `VerdictRatified` | Final verdict ratified |
| `ReplayEvaluated` | Replay audit completed |

All events are `Schema.TaggedStruct` with `_tag` discriminant. The union type `AuditEvent` covers all 9.

---

## Hook Execution Engine

### Compiled Plan Structure

```
HookPlanCompiled
  planId: string
  schemaVersion: string
  builderVersion: string
  stages: HookStageSpec[]        -- Ordered stage sequence
    name: string
    mode: 'sequential' | 'parallel-safe'
    sequence: number
    entries: (HookStepSpec | HookGroupSpec)[]
  events: HookEventSpec[]        -- Event-triggered hooks
  resolverSnapshot: ResolverSnapshotEntry[]
  integrity: { contentHash: string }
```

### Execution Modes

- **Sequential stages**: Steps execute in order, each awaiting the previous
- **Parallel-safe stages**: Steps in a `HookGroupSpec` run concurrently with deterministic merge
- **Per-step error policies**: `halt` (stop run), `continue` (skip step), `quarantine` (isolate step output)

### Deterministic Merge

Parallel hook outputs are merged with a frozen merge policy:
- Runtime completion order does not affect output
- Merge policy is captured at plan compilation time
- Tie-break decisions are recorded as audit events

---

## Persistence

### SQLite Ledger

- Append-only semantics
- Schema-validated payload writes
- Stable ordering key for replay and export
- Typed errors (`LedgerPersistenceError`) for persistence failures

### Export Formats

- **JSON**: Full event array as `application/json`
- **JSONL**: One event per line for streaming consumption

---

## Pi Agent Roster

11 agents support the Hypothesis Lab system:

### Core Agents (6 specialized)

| Agent | Model | Mission |
|-------|-------|---------|
| `eisenhower-architect` | Opus 4.6 | Enforces Eisenhower co-equal decision architecture. Zero drift on weighted + quadrant logic. |
| `matrix-judge` | Opus 4.6 | Implements trust gates, dual-run checks, and verdict drafting with adaptive weight policy. |
| `replay-auditor` | Opus 4.6 | Strict/tolerant replay classification, drift detection, and escalation policy enforcement. |
| `hook-orchestrator` | Opus 4.6 | Hook runtime determinism -- stage/event execution, parallel-safe merge, per-step error policies. |
| `sqlite-ledger` | Opus 4.6 | SQLite-backed append-only persistence with schema-validated writes and stable ordering. |
| `pi-extension-wirer` | Opus 4.6 | Exposes Hypothesis Lab lifecycle through Pi extension tools/commands. |

### General-Purpose Agents (5)

| Agent | Model | Role |
|-------|-------|------|
| `planner` | Sonnet 4.5 | Read-only planning specialist. Produces implementation plans from scout findings. |
| `reviewer` | Opus 4.6 | Read-only code review. Checks bugs, security issues, code smells with file:line citations. |
| `scout` | Haiku 4.5 | Fast codebase recon. Returns compressed context for handoff to other agents. |
| `worker` | Sonnet 4.5 | General-purpose implementation. Full capabilities in isolated context. |
| `codex53-worker` | Codex 5.3 | Read-only architecture analyst. Findings, evidence, risks, recommendations. |

### Agent Pipeline

```
scout (recon) -> planner (plan) -> worker (implement) -> reviewer (verify)
```

The 6 specialized agents (eisenhower-architect through pi-extension-wirer) are domain experts that can be invoked for specific Hypothesis Lab subsystems.

---

## Schema Summary

### Core Types (12)

`HypothesisRun`, `Hypothesis`, `HookStepSpec`, `HookGroupSpec`, `HookStageSpec`, `HookEventSpec`, `HookPlanCompiled`, `EvidenceRecord`, `MatrixCriterion`, `DecisionMatrix`, `Verdict`, `ReplayReport`

### Supporting Types (7)

`HookStepPolicy`, `CriterionProvenance`, `AdaptiveWeightPolicySnapshot`, `ResolverSnapshotEntry`, `HookPlanIntegrity`, `DriftRecord`, `HookStageEntry` (union)

### Enums (10)

`RunStatus`, `HypothesisLabel`, `StageMode`, `HookOnErrorPolicy`, `ReplayStatus`, `DriftCategory`, `EisenhowerQuadrant`, `Winner`, `TrustGate`, `TrustGateStatus`, `RatificationPhase`

### Input Types (2)

`CreateRunInput`, `RatifyVerdictInput`

### Audit Events (9)

`RunCreated`, `HypothesisSeeded`, `HookPlanCompiledEvent`, `HookInvoked`, `MatrixDrafted`, `TrustGateEvaluated`, `RatificationPhaseAdvanced`, `VerdictRatified`, `ReplayEvaluated`

**Total: 40 Schema types**

---

## Key Design Principles

1. **Co-equal signals**: Aggregate score and Eisenhower quadrant are never subordinated to each other
2. **No hidden heuristics**: Every decision path is auditable through trust gates and audit events
3. **Immutable audit trail**: Append-only ledger with schema-validated writes
4. **Replay integrity**: Two-channel (strict/tolerant) classification with explicit tolerance envelopes
5. **Deterministic execution**: Parallel hook outputs merged deterministically regardless of completion order
6. **Human-in-the-loop**: Two-phase ratification requires explicit conflict acknowledgement and human signoff
7. **Effect-native**: All services use `Effect.Service`, all types use `Schema.TaggedStruct`, persistence uses `@effect/sql`
