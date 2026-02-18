# F318-B2 Scroll Behavior Assertions

Row ID: **F318-B2**

## Implementation anchor
- `src/lib/agents/tasks/views/inline-task-log-view.tsx`
  - `scheduleScrollToLatest(mode)`
  - `jumpToLatest()` uses `scheduleScrollToLatest('smooth')`

## Assertions
- Jump-to-latest path requests smooth behavior when reduced motion is not active.
- Tail-follow append path uses non-animated auto behavior to avoid repeated smooth jitter.

## Validation
- Behavioral assertions covered in tail semantics test:

```bash
bunx vitest run src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx
```

## Status
- PASS
