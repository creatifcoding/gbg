# Floating Panel System — Decomposition Audit

> Audit date: 2026-02-20
> Frameworks applied: Vercel Composition Patterns, components.build spec, Vercel React Best Practices

---

## 1. Inventory

| File | Lines | Concern Count | Verdict |
|------|------:|:-------------:|---------|
| `FloatingPanelProvider.tsx` | 976 | **11** | 🔴 CRITICAL — god component |
| `FloatingPanel.tsx` | 389 | **5** | 🟡 MODERATE — mixed concerns |
| `floating-stx.ts` | 602 | 1 | 🟢 CLEAN — single responsibility |
| `FloatingBoundsContext.tsx` | 304 | 2 | 🟢 ACCEPTABLE — context + utils |
| `types.ts` | 256 | 1 | 🟢 CLEAN |
| `ResizeHandles.tsx` | 234 | 1 | 🟢 CLEAN |
| `hooks/useResize.ts` | 234 | 1 | 🟢 CLEAN |
| `PanelRegistry.tsx` | 273 | 2 | 🟡 MINOR — context + singleton |
| `withDraggable.tsx` | 220 | 2 | 🟡 MINOR — HOC + inline rendering |
| `hooks/useFloatingPanel.ts` | 187 | 1 | 🟢 CLEAN |
| `index.ts` | 181 | 1 | 🟡 BARREL — 80+ re-exports |
| `FloatingDimensionContext.tsx` | 147 | 1 | 🟢 CLEAN |
| `FloatingDragOverlay.tsx` | 53 | 1 | 🟢 TRIVIAL |
| `utils/position.ts` | 290 | 1 | 🟢 CLEAN |
| `utils/raf-throttle.ts` | 80 | 1 | 🟢 CLEAN |
| `machines/panel-machine.ts` | 198 | 1 | 🟢 CLEAN |

**Total: 4,846 lines across 18 files**

---

## 2. Violations

### 2.1 FloatingPanelProvider.tsx — 976 lines, 11 concerns

This is the god component. It violates every composition principle at once.

| # | Concern | Lines | Violation |
|---|---------|------:|-----------|
| 1 | `DockZone` type + `DOCK_THRESHOLD` constant | 78–87 | **Domain logic in component file** — types.ts or own module |
| 2 | `approx()`, `classifyDockZone()`, `dockZoneLabel()` | 88–141 | **Pure functions in component** — zero React dependency, should be utility |
| 3 | `resolveDockLayout()` | 143–196 | **Pure function** — layout math has no React dependency |
| 4 | Context type `FloatingPanelContextValue` + `createContext()` + `useFloatingPanelContext()` hook | 204–233 | **Context definition coupled to provider** — should be own file per components.build `composition-root` |
| 5 | Workspace bounds caching (`workspaceRectRef` + `ResizeObserver` effect) | 274–299 | **Infrastructure hook** — `useWorkspaceBounds()` |
| 6 | Snap guide refs + `hideSnapGuides()` + `paintSnapGuides()` | 328–394 | **Imperative overlay subsystem** — `useSnapGuides()` |
| 7 | Dock preview refs + `hideDockPreview()` + `paintDockPreview()` | 265–266, 333–362 | **Imperative overlay subsystem** — `useDockPreview()` |
| 8 | `restrictToWorkspace` + `magneticSnap` + `dockPreviewModifier` (3 dnd-kit modifiers) | 305–478 | **Modifier pipeline** — should be composable module |
| 9 | Keyboard nudging effect | 624–695 | **Standalone behavior hook** — `useKeyboardNudge()` |
| 10 | Persistence effects (restore + subscribe) | 550–620 | **Already has `usePanelPersistence` hook** but inlined duplicate |
| 11 | 10 wrapped stx action callbacks + context value assembly | 696–780 | **Duplicates `useFloatingPanel` hook** verbatim |

**Vercel violations:**
- `architecture-avoid-boolean-props` — N/A (no booleans, but monolithic conditional soup)
- `architecture-compound-components` — Provider is not decomposed into composable compound parts
- `state-decouple-implementation` — Persistence, docking, snapping, keyboard all know stx internals
- `rerender-defer-reads` — `snapGridSize` and `snapEnabled` selectors trigger re-renders for modifier rebuilds
- `bundle-barrel-imports` — The 181-line `index.ts` re-exports everything from this file

**components.build violations:**
- `composition-root` — Context type must be defined separately from the provider
- `types-single-element` — Provider wraps `DndContext > {children} > div[snap guides] > div[dock preview] > div[dock label]`
- `state-controllable` — No separation between controlled and uncontrolled panel state

### 2.2 FloatingPanel.tsx — 389 lines, 5 concerns

| # | Concern | Lines | Violation |
|---|---------|------:|-----------|
| 1 | `PANEL` design tokens | 28–39 | **Hardcoded tokens in component** — should be `tokens.ts` |
| 2 | 5 icon components (`MinimizeIcon`, `CollapseIcon`, `ExpandIcon`, `MaximizeIcon`, `RestoreIcon`) | 46–88 | **6 components in 1 file** — should be `components/PanelIcons.tsx` |
| 3 | `ChromeBtn` component | 99–125 | **Reusable primitive in consumer file** — should be own component |
| 4 | Title bar layout (~80 lines inline JSX) | 226–290 | **Compound component violation** — title bar is a distinct compositional unit |
| 5 | Chrome controls group (~20 lines inline JSX) | 292–310 | **Part of title bar compound** |

**Vercel violations:**
- `rendering-hoist-jsx` — `chromeBtnBase` style object is hoisted ✓, but `PANEL` tokens are not in a shared location
- `rerender-memo` — Icons are memoized ✓, but the 12 `useSelector` calls in the main component all fire independently (correct pattern, but title bar and content area could be split to isolate subscription domains)

**components.build violations:**
- `composition-root` + `composition-trigger` + `composition-content` — FloatingPanel should be decomposed into `Panel.Root`, `Panel.TitleBar`, `Panel.Content`, `Panel.Controls`
- `data-attributes-slot` — No `data-slot` attributes for targeting sub-components
- `styling-css-variables` — Tokens are JS constants, not CSS variables (inconsistent with the `--tmnl-text-*` pattern used everywhere else)

### 2.3 index.ts — 181-line barrel

**Vercel violation: `bundle-barrel-imports`** — Every consumer that imports one thing pulls the entire dependency graph. The barrel re-exports from 10+ modules including `floating-stx.ts` (602 lines), all hooks, all types, all utils.

### 2.4 withDraggable.tsx — forwardRef not used but should be avoided anyway

Uses `memo()` wrapper around function component. Clean enough, but renders `FloatingPanel` inline when floating — tight coupling.

### 2.5 Duplicated Action Wrappers

`FloatingPanelProvider.tsx` lines 696–740 define 10 `useCallback` wrappers that are **identical** to the ones in `hooks/useFloatingPanel.ts` lines 95–135. Same functions, same empty dependency arrays, same stx calls.

---

## 3. Subscription Audit (Re-render Risk)

### FloatingPanel.tsx — 12 useSelector calls

```
position, dimensions, constraints, zIndex, visibility,
isDragging, isResizing, isMaximized, mode, closable, minimizable, resizable
```

All 12 fire on any change to their respective field. A dimension change during resize triggers the entire panel re-render. The title bar doesn't need `dimensions` — only the content area does.

**Recommendation:** Split into `TitleBar` (subscribes to: title, mode, isMaximized, closable, minimizable, isDragging, isResizing) and content wrapper (subscribes to: dimensions, visibility, isResizing). Each sub-component has a narrower subscription surface.

### FloatingPanelProvider.tsx — 2 useSelector calls + 5 useEffect

`snapGridSize` and `snapEnabled` drive a `useMemo` that rebuilds the modifier array. Every snap toggle rebuilds all modifiers and re-renders the provider (and therefore every child).

**Recommendation:** Modifiers should be refs, not memoized state. dnd-kit reads modifiers on each drag frame anyway — they don't need to be React-reactive.

---

## 4. Dead Code / Redundancy

| Item | Location | Status |
|------|----------|--------|
| `FloatingDragOverlay` | `FloatingDragOverlay.tsx` | **Near-dead** — renders `<DragOverlay dropAnimation={null} />` with 2 unused props |
| `useResize` hook | `hooks/useResize.ts` | **Orphaned** — `ResizeHandles` does its own pointer handling, doesn't use this hook |
| `usePanelPersistence` hook | `hooks/usePanelPersistence.ts` | **Orphaned** — Provider has its own inline persistence logic |
| Persistence in Provider | Lines 550–620 | **Duplicate** — duplicates the hook's purpose |
| 10 action wrappers in Provider | Lines 696–740 | **Duplicate** — identical to `useFloatingPanel` hook |
| `style` prop on `FloatingDragOverlay` | Props | **Unused** — always 'ghost', never read |

---

## 5. Accessibility Gaps (components.build)

| Rule | Status | Issue |
|------|--------|-------|
| `accessibility-semantic-html` | 🔴 | Panel is `<div>` not `<dialog>` or `role="dialog"` |
| `accessibility-keyboard` | 🟡 | Arrow nudging exists, but no focus trap, no Escape to close |
| `accessibility-aria` | 🔴 | No `aria-label` on panel root, no `aria-modal`, no `role` on title bar |
| `accessibility-focus` | 🔴 | No focus management when panel opens/closes, no focus restoration |
| `accessibility-contrast` | 🟡 | Vantablack tokens haven't been contrast-audited (WCAG AA requires 4.5:1 for text) |

---

## 6. Summary

**Critical path: FloatingPanelProvider.tsx must be decomposed.** It is 976 lines with 11 distinct concerns, 47 hook calls, and inline rendering of 3 overlay elements. It is the single largest source of coupling, re-render risk, and cognitive load in the floating system.

**Secondary: FloatingPanel.tsx must be decomposed.** 5 concerns in 1 file. Tokens, icons, chrome button, title bar, and the panel itself should be separate files.

**Tertiary: Dead code removal.** 3 orphaned modules, 1 near-dead component, duplicated action wrappers.
