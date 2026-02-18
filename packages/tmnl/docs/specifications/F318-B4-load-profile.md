# F318-B4 Sustained Stream Load Profile (Preliminary)

Row ID: **F318-B4**

## Target
- Keep append behavior responsive under sustained stream by coalescing scroll writes via RAF.
- Avoid per-entry synchronous scroll writes in append loop.

## Implementation evidence
- `scheduleScrollToLatest()` uses `requestAnimationFrame` and cancels prior pending frame.
- Append path in tail mode calls `scheduleScrollToLatest('auto')` (single frame write path).
- Reduced motion path forces `behavior: 'auto'`.

Source:
- `src/lib/agents/tasks/views/inline-task-log-view.tsx`

## Verification run
```bash
bunx vitest run src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx
```

## Notes
- This is code-path + functional verification.
- Browser profiler and long-frame JSON (`F318-B4-long-frame-report.json`) still pending manual capture in interactive session.
