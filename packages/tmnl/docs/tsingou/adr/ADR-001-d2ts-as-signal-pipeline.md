# ADR-001: d2ts as Signal Pipeline Core

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: Questionnaire `tsingou-d2ts-signal-pipeline` (ID: `nhWpfw_yDez8YZtSraF3R`)

---

## Context

nw_wrld uses a hand-rolled imperative signal pipeline: `InputManager.broadcast()` → IPC → `inputListener` → `channelDispatch` → `methodExecutor`. This is point-to-point, non-composable, and cannot express joins, aggregations, or windowed computations.

Tsingou needs to support arbitrary signal sources (SIGINT/OSINT feeds) with cross-source correlation, temporal windowing, and incremental computation — capabilities that require a fundamentally different engine.

## Decision

**d2ts (full, not d2mini) replaces the entire signal pipeline.** Effectual d2ts IS the pipeline — sources feed D2 graph inputs, operators transform, outputs drive rendering layers.

### Specific Choices

| Question | Decision | Rationale |
|----------|----------|-----------|
| d2ts role | Replace entire signal pipeline | Need joins, aggregates, incremental — not just event routing |
| d2ts vs d2mini | d2ts full | Multi-dimensional versioning `[tick, source]` + persistence via NATS/SQLite |
| Version semantics | Multi-dimensional `[tick, source_seq]` | Real-time needs both temporal and source-causal ordering |
| MultiSet semantics | Event accumulation (+1 only) | Signals insert; -1 only for explicit retractions |
| Graph topology | Tiered: ingest → derived | Ingest normalizes; derived computes joins/aggregates |
| Effect bridge | D2 operators as Effect.Stream combinators | Deep integration — d2ts operators compose with Effect streams |
| Output path | `output()` → `Effect.Queue` → consumer fiber → `Atom.set()` | Backpressure-aware with atom state for React |
| Custom operators | `@tmnl/tsingou-operators` library | `window(duration)`, `throttle(rate)`, `schema-validate` |
| Package name | `@tmnl/tsingou-flow` | Houses d2ts graph + Effect bridge + schemas + operators |

## Consequences

### Positive
- Incremental computation — only processes changes, not full dataset
- Cross-source joins — d2ts `join` maintains state from both sides
- Temporal windowing — custom `window(duration)` operator
- Resumable pipelines — d2ts persistence via version frontier tracking
- Type-safe — Effect.Schema at operator boundaries

### Negative
- Learning curve — d2ts MultiSet semantics are unfamiliar
- Complexity — tiered graph topology requires careful version management
- d2ts is young — `@electric-sql/d2ts` may have breaking changes

### Risks
- d2ts performance at high signal rates (>10k/sec) is untested
- Multi-dimensional version comparison has O(n) frontier management cost

## Implementation

- **Package**: `src/lib/tsingou-flow/` (40 files, ~5,800 LOC)
- **Graph stubs**: Pure-function pipelines running now; D2 graph slots ready for `@electric-sql/d2ts`
- **Version helpers**: `graph/version.ts` — 2D `[tick, source_seq]`, partial order comparison
- **MultiSet helpers**: `graph/multiset-helpers.ts` — `fromBatch()`, `fromSignal()`, `merge()`, `activeEntries()`
- **Operators**: `operators/window.ts`, `operators/throttle.ts`, `operators/schema-validate.ts`
