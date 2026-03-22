# F317-A1 Near-Bottom Threshold Evidence

Row ID: **F317-A1**

## Implementation anchor
- `src/lib/agents/tasks/views/inline-task-log-view.tsx`
  - `SCROLL_FOLLOW_THRESHOLD_PX = 24`
  - `handleScroll()` computes `distanceFromBottom`
  - `isNearBottom => tail mode`

## Automated validation
Command:

```bash
bunx vitest run src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx
```

Assertion coverage:
- user scroll-up forces `PAUSED` (`inspect`)
- returning to latest path restores `LIVE` (`tail`)
- unread badge is cleared on resume

## Result
- PASS (see latest vitest run in terminal history and regression matrix blob)
