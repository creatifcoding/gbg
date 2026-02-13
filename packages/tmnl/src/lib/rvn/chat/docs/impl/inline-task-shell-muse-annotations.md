# InlineTaskShell — Muse Annotation Audit

**Source**: `src/lib/rvn/chat/integrate/morebetter-inlinetask-muse.tsx`  
**Date**: 2026-02-13

---

## Full Annotation Inventory

Every `TODO`, `NOTE`, and inline `{ /* */ }` comment from the muse, with line numbers, verbatim text, and resolution status.

---

### TODO Annotations

#### 1. `TODO[customStyles]` — Line 3

**Verbatim**:
```
// TODO[customStyles]:
```

**Context**: CSS custom properties object with 8 design tokens (`--bg-dark`, `--bg-card`, etc.).

**Resolution**: ✅ Already covered. Our token palette in `message.css` covers all 8 values with slightly warmer tones. No action needed — we don't use JS-defined CSS vars, we use component-level CSS selectors.

---

#### 2. `TODO: RvnInlineTaskRow mapping` — Line 189

**Verbatim**:
```
// TODO: We have a RvnInlineTaskRow. This is the loose mapping. Again its not as 1-to-1. Fill in the gaps. Componentize.
```

**Context**: The muse's `TaskItem` component — a self-contained accordion row with toggle, details grid, progress bar, and action toolbar.

**Resolution**: ⚠️ Partially covered. Our `RvnChatInlineTaskRow` handles toggle, status indicator, detail panel (via `InlineTaskDetail`), and progress bar. **Gaps**:
- No action toolbar (View Logs / Retry / Abort) → new `InlineTaskRowToolbar`
- No standalone progress bar in detail grid → new `InlineTaskRowProgress`
- No copy-to-clipboard on detail field values → addition to `InlineTaskDetailFields`

---

#### 3. `TODO: RvnInlineTaskExpandedRowProgressBar` — Line 323

**Verbatim**:
```
{ /* TODO: Need this, RvnInlineTaskExpandedRowProgressBar or something. All of the buttons are basically the same (until they're not) we ought to give ourselves a generic button that you offer up variants for the appearance and action logic. Obviously the action props aren't implemented quite yet, but as you can imagine, progress will be a Atom.subscribable from a task based atom..*// }
```

**Context**: Progress bar with track, fill (status-colored), stripe animation for running, and percentage label. Rendered in the expanded detail grid.

**Resolution**: → New component `inline-task-row-progress.tsx`. Stateless, status-driven. Future atom subscription noted but deferred (action props not wired yet).

---

#### 4. `TODO: elite schema destructuring` — Line 353

**Verbatim**:
```
{/* TODO: We have elite schema destructuring at home LOL. */}
```

**Context**: The muse does `Object.entries(task.details).map(...)` with per-field copy-to-clipboard buttons. Our code uses `SchemaAST.getPropertySignatures` → `AGENT_TASK_FIELD_DESCRIPTORS` iteration.

**Resolution**: ✅ Schema destructuring already implemented and superior. **Gap**: Copy-to-clipboard per field value is missing. Add `copyable` prop to `InlineTaskDetailFields`.

---

#### 5. `TODO: RvnInlineTaskExpandedRowToolbar` — Line 410

**Verbatim**:
```
{ /* TODO: Need this, RvnInlineTaskExpandedRowToolbar or something. you get the idea. You can give it a better name. But this *// }
```

**Context**: Action strip at the bottom of expanded row — "View Logs", "Retry", "Abort" buttons, right-aligned, with border-top separator.

**Resolution**: → New component `inline-task-row-toolbar.tsx`. Renders an array of `InlineTaskRowAction` objects. `onAction` callback receives action ID — actual atom operations deferred.

---

#### 6. `TODO: RvnInlineTaskRowExpandedToolbarButton` — Line 413

**Verbatim**:
```
{ /* TODO: Need this, RvnInlineTaskRowExpandedToolbarButton or something. All of the buttons are basically the same (until they're not) we ought to give ourselves a generic button that you offer up variants for the appearance and action logic. Obviously the action props aren't implemented quite yet, but as you can imagine, it'll be an Atom operation..*// }
```

**Context**: Generic action button with icon + label + variant (default/danger). All three toolbar buttons share this shape.

**Resolution**: → New component `inline-task-row-action-btn.tsx`. Variant-driven (`default` | `danger`). Icon and label props. CSS handles variant styling via `--danger` modifier class.

---

#### 7. `TODO: header band componentization` — Line 554

**Verbatim**:
```
{/* TODO: This is the part that is rife for the componentization. This is where I am seeing where we can split on e.g. the header band.*/}
```

**Context**: The outer shell `<div>` containing header, metrics, task list, and command prompt — the full "Task Runner" chrome.

**Resolution**: → Full `InlineTaskShell` architecture. The muse's header (traffic lights, "Task Runner v2.4.0", "System Online", "Clear Logs", "New Task") is **removed**. The shell uses `ExpandBand` instead — a cleaner show/collapse toggle that fits the inline embedding context. The header chrome belongs to a standalone surface, not an inline message attachment.

---

#### 8. `TODO: Metrics band` — Line 596

**Verbatim**:
```
{/* TODO: Metrics band!! */}
```

**Context**: 4-column grid showing Total Tasks, Running, Completed, and Success Rate, with status-colored values.

**Resolution**: → New `MetricsBand` compound with `MetricCell` children. Metrics derived from task array in shell context. Cell values use `data-status` attributes for color (same pattern as row status colors).

---

#### 9. `TODO: Inline Task Row band` — Line 624

**Verbatim**:
```
{/* TODO: Inline Task Row. band!! */}
```

**Context**: Scrollable flex-1 container with task list rendering.

**Resolution**: → `ThreadBand` absorbs the virtualizer from `VirtualizedList`. Reads `filteredTasks` from context (after search filter), renders virtual rows.

---

### NOTE Annotations

#### 1. `getStatusColor` utility — Line 103

**Verbatim**:
```
// NOTE: I actually like this utility, it's possible that we have this accounted for in our code.
```

**Context**: Returns Tailwind class strings for status badge styling (background, text color, border, optional glow).

**Resolution**: ✅ Already covered via CSS `data-status` attribute selectors. Our approach (component-level CSS on `[data-status='running']`, etc.) is architecturally superior to returning JS class strings. No action needed.

---

#### 2. `getStatusIcon` utility — Line 119

**Verbatim**:
```
// NOTE: The same for this utility, very nice, I'd like you to factor it into our code as well
```

**Context**: Returns inline SVG elements for each status (checkmark, spinner, clock, X).

**Resolution**: ✅ Already covered by `StatusIndicator` in `inline-task-row.tsx` — uses Lucide icons (`Check`, `LoaderCircle`, `Timer`, `AlertTriangle`, `Ban`, `ShieldAlert`, `Pause`) with `motion/react` animations. More complete than the muse (we have 7 statuses vs 4). No action needed.

---

#### 3. Virtualizer mapping concern — Line 626

**Verbatim**:
```
{/* NOTE: I would like to explicitly engineer this mapping function.
Currently we're doing some virtualized list rendering stuff, but, frankly, I don't think I fully  */}
```

**Context**: Concern about the current virtualizer mapping approach — sentence trails off.

**Resolution**: ⚠️ The `ThreadBand` absorbs the virtualizer with a cleaner separation: context owns the task data + filter, ThreadBand owns the virtualizer instance + scroll viewport. The mapping function becomes a simple `filteredTasks.map` inside the virtualizer's render callback — no more mixing state management and rendering in one 471-line component.

---

### Inline Split Comments

#### 1. `{ /* Split. */ }` — Line 287

**Context**: Inside the expanded `TaskItem`, between the header fields grid (Task ID, Title, Status) and the detail fields grid (`Object.entries(task.details)`).

**Resolution**: ✅ Already split in our code. `InlineTaskDetail` is its own compound component, and `InlineTaskDetailFields` handles the schema-driven grid separately from any header fields.

---

#### 2. `{ /* e.g. split here. */ }` — Line 325

**Context**: Inside the expanded header fields grid, marking the progress bar as a component extraction point.

**Resolution**: → `InlineTaskRowProgress` extraction. See TODO #3.

---

## Summary Matrix

| # | Type | Line | Status | Action |
|---|---|---|---|---|
| 1 | TODO | 3 | ✅ Covered | None — tokens already in CSS |
| 2 | TODO | 189 | ⚠️ Partial | Add toolbar, progress, copy-to-clipboard |
| 3 | TODO | 323 | 🔲 New | `inline-task-row-progress.tsx` |
| 4 | TODO | 353 | ⚠️ Partial | Add `copyable` to `InlineTaskDetailFields` |
| 5 | TODO | 410 | 🔲 New | `inline-task-row-toolbar.tsx` |
| 6 | TODO | 413 | 🔲 New | `inline-task-row-action-btn.tsx` |
| 7 | TODO | 554 | 🔲 New | Full shell architecture |
| 8 | TODO | 596 | 🔲 New | MetricsBand |
| 9 | TODO | 624 | 🔲 New | ThreadBand |
| 10 | NOTE | 103 | ✅ Covered | CSS `data-status` selectors |
| 11 | NOTE | 119 | ✅ Covered | `StatusIndicator` component |
| 12 | NOTE | 626 | ⚠️ Concern | ThreadBand refactors the mapping |
| 13 | Split | 287 | ✅ Covered | Already split (InlineTaskDetail compound) |
| 14 | Split | 325 | 🔲 New | RowProgress extraction |
