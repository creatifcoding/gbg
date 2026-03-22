# Conductor Chat Layout Component Plan v2

Date: 2026-02-11  
Owner: Val  
Intent source: questionnaire `conductor-chat-layout-plan-v2`

## ALIGNED MODEL (locked)

1. **Shell strategy:** 4-band
   - Header
   - Command rail
   - Thread
   - Composer
2. **Header structure:** fully slotted regions
   - left / center / right
3. **Connection badge:** dot + text + optional latency suffix
4. **Inline task thread placement:** inside assistant message body
5. **Expanded task list mode:** inline expand inside message/thread
6. **Layout non-negotiable:** lock spacing + breakpoints so slot providers cannot overfill surfaces.

### v2.1 Amendments (questionnaire lock)

- Header is **extended semantic compound**: Basic slots + Controls + AgentSelector + SessionCluster.
- Connection badge is **interactive** (icon+states, hover expansion, probe action, visible-only expensive compute).
- Composer requires **deep second-order compounding**:
  - Input(Field/Placeholder/Counter)
  - Toolbar(Mode/Insert/Voice/Transport groups)
  - Transport(Primary/Reconnect)
- Shell bands are **semantic owners**, not layout-only wrappers.
- Adoption strategy is **big-bang** in `ConductorAgentChat`.
- Breakpoint constants intentionally deferred for post-adoption freeze.

### v2.2 Amendments (boundary + message contract lock)

- Boundary model: **Shell absorbs Frame responsibilities** (Shell is top-level owner).
- Message is a **second-order compound** with nested first-order lanes:
  - HeaderCluster
  - BodyContent
  - AttachmentLane
  - FooterActions
  - SeverityRails
- AttachmentLane required mounts:
  - InlineTaskThread
  - ArtifactCard
  - per-message status badges
  - per-attachment collapse controls
- Inline task attachment binding key: **`messageAnchorId` only**.
- Sequence lock: **message contracts first**, then shell second-order absorption work.

---

## What this proves we understood

You are not asking for cosmetic patchwork. You want:
- layout as first-class component architecture,
- explicit slot ownership (header/thread/composer/title areas),
- dedicated connection badge component,
- inline task-thread surface with event contract + atom state,
- and strict containment rules so slots cannot blow up the shell.

---

## Slot-level layout architecture

## 1) Frame compound (4-band)

`RvnChatFrame`
- `RvnChatFrame.Root`
- `RvnChatFrame.Header`
- `RvnChatFrame.CommandRail`
- `RvnChatFrame.Thread`
- `RvnChatFrame.Composer`
- `RvnChatFrame.Corners`

### Header sub-slots (fully slotted)
- `RvnChatHeader.Left`
- `RvnChatHeader.Center`
- `RvnChatHeader.Right`
- `RvnChatHeader.Title`
- `RvnChatHeader.Subtitle`
- `RvnChatHeader.Badges`

## 2) Command rail

- `RvnChatCommandBtn`
- `RvnChatTelemetryPill`

## 3) Thread surfaces

- `RvnChatMessage` compound (role/message primitives)
- `RvnChatMessage.RoleRail`
- `RvnChatInterruptionBanner`
- `RvnChatEmptyState`

## 4) Composer surfaces

- `RvnComposerContentEditable`
- `RvnChatTransportBtn` (+ send/pause/reconnect variants)

## 5) Connectivity/status

- `RvnConnectionBadge`
  - dot + label + optional latency
  - state-driven variants: online/offline/connecting/reconnecting/resyncing

## 6) Inline task thread (inside assistant body)

- `RvnInlineTaskThread`
- `RvnInlineTaskRow`
- `RvnInlineTaskLog`
- `RvnInlineTaskExpandToggle`

Behavior:
- collapsed: first 3 tasks
- expanded: TanStack virtual list
- oldest-first order
- inline expansion (no overlay)

---

## Breakpoint + containment contract

## Breakpoints
- `sm`: <= 640
- `md`: 641-1024
- `lg`: >= 1025

## Containment rules
1. Header slots: hard max widths per region (`left/center/right`) to prevent overfill.
2. Command rail: chips wrap but cannot grow band height beyond configured clamp.
3. Thread: only scrolling region for message/task content.
4. Composer: fixed min/max block size; input internally scrolls after line cap.
5. Slot providers must respect `max-inline-size: 100%` + ellipsis rules where applicable.

---

## Inline task event contract (layout-facing)

Event schema family: `InlineHarnessTaskEvent`

Minimum fields:
- `threadId`
- `messageAnchorId?`
- `taskId`
- `title`
- `status`
- `progress?`
- `seq`
- `at`
- `message?`

Statuses:
- queued, running, paused, completed, failed, cancelled, blocked

State ownership:
- atom-backed thread family keyed by `threadId`
- derived sorted task list (oldest-first)
- UI atom for expanded/collapsed

---

## Proposed directory additions (convention-aligned)

```text
src/lib/rvn/chat/
  frame/
    index.ts
    frame-corners.tsx

  header/
    header-root.tsx
    header-left.tsx
    header-center.tsx
    header-right.tsx
    title-slot.tsx
    subtitle-slot.tsx
    badges-slot.tsx
    index.ts

  status/
    connection-badge.tsx
    telemetry-pill.tsx
    index.ts

  msg/
    msg-role-rail.tsx
    inline-task-thread.tsx
    inline-task-row.tsx
    inline-task-log.tsx
    index.ts

  btn/
    command-btn.tsx
    transport-btn.tsx
    send-btn.tsx
    pause-btn.tsx
    reconnect-btn.tsx
    index.ts

  banner/
    interruption-banner.tsx
    index.ts

  card/
    artifact-card-*.tsx
    index.ts

  empty/
    empty-state.tsx
    index.ts
```

---

## Execution phases

## LAYOUT-01 (structure)
- add header concern with explicit left/center/right/title/subtitle/badges slots
- add `connection-badge.tsx`

## LAYOUT-02 (task thread UI)
- add inline task thread components in `msg/`
- wire TanStack virtualization in expanded mode
- lock hybrid expansion behavior:
  - non-L3 accordion
  - L3 drawer-style reveal
- lock motion profile:
  - snappy 140–180ms
  - reduced-motion opacity-only fade

## LAYOUT-03 (containment guards)
- add breakpoint + spacing clamp classes
- enforce max-fill on slot providers

## LAYOUT-04 (adoption)
- consume new slot components in `ConductorAgentChat`
- preserve runtime behavior contracts

---

## Acceptance checklist (layout lane)

- 4-band shell renders deterministically across breakpoints.
- Header slot providers cannot overfill or collapse sibling regions.
- Connection badge component used (not ad hoc chip).
- Inline task thread appears in assistant message body.
- Collapsed task preview shows 3 tasks; expanded list virtualizes with TanStack.
- Inline task thread uses hybrid reveal: non-L3 accordion, L3 drawer-style.
- Expand/collapse trigger matrix includes control click, row click, keyboard, and auto-open on streaming.
- Expansion state remains per-message.
- Composer and thread maintain independent, predictable scroll behavior.
