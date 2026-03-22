# Conductor Inline Task Thread Contract v1

Date: 2026-02-11  
Owner: Val  
Source: questionnaires `conductor-inline-task-thread-contract-v1` + `inline-task-thread-motion-expectations-v1`

## Locked decisions

1. **Binding model:** both
   - Session-scoped thread with message anchors.
2. **Collapsed preview count:** 3 tasks.
3. **Ordering:** oldest-first chronology.
4. **Expanded virtualization:** use TanStack virtual list.
5. **Step statuses required:**
   - queued
   - running
   - paused
   - completed
   - failed
   - cancelled
   - blocked
6. **Event payload direction:** inline harness task schema (`inlineharnesstask`) with async handling.
7. **Expansion model:** hybrid.
   - Accordion default.
   - Drawer-style reveal at L3 only.
8. **Expansion/collapse triggers:** all required.
   - Explicit chevron/button.
   - Row click.
   - Keyboard (Enter/Space on control).
   - Auto-open while streaming updates.
9. **Motion profile:** snappy.
   - Target range: ~140–180ms.
10. **Collapsed content handling:** hybrid mount policy.
    - Keep lightweight shell mounted.
    - Virtualize heavy expanded content.
11. **Reduced motion policy:** opacity-only fade.
12. **Expansion state ownership:** per-message.

---

## Event contract (schema target)

Create Effect Schema union for task events:

- `InlineHarnessTaskThreadStarted`
- `InlineHarnessTaskUpserted`
- `InlineHarnessTaskStatusChanged`
- `InlineHarnessTaskProgressChanged`
- `InlineHarnessTaskLogAppended`
- `InlineHarnessTaskCompleted`
- `InlineHarnessTaskFailed`
- `InlineHarnessTaskThreadCompleted`

Shared required fields (minimum):

- `threadId` (session-scoped)
- `messageAnchorId` (optional message anchor)
- `taskId`
- `title`
- `status`
- `progress` (nullable)
- `seq`
- `at`
- `message` (optional human log)

---

## Atom model (Atom-as-State)

- `inlineTaskEventsByThreadAtom` (family/map)
- `inlineTaskThreadStateAtom` (derived reduce from events)
- `inlineTaskUiStateAtom` (expanded/collapsed + viewport state)

Rendering behavior:

- Collapsed: render first 3 chronological tasks.
- Expanded: render full task thread via TanStack virtual list.
- Toggle: inline expand/collapse control on task-thread component.

## Motion + interaction contract (locked)

- Canonical mode: **hybrid**.
  - Non-L3: accordion-style inline expansion.
  - L3: drawer-style reveal behavior.
- Trigger matrix:
  - explicit control click,
  - row click,
  - keyboard activation,
  - auto-open on streaming activity.
- Timing profile:
  - snappy brutalist, ~140–180ms.
- Reduced motion:
  - opacity-only fade (no large transform choreography).
- State ownership:
  - expansion state is per-message (not global thread singleton).

---

## Component extraction backlog (explicit)

In addition to existing scaffolds, add/flesh:

1. `msg/inline-task-thread.tsx`
2. `msg/inline-task-row.tsx`
3. `msg/inline-task-log.tsx`
4. `status/connection-badge.tsx`
5. `frame/title-slot.tsx`
6. `frame/header-slot.tsx`
7. `frame/thread-slot.tsx`
8. `frame/composer-slot.tsx`

These are required to fully cover missing surfaces called out by user.

---

## Integration staging

1. Define schema + atoms first.
2. Build inline task thread component against atoms.
3. Add virtualization in expanded mode.
4. Mount inline task thread inside message/thread surface.
5. Later: harness emits real inline task events into the contract.
