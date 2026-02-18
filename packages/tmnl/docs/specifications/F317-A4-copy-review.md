# F317-A4 LIVE/PAUSED Copy Review

Row ID: **F317-A4**

## UI copy audit
- Live state label: `LIVE`
- Paused state label: `PAUSED`
- Pause toggle affordance: `⏸` with title `Pause auto-scroll`
- Resume affordance: `▶` with title `Resume auto-scroll`
- Inspect-mode recovery action: `↓ Latest (n)` with title `Jump to latest`

## Why this is unambiguous
- State token is explicit text, not icon-only.
- Toggle title communicates action semantics.
- Recovery action appears only in paused/inspect mode.
- Unread badge (`+n new`) only appears while paused.

## Source anchors
- `src/lib/agents/tasks/views/log-tail-controls.tsx`
- `src/lib/agents/tasks/views/log-view.css`

Status: pass for copy clarity; screenshot artifact still pending manual capture.
