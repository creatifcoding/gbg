# Conductor Chat L3 — Interaction Precedence Matrix v1

Owner: Val  
Date: 2026-02-10

## Precedence Order (highest -> lowest)

1. Hard blockers (fatal offline / disabled state)
2. Suggestion arbitration (popup/inline selection)
3. Stream control arbitration (pause/reconnect)
4. Composer defaults (Enter send, Shift+Enter newline)
5. Passive shortcuts

## Keyboard + Control Matrix

| Context | Input | Guard | Result |
|---|---|---|---|
| Any | Escape | popup suggestions open | Close popup, keep draft |
| Any | Escape | no popup, stream active | Trigger Pause action |
| Any | Escape | no popup, reconnect required | Focus reconnect action |
| Composer | ArrowDown | suggestions available | Next suggestion |
| Composer | ArrowUp | suggestions available | Previous suggestion |
| Composer | Enter | suggestion highlighted | Apply suggestion (do not send) |
| Composer | Tab | suggestion highlighted | Apply suggestion |
| Composer | Shift+Enter | contenteditable focused | Insert newline |
| Composer | Enter | no suggestions, input valid, not streaming | Send prompt |
| Composer | Enter | no suggestions, streaming active | No send (primary is Pause) |
| Composer | Click primary | input valid, not streaming | Send |
| Composer | Click primary | streaming | Pause |
| Composer | Click reconnect | reconnect needed | Reconnect |

## Suggestion Arbitration Rules

- Slash + mention are separate subsystems with shared arbitration.
- If token begins with `/`, slash takes priority.
- If token begins with `@`, mention takes priority.
- Inline pill rail only when composer is empty.
- Popup palette while typing active token.

## Node Isolation Rules

- All commands resolve against active `nodeId` only.
- Enter/send/pause/reconnect must never dispatch globally.
- Agent switching does not merge drafts between nodes.

## Accessibility Rules

- Suggestion navigation fully keyboard-accessible.
- Focus-visible styles for primary/reconnect controls.
- Escape always has deterministic behavior.

## Acceptance Gates

1. Suggestions intercept Enter before send.
2. Send and Pause cannot fire in the same event frame.
3. Reconnect action is reachable without pointer.
4. No cross-node mutation under any keyboard path.
