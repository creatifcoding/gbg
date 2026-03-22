# InlineTaskShell — Dependency Graph & Implementation Order

**Status**: Design  
**Parent**: `inline-task-shell-architecture.md`  
**Date**: 2026-02-13

---

## Dependency Graph

```
                    ┌──────────────────────┐
                    │   inline-task-types   │  (existing, leaf)
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   shell-context.ts    │  (new, leaf)
                    │   Context definition │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────────┐
              │                │                     │
   ┌──────────▼──────┐  ┌─────▼──────────┐  ┌──────▼──────────┐
   │  metric-cell.tsx │  │ search-band    │  │ expand-band     │
   │  (new, leaf)     │  │ (new, leaf)    │  │ (new, leaf)     │
   └──────────┬──────┘  └─────┬──────────┘  └──────┬──────────┘
              │                │                     │
   ┌──────────▼──────┐        │                     │
   │ metrics-band    │        │                     │
   │ (new, cell dep) │        │                     │
   └──────────┬──────┘        │                     │
              │                │                     │
              │         ┌──────────────────┐         │
              │         │  Row Extractions │         │
              │         │  (parallel work) │         │
              │         └──────┬───────────┘         │
              │                │                     │
              │    ┌───────────┼──────────┐          │
              │    │           │          │          │
              │  ┌─▼───────┐ ┌▼───────┐ ┌▼────────┐│
              │  │action-btn│ │progress│ │toolbar  ││
              │  │(new,leaf)│ │(new)   │ │(dep:btn)││
              │  └──────────┘ └────────┘ └─────────┘│
              │                │                     │
              │         ┌──────▼───────────┐         │
              │         │  thread-band     │         │
              │         │  (absorbs vlist) │         │
              │         └──────┬───────────┘         │
              │                │                     │
              └────────────────┼─────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   shell-root.tsx      │
                    │   (top-level, all     │
                    │    bands as children) │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   inline-task-thread  │
                    │   compound exports   │
                    │   (wire shell into   │
                    │    existing compound) │
                    └──────────────────────┘
```

---

## Implementation Tiers

### Tier 0 — Leaves (no internal deps, parallelizable)

| Component | File | Deps | Notes |
|---|---|---|---|
| Context | `inline-task-shell-context.ts` | `inline-task-types.ts`, `effect/HashMap` | Pure type + `createContext`. No runtime logic. |
| MetricCell | `metric-cell.tsx` | Context (read-only) | Stateless cell: label + value + optional status color |
| ActionBtn | `inline-task-row-action-btn.tsx` | None (pure presentational) | Generic button: icon + label + variant (default/danger) |
| RowProgress | `inline-task-row-progress.tsx` | None (pure presentational) | Track + fill + percentage. Animated stripes for running. |

### Tier 1 — Simple Bands (depend on context, no virtualizer)

| Component | File | Deps | Notes |
|---|---|---|---|
| ExpandBand | `expand-band-root.tsx` | Context, Lucide (ChevronDown), transfer hooks | Read `expanded`, `metrics.total`, cluster drag support |
| MetricsBand | `metrics-band-root.tsx` | Context, MetricCell | Read `metrics`, render 4 cells |
| SearchBand | `search-band-root.tsx` | Context | Read/write `searchTerm`, render input + hotkey hints |
| RowToolbar | `inline-task-row-toolbar.tsx` | ActionBtn | Renders action array, calls `onAction` |

### Tier 2 — ThreadBand (absorbs virtualizer complexity)

| Component | File | Deps | Notes |
|---|---|---|---|
| ThreadBand | `thread-band-root.tsx` | Context, `@tanstack/react-virtual`, `RvnChatInlineTaskRow`, transfer hooks, `motion/react` | Heaviest component. Absorbs virtualizer from `VirtualizedList`. |

### Tier 3 — Shell Root (orchestrator)

| Component | File | Deps | Notes |
|---|---|---|---|
| ShellRoot | `inline-task-shell-root.tsx` | Context, all bands (indirect), `effect/HashMap` | Owns state, computes metrics, provides context. Children = bands. |

### Tier 4 — Wiring

| Component | File | Deps | Notes |
|---|---|---|---|
| Barrel | `index.ts` | All shell components | Export compound interface |
| Thread Compound | `inline-task-thread.tsx` | Barrel | Add `Shell` to compound statics |

---

## CSS Implementation Order

All CSS goes in `src/lib/rvn/chat/styles/message.css`, appended after existing inline task selectors.

| Order | Selectors | Tier |
|---|---|---|
| 1 | `.rvn-chat__inline-task-shell` (root grid) | With Root |
| 2 | `.rvn-chat__inline-task-shell-expand-band*` | With ExpandBand |
| 3 | `.rvn-chat__inline-task-shell-metric*` | With MetricsBand |
| 4 | `.rvn-chat__inline-task-shell-search*` | With SearchBand |
| 5 | `.rvn-chat__inline-task-shell-thread-band` | With ThreadBand |
| 6 | `.rvn-chat__inline-task-row-progress-standalone*` | With RowProgress |
| 7 | `.rvn-chat__inline-task-row-toolbar*` | With RowToolbar |
| 8 | `.rvn-chat__inline-task-row-action-btn*` | With ActionBtn |
| 9 | `@keyframes rvn-progress-stripes` | With RowProgress |

---

## Existing Component Modifications

### `inline-task-row.tsx` — Surgical Additions

1. Import and render `InlineTaskRowToolbar` inside the expanded details panel (after `InlineTaskDetail`, after progress bar)
2. Import and render `InlineTaskRowProgress` as an alternative to the inline progress bar (optional — can coexist)
3. Add `actions` and `onAction` props to `RvnChatInlineTaskRowProps`

### `inline-task-detail/inline-task-detail-fields.tsx` — Copy-to-Clipboard

1. Add `copyable?: boolean` prop
2. When `copyable`, render a copy button next to each non-empty field value
3. Transient `copied` state per field key (1.5s timeout)
4. CSS: `.rvn-chat__inline-task-detail-field-copy` button selector

### `inline-task-thread.tsx` — Compound Wiring

1. Import `InlineTaskShell` from barrel
2. Add `Shell` to compound statics: `InlineTaskThread.Shell = InlineTaskShell`
3. Re-export shell types

---

## Commit Strategy

Each tier maps to 1–3 granular commits, bottom-up:

```
1. feat(rvn/inline-task): add shell context definition
2. feat(rvn/inline-task): add action button, row progress, and metric cell components
3. feat(rvn/inline-task): add expand band
4. feat(rvn/inline-task): add metrics band
5. feat(rvn/inline-task): add search band
6. feat(rvn/inline-task): add row toolbar compound
7. feat(rvn/inline-task): add thread band — absorbs virtualizer from VirtualizedList
8. feat(rvn/inline-task): add shell root with context provider and metrics derivation
9. feat(rvn/inline-task): add shell CSS selectors to message.css
10. feat(rvn/inline-task): wire shell into InlineTaskThread compound exports
11. feat(rvn/inline-task): add copy-to-clipboard to InlineTaskDetailFields
12. feat(rvn/inline-task): wire toolbar + progress into InlineTaskRow
```

---

## Testing Strategy

| Component | Test Type | Notes |
|---|---|---|
| Context | None (pure type) | — |
| MetricCell | Render test | Verify label, value, status color attribute |
| ActionBtn | Render + click | Verify variant classes, onClick fires |
| RowProgress | Render test | Verify width style, stripe animation for running |
| ExpandBand | Render + click | Verify expanded toggle, count display |
| MetricsBand | Render test | Verify 4 cells from context metrics |
| SearchBand | Render + input | Verify setSearchTerm fires on input |
| RowToolbar | Render + click | Verify actions render, onAction callback |
| ThreadBand | Integration | Virtualizer renders rows, scroll-to-task works |
| ShellRoot | Integration | Full shell renders, context flows to all bands |
| Copy-to-clipboard | Click test | Verify clipboard write, flash state |
