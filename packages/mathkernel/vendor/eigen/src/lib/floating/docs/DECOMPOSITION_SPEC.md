# Floating Panel System — Decomposition Spec

> Spec date: 2026-02-20
> Applies: Vercel Composition Patterns, components.build, Vercel React Best Practices
> Prerequisite: `DECOMPOSITION_AUDIT.md`

---

## 1. Target Structure

```
src/lib/floating/
├── tokens.ts                              # Design tokens (PANEL palette, sizes)
├── types.ts                               # Effect Schemas (existing, untouched)
├── floating-stx.ts                        # State management (existing, untouched)
├── index.ts                               # Barrel (slimmed — public API only)
│
├── components/
│   ├── FloatingPanel.tsx                  # Slim orchestrator — composes sub-parts
│   ├── TitleBar.tsx                       # Title bar compound: tab, title, close
│   ├── PanelControls.tsx                  # Chrome buttons: collapse/expand, max/restore, minimize
│   ├── PanelContent.tsx                   # Content wrapper: FloatingDimensionProvider + PanelSlot
│   ├── ChromeBtn.tsx                      # Reusable chrome button primitive
│   ├── PanelIcons.tsx                     # All 6 memoized SVG icons
│   ├── ResizeHandles.tsx                  # (moved from root — unchanged)
│   ├── FloatingDragOverlay.tsx            # (moved from root — unchanged)
│   └── index.ts                           # Component barrel
│
├── context/
│   ├── FloatingPanelContext.ts            # Context type + createContext + useFloatingPanelContext
│   ├── FloatingDimensionContext.tsx        # (moved from root — unchanged)
│   ├── FloatingBoundsContext.tsx           # (moved from root — unchanged)
│   └── index.ts                           # Context barrel
│
├── providers/
│   ├── FloatingPanelProvider.tsx           # Slim provider: context value + DndContext + overlays
│   └── index.ts
│
├── hooks/
│   ├── useFloatingPanel.ts                # (existing — unchanged)
│   ├── usePanelById.ts                    # (extracted from useFloatingPanel.ts)
│   ├── useWorkspaceBounds.ts              # NEW: workspace rect caching + ResizeObserver
│   ├── useKeyboardNudge.ts                # NEW: arrow key nudging effect
│   ├── useSnapGuides.ts                   # NEW: snap guide refs + paint/hide
│   ├── useDockPreview.ts                  # NEW: dock preview refs + paint/hide
│   ├── usePanelPersistence.ts             # (existing — becomes the ONLY persistence path)
│   ├── useResize.ts                       # REVIEW: orphaned — delete or rewire
│   └── index.ts                           # Hook barrel
│
├── dock/
│   ├── types.ts                           # DockZone type, DOCK_THRESHOLD constant
│   ├── layout.ts                          # resolveDockLayout, classifyDockZone, dockZoneLabel, approx
│   └── index.ts                           # Dock barrel
│
├── modifiers/
│   ├── restrictToWorkspace.ts             # dnd-kit Modifier: workspace bounds clamping
│   ├── magneticSnap.ts                    # dnd-kit Modifier: magnetic snap (reads snap refs)
│   ├── dockPreview.ts                     # dnd-kit Modifier: dock preview painting
│   └── index.ts                           # Modifier barrel
│
├── overlays/
│   ├── SnapGuideOverlay.tsx               # Renders snap guide + dock preview DOM elements
│   └── index.ts
│
├── machines/
│   └── panel-machine.ts                   # (existing — unchanged)
│
├── utils/
│   ├── position.ts                        # (existing — unchanged)
│   ├── raf-throttle.ts                    # (existing — unchanged)
│   └── __tests__/
│       └── position.test.ts               # (existing — unchanged)
│
├── withDraggable.tsx                       # (existing — unchanged)
├── PanelRegistry.tsx                       # (existing — unchanged)
│
└── docs/
    ├── DECOMPOSITION_AUDIT.md
    ├── DECOMPOSITION_SPEC.md              # This file
    ├── SPEC.md
    ├── REQUIREMENTS.md
    ├── PERFORMANCE_AUDIT.md
    └── BENCHMARK_RESULTS.md
```

---

## 2. Extraction Plan

### Phase 1: Tokens + Icons (zero behavioral change)

**New files:**
- `tokens.ts` — Extract `PANEL` object from `FloatingPanel.tsx`
- `components/PanelIcons.tsx` — Extract all 6 icon components
- `components/ChromeBtn.tsx` — Extract `ChromeBtn` + `chromeBtnBase` style

**Changes to existing:**
- `FloatingPanel.tsx` — Import from new files, remove inline definitions

**Risk:** None — pure extraction, no logic changes.

### Phase 2: Dock module (zero behavioral change)

**New files:**
- `dock/types.ts` — `DockZone`, `DOCK_THRESHOLD`
- `dock/layout.ts` — `approx()`, `classifyDockZone()`, `dockZoneLabel()`, `resolveDockLayout()`
- `dock/index.ts` — Barrel

**Changes to existing:**
- `FloatingPanelProvider.tsx` — Import from `./dock`

**Risk:** None — pure functions moved, no React dependency.

### Phase 3: Context extraction (zero behavioral change)

**New files:**
- `context/FloatingPanelContext.ts` — `FloatingPanelContextValue` interface, `createContext()`, `useFloatingPanelContext()` hook

**Changes to existing:**
- `FloatingPanelProvider.tsx` — Import context from `./context/FloatingPanelContext`
- `FloatingPanel.tsx` — Import `useFloatingPanelContext` from `./context`

**Risk:** Low — context identity must remain the same singleton.

### Phase 4: Hook extraction from provider

**New files:**
- `hooks/useWorkspaceBounds.ts` — `workspaceRectRef` + `ResizeObserver` effect → returns `{ workspaceRectRef }`
- `hooks/useSnapGuides.ts` — `guideVRef`, `guideHRef`, `hideSnapGuides()`, `paintSnapGuides()` → returns `{ guideVRef, guideHRef, hideSnapGuides, paintSnapGuides }`
- `hooks/useDockPreview.ts` — `dockPreviewRef`, `dockPreviewLabelRef`, `hideDockPreview()`, `paintDockPreview()` → returns `{ dockPreviewRef, dockPreviewLabelRef, hideDockPreview, paintDockPreview }`
- `hooks/useKeyboardNudge.ts` — Standalone `useEffect` that reads stx + viewport → no return value (side-effect-only hook)

**Changes to existing:**
- `FloatingPanelProvider.tsx` — Replace inline code with hook calls

**Risk:** Medium — hooks must receive the same refs/callbacks. Interface design matters.

### Phase 5: Modifier extraction

**New files:**
- `modifiers/restrictToWorkspace.ts` — Factory: `createRestrictToWorkspace(workspaceRectRef)` → `Modifier`
- `modifiers/magneticSnap.ts` — Factory: `createMagneticSnap(dragSnapRef, hideSnapGuides, paintSnapGuides)` → `Modifier`
- `modifiers/dockPreview.ts` — Factory: `createDockPreviewModifier(dragSnapRef, hideDockPreview, paintDockPreview)` → `Modifier`
- `modifiers/index.ts` — Barrel

**Changes to existing:**
- `FloatingPanelProvider.tsx` — Replace inline `useCallback<Modifier>` with factory calls

**Risk:** Medium — modifier closures must capture the right refs. Test with real drag.

### Phase 6: Overlay extraction

**New file:**
- `overlays/SnapGuideOverlay.tsx` — Renders the 4 guide/preview DOM elements, receives refs via props

**Changes to existing:**
- `FloatingPanelProvider.tsx` — Replace inline JSX with `<SnapGuideOverlay />`

**Risk:** Low — pure presentational extraction.

### Phase 7: FloatingPanel compound decomposition

**New files:**
- `components/TitleBar.tsx` — Title bar + tab + close button. Props: `{ id, title, borderColor, isMaximized, closable, onClose, onMaximizeToggle, activatorRef, listeners }`
- `components/PanelControls.tsx` — Chrome control buttons. Props: `{ mode, isMaximized, minimizable, onToggleMode, onMaximizeToggle, onMinimize }`
- `components/PanelContent.tsx` — Content + resize handles wrapper. Props: `{ id, dimensions, position, isResizing, resizable, visibility, children }`

**Changes to existing:**
- `FloatingPanel.tsx` — Becomes slim orchestrator that composes `TitleBar`, `PanelControls`, `PanelContent`

**Why this split:**
- `TitleBar` subscribes to: title, isDragging, isResizing, isMaximized, closable → no re-render on dimension changes
- `PanelContent` subscribes to: dimensions, isResizing, visibility → no re-render on drag state changes
- `PanelControls` subscribes to: mode, isMaximized, minimizable → minimal subscription surface

**Risk:** Medium — dnd-kit `useDraggable` provides `setActivatorNodeRef` and `listeners` that must be passed to `TitleBar`. Props must be designed carefully.

### Phase 8: Dead code removal

**Delete:**
- `hooks/useResize.ts` — Orphaned, `ResizeHandles` does its own pointer handling
- Inline persistence in `FloatingPanelProvider.tsx` — Use `usePanelPersistence` hook instead
- 10 duplicated action wrapper `useCallback`s in provider — Provider context value should reference stx functions directly or use `useFloatingPanel` hook internally

**Simplify:**
- `FloatingDragOverlay.tsx` — Remove unused `style` and `className` props, or delete entirely if `<DragOverlay dropAnimation={null} />` can be inlined

---

## 3. Compound Component API (Target)

After decomposition, `FloatingPanel` reads as a compound composition:

```tsx
// components/FloatingPanel.tsx (target ~80 lines)
export const FloatingPanel = memo(function FloatingPanel({
  id, title, onClose, onToggleMode, children,
}: FloatingPanelProps) {
  const panel = usePanelState(id)        // fine-grained stx selectors
  const draggable = useDraggable({ id }) // dnd-kit

  if (!panel.visible) return null

  return (
    <div
      ref={draggable.setNodeRef}
      className="fp-panel"
      data-floating-panel
      data-state={panel.isDragging ? 'dragging' : panel.isResizing ? 'resizing' : 'idle'}
      style={panelStyle(panel, draggable.transform)}
      onClick={() => bringToFront(id)}
      {...draggable.attributes}
    >
      <TitleBar
        id={id}
        title={title}
        activatorRef={draggable.setActivatorNodeRef}
        listeners={draggable.listeners}
        borderColor={panel.borderColor}
        isMaximized={panel.isMaximized}
        closable={panel.closable}
        onClose={onClose}
        onMaximizeToggle={() => toggleMaximize(id)}
      >
        <PanelControls
          mode={panel.mode}
          isMaximized={panel.isMaximized}
          minimizable={panel.minimizable}
          onToggleMode={onToggleMode}
          onMaximizeToggle={() => toggleMaximize(id)}
          onMinimize={() => setVisibility(id, 'minimized')}
        />
      </TitleBar>

      <PanelContent
        id={id}
        dimensions={panel.dimensions}
        position={panel.position}
        isResizing={panel.isResizing}
        resizable={panel.resizable}
        visibility={panel.visibility}
      >
        {children}
      </PanelContent>
    </div>
  )
})
```

And the provider reads as a clean composition:

```tsx
// providers/FloatingPanelProvider.tsx (target ~120 lines)
export function FloatingPanelProvider({
  children, disablePersistence, onSortableDragStart, onSortableDragEnd,
}: FloatingPanelProviderProps) {
  const { workspaceRectRef } = useWorkspaceBounds()
  const snapGuides = useSnapGuides()
  const dockPreview = useDockPreview()
  const dragSnapRef = useDragSnapCache()

  // Persistence
  usePanelPersistence({ disabled: disablePersistence })

  // Keyboard
  useKeyboardNudge({ workspaceRectRef })

  // Modifier pipeline
  const modifiers = usePanelModifiers({
    workspaceRectRef, dragSnapRef, snapGuides, dockPreview,
  })

  // Drag handlers
  const { handleDragStart, handleDragEnd } = usePanelDragHandlers({
    dragSnapRef, snapGuides, dockPreview, workspaceRectRef,
    onSortableDragStart, onSortableDragEnd,
  })

  return (
    <FloatingPanelContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        modifiers={modifiers}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <SnapGuideOverlay
          guideVRef={snapGuides.guideVRef}
          guideHRef={snapGuides.guideHRef}
          dockPreviewRef={dockPreview.previewRef}
          dockLabelRef={dockPreview.labelRef}
        />
      </DndContext>
    </FloatingPanelContext.Provider>
  )
}
```

---

## 4. Data Attributes (components.build)

Add to all decomposed components:

| Element | Attribute | Values |
|---------|-----------|--------|
| Panel root | `data-slot="panel"` | — |
| Panel root | `data-state` | `idle`, `dragging`, `resizing`, `maximized` |
| Title bar | `data-slot="titlebar"` | — |
| Title tab | `data-slot="tab"` | — |
| Controls group | `data-slot="controls"` | — |
| Content area | `data-slot="content"` | — |
| Resize handle | `data-slot="resize-handle"` | — |
| Resize handle | `data-resize-handle` | `n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw` |

This enables external CSS targeting:

```css
[data-slot="panel"][data-state="dragging"] [data-slot="titlebar"] {
  border-color: var(--panel-border-active);
}
```

---

## 5. Accessibility Additions

| Addition | Component | Spec |
|----------|-----------|------|
| `role="dialog"` | `FloatingPanel` root | Identifies as dialog |
| `aria-label={title}` | `FloatingPanel` root | Screen reader label |
| `aria-labelledby` | Panel root → title span | Links label element |
| `role="toolbar"` | `PanelControls` | Groups chrome buttons |
| `aria-label="Panel controls"` | `PanelControls` | Labels toolbar |
| `Escape` key handler | `FloatingPanel` | Close active panel on Escape |
| Focus panel on open | `registerPanel` flow | Auto-focus panel root when created |
| Focus restoration | `closePanel` flow | Return focus to previously focused element |

---

## 6. Execution Order

| Phase | Files Created | Files Modified | Risk | LOC Delta |
|-------|:------------:|:--------------:|:----:|:---------:|
| 1 — Tokens + Icons | 3 | 1 | None | +120 / −110 |
| 2 — Dock module | 3 | 1 | None | +100 / −90 |
| 3 — Context extraction | 2 | 2 | Low | +40 / −30 |
| 4 — Hook extraction | 4 | 1 | Medium | +280 / −250 |
| 5 — Modifier extraction | 4 | 1 | Medium | +200 / −180 |
| 6 — Overlay extraction | 2 | 1 | Low | +60 / −40 |
| 7 — Panel compound | 3 | 1 | Medium | +200 / −180 |
| 8 — Dead code | 0 | 3 | Low | −180 |

**Net: +21 files, ~1,000 new lines, ~1,060 removed lines. Net LOC stays flat.**

Each phase is independently shippable and independently testable. Phase N does not depend on Phase N+1. Revert any phase without affecting others.

---

## 7. Quality Gates

**Full gate spec: [`GATES.md`](./GATES.md)**

Every gate is an executable shell command (exit 0 = pass). Gates cover:

- **Compilation**: `tsc --noEmit` after every phase
- **Tests**: vitest suite must pass — position tests (existing), dock layout tests (Phase 2), modifier tests (Phase 5), compound component render tests (Phase 7)
- **Structural conformance**: Line count budgets per file category (provider ≤150, panel ≤120, hooks ≤100, modifiers ≤80, barrel ≤60)
- **Visual conformance**: Zero hardcoded hex colors outside `tokens.ts`, vantablack palette audit, 12px floor check
- **Accessibility**: `role=dialog`, `aria-label`, `data-slot` on all compound parts, `role=toolbar` on controls
- **Import hygiene**: Zero stale import paths, zero orphaned root-level files, 11 external consumers compile
- **Dead code**: `useResize.ts` deleted, ≤4 useCallback wrappers in provider, no inline dock/snap/preview code in provider

### Test Coverage Requirements

| Phase | New Test File | Min Cases |
|-------|--------------|:---------:|
| 2 | `dock/__tests__/layout.test.ts` | 8 |
| 5 | `modifiers/__tests__/modifiers.test.ts` | 6 |
| 7 | `components/__tests__/compound.test.tsx` | 8 |

### External Consumers (must not break)

These 11 files import from `@/lib/floating` and must compile after every phase:

1. `src/components/testbed/FloatingPanelTestbed.tsx`
2. `src/components/testbed/AvaTestbed.tsx`
3. `src/components/testbed/CollaborationTestbed.tsx`
4. `src/components/testbed/EguiMorphCardTestbed.tsx`
5. `src/components/testbed/collaboration/EditorFloatingPanel.tsx`
6. `src/components/primitives/InteractiveCard.tsx`
7. `src/lib/egui/panels/EguiCanvasPanel.tsx`
8. `src/lib/file-browser/floating/FileBrowserPanel.tsx`
9. `src/lib/file-browser/floating/FileBrowserTrigger.tsx`
10. `src/lib/geoint/components/EntityPanel.tsx`
11. `src/lib/terminal/TerminalPanel.tsx`
