# ConductorAgentChat PR-01 Exact Edit Set v1

Date: 2026-02-11  
Owner: Val  
Target file: `src/components/testbed/conductor/ConductorAgentChat.tsx`

## Scope

PR-01 is **styling substrate only**:
- introduce class-based RVN chat skin
- remove highest-value inline style blocks first
- keep behavior and state logic untouched

No transport, no atom logic, no message semantics rewrites.

---

## 0) Prep edits

## 0.1 Create CSS files
- `src/components/testbed/conductor/styles/conductor-agent-chat.rvn.css`
- `src/components/testbed/conductor/styles/conductor-agent-chat.thread.css`
- `src/components/testbed/conductor/styles/conductor-agent-chat.composer.css`

## 0.2 Import CSS once
At top of `ConductorAgentChat.tsx`, add:
- `import './styles/conductor-agent-chat.rvn.css'`
- `import './styles/conductor-agent-chat.thread.css'`
- `import './styles/conductor-agent-chat.composer.css'`

---

## 1) Classes that land first (exact order)

This order minimizes diff risk and preserves behavior while visual parity is established.

## Pass A — Root + Header + Quick Actions (safe/static)

### A1 Root section (around line ~324)
Apply classes:
- `.rvn-chat`
- `.rvn-chat__frame`
- `.rvn-chat--l2 | .rvn-chat--l3` (modifier by expansion)

Inline style survivors (keep for PR-01):
- `gridTemplateRows` (uses runtime `threadMinHeight`)
- `minHeight` (uses runtime `panelMinHeight`)
- `transition` (uses runtime `motionMs`)

Inline style removals (kill now):
- `border`, `background`, `display: grid` baseline static declaration

### A2 Header shell (around line ~392)
Apply classes:
- `.rvn-chat__header`
- `.rvn-chat__header-main`
- `.rvn-chat__title`
- `.rvn-chat__status-cluster`
- `.rvn-chat__controls`

Inline style removals:
- all static spacing/layout/font blocks in header wrappers

### A3 Status chips (connection/message/session)
Apply classes:
- `.rvn-chat__status-chip`
- `.rvn-chat__status-chip--connection`
- `.rvn-chat__status-chip--message`
- `.rvn-chat__status-chip--session`

Dynamic survivor:
- per-chip tone (`connectionTone`, `messageTone`) via CSS variable only:
  - `style={{ '--cchat-chip-color': connectionTone } as React.CSSProperties }`

### A4 Header controls
Apply classes:
- `.rvn-chat__control-btn`
- `.rvn-chat__control-btn--expand`
- `.rvn-chat__control-btn--reset`
- `.rvn-chat__control-btn--exit`
- `.rvn-chat__agent-selector-trigger`
- `.rvn-chat__agent-selector-menu`
- `.rvn-chat__agent-selector-option`

Keep dynamic state attributes:
- `data-state`
- `aria-*`
- disabled semantics

### A5 Quick actions rail (around line ~661)
Apply classes:
- `.rvn-chat__command-rail`
- `.rvn-chat__command-chip`

Inline style removals:
- static border/padding/gap/background/fonts

---

## Pass B — Thread surface + rows

### B1 Thread container (around line ~718)
Apply classes:
- `.rvn-chat__thread`

Inline style removals:
- static flex/overflow/padding/gap

### B2 Status rows (around line ~744)
Apply classes:
- `.rvn-chat__alert-row`
- modifiers from existing `data-tone` (`info|warn|error`)

Dynamic survivor:
- none required if tone mapped in CSS via `[data-tone="..."]`

### B3 Empty state (around line ~761)
Apply class:
- `.rvn-chat__empty-state`

### B4 Message article + meta/body/footer (around line ~785)
Apply classes:
- `.rvn-chat__message`
- `.rvn-chat__message-meta`
- `.rvn-chat__message-body`
- `.rvn-chat__message-footer`
- `.rvn-chat__breakout`

Dynamic survivors:
- role accent/background via CSS vars only:
  - `style={{ '--cchat-msg-accent': roleAccent, '--cchat-msg-bg': roleBackground } as React.CSSProperties }`
- streaming opacity can remain runtime or move to `[data-slot="..."]` selector

Inline style removals:
- all static message border/padding/font blocks

---

## Pass C — Composer + toolbar

### C1 Composer shell (around line ~1133)
Apply classes:
- `.rvn-chat__composer`

Inline style removals:
- static sticky/spacing/border/background

### C2 Recording banner
Apply class:
- `.rvn-chat__recording-banner`

### C3 Suggestions list + options
Apply classes:
- `.rvn-chat__suggestions`
- `.rvn-chat__suggestion`
- active modifier by `data-state="active"`
- `.rvn-chat__suggestion-title`
- `.rvn-chat__suggestion-subtitle`

### C4 Contenteditable well + placeholder
Apply classes:
- `.rvn-chat__composer-input-wrap`
- `.rvn-chat__composer-placeholder`
- `.rvn-chat__composer-input`

Keep behavior unchanged:
- `role="textbox"`, `contentEditable`, keyboard logic

### C5 Toolbar groups + buttons
Apply classes:
- `.rvn-chat__toolbar`
- `.rvn-chat__mode-group`
- `.rvn-chat__insert-group`
- `.rvn-chat__transport-group`
- `.rvn-chat__tool-btn`
- `.rvn-chat__tool-btn--active`
- `.rvn-chat__tool-btn--recording`
- `.rvn-chat__reconnect`
- `.rvn-chat__send`

Inline style removals:
- all one-line button style literals (the biggest style-sprawl cluster)

---

## 2) Inline styles that should NOT be removed in PR-01

Keep these runtime-driven values inline (or as CSS vars set inline):

1. Root dynamic layout values:
   - `gridTemplateRows`
   - `minHeight`
   - `transition` duration tied to reduced motion
2. Dynamic color semantics:
   - connection/message tone colors
   - message role accent/background
3. Motion library animation props (`initial/animate/exit/whileHover/whileTap`)
4. Width/position values owned by popup geometry if any runtime-driven offset is added later

Everything else static moves to CSS.

---

## 3) “Inline blocks die first” kill list

Kill these blocks first in PR-01 (highest noise reduction, lowest risk):

1. Header wrappers static styles
2. Quick action button styles
3. Thread container + empty state styles
4. Message meta/body/footer static typography styles
5. Composer wrapper + placeholder + contenteditable static styles
6. Toolbar one-line button style literals (all mode/insert/transport)

---

## 4) Post-edit sanity checks (PR-01)

Run only focused checks:

1. `bunx tsc --noEmit -p tsconfig.json`
2. `bunx vitest src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx`

Manual quick pass:
- chat renders in l2/l3
- controls still clickable
- no missing text due to class omissions

---

## 5) PR-01 done condition

PR-01 is done when:
- `.rvn-chat*` classes own most static visual styling
- inline style objects are reduced to runtime-driven values
- behavior is unchanged
- visual parity with reference shell is directionally achieved
