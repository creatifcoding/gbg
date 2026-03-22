# InlineTaskShell — Shellified Inline Task Architecture

**Status**: Design  
**Origin**: `src/lib/rvn/chat/integrate/morebetter-inlinetask-muse.tsx`  
**Precedent**: `src/lib/rvn/chat/shell/` (RvnChatShell band architecture)  
**Date**: 2026-02-13

---

## Overview

The inline task system is being elevated from a flat virtualized list embedded in message attachment lanes into a **first-class shell compound** — following the same band-based architecture as `RvnChatShell` (header-band, command-band, thread-band, composer-band).

This document covers the full architecture: band decomposition, compound component interface, context design, CSS strategy, row sub-extractions, and migration path from the current implementation.

---

## Band Decomposition

```
InlineTaskShell (Root)
├── InlineTaskShell.ExpandBand      ← show/collapse toggle (replaces ExpandControl)
├── InlineTaskShell.MetricsBand     ← summary metrics row (total, running, completed, rate)
├── InlineTaskShell.ThreadBand      ← virtualizer viewport, task rows render here
└── InlineTaskShell.SearchBand      ← search/filter input for tasks in current thread
```

### Band Responsibilities

| Band | Muse Source | Current Code | Role |
|---|---|---|---|
| **ExpandBand** | Implicit (header removed, collapse retained) | `inline-task-expand-control.tsx` | Styled expand/collapse with task count + cluster drag support. Replaces the old `ExpandControl` button. The muse's top `<header>` (traffic lights, title, "New Task" button) is **removed** — ExpandBand subsumes the collapse toggle with better styling. |
| **MetricsBand** | Lines 596–621 (4-cell grid: Total/Running/Completed/Success Rate) | None | Derived metrics row. Computes from `tasks` array: `total`, `running`, `completed`, `failed`, and `rate` (completed / (completed + failed) as percentage). |
| **ThreadBand** | Lines 624–633 (scrollable task list) | `inline-task-virtualized-list.tsx` | Virtualizer viewport. Absorbs the virtualizer setup, row rendering, scroll-to-task navigation, and selection state from `VirtualizedList`. |
| **SearchBand** | Lines 635–649 (command prompt footer) | None | Search/filter input. Filters `tasks` by title/taskId match. Renders hotkey hints (ESC to clear, Ctrl+C for copy). **Not** a command executor — purely task search within the current thread. |

---

## File Structure

```
src/lib/rvn/chat/msg/inline-task-shell/
├── index.ts                                    # Barrel exports
├── inline-task-shell-root.tsx                  # Root — context provider, layout frame
├── inline-task-shell-context.ts                # React context definition
├── expand-band/
│   ├── index.ts
│   └── expand-band-root.tsx                    # Styled show/collapse + count + cluster drag
├── metrics-band/
│   ├── index.ts
│   ├── metrics-band-root.tsx                   # Grid container (4-col)
│   └── metric-cell.tsx                         # Individual metric cell (label + value + color)
├── thread-band/
│   ├── index.ts
│   └── thread-band-root.tsx                    # Virtualizer viewport (absorbs from VirtualizedList)
├── search-band/
│   ├── index.ts
│   └── search-band-root.tsx                    # Filter input + hotkey hints
└── row/
    ├── index.ts
    ├── inline-task-row-progress.tsx             # Extracted progress bar compound
    ├── inline-task-row-toolbar.tsx              # Action strip (View Logs / Retry / Abort)
    └── inline-task-row-action-btn.tsx           # Generic variant action button
```

---

## Compound Component Interface

```tsx
// Consumer API — mirrors RvnChatShell band pattern
<InlineTaskShell threadId="thread-1" tasks={tasks}>
  <InlineTaskShell.ExpandBand />
  <InlineTaskShell.MetricsBand />
  <InlineTaskShell.ThreadBand
    estimatedRowHeight={44}
    overscan={10}
  />
  <InlineTaskShell.SearchBand placeholder="Filter tasks..." />
</InlineTaskShell>

// Compound statics
InlineTaskShell.Root
InlineTaskShell.ExpandBand
InlineTaskShell.MetricsBand
InlineTaskShell.ThreadBand
InlineTaskShell.SearchBand
InlineTaskShell.Row              // Re-export of RvnChatInlineTaskRow
InlineTaskShell.RowProgress      // Extracted progress bar
InlineTaskShell.RowToolbar       // Action strip
InlineTaskShell.RowActionBtn     // Generic variant button
```

---

## Context Shape

```ts
// inline-task-shell-context.ts
interface InlineTaskShellContextValue {
  /** Thread identifier — scopes all state */
  threadId: string

  /** Full unfiltered task array */
  tasks: ReadonlyArray<RvnChatInlineTaskItem>

  /** Tasks after search filter applied */
  filteredTasks: ReadonlyArray<RvnChatInlineTaskItem>

  /** Current search term */
  searchTerm: string
  setSearchTerm: (term: string) => void

  /** Shell-level expanded state (panel open/closed) */
  expanded: boolean
  setExpanded: (expanded: boolean) => void

  /** Which individual task row is expanded (accordion — one at a time) */
  expandedTaskId: string | null
  setExpandedTaskId: (id: string | null) => void

  /** Multi-select state for transfer operations */
  selectedTaskIds: ReadonlySet<string>
  toggleSelection: (taskId: string, additive: boolean) => void
  clearSelection: () => void

  /** Effect HashMap lookup for dependency badge resolution */
  taskLookup: HashMap.HashMap<string, RvnChatInlineTaskItem>

  /** Derived metrics */
  metrics: InlineTaskShellMetrics
}

interface InlineTaskShellMetrics {
  total: number
  running: number
  completed: number
  failed: number
  queued: number
  blocked: number
  /** completed / (completed + failed) — 0–100, NaN → 0 */
  successRate: number
}
```

### State Ownership

All state lives in the **Root** and flows down via context. Bands are purely presentational consumers of context. This mirrors how `RvnChatShell.Root` owns geometry/expansion context and bands consume it.

| State | Owner | Consumers |
|---|---|---|
| `expanded` | Root (controlled or uncontrolled) | ExpandBand, ThreadBand |
| `searchTerm` | Root | SearchBand (writes), ThreadBand (reads filtered list) |
| `expandedTaskId` | Root | ThreadBand → Row |
| `selectedTaskIds` | Root | ThreadBand → Row |
| `metrics` | Root (derived, memoized) | MetricsBand |
| `taskLookup` | Root (derived, Effect HashMap) | ThreadBand → Row → Detail |

---

## CSS Strategy

### New Selectors

All new selectors follow the existing `rvn-chat__inline-task-*` namespace. These go in `src/lib/rvn/chat/styles/message.css` alongside existing inline task styles.

```css
/* ── InlineTaskShell ── */

.rvn-chat__inline-task-shell {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  border: 1px solid #111827;
  background: #05070b;
  color: #e5e7eb;
  overflow: hidden;
}

/* ── ExpandBand ── */

.rvn-chat__inline-task-shell-expand-band {
  /* Replaces .rvn-chat__inline-task-expand-control with richer styling */
  width: 100%;
  border: 0;
  border-bottom: 1px solid #1f2937;
  background: #03060a;
  color: #cbd5e1;
  padding: 4px 10px;
  font-family: var(--rvn-font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rvn-chat__inline-task-shell-expand-band[data-expanded] {
  background: #111827;
  color: #e5e7eb;
}

.rvn-chat__inline-task-shell-expand-band-count {
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.rvn-chat__inline-task-shell-expand-band-chevron {
  display: inline-flex;
  transition: transform 140ms ease;
}

.rvn-chat__inline-task-shell-expand-band[data-expanded]
  .rvn-chat__inline-task-shell-expand-band-chevron {
  transform: rotate(180deg);
}

/* ── MetricsBand ── */

.rvn-chat__inline-task-shell-metrics-band {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid #1f2937;
  background: #0d0d0d;
}

.rvn-chat__inline-task-shell-metric-cell {
  padding: 4px 10px;
  border-right: 1px solid #1f2937;
}

.rvn-chat__inline-task-shell-metric-cell:last-child {
  border-right: 0;
}

.rvn-chat__inline-task-shell-metric-label {
  font-family: var(--rvn-font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 1px;
}

.rvn-chat__inline-task-shell-metric-value {
  font-family: var(--rvn-font-mono);
  font-size: 16px;
  font-weight: 500;
  color: #e5e7eb;
  font-variant-numeric: tabular-nums;
}

.rvn-chat__inline-task-shell-metric-value[data-status='running'] {
  color: #22d3ee;
}

.rvn-chat__inline-task-shell-metric-value[data-status='completed'] {
  color: #4ade80;
}

.rvn-chat__inline-task-shell-metric-value[data-status='failed'] {
  color: #f87171;
}

/* ── ThreadBand ── */

.rvn-chat__inline-task-shell-thread-band {
  overflow-y: auto;
  background: #050505;
}

/* ── SearchBand ── */

.rvn-chat__inline-task-shell-search-band {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-top: 1px solid #1f2937;
  background: #0a0a0a;
}

.rvn-chat__inline-task-shell-search-prompt {
  color: #4ade80;
  font-family: var(--rvn-font-mono);
  font-size: 12px;
  flex-shrink: 0;
}

.rvn-chat__inline-task-shell-search-input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: none;
  color: #cbd5e1;
  font-family: var(--rvn-font-mono);
  font-size: 12px;
  padding: 2px 0;
}

.rvn-chat__inline-task-shell-search-input::placeholder {
  color: #4b5563;
}

.rvn-chat__inline-task-shell-search-hints {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.rvn-chat__inline-task-shell-search-hint {
  padding: 1px 4px;
  border: 1px solid #1f2937;
  border-radius: 2px;
  font-family: var(--rvn-font-mono);
  font-size: 10px;
  font-weight: 700;
  color: #4b5563;
}

/* ── Row Progress (extracted) ── */

.rvn-chat__inline-task-row-progress-standalone {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rvn-chat__inline-task-row-progress-track {
  height: 4px;
  flex: 1;
  background: #1f2937;
  border-radius: 2px;
  overflow: hidden;
}

.rvn-chat__inline-task-row-progress-fill {
  height: 100%;
  transition: width 300ms ease;
}

.rvn-chat__inline-task-row-progress-fill[data-status='running'] {
  background: #22d3ee;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 0,
    rgba(255, 255, 255, 0.15) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 75%
  );
  background-size: 1rem 1rem;
  animation: rvn-progress-stripes 1s linear infinite;
}

.rvn-chat__inline-task-row-progress-fill[data-status='completed'] {
  background: #4ade80;
}

.rvn-chat__inline-task-row-progress-fill[data-status='failed'] {
  background: #f87171;
}

.rvn-chat__inline-task-row-progress-percent {
  font-family: var(--rvn-font-mono);
  font-size: 12px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
  min-width: 28px;
  text-align: right;
}

@keyframes rvn-progress-stripes {
  from { background-position: 1rem 0; }
  to { background-position: 0 0; }
}

/* ── Row Toolbar (extracted) ── */

.rvn-chat__inline-task-row-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 3px 6px;
  border-top: 1px solid rgba(31, 41, 55, 0.5);
  background: #070707;
}

/* ── Row Action Button (generic variant) ── */

.rvn-chat__inline-task-row-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  font-family: var(--rvn-font-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.rvn-chat__inline-task-row-action-btn:hover {
  color: #e5e7eb;
  background: #1f2937;
}

.rvn-chat__inline-task-row-action-btn--danger {
  color: #f87171;
}

.rvn-chat__inline-task-row-action-btn--danger:hover {
  color: #fca5a5;
  background: rgba(127, 29, 29, 0.2);
}

.rvn-chat__inline-task-row-action-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

### Existing CSS That Stays

The following selectors in `message.css` are **unchanged** — row, detail, badge, status, progress bar (the inline variant) all remain. The new shell wraps around them.

- `.rvn-chat__inline-task-row*` — all row selectors stay
- `.rvn-chat__inline-task-detail*` — all detail compound selectors stay
- `.rvn-chat__inline-task-badge*` — badge selectors stay
- `.rvn-chat__inline-task-expand-control` — stays but becomes legacy (ExpandBand replaces it)
- `.rvn-chat__inline-task-thread-virtualized` — stays as fallback for non-shell usage

---

## Row Sub-Extractions

Three new compounds extracted from the muse's `TaskItem` that don't exist in current code:

### 1. `InlineTaskRowProgress` (line 323–349)

**What**: Standalone progress bar with track, fill, and percentage label.

**Props**:
```ts
interface InlineTaskRowProgressProps {
  progress: number          // 0–100
  status: RvnChatInlineTaskStatus
  animated?: boolean        // stripe animation for running
}
```

**Muse reference**: The muse renders this in two places — once as a thin 2px bar at the bottom of the toggle row (for running tasks), and once as a full progress bar in the expanded detail grid. The extracted component serves the detail grid use case. The toggle-bottom bar stays inline in the row.

### 2. `InlineTaskRowToolbar` (line 410–464)

**What**: Action strip rendered at the bottom of an expanded task row.

**Props**:
```ts
interface InlineTaskRowToolbarProps {
  task: RvnChatInlineTaskItem
  actions?: ReadonlyArray<InlineTaskRowAction>
  onAction?: (actionId: string, task: RvnChatInlineTaskItem) => void
}

interface InlineTaskRowAction {
  id: string
  label: string
  icon: ReactNode
  variant?: 'default' | 'danger'
  /** Future: atom operation binding */
  disabled?: boolean
}
```

**Default actions** (from muse):
- `view-logs` — Eye icon, default variant
- `retry` — Refresh icon, default variant
- `abort` — X icon, danger variant

Actions are declarative. The `onAction` callback receives the action ID — actual atom operations will be wired in a future pass.

### 3. `InlineTaskRowActionBtn` (line 413)

**What**: Generic variant button used inside the toolbar. All buttons share the same base shape with variant appearance (default/danger) and an action callback.

**Props**:
```ts
interface InlineTaskRowActionBtnProps extends ComponentPropsWithoutRef<'button'> {
  icon?: ReactNode
  label: string
  variant?: 'default' | 'danger'
}
```

---

## Copy-to-Clipboard Per Field

The muse (line 353–404) renders a copy button on every detail field value. Our current `InlineTaskDetailFields` doesn't have this.

**Addition**: Add an optional `copyable?: boolean` prop to `InlineTaskDetailFields`. When true, each non-empty field value renders a small copy icon that writes the value to clipboard. Uses a transient `copied` state per field key (1.5s flash).

This is a surgical addition to the existing component — not a new file.

---

## Status Utility Functions

The muse's `getStatusColor` (line 103) and `getStatusIcon` (line 119) are nice utilities. We already have equivalent coverage:

- **`getStatusColor`** → Covered by CSS `data-status` attribute selectors throughout `message.css`. No need for a JS utility returning Tailwind classes — we use component-level CSS.
- **`getStatusIcon`** → Covered by `StatusIndicator` in `inline-task-row.tsx` using Lucide icons + motion.

**No new utility needed.** The muse's approach (Tailwind class strings) conflicts with our CSS discipline. Our `data-status` attribute selectors are the correct pattern.

---

## Migration Path

### What Gets Absorbed

`inline-task-virtualized-list.tsx` (471 lines) is the primary migration target. Its responsibilities split across the shell:

| VirtualizedList Responsibility | Shell Target |
|---|---|
| `internalExpanded` / `effectiveExpanded` state | Root context |
| `expandedTaskId` state | Root context |
| `selectedTaskIds` state | Root context |
| `taskLookup` HashMap | Root context (derived) |
| `panelViewportHeight` computation | ThreadBand |
| `useVirtualizer` setup | ThreadBand |
| Virtual row rendering loop | ThreadBand |
| Transfer token generation | Root (or ThreadBand) |
| Clipboard copy handler | Root (keyboard handler) |
| `ExpandControl` rendering | ExpandBand |

### What Stays Untouched

- `inline-task-row.tsx` — Row component stays, gains RowToolbar + RowProgress extraction
- `inline-task-detail/*` — Entire detail compound stays as-is
- `inline-task-types.ts` — Schema types stay
- `inline-task-log.tsx` — Log component stays
- `inline-task-thread.tsx` — Compound export hub evolves (adds shell members)

### Backward Compatibility

`RvnChatInlineTaskVirtualizedList` remains available for non-shell consumers (e.g., direct embedding in message attachment lanes). The shell is an alternative composition surface, not a replacement. Both share `RvnChatInlineTaskRow` and `InlineTaskDetail`.

---

## Token Reference (from muse `customStyles`)

The muse defines CSS custom properties at line 3. These map to our existing token layer:

| Muse Token | Our Equivalent | Source |
|---|---|---|
| `--bg-dark: #050505` | `#05070b` in `.rvn-chat__inline-task-thread` | `message.css` |
| `--bg-card: #0A0A0A` | `#0a0a0a` in various backgrounds | `message.css` |
| `--bg-hover: #121212` | `#111827` in expanded/hover states | `message.css` |
| `--border: #1F1F1F` | `#1f2937` throughout inline task selectors | `message.css` |
| `--accent-green: #00FF94` | `#4ade80` (completed status) | `message.css` |
| `--accent-blue: #00E1FF` | `#22d3ee` (running status) | `message.css` |
| `--text-main: #E5E5E5` | `#e5e7eb` / `#e9e4d6` | `message.css` |
| `--text-dim: #6B7280` | `#64748b` / `#4b5563` | `message.css` |

No new tokens needed. Our existing palette is slightly warmer (the `#e9e4d6` cream tone) and our borders are slightly bluer (`#1f2937` vs `#1F1F1F`). Keep ours.

---

## Muse Annotation Inventory (Complete)

### TODOs

| Line | Tag | Resolution |
|---|---|---|
| 3 | `TODO[customStyles]` | Token mapping — our tokens already cover this. See token table above. |
| 189 | `TODO: RvnInlineTaskRow mapping` | Covered — our `RvnChatInlineTaskRow` is more complete. Add toolbar + progress extractions. |
| 323 | `TODO: RvnInlineTaskExpandedRowProgressBar` | → `inline-task-row-progress.tsx` — new compound member. |
| 353 | `TODO: elite schema destructuring` | Already implemented in `InlineTaskDetailFields`. Add copy-to-clipboard per field. |
| 410 | `TODO: RvnInlineTaskExpandedRowToolbar` | → `inline-task-row-toolbar.tsx` — new compound member. |
| 413 | `TODO: RvnInlineTaskRowExpandedToolbarButton` | → `inline-task-row-action-btn.tsx` — generic variant button. |
| 554 | `TODO: header band componentization` | → Full shell architecture (this document). Header removed, ExpandBand replaces. |
| 596 | `TODO: Metrics band` | → `metrics-band/` — new band compound. |
| 624 | `TODO: Inline Task Row band` | → `thread-band/` — absorbs virtualizer. |

### NOTEs

| Line | Resolution |
|---|---|
| 103 | `getStatusColor` — we use CSS `data-status` selectors instead of JS class strings. Already covered. |
| 119 | `getStatusIcon` — we use `StatusIndicator` with Lucide + motion. Already covered. |
| 626 | Virtualizer mapping — ThreadBand absorbs this with explicit control over the mapping function. |

### Inline Split Comments

| Line | Resolution |
|---|---|
| 287 | `{ /* Split. */ }` — Detail field grid split between header fields and schema fields. Already split in our compound (`InlineTaskDetailFields` is its own component). |
| 325 | `{ /* e.g. split here. */ }` — Progress bar extraction point. → `inline-task-row-progress.tsx`. |
