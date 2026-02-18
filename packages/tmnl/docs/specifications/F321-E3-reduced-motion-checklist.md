# F321-E3 Keyboard + Reduced-Motion Checklist

Row ID: **F321-E3**

## Keyboard interaction audit (current lane surface)
- [x] Filter/search inputs are native `<input type="text">` (focusable, keyboard-editable).
- [x] Tail controls are native `<button>` elements (`Pause/Resume`, `Latest`) with accessible text/title.
- [x] No pointer-only affordance for tail-mode recovery; jump-to-latest is keyboard-clickable.

## Reduced-motion audit
- [x] `prefers-reduced-motion` is read via `window.matchMedia('(prefers-reduced-motion: reduce)')`.
- [x] Motion preference listener updates behavior at runtime.
- [x] Scroll behavior degrades to `auto` when reduced motion is active.
- [x] Smooth scrolling is used only when reduced motion is not active.

## Source anchors
- `src/lib/agents/tasks/views/inline-task-log-view.tsx`
- `src/lib/agents/tasks/views/log-tail-controls.tsx`
- `src/lib/agents/tasks/views/log-filter-bar.tsx`

## Validation command
```bash
bunx vitest run src/lib/agents/tasks/views/__tests__/inline-task-log-view.tail.test.tsx
```

Status: **provisionally pass (code-path + targeted tests)**; manual keyboard walkthrough video still pending if required by QA policy.
