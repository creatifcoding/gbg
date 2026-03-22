# F332 Observability Evidence (AH1-T16 / AH1-T17)

Date: 2026-02-18  
Owner: Val

## Scope

Close observability gate rows H-01..H-08 for persisted log archive + hydration.

## Evidence Map

### H-01 / H-02 — Durability spans

- Source: `src/lib/agents/tasks/services/AgentTaskLogDurabilityService.ts`
  - `Effect.withSpan('AgentTask.LogDurability.publish', ...)`
  - `Effect.withSpan('AgentTask.LogDurability.ack', ...)`
- Exercised by:
  - `src/lib/agents/tasks/services/__tests__/AgentTaskLogDurabilityService.test.ts`
  - test: `ensures stream once and publishes acknowledgements`
  - test: `publishes with deterministic subject and msgId derived from entry id`

### H-03 / H-04 — Archive spans

- Source: `src/lib/agents/tasks/services/LogArchiveStoreService.ts`
  - `Effect.withSpan('AgentTask.LogArchive.spill', ...)` in `writeChunk`
  - `Effect.withSpan('AgentTask.LogArchive.evict', ...)` in `evictOldestChunk`
- Exercised by:
  - `src/lib/agents/tasks/services/__tests__/LogArchiveStoreService.test.ts`
  - test: `writes sequential chunks and reads deterministic inclusive ranges`
  - test: `evicts the oldest chunk and updates manifest counters`

### H-05 / H-06 — Hydration spans

- Source: `src/lib/agents/tasks/services/LogHydrationService.ts`
  - `Effect.withSpan('AgentTask.LogHydration.plan', ...)`
  - `Effect.withSpan('AgentTask.LogHydration.fetch', ...)`
- Exercised by:
  - `src/lib/agents/tasks/services/__tests__/LogHydrationService.test.ts`
  - test: `plans newest-first windows with bounded offsets`
  - test: `hydrates from archive and reuses in-memory cache for repeat window`
  - test: `falls back to nats source when archive is missing or chunk range has gaps`

### H-07 — Hydration source counters

- Source: `src/lib/agents/tasks/atoms/surface.ts`
  - `hydrateWindowTrigger` increments:
    - `hydrationRequestCountFamily`
    - `hydrationCacheHitCountFamily`
    - `hydrationArchiveHitCountFamily`
    - `hydrationNatsFallbackHitCountFamily`
    - `hydrationErrorCountFamily`
  - `hydrationMetricsFamily` publishes aggregated counters.

### H-08 — Ack-latency histogram

- Source: `src/lib/agents/tasks/atoms/surface.ts`
  - `recordDurabilityAckLatency(...)`
  - outbox `onAttemptSuccess` wiring updates `durabilityAckMetricsFamily` from durability receipt latency.
- Assertions:
  - `src/lib/agents/tasks/atoms/__tests__/surface.observability.test.ts`
  - test: `records ack latency samples with min/max/avg tracking`
  - test: `places samples into the expected histogram buckets`
  - test: `clamps negative latency values to zero`

## Validation Snapshot

Executed:

- `bunx vitest run src/lib/agents/tasks/atoms/__tests__/surface.observability.test.ts src/lib/agents/tasks/services/__tests__/LogArchiveStoreService.test.ts src/lib/agents/tasks/views/__tests__/inline-task-log-view.controller.test.tsx`
- `bunx tsc --noEmit --pretty false`

Result:

- vitest: **13/13 passing**
- tsc: **clean**

## Commit References

- `72a9e5c` — observability metrics + archive span aliases + assertions.
- `c6d0efc` — deterministic hot/hydrated merge integration (upstream dependency proof).
