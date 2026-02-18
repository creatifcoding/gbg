# F317-A3 Tail Mode Assertions

Row ID: **F317-A3**

## Assertions captured
1. `inspect -> tail` transition occurs on jump-to-latest action.
2. `unreadCount` resets to `0` on jump/resume.
3. LIVE indicator is visible after transition.

## Test reference
- `src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx`

## Command

```bash
bunx vitest run src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx
```

## Status
- PASS
