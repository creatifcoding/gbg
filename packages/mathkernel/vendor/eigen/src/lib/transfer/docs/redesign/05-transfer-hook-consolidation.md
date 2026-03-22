# 05 — Transfer Hook Consolidation

**Parent**: [Index](./00-transfer-redesign-index.md)  
**Survey answer**: *"One `useInlineTaskTransfer()` hook encapsulates everything — basically, the hook would be a compound hook."*

---

## Current Consumer Tax: 80+ Lines in VirtualizedList

The VirtualizedList currently does all of this inline:

```typescript
// 1. Build origin (8 lines)
const transferOrigin = useMemo(() => ({
  surfaceId: 'inline-task-thread',
  sourceId: threadId,
  // ...
}), [threadId])

// 2. Build per-task token map (12 lines)
const taskReferenceTokens = useMemo(() => {
  const map = new Map<string, TransferReferenceToken>()
  for (const task of tasks) {
    map.set(task.id, createTaskReferenceToken(task, transferOrigin))
  }
  return map
}, [tasks, transferOrigin])

// 3. Build cluster token (6 lines)
const clusterReferenceToken = useMemo(() =>
  createClusterReferenceToken(tasks, transferOrigin),
  [tasks, transferOrigin]
)

// 4. Derive selected tokens (5 lines)
const selectedTaskTokens = useMemo(() =>
  selectedTaskIds.map(id => taskReferenceTokens.get(id)).filter(Boolean),
  [selectedTaskIds, taskReferenceTokens]
)

// 5. Wire clipboard hook (4 lines)
const { copyToClipboard } = useTransferClipboard({
  tokens: selectedTaskTokens,
  origin: transferOrigin,
})

// 6. Wire draggable hook on cluster (8 lines)
const { dragHandleProps, isDragging } = useTransferDraggable({
  token: clusterReferenceToken,
  label: `${tasks.length} tasks`,
})

// 7. Keyboard handler (6 lines)
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      copyToClipboard()
    }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}, [copyToClipboard])

// 8. Thread 6 props to every row (repeated per-row in JSX)
<InlineTaskRow
  transferToken={taskReferenceTokens.get(task.id)}
  transferOrigin={transferOrigin}
  isDragging={isDragging && selectedTaskIds.includes(task.id)}
  onDragStart={...}
  onCopy={...}
  isSelected={selectedTaskIds.includes(task.id)}
/>
```

**This is the integration cost the questionnaire rejected.** Every surface that wants transfer has to replicate this pattern.

---

## The Compound Hook: `useInlineTaskTransfer`

One hook. One call. Everything encapsulated.

### Signature

```typescript
interface InlineTaskTransferConfig {
  /** Thread identifier (scopes the transfer surface) */
  threadId: string

  /** Tasks in this thread (source data for token generation) */
  tasks: ReadonlyArray<AgentTask>

  /** Label for cluster drags */
  clusterLabel?: string

  /** Which task IDs are currently selected (for multi-copy) */
  selectedIds?: ReadonlySet<string>

  /** Callback when a task is dropped onto this surface (if target-capable) */
  onReceive?: (tokens: ReadonlyArray<TransferToken>) => void
}

interface InlineTaskTransferHandle {
  // ── Row Props Factory ────────────────────────────────────
  /** Get all transfer-related props for a specific row */
  getRowTransferProps: (taskId: string) => InlineTaskRowTransferProps

  // ── Cluster Operations ───────────────────────────────────
  /** Drag handle props for the expand-band cluster drag */
  clusterDragProps: DragHandleProps

  /** Copy entire cluster to clipboard */
  copyCluster: () => void

  // ── Selection Operations ─────────────────────────────────
  /** Copy selected tasks to clipboard */
  copySelection: () => void

  /** Toggle task selection */
  toggleSelect: (taskId: string) => void

  /** Clear selection */
  clearSelection: () => void

  // ── State (for trait/feedback) ───────────────────────────
  /** Is any drag active from this surface? */
  isDragging: boolean

  /** Number of items in active drag */
  dragCount: number

  /** Currently selected task IDs */
  selectedIds: ReadonlySet<string>

  // ── Scope Reference ──────────────────────────────────────
  /** Direct scope access for advanced use cases */
  scope: TransferScope
}
```

### Usage in InlineTaskShell

```tsx
// Inside InlineTaskShellRoot or ThreadBand
function InlineTaskShellRoot({ threadId, tasks, children }: Props) {
  const transfer = useInlineTaskTransfer({
    threadId,
    tasks,
    clusterLabel: `${tasks.length} tasks`,
  })

  return (
    <InlineTaskShellContext.Provider value={{
      tasks,
      transfer,
      // ... other shell state
    }}>
      {children}
    </InlineTaskShellContext.Provider>
  )
}
```

### Usage in ExpandBand (cluster drag)

```tsx
function ExpandBandRoot() {
  const { transfer } = useInlineTaskShellContext()

  return (
    <div className="expand-band">
      <button
        {...transfer.clusterDragProps}
        onClick={transfer.copyCluster}
      >
        {tasks.length} tasks
      </button>
    </div>
  )
}
```

### Usage in ThreadBand Rows

```tsx
function InlineTaskRow({ task }: { task: AgentTask }) {
  const { transfer } = useInlineTaskShellContext()
  const rowTransfer = transfer.getRowTransferProps(task.id)

  return (
    <div
      className="inline-task-row"
      data-transfer-dragging={rowTransfer.isDragging || undefined}
      draggable={rowTransfer.draggable}
      onDragStart={rowTransfer.onDragStart}
      onDragEnd={rowTransfer.onDragEnd}
    >
      {/* row content */}
    </div>
  )
}
```

**Zero prop threading.** Rows access transfer via context. The compound hook provides a factory function (`getRowTransferProps`) that calculates the right props per task ID.

---

## `InlineTaskRowTransferProps`

The per-row transfer props returned by `getRowTransferProps`:

```typescript
interface InlineTaskRowTransferProps {
  /** Is this specific row being dragged? */
  isDragging: boolean

  /** Is this row selected for multi-transfer? */
  isSelected: boolean

  /** HTML draggable attribute */
  draggable: boolean

  /** Drag event handlers */
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void

  /** Click handler for selection toggle */
  onSelectToggle: () => void

  /** Copy this single task to clipboard */
  onCopy: () => void
}
```

### How `getRowTransferProps` Works Internally

```typescript
const getRowTransferProps = useCallback((taskId: string): InlineTaskRowTransferProps => {
  const token = tokenMap.get(taskId)
  const isDragging = session !== null && session.tokens.some(t =>
    t.ref._tag === 'TaskRef' && t.ref.taskId === taskId
  )
  const isSelected = selectedIds.has(taskId)

  return {
    isDragging,
    isSelected,
    draggable: true,
    onDragStart: (e) => {
      if (!token) return
      const tokens = isSelected && selectedIds.size > 1
        ? Array.from(selectedIds).map(id => tokenMap.get(id)).filter(Boolean)
        : [token]
      startDrag(e, tokens)
    },
    onDragEnd: () => endDrag(),
    onSelectToggle: () => toggleSelect(taskId),
    onCopy: () => copySingle(taskId),
  }
}, [tokenMap, session, selectedIds, startDrag, endDrag, toggleSelect, copySingle])
```

This is a **factory function**, not a hook. It can be called per-row in render without violating hook rules. The underlying state (tokenMap, session, selectedIds) comes from the compound hook's scope atoms.

---

## Internal Composition

The compound hook internally composes the lower-level concerns:

```
useInlineTaskTransfer
├── useTransferScope(config)      → scope (Effect Scope lifecycle)
│   ├── session atom
│   ├── selection atom
│   └── clipboard atom
├── useTokenMap(tasks, scope)     → Map<taskId, TransferToken>
├── useDragHandlers(scope)        → startDrag, endDrag
├── useClipboardHandlers(scope)   → copyToClipboard, copySingle
├── useKeyboardBindings(scope)    → Ctrl+C handler
└── useTraitDerivation(scope)     → source/feedback trait props
```

Each internal concern is a small, focused hook. The compound hook composes them. The consumer never sees the internals.

---

## Hook Elimination Matrix

| Current Hook | Compound Hook Absorbs | Notes |
|---|---|---|
| `useTransferDraggable` | `useDragHandlers` (internal) | DOM drag events + ghost image |
| `useTransferClipboard` | `useClipboardHandlers` (internal) | Read/write + in-memory fallback |
| `useTransferDroppable` | Stays separate (target-side) | Not part of source compound |
| `useTransferRuntime` | Eliminated | Replaced by scope atoms |

`useTransferDroppable` stays as a standalone hook for the **target side** (composer). The compound hook is source-focused. Target integration is lighter (one hook call in composer).

---

## Keyboard Binding Internals

The compound hook registers keyboard shortcuts scoped to its surface:

```typescript
// Inside useInlineTaskTransfer, internal useKeyboardBindings
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return

    switch (e.key) {
      case 'c':
        if (selectedIds.size > 0) {
          e.preventDefault()
          copySelection()
        }
        break
      case 'a':
        e.preventDefault()
        selectAll()
        break
    }
  }

  // Scoped to the shell's DOM element, not document
  shellRef.current?.addEventListener('keydown', handler)
  return () => shellRef.current?.removeEventListener('keydown', handler)
}, [selectedIds, copySelection, selectAll, shellRef])
```

Key improvement: **scoped to the shell DOM**, not `document`. Two shells on the same page don't fight over Ctrl+C.

---

## Migration Path

### Phase 1: Create compound hook (no consumer changes)

Build `useInlineTaskTransfer` that wraps all existing hooks internally. The VirtualizedList can switch to it — same behavior, less code.

### Phase 2: Wire into InlineTaskShell

Replace VirtualizedList's inline transfer code with compound hook via shell context. ThreadBand rows use `getRowTransferProps`. ExpandBand uses `clusterDragProps`.

### Phase 3: Remove standalone source hooks

Once all consumers use the compound hook, the standalone `useTransferDraggable` and `useTransferClipboard` can be deprecated (kept for non-shell consumers) or removed.
