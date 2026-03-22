# Conductor Chat L3 — Compound Component Contract Map v1

Owner: Val  
Date: 2026-02-10

## 1) Contract Goals

- Preserve strict RVN style system.
- Enforce compound boundaries for safe phased implementation.
- Keep behavior node-scoped and stream-first.

## 2) Namespace Model (Hybrid)

Top-level family:
- `RvnConductorChat.*`

Region families:
- `RvnConductorChat.Header.*`
- `RvnConductorChat.Context.*`
- `RvnConductorChat.Thread.*`
- `RvnConductorChat.Composer.*`

## 3) Root Contract

`RvnConductorChat.Root`

Required props:
- `nodeId: string`
- `mode: 'collapsed' | 'expanded' | 'chat_full'`
- `onModeChange: (mode) => void`
- `onExitL3: () => void`

Provided context:
- node identity
- session/connectivity status
- stream status
- composer arbitration state

Invariant:
- no render path with missing `nodeId`

## 4) Header Family

- `Header.Root`
- `Header.AgentSwitch`
- `Header.SessionStatus`
- `Header.ResetSession`
- `Header.CollapseToL2`
- `Header.ExitL3`

Rule:
- reconnect/pause controls are not placed in header.

## 5) Context Family

- `Context.TopChips` (session/mode/entity)
- `Context.InputChips` (composer-related chips)
- `Context.CollapseToggle`

Rule:
- context strip is user-collapsible.

## 6) Thread Family

Architecture: shared base + role extensions.

- `Thread.Root`
- `Thread.StatusRow`
- `Thread.MessageRowBase`
- `Thread.UserMessage`
- `Thread.AssistantMessage`
  - `Thread.AssistantMessage.StreamingBody`
  - `Thread.AssistantMessage.FinalBody`
- `Thread.SystemMessage`
- `Thread.ErrorBanner`
- `Thread.BreakoutAction`

Rules:
- streaming body collapses into final body for same message id.
- breakout action appears in message footer.

## 7) Composer Family

- `Composer.Root`
- `Composer.ContentEditable`
- `Composer.Slash` subsystem
- `Composer.Mention` subsystem
- `Composer.SuggestionRail` (inline, empty state)
- `Composer.SuggestionPopup` (typing state)
- `Composer.PrimaryAction` (Send ↔ Pause)
- `Composer.ReconnectAction`

Rules:
- no textarea.
- contenteditable capped to ~8 visible lines before internal scroll.
- send is contextual (valid/non-empty input).

## 8) State Ownership Map

Per `nodeId` atom families should own:
- `messages`
- `sessionId`
- `lastSeq`
- `pending`
- `streamingMessageId`
- `error`
- `draft` (explicit)
- `scrollPosition` (explicit)

## 9) Styling Contract

- RVN tokens only.
- min text 12px floor.
- zero radius.
- hard outer frame, calmer inner sections.

## 10) Acceptance Criteria

1. L3 contains no raw textarea usage.
2. All public slots export under `RvnConductorChat.*`.
3. Draft + scroll are preserved per node across L3 exit/return.
4. Stream-first thread updates mutate only targeted rows.
