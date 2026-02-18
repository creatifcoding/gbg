# F323 Context Overhead + Bounded Retention Math

Date: 2026-02-17
Owner: Val

## Objective

Quantify memory risk for many concurrent task logs and define deterministic retention guardrails for `AgentTaskLogAtomSurface`.

## Baseline observations

### Serialized line size (mock stream sample)

Sample command (500 entries):

```bash
bun -e "...MockTransportServiceCustom...Stream.take(500)..."
```

Observed:
- avg: **311.56 B**
- min: 294 B
- p95: 368 B
- max: 370 B

This is transport line size only. In-memory `AssembledLogEntry` is larger due to decoded object graph, derived fields, and JS runtime overhead.

### Planning envelope for in-memory entries

Use **1.5–2.5 KB / entry** as a practical sizing envelope for capacity planning.

## Growth model

Let:
- `T` = retained task buffers
- `E_i` = retained entries in task buffer `i`
- `M_entry` = memory per entry (1.5–2.5 KB)

Then:

```text
M_total ≈ T * M_task_fixed + Σ(E_i * M_entry)
```

`M_task_fixed` (atom/context metadata) is secondary compared to log entry payload volume.

## Unbounded risk example

At ~5 entries/sec (continuous stream):

```text
18,000 entries / task / hour
```

Memory per task-hour:
- low: `18,000 * 1.5 KB` ≈ **27 MB**
- high: `18,000 * 2.5 KB` ≈ **45 MB**

Unbounded retention across many tasks is not acceptable.

## Guardrails (implemented)

Applied in `src/lib/agents/tasks/atoms/surface.ts`:

1. **Per-task ring cap**: `maxEntriesPerTask = 1000`
2. **Task-buffer LRU cap**: `maxTaskBuffers = 64`
3. **Idle TTL eviction**: `idleTtlMs = 15m`

Policy object:

```ts
DEFAULT_LOG_RETENTION_POLICY = {
  maxEntriesPerTask: 1000,
  maxTaskBuffers: 64,
  idleTtlMs: 15 * 60 * 1000,
}
```

## Deterministic helper seam

Exported helpers for policy determinism:
- `applyPerTaskEntryCap(entries, maxEntriesPerTask)`
- `touchLruOrder(currentOrder, taskId)`
- `selectEvictedTaskIds(lruOrder, lastSeenEpochMs, nowEpochMs, activeTaskId, policy)`

## Test evidence

`src/lib/agents/tasks/atoms/__tests__/surface.retention.test.ts`
- ring cap keeps tail window
- LRU ordering uniqueness and bump behavior
- TTL + overflow eviction selection (active task protected)

Validation run (targeted):
- retention + querydsl + log-view compounds/integration/tail + mock transport = **18/18 pass**
- `bunx tsc --noEmit` pass

## Notes

- Context/provider overhead from compounds is not the dominant memory risk.
- Primary risk is unbounded entry retention.
- Optional future enhancement: old-segment compaction for historical summaries.

## Post-split controller evidence

Controller extraction and regression envelope proofs are tracked in:

- `docs/specifications/F323-controller-boundary-and-regression-evidence.md`

This captures the locked seam (`useInlineTaskLogController` + explicit context provider boundary)
and test coverage for task-switch reset, remount continuity, and high-volume bounded retention behavior.
