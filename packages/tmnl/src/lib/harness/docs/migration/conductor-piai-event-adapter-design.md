# Conductor Harness Migration — Event Adapter Design (pi-ai → chat-v2)

**Feature:** #F218 (EDIN / Design)  
**Task:** #794  
**Date:** 2026-02-11

---

## 1) Adapter Goal

Translate backend stream semantics (pi-ai/agent-core) into the Conductor-stable chat-v2 reducer contract.

Conductor does **not** consume raw backend events. It consumes the normalized chat-v2 event taxonomy.

---

## 2) Target Mapping Contract

| Normalized backend event | chat-v2 output | Notes |
|---|---|---|
| session established | `chat:v2/session_opened` | include `sessionId/nodeId/role/agentId/seq/at` |
| send accepted | `chat:v2/send_accepted` | include `clientMessageId/userMessageId` |
| assistant start | `chat:v2/assistant_start` | start shell message |
| assistant text delta | `chat:v2/assistant_delta` | append token/delta text |
| assistant done | `chat:v2/assistant_final` | finalize message text |
| backend/runtime error | `chat:v2/error` | preserve typed code + message |
| tool execution lifecycle (optional lane) | `chat:v2/tool_event` | currently not consumed by reducer |

---

## 3) Reducer Invariants (must remain)

- session-gated event apply (`event.sessionId === activeSession`)
- seq dedupe (`seq <= lastSeq` ignored)
- resume replay through same reducer path
- reconnect fallback marker: `session resynced after reconnect`

Evidence:
- `src/components/testbed/conductor/agent-chat-stx.ts:274-281,448-498`

---

## 4) Hardening landed during this task

### 4.1 Removed silent stream failure swallow
- changed `PiRemoteChatV2Client.events` to stop swallowing decode/transport failures.
- file: `src/lib/pi-orchestrator/client/PiRemoteChatV2Client.ts`

### 4.2 Added stream failure surfacing in node reducer path
- subscription now catches stream errors, marks subscription false, sets `nodeChatError`, and appends system message `stream-error: ...`.
- file: `src/components/testbed/conductor/agent-chat-stx.ts`

### 4.3 Typed replay and reducer event input
- replaced `any` event types with `ChatV2Event` in replay/reducer helpers.
- file: `src/components/testbed/conductor/agent-chat-stx.ts`

---

## 5) Adapter API Shape (next implementation target)

```ts
interface PiAiEventAdapter {
  mapSessionOpened(...): ChatV2SessionOpenedEvent
  mapSendAccepted(...): ChatV2SendAcceptedEvent
  mapAssistantStart(...): ChatV2AssistantStartEvent
  mapAssistantDelta(...): ChatV2AssistantDeltaEvent
  mapAssistantFinal(...): ChatV2AssistantFinalEvent
  mapError(...): ChatV2ErrorEvent
  mapTool(...): Option<ChatV2ToolEvent>
}
```

Sequence allocation remains runtime-owned (monotonic per session).

---

## 6) Acceptance for #794

- [x] mapping contract documented
- [x] reducer invariants frozen
- [x] silent stream swallow removed
- [x] reducer typing tightened (`ChatV2Event`)
