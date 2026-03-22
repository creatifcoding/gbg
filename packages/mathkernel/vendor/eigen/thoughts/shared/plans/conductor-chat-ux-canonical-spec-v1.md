# Conductor Chat — Canonical UX Spec v1 (RVN L3)

Owner: Val  
Feature Track: #F206 (feeds #F204 / #F205 implementation)  
Date: 2026-02-10
Status: **LOCKED CANONICAL SPEC (v1)**

---

## 0) Intent

Deliver a chat surface that feels as polished as modern productivity chat (readable, calm, immediate) while remaining **strictly RVN** in visual language and system constraints.

This spec is the single source of truth for L3 chat UX and supersedes conflicting drafts in earlier kickoff notes.

---

## 1) Hard Constraints (Non-Negotiable)

1. **RVN-only visual system**
   - RVN tokens for spacing/color/typography.
   - No ad-hoc styling drift.
2. **Typography floor**
   - Minimum text size: `var(--tmnl-text-xs, 12px)`.
3. **Geometry discipline**
   - No rounded corners.
   - Hard frame language retained.
4. **Composer primitive**
   - No `<textarea>`.
   - Use **custom RVN contenteditable composer**.
5. **Runtime/state discipline**
   - Atom-as-State (`@effect-atom/atom`) and stream-first Chat V2 behavior.

---

## 2) Expansion Model (Conductor Node)

Three expansion levels:

- **L1**: Node card (compact)
- **L2**: Inspector-expanded node
- **L3**: Full chat mode (**~4x area**, roughly 2x width × 2x height)

L3 trigger:
- **Combo path**: chat button on node chrome + keyboard pathway.

L3 placement:
- **Adaptive anchoring**: morph in place when space permits; dock to fixed safe viewport region when constrained.

Inspector behavior in L3:
- **Hidden** (chat-focus mode).

---

## 3) Visual Character ("Notion-level feel", RVN-constrained)

Target feel:
- Calm reading rhythm
- High legibility
- Low ornamental noise
- Immediate interaction feedback

RVN execution:
- **Hard outer shell**, calmer interior sections.
- **Hybrid separators**:
  - outer boundary: strong RVN border grammar
  - internal zone dividers: softer separators

Canonical thread style:
- **Ledger row style (terminal-ish)** with modern readability spacing.
- Role separation via **gutter contrast** (not loud bubbles).

---

## 4) Canonical L3 Layout

```txt
┌──────────────────────────────────────────────────────────────────┐
│ Sticky Header                                                    │
│ [Agent Switch] [Session Status] [Reset] [Collapse L2] [Exit L3] │
│ + top context chips (session/mode/entity)                       │
├──────────────────────────────────────────────────────────────────┤
│ Scroll Thread (single stream rail with role-separator gutter)   │
│ - inline status rows (accepted/streaming/reconnecting/resync)   │
│ - user/assistant/system rows (hybrid row architecture)          │
│ - streaming row layer collapses to final row                    │
│ - inline error banners                                           │
│ - manual breakout action in message footer                      │
├──────────────────────────────────────────────────────────────────┤
│ Sticky Composer                                                  │
│ [custom RVN contenteditable, max ~8 lines then internal scroll] │
│ [input chips + adaptive suggestion surfaces]                    │
│ [morphing right-edge primary control: Send ↔ Pause]             │
│ [Reconnect control in composer zone]                            │
└──────────────────────────────────────────────────────────────────┘
```

Readability width:
- **Adaptive by panel width**.

---

## 5) Compound Component Contract (Hybrid Namespace)

Top-level namespace:
- `RvnConductorChat.*`

Region families:
- `RvnConductorChat.Header.*`
- `RvnConductorChat.Context.*`
- `RvnConductorChat.Thread.*`
- `RvnConductorChat.Composer.*`

### 5.1 Thread Architecture

Final rule:
- **Shared base + role-specific extensions** (hybrid).

Examples:
- `Thread.MessageRowBase`
- `Thread.UserMessage`
- `Thread.AssistantMessage`
- `Thread.SystemMessage`

Streaming model:
- `AssistantMessage.StreamingBody` -> collapses into `AssistantMessage.FinalBody` on completion.

### 5.2 Composer Architecture

Primary input:
- `Composer.ContentEditable`

Suggestions:
- Separate subsystems + shared arbitration:
  - `Composer.Slash.*`
  - `Composer.Mention.*`
  - arbitration layer for precedence and keyboard routing

Suggestions behavior:
- **Adaptive**
  - empty composer: inline pills
  - typing context: popup palette

Composer action row:
- Send is **contextual** (appears/emphasized when input is valid/non-empty)
- Primary right-edge control **morphs** during streaming: `Send ↔ Pause`
- `Reconnect` and `Pause` live in **composer zone** (not header)

---

## 6) Interaction Rules

1. **Enter** = send
2. **Shift+Enter** = newline
3. Sticky header + sticky composer; thread is the scrolling middle region.
4. Context chips are split:
   - top/session chips in header zone
   - input chips in composer zone
5. Context strip behavior:
   - **user-collapsible** (not forced always-open)

---

## 7) Per-Node Session Behavior

Chats are node-individuated:
- each node owns independent draft/session context
- preserve per-node state across L3 exits:
  - **remember draft**
  - **remember scroll position**

Agent switching policy:
- no global merge of drafts across nodes
- persistence is node-scoped by default

---

## 8) Connectivity + Failure UX

Offline mode:
- Composer remains editable with **queued draft intent** (send on reconnect).

Failure patterns:
- Inline thread banners (where work occurs).

Status visibility:
- explicit rows/badges for accepted, streaming, offline, reconnecting, resyncing.

---

## 9) Motion Spec (v1)

Animation engine:
- **motion.dev** (selected)

L2 -> L3 baseline:
- Duration: **240ms**
- Easing: **easeOut**
- Character: snappy brutalist (clean, fast, non-elastic)

---

## 10) Header vs Composer Controls (Final)

### Header controls (visible in L3)
- Agent switch
- Reset session
- Collapse to L2
- Exit L3

### Composer controls
- Morphing primary: Send ↔ Pause
- Reconnect
- Slash/Mention affordances

---

## 11) Accessibility + Usability Baseline

- Keyboard-first navigation across header/thread/composer.
- Focus-visible states for all interactive controls.
- Live region updates for streaming/error/reconnect events.
- 12px minimum type floor respected in all subcomponents.

---

## 12) Implementation Notes (for handoff)

1. Build this as compound primitives first; wire behavior second.
2. Keep render updates granular (streaming row only).
3. Preserve Chat V2 stream-first path; no polling fallback in L3 UX.
4. Keep visual contracts tokenized; no arbitrary text-size or radius overrides.

---

## 13) Canonical Conflict Resolutions (Recorded)

Resolved to final values:
- Thread style -> **ledger row terminal-ish**
- Thread architecture -> **shared base + role extensions**
- Breakout placement -> **message footer action**
- Context strip -> **user-collapsible**
- Reconnect/Pause placement -> **composer only**

This closes v1 UX ambiguity.

---

## 14) Artifact Pack Cross-Links

- `thoughts/shared/plans/conductor-chat-ux-artifact-index-v1.md`
- `thoughts/shared/plans/conductor-chat-layout-state-spec-v1.md`
- `thoughts/shared/plans/conductor-chat-component-contract-map-v1.md`
- `thoughts/shared/plans/conductor-chat-interaction-precedence-matrix-v1.md`
- `thoughts/shared/plans/conductor-chat-failure-copy-severity-matrix-v1.md`
- `thoughts/shared/plans/conductor-chat-motion-expansion-spec-v1.md`
