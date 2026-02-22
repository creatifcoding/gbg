# Floating Panel System — UX & Performance Audit

**Date**: 2026-02-20
**Test URL**: `http://localhost:1420/window?testbed=floating`
**Method**: agent-browser eval + screenshot + DOM introspection

---

## Executive Summary

The floating panel system renders correctly with 5 panels, vantablack styling, proper z-ordering, resize handles, and keyboard support. However, several issues were found:

| Severity | Issue | Status |
|----------|-------|--------|
| 🔴 P0 | **Route broken** — `/testbed/floating` never renders (TanStack Router conflict) | Blocking for dev workflow |
| 🔴 P0 | **onClick bringToFront passes wrong arg** — panel click handler receives MouseEvent, not panel ID | Bug — but only affects programmatic `.click()`, real mouse clicks work |
| 🟡 P1 | **Maximized panel buttons disabled** — Can't restore via panel chrome when maximized | UX gap |
| 🟡 P1 | **No role="dialog" or aria-label** — Panels not announced by screen readers | Accessibility |
| 🟢 P2 | **`transition: all 0s`** on all panels — Tailwind reset, not harmful but could be footgun | Style hygiene |
| 🟢 P2 | **40 resize handles** for 5 panels — 8 per panel, could lazy-render | Performance minor |

---

## Test Results

### ✅ Rendering (PASS)
- 5 panels rendered at correct positions
- All panels have headers, content areas, 8 resize handles
- Status bar shows panel count, active panel, snap state
- Spawn bar allows toggling panels
- Vantablack palette: body `rgb(10,10,10)`, panel bg `#0a0a0a`

### ✅ Z-Order / Bring-to-Front (PASS with caveat)
- `bringPanelToFront()` correctly reassigns z-indices
- Real mouse clicks via Playwright trigger React onClick → bringToFront
- Programmatic `.click()` does NOT trigger React's event system (known React limitation)
- Z-indices start at 1000, increment sequentially

### ✅ Maximize / Restore (PASS with UX gap)
- Maximize sets `data-state="maximized"`, z-index 99999, fills 1280x720
- Restore returns to original dimensions
- **Issue**: Panel chrome buttons (Close, Collapse, Maximize, Minimize) are ALL disabled during maximize state

### ✅ Panel Lifecycle (PASS)
- Spawn bar toggles create/destroy panels
- Panels register with correct IDs and dimensions
- Status bar updates reactively

### ⚠️ Drag (COULD NOT FULLY TEST)
- dnd-kit requires real browser pointer events with 8px activation distance
- agent-browser's `drag` command and synthesized PointerEvents did not trigger dnd-kit sensor
- Manual testing required for:
  - Drag position update
  - Magnetic snap behavior
  - Snap guide visibility
  - Dock preview on edge drag
  - Keyboard nudge (arrow keys)

### ⚠️ Resize (NOT TESTED)
- Resize handles present (8 per panel, 40 total)
- Could not programmatically test resize — requires pointer event sequence on handle elements

### ❌ Accessibility (FAIL)
- 0 panels have `role="dialog"` 
- 0 panels have `aria-label`
- 28 buttons are focusable
- No ARIA live regions for status changes

### ❌ Route Navigation (FAIL — pre-existing)
- `/testbed/floating` matches in route tree but never renders
- TanStack Router v1.139: `/testbed` route (AnimationTestbed) swallows all `/testbed/*` paths
- `router.state.status` stays `pending` for all `/testbed/*` sub-routes
- **Workaround**: Use `/window?testbed=floating` (WindowRoute)

---

## Performance Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| DOM nodes | 266 | Good for 5 panels |
| Resize handles | 40 | 8/panel — could lazy-render on hover |
| CSS transitions | `all 0s` | Effectively instant, Tailwind reset |
| `willChange` | `transform` | Correct — GPU layer for drag |
| z-index range | 1000-1004 (normal), 99999 (maximized) | Clean |

---

## Recommendations

### P0 — Fix Route (Architecture)
The `/testbed` route at `src/router.tsx:99` uses `path: '/testbed'` with `getParentRoute: () => rootRoute`. This creates a layout route that swallows all `/testbed/*` child paths. The `AnimationTestbed` component doesn't render `<Outlet />`, so children never mount.

**Fix option A**: Change `/testbed` to use `path: '/testbed/'` (exact match only)
**Fix option B**: Make all `/testbed/*` routes children of `testbedRoute` and add `<Outlet />` to `AnimationTestbed`
**Fix option C**: Rename `/testbed` to `/testbed/animation` to avoid prefix conflict

### P0 — Fix onClick bringToFront
In `src/lib/floating/FloatingPanel.tsx:137`:
```tsx
onClick={panelCtx.actions.bringToFront}
```
This works for real clicks but `bringToFront: () => void` signature means React event is ignored. This is actually CORRECT behavior — the closure captures `id` at creation time. The issue is only with programmatic `.click()` which bypasses React's event delegation. **No code change needed.**

### P1 — Enable maximized panel chrome
In maximized state, panel chrome buttons are disabled. Users should be able to:
- Click "Restore" to un-maximize
- Click "Close" to close the maximized panel
- Click "Minimize" to minimize

### P1 — Add ARIA attributes
```tsx
<div
  role="dialog"
  aria-label={title}
  aria-modal={false}
  data-floating-panel
  data-state={state}
>
```

### P2 — Remove `transition: all`
Add explicit `transition: none` to panel container style to prevent any inherited transitions:
```tsx
style={{ transition: 'none', ...rest }}
```
