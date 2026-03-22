# F318-B3 Reduced Motion Checklist

Row ID: **F318-B3**

- [x] `prefers-reduced-motion` is read via `window.matchMedia('(prefers-reduced-motion: reduce)')`
- [x] media query change listener updates runtime behavior
- [x] when reduced motion is active, scroll behavior is forced to `auto`
- [x] smooth behavior is only used when reduced motion is not active

Implementation location:
- `src/lib/agents/tasks/views/inline-task-log-view.tsx`

Status: PASS (code-path verification)
