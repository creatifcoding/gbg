# InlineTaskShell — CSS Inventory & Selector Map

**Status**: Design  
**Parent**: `inline-task-shell-architecture.md`  
**Date**: 2026-02-13

---

## Existing Selectors (stays, no changes)

All of these live in `src/lib/rvn/chat/styles/message.css` and are **unchanged** by the shell work.

### Thread Container

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-thread` | Non-shell thread container |
| `.rvn-chat__inline-task-thread-virtualized` | VirtualizedList root (stays for non-shell consumers) |
| `.rvn-chat__inline-task-thread-virtualized:focus-visible` | Focus ring |
| `.rvn-chat__inline-task-thread-panel` | Animated panel wrapper |
| `.rvn-chat__inline-task-thread-panel--drawer` | Drawer variant |
| `.rvn-chat__inline-task-thread-virtual-scroll` | Scroll viewport |
| `.rvn-chat__inline-task-thread-virtual-inner` | Virtualizer sizing container |
| `.rvn-chat__inline-task-thread-virtual-row` | Absolute-positioned virtual row |
| `.rvn-chat__inline-task-thread-item` | Generic thread item |

### Row

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-row` | Row root |
| `.rvn-chat__inline-task-row--draggable` | Cursor: grab |
| `.rvn-chat__inline-task-row--draggable:active` | Cursor: grabbing |
| `.rvn-chat__inline-task-row[data-selected]` | Selection highlight |
| `.rvn-chat__inline-task-row[data-transfer-state='dragging']` | Drag highlight |
| `.rvn-chat__inline-task-row-toggle` | Toggle button (full-width) |
| `.rvn-chat__inline-task-row-head` | Title + grip + status layout |
| `.rvn-chat__inline-task-row-grip` | Drag grip icon |
| `.rvn-chat__inline-task-row-title` | Task title text |
| `.rvn-chat__inline-task-row-status` | Status indicator + label container |
| `.rvn-chat__inline-task-row-status-label` | Status text |
| `.rvn-chat__inline-task-row-indicator` | Status icon wrapper |
| `.rvn-chat__inline-task-row-indicator--running` | Running spinner |
| `.rvn-chat__inline-task-row-indicator--queued` | Queued pulse |
| `.rvn-chat__inline-task-row-chevron` | Expand/collapse chevron |
| `.rvn-chat__inline-task-row[data-expanded] .rvn-chat__inline-task-row-chevron` | Rotated chevron |
| `.rvn-chat__inline-task-row-details` | Expanded details container |
| `.rvn-chat__inline-task-row-message` | Message/note text |
| `.rvn-chat__inline-task-row-progress` | Inline progress bar (thin) |
| `.rvn-chat__inline-task-row-progress-center` | Progress centering |
| `.rvn-chat__inline-task-row-progress-bar` | Progress fill (striped) |
| `.rvn-chat__inline-task-row[data-status='running'] .rvn-chat__inline-task-row-status` | Cyan status |
| `.rvn-chat__inline-task-row[data-status='completed'] .rvn-chat__inline-task-row-status` | Green status |
| `.rvn-chat__inline-task-row[data-status='failed|blocked|cancelled'] .rvn-chat__inline-task-row-status` | Red status |

### Detail Compound

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-detail` | Detail root |
| `.rvn-chat__inline-task-detail-grid` | Schema-driven field grid |
| `.rvn-chat__inline-task-detail-field` | Individual field (dt + dd) |
| `.rvn-chat__inline-task-detail-field dt` | Field key |
| `.rvn-chat__inline-task-detail-field dd` | Field value |
| `.rvn-chat__inline-task-detail-field-value` | Generic text value |
| `.rvn-chat__inline-task-detail-status` | Status field compound |
| `.rvn-chat__inline-task-detail-status[data-status='*']` | Per-status colors |
| `.rvn-chat__inline-task-detail-status-icon` | Status icon in detail |
| `.rvn-chat__inline-task-detail-status-label` | Status label in detail |
| `.rvn-chat__inline-task-detail-deps` | Dependency badge container |

### Badge

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-badge` | Badge root |
| `.rvn-chat__inline-task-badge:hover` | Hover state |
| `.rvn-chat__inline-task-badge-id` | Task ID text |
| `.rvn-chat__inline-task-badge-dot` | Status dot |
| `.rvn-chat__inline-task-badge-dot[data-status='*']` | Per-status dot colors |

### Log + Expand Control

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-log` | Log container |
| `.rvn-chat__inline-task-log-entry` | Log entry |
| `.rvn-chat__inline-task-log-time` | Log timestamp |
| `.rvn-chat__inline-task-log-message` | Log message |
| `.rvn-chat__inline-task-expand-control` | Old expand button (stays for backward compat) |
| `.rvn-chat__inline-task-expand-control[data-expanded]` | Expanded state |

---

## New Selectors (to be added)

All appended to `src/lib/rvn/chat/styles/message.css` after existing inline task selectors.

### Shell Root

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-shell` | Shell root — 4-row grid |

### ExpandBand

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-shell-expand-band` | Band root — button |
| `.rvn-chat__inline-task-shell-expand-band[data-expanded]` | Expanded state |
| `.rvn-chat__inline-task-shell-expand-band-count` | Task count label |
| `.rvn-chat__inline-task-shell-expand-band-chevron` | Chevron icon |
| `.rvn-chat__inline-task-shell-expand-band[data-expanded] ...chevron` | Rotated |

### MetricsBand

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-shell-metrics-band` | Band root — 4-col grid |
| `.rvn-chat__inline-task-shell-metric-cell` | Cell container |
| `.rvn-chat__inline-task-shell-metric-cell:last-child` | No right border |
| `.rvn-chat__inline-task-shell-metric-label` | Cell label |
| `.rvn-chat__inline-task-shell-metric-value` | Cell value |
| `.rvn-chat__inline-task-shell-metric-value[data-status='*']` | Status-colored values |

### ThreadBand

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-shell-thread-band` | Band root — scrollable |

### SearchBand

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-shell-search-band` | Band root — flex row |
| `.rvn-chat__inline-task-shell-search-prompt` | Green `❯` prompt |
| `.rvn-chat__inline-task-shell-search-input` | Text input |
| `.rvn-chat__inline-task-shell-search-input::placeholder` | Placeholder color |
| `.rvn-chat__inline-task-shell-search-hints` | Hotkey hint container |
| `.rvn-chat__inline-task-shell-search-hint` | Individual hint badge |

### Row Progress (Standalone)

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-row-progress-standalone` | Standalone container |
| `.rvn-chat__inline-task-row-progress-track` | Track (background bar) |
| `.rvn-chat__inline-task-row-progress-fill` | Fill bar |
| `.rvn-chat__inline-task-row-progress-fill[data-status='running']` | Cyan + stripes |
| `.rvn-chat__inline-task-row-progress-fill[data-status='completed']` | Green |
| `.rvn-chat__inline-task-row-progress-fill[data-status='failed']` | Red |
| `.rvn-chat__inline-task-row-progress-percent` | Percentage label |
| `@keyframes rvn-progress-stripes` | Stripe animation |

### Row Toolbar

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-row-toolbar` | Toolbar container |

### Row Action Button

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-row-action-btn` | Button base |
| `.rvn-chat__inline-task-row-action-btn:hover` | Hover state |
| `.rvn-chat__inline-task-row-action-btn--danger` | Danger variant |
| `.rvn-chat__inline-task-row-action-btn--danger:hover` | Danger hover |
| `.rvn-chat__inline-task-row-action-btn-icon` | Icon wrapper |

### Copy-to-Clipboard (detail field addition)

| Selector | Purpose |
|---|---|
| `.rvn-chat__inline-task-detail-field-copy` | Copy button |
| `.rvn-chat__inline-task-detail-field-copy:hover` | Hover state |
| `.rvn-chat__inline-task-detail-field-copy[data-copied]` | Copied flash |

---

## Selector Count Summary

| Category | Existing | New | Total |
|---|---|---|---|
| Thread container | 9 | 0 | 9 |
| Row | 24 | 0 | 24 |
| Detail compound | 12 | 1 (copy btn) | 13 |
| Badge | 6 | 0 | 6 |
| Log + expand | 6 | 0 | 6 |
| Shell root | 0 | 1 | 1 |
| ExpandBand | 0 | 5 | 5 |
| MetricsBand | 0 | 6 | 6 |
| ThreadBand | 0 | 1 | 1 |
| SearchBand | 0 | 6 | 6 |
| Row Progress | 0 | 7 | 7 |
| Row Toolbar | 0 | 1 | 1 |
| Row Action Btn | 0 | 5 | 5 |
| **Total** | **57** | **33** | **90** |
