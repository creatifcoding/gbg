# Conductor Chat L3 — Layout & State Spec v1

Owner: Val  
Date: 2026-02-10

## 1) Scope

Defines low-fi IA, zone layout, and runtime state model for Conductor L3 chat mode.

## 2) Expansion Model

- L1: compact node
- L2: expanded node
- L3: full chat mode (~4x area)

### L3 Trigger
- Combo entry path:
  - node chrome chat button
  - keyboard trigger path

### L3 Placement Rule
- Adaptive anchor:
  - morph-in-place if local space is sufficient
  - dock to fixed safe viewport region when constrained

## 3) Zone Layout (Sticky Shell)

```txt
┌──────────────────────────────────────────────┐
│ Sticky Header                               │
│ - Agent switch                              │
│ - Session status                            │
│ - Reset session                             │
│ - Collapse to L2                            │
│ - Exit L3                                   │
│ - Top/session context chips                 │
├──────────────────────────────────────────────┤
│ Scrollable Thread                           │
│ - Status rows (accepted/streaming/offline) │
│ - Role rows (user/assistant/system)         │
│ - Error banners                             │
│ - Breakout action in message footer         │
├──────────────────────────────────────────────┤
│ Sticky Composer                             │
│ - RVN contenteditable                       │
│ - max visible ~8 lines then internal scroll│
│ - input chips + suggestion surfaces         │
│ - send↔pause primary control               │
│ - reconnect action                          │
└──────────────────────────────────────────────┘
```

## 4) Visual Rhythm

- Hard outer shell, calmer interior sections.
- Hybrid separators (hard outside, soft inside).
- Ledger-like thread rows with role-separator gutter.
- Readability width adapts to panel width.

## 5) Primary UI State Model

### Connectivity + session envelope
- `offline`
- `connecting`
- `online`
- `reconnecting`
- `resyncing`

### Message lifecycle
- `idle`
- `typing`
- `send_accepted`
- `assistant_streaming`
- `assistant_finalized`
- `error`

## 6) Transition Inputs

From Chat V2 + transport signals:
- `session_opened`
- `send_accepted`
- `assistant_start`
- `assistant_delta`
- `assistant_final`
- `error`
- websocket open/close/fail
- reconnect + snapshot replay results

## 7) Node-Scoped Continuity

State is per `nodeId`:
- session id
- last sequence cursor
- pending/streaming message id
- draft text (preserved)
- scroll position (preserved)
- node-local error state

No cross-node mutation from send/reconnect flows.

## 8) Layout Invariants

1. Header stays sticky.
2. Composer stays sticky.
3. Thread is only scrollable region.
4. Inspector is hidden in L3.
5. Right-side reconnect/pause controls are in composer zone, not header.
