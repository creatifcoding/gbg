# F321-E4 Regression Matrix

Row ID: **F321-E4**

## Commands executed

```bash
bunx tsc --noEmit --pretty false
bunx vitest run src/lib/agents/tasks/services/__tests__/MockTransportService.test.ts src/lib/agents/tasks/views/__tests__/inline-task-log-view.compound.test.tsx src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx src/lib/agents/tasks/views/__tests__/inline-task-log-view.integration.test.tsx src/lib/agents/tasks/views/__tests__/log-entry-detail.compound.test.tsx src/lib/agents/tasks/views/__tests__/log-entry-row.compound.test.tsx src/lib/agents/tasks/atoms/__tests__/surface.querydsl.test.ts
```

## Results
- Typecheck: PASS
- Aggregate regression suite: **14/14 PASS**
- Mock transport continuity + deterministic seed tests: PASS (2 tests)
- InlineTaskLogView compound slot test: PASS (1 test)
- Tail semantics tests (scroll-up pause, threshold boundary return, jump-to-latest): PASS (2 tests)
- Integration smoke (stream -> filter -> row expansion + typed dork chips): PASS (1 test)
- LogEntryDetail compound tests: PASS (2 tests)
- LogEntryRow compound tests: PASS (2 tests)
- QueryDSL bridge/mapping tests (operator-only + invalid-regex safety): PASS (4 tests)

## Covered regressions
- stream continuity beyond template length
- deterministic stream generation for test reproducibility
- tail/inspect state transitions
- unread lifecycle clear-on-resume behavior
- query/filter path stability in live stream context
- row expansion detail rendering after filtered stream updates
- typed dork chip extraction from input while preserving query semantics
- QueryDSL mapping correctness from AssembledLogEntry -> SearchableItem
- invalid regex handling remains deterministic no-op (no crash)
- compound-slot APIs remain backward compatible for InlineTaskLogView and LogEntryRow
