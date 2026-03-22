# Conductor Harness Migration — Tool + Extension Adapter Contract

**Feature:** #F218 (EDIN / Design)  
**Task:** #795  
**Date:** 2026-02-11

---

## 1) Objective

Define a stable contract for:

1. Tool execution lifecycle propagation into chat-v2 (`chat:v2/tool_event`)
2. Extension UI interactive round-trip (`request` -> `respond`)

while backend transitions from AgentSession to pi-ai.

---

## 2) Tool Lifecycle Contract

### Required lifecycle phases
- `start`
- `update`
- `end`

### Canonical event shape
`ChatV2ToolEvent` (`src/lib/pi-orchestrator/schemas/chat-v2.ts:111-118`)

```ts
{
  _tag: 'chat:v2/tool_event'
  sessionId, seq, at,
  toolCallId,
  toolName,
  phase: 'start' | 'update' | 'end',
  payload: unknown
}
```

### Mapping source (legacy adapter)
- `pi:tool_execution_start` -> `tool_event(start)`
- `pi:tool_execution_update` -> `tool_event(update)`
- `pi:tool_execution_end` -> `tool_event(end)`

Implemented in:
- `src/lib/pi-orchestrator/server/ChatGatewayV2.ts` (bindSessionEvents switch)

Notes:
- `toolCallId -> toolName` mapping is maintained in session state to preserve naming for update/end phases.

---

## 3) Extension UI Contract

### Interactive methods (must resolve)
- `select`, `confirm`, `input`, `editor`

### Fire-and-forget methods
- `notify`, `setStatus`, `setWidget`, `setTitle`, `set_editor_text`

### Runtime requirements
1. Every interactive request emits `pi:extension_ui_request` with `requestId`
2. Pending resolver queue stores request until response or timeout
3. `respondExtensionUI` resolves and clears queue entry
4. Timeout emits explicit telemetry (`agent.extension_ui.request.timeout`)

Current implementation anchors:
- `src/lib/pi-orchestrator/services/PiAgentHandle.ts:387-436,1032-1059`

---

## 4) Migration adapter obligations (pi-ai backend)

When pi-ai backend is active, adapter must still:

- emit chat-v2 `tool_event` phase triplet with stable `toolCallId`
- preserve extension request/response semantics and timeout behavior
- preserve telemetry tags for timeout/resolve/miss

No backend-specific payload shape may leak into Conductor reducer.

---

## 5) Hardening landed in this task

- Chat gateway now emits `chat:v2/tool_event` from tool execution stream:
  - `pi:tool_execution_start`
  - `pi:tool_execution_update`
  - `pi:tool_execution_end`
- Session state now tracks `toolCallNames` for name continuity.
- Tool update/end payload now includes diagnostics (`toolNameResolved`) and logs warning telemetry when unresolved.
- Session-scoped abort bridge wired from Conductor pause action via `remote:chat_v2_abort`.

Files:
- `src/lib/pi-orchestrator/server/ChatGatewayV2.ts`
- `src/lib/pi-orchestrator/server/PiRemoteCommandRouter.ts`
- `src/lib/pi-orchestrator/client/PiRemoteChatV2Client.ts`
- `src/components/testbed/conductor/agent-chat-stx.ts`
- `src/components/testbed/ConductorTestbed.tsx`

---

## 6) Follow-up implementation edges

1. Wire reducer/UI consumption for tool events (currently ignored in `agent-chat-stx`).
2. Add synthesized-tool-result diagnostics marker when backend fabricates tool-result continuity.
3. Add contract tests for tool phase ordering and extension timeout paths.

---

## 7) Acceptance for #795

- [x] Tool lifecycle mapping contract documented
- [x] Extension UI request/response contract documented
- [x] Legacy adapter emits chat-v2 tool events with phase continuity
