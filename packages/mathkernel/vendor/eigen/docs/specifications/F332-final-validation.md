# F332 Final Validation Run (AH1-T18 / task #1227)

Date: 2026-02-18  
Owner: Val

## Command Set

```bash
bunx vitest run \
  src/lib/agents/tasks/atoms/__tests__/surface.hydration-cache.test.ts \
  src/lib/agents/tasks/atoms/__tests__/surface.hydration-merge.test.ts \
  src/lib/agents/tasks/atoms/__tests__/surface.observability.test.ts \
  src/lib/agents/tasks/services/__tests__/AgentTaskLogDurabilityService.test.ts \
  src/lib/agents/tasks/services/__tests__/AgentTaskLogOutboxService.test.ts \
  src/lib/agents/tasks/services/__tests__/LogArchiveStoreService.test.ts \
  src/lib/agents/tasks/services/__tests__/LogHydrationService.test.ts \
  src/lib/agents/tasks/views/__tests__/inline-task-log-view.controller.test.tsx \
  src/lib/agents/tasks/views/__tests__/inline-task-log-view.hydration-status.test.tsx \
  src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx

bunx tsc --noEmit --pretty false
```

## Result Snapshot

- `vitest`: **10 files / 32 tests passed**
- `tsc`: **clean (no output)**

### Notes

- Baseline-browser-mapping age warning remains informational and unrelated to AH1 persisted-log acceptance.
- No regressions observed in tail/inspect behavior, hydration status UI, archive/hydration services, or observability helper assertions.

## Closure Decision

Validation gate for F332 is satisfied for scoped AH1 suites and typecheck.
