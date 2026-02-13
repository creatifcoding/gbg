# Conductor Harness Migration — Critical Contract Set (AgentSession → pi-ai)

**Feature:** #F217 (EDIN / Experiment)
**Task:** #790
**Date:** 2026-02-11
**Decision mode:** **No bug parity** (preserve only critical contracts)

---

## 1) Scope Boundary (What this contract set is for)

This document freezes the **minimum critical runtime contracts** Conductor must preserve while migrating harness/runtime paths to pi-ai-backed orchestration.

If a behavior is not listed here, it is **not** implicitly required.

---

## 2) Critical Contracts to Preserve

## C1 — Chat stream event contract (node chat)

### C1.1 Envelope invariants

Every chat event consumed by Conductor node chat must include:

```ts
{
  sessionId: ChatSessionId,
  seq: number >= 0,
  at: number // epoch ms
}
```

- `seq` is monotonic per session and used for dedupe.
- `sessionId` gates routing so a node only applies events for its active session.

**Source anchors:**
- `src/lib/pi-orchestrator/schemas/chat-v2.ts:70-73`
- `src/components/testbed/conductor/agent-chat-stx.ts:282-289,448-455`

### C1.2 Required event tags and semantics

Conductor reducer must preserve behavior for:

1. `chat:v2/session_opened`
   - set active agent id
   - clear chat error
   - **anchors:** `chat-v2.ts:76-82`, `agent-chat-stx.ts:292-296`

2. `chat:v2/send_accepted`
   - set pending state true
   - update ack latency metrics (if in-flight timing exists)
   - **anchors:** `chat-v2.ts:84-89`, `agent-chat-stx.ts:298-326`

3. `chat:v2/assistant_start`
   - set streaming message id
   - ensure assistant message shell exists
   - update first-delta lag metrics when applicable
   - **anchors:** `chat-v2.ts:91-95`, `agent-chat-stx.ts:328-358`

4. `chat:v2/assistant_delta`
   - append delta to streaming assistant message
   - keep pending true
   - update first-delta lag metrics (same guard as above)
   - **anchors:** `chat-v2.ts:97-102`, `agent-chat-stx.ts:360-390`

5. `chat:v2/assistant_final`
   - replace assistant message text with final text
   - clear pending + streaming id + in-flight timing
   - **anchors:** `chat-v2.ts:104-109`, `agent-chat-stx.ts:392-398`

6. `chat:v2/error`
   - append system message `error: <code>: <message>`
   - clear pending + streaming id + in-flight timing
   - set chat error
   - **anchors:** `chat-v2.ts:120-125`, `agent-chat-stx.ts:400-414`

### C1.3 Snapshot + resume semantics

- Node resume path must request replay from `lastKnownSeq`.
- Replay events are applied through the same reducer path (no alternate mutation path).
- Resume failure must degrade to `openSession + full snapshot`, add system note `session resynced after reconnect`, reset local seq cursor, then replay.

**Source anchors:**
- `src/components/testbed/conductor/agent-chat-stx.ts:432-498`
- `src/lib/pi-orchestrator/client/PiRemoteChatV2Client.ts:121-128,150-158`
- `src/lib/pi-orchestrator/schemas/remote.ts:106-109,228-233`

---

## C2 — Session/command lifecycle contract

### C2.1 Session acquisition + idempotence

- `openSession(nodeId, role)` is the session entrypoint.
- Server must reuse existing node→session mapping when present.

**Source anchors:**
- `src/lib/pi-orchestrator/server/ChatGatewayV2.ts:244-266`
- `src/lib/pi-orchestrator/server/ChatGatewayV2.ts:105,288`

### C2.2 Send idempotence + async dispatch

- Duplicate `clientMessageId` in same session is accepted without duplicate processing.
- `send` emits `chat:v2/send_accepted` before detached prompt execution.
- Prompt dispatch remains detached/non-blocking.

**Source anchors:**
- `src/lib/pi-orchestrator/server/ChatGatewayV2.ts:321-323,348-364,375-376`
- `src/lib/pi-orchestrator/schemas/chat-v2.ts:84-89`

### C2.3 Abort contract

- Remote abort command route must be preserved end-to-end:
  - `remote:abort` → router lookup → handle.abort → SDK `session.abort()`.

**Source anchors:**
- `src/lib/pi-orchestrator/schemas/remote.ts:76-78`
- `src/lib/pi-orchestrator/server/PiRemoteCommandRouter.ts:263-267`
- `src/lib/pi-orchestrator/services/PiAgentHandle.ts:866-870,986`

### C2.4 Snapshot retrieval contract

- `chat_v2_get_snapshot` and `chat_v2_resume_session` must return `{ sessionId, headSeq, events[] }`.
- `fromSeq` means incremental replay (`event.seq > fromSeq`).

**Source anchors:**
- `src/lib/pi-orchestrator/schemas/remote.ts:106-109,118-121,228-233`
- `src/lib/pi-orchestrator/server/PiRemoteCommandRouter.ts:298-322`
- `src/lib/pi-orchestrator/server/ChatGatewayV2.ts:410-421`

---

## C3 — Tool + extension bridge contract

### C3.1 SDK event mapping contract

These SDK events must still map into `PiAgentEvent` stream:

- `agent_start` → `pi:agent_start`
- `agent_end` → `pi:agent_end`
- `message_update.text_delta` → `pi:text_delta`
- `message_update.thinking_delta` → `pi:thinking_delta`
- `message_update.toolcall_start|delta|end` → `pi:toolcall_start|delta`
- `tool_execution_start|update|end` → `pi:tool_execution_start|update|end`
- compaction start/end → `pi:compaction`

**Source anchors:**
- `src/lib/pi-orchestrator/services/PiAgentHandle.ts:201-315`
- `src/lib/pi-orchestrator/schemas/events.ts:74-172`

### C3.2 Tool execution telemetry state contract

Per-agent tool timeline atom updates must preserve:

- start creates running execution with `startedAt`
- update appends partial output
- end stamps `completedAt`, `durationMs`, status completed

**Source anchors:**
- `src/lib/pi-orchestrator/services/PiAgentOrchestrator.ts:124-163`
- `src/lib/pi-orchestrator/atoms/per-agent.ts:46-57`
- `src/lib/pi-orchestrator/schemas/health.ts:47-58`

### C3.3 Extension UI bridge contract

- Interactive methods (`select|confirm|input|editor`) emit `pi:extension_ui_request` and require `respondExtensionUI` to resolve.
- Fire-and-forget methods (`notify|setStatus|setWidget|setTitle|set_editor_text`) emit and return immediately.
- Pending interactive request queue must update on request and clear on response.

**Source anchors:**
- `src/lib/pi-orchestrator/schemas/events.ts:143-153,214-223`
- `src/lib/pi-orchestrator/services/PiAgentHandle.ts:393-428,541-577,1046`
- `src/lib/pi-orchestrator/atoms/per-agent.ts:83-92,141-165`

---

## C4 — Telemetry envelope + event taxonomy contract

### C4.1 JSONL envelope fields (must remain queryable)

Required emitted keys:

`ts, level, component, event, correlationId, requestId, wsId, agentId, commandTag, durationMs, message`

**Source anchors:**
- `src/lib/pi-orchestrator/logging/jsonl.ts:3-13,19-29`

### C4.2 Correlation model (request traceability)

- `wsId` identifies connection
- `requestId` identifies remote envelope request
- `correlationId = ${wsId}:${requestId}` ties ws/router/agent logs

**Source anchors:**
- `src/lib/pi-orchestrator/NETWORK_SEQUENCE.md:7-9`
- `src/lib/pi-orchestrator/server/PiOrchestratorRemoteWsServer.ts:267-278`

### C4.3 Mandatory telemetry event families

1. WS lifecycle and IO:
   - `ws.connection.*`, `ws.inbound.*`, `ws.outbound.queued`
2. Router command lifecycle:
   - `router.command.start|ok|fail`
3. Agent command lifecycle:
   - `agent.command.start|ok|fail`, `agent.command.detached.fail`
4. Extension UI lifecycle:
   - `agent.extension_ui.request.start|resolved|timeout`
   - `agent.extension_ui.resolve.ok|miss`
5. Server lifecycle:
   - `server.lifecycle.start|crash`

**Source anchors:**
- `src/lib/pi-orchestrator/server/PiOrchestratorRemoteWsServer.ts:151-347,392,412`
- `src/lib/pi-orchestrator/server/PiRemoteCommandRouter.ts:161,371,383`
- `src/lib/pi-orchestrator/services/PiAgentHandle.ts:393,412,428,793,814,952,963,1046`
- `src/lib/pi-orchestrator/NETWORK_SEQUENCE.md:48-49,82-85,103-104,115-118`

---

## 3) Explicit Non-Goals (No Bug Parity)

1. **No legacy subprocess/RPC parity requirements**.
   - SDK-native session runtime is canonical.
   - We do not preserve old process-spawn quirks.

2. **No requirement to make unsupported remote bridge UI methods functional**.
   - `setTheme/getTheme/getAllThemes/getToolsExpanded/setToolsExpanded/...` remain inert/no-op in remote bridge mode.

3. **No requirement to preserve unconsumed chat-v2 tags in Conductor UI reducer**.
   - `chat:v2/tool_event` and `chat:v2/heartbeat` are schema-level but currently ignored by node-chat reducer.

4. **No UI pause-control parity in this task**.
   - Pause button backend wiring is intentionally out of scope here.

5. **No guarantee of historical log text formatting parity**.
   - Contract is semantic event taxonomy + envelope keys, not byte-identical messages.

**Source anchors:**
- `src/lib/pi-orchestrator/MIGRATION_NOTES_SDK.md:1-4,14-20,59-66`
- `src/lib/pi-orchestrator/SDK_BRIDGE_NOTES.md:41-57`
- `src/lib/pi-orchestrator/schemas/chat-v2.ts:111-130`
- `src/components/testbed/conductor/agent-chat-stx.ts:416-417`
- `src/components/testbed/ConductorTestbed.tsx:2060-2062`

---

## 4) Measurable Acceptance Checks

## Gate A — Stream/session contract integrity

- **A1. Event ordering/dedupe**
  - Inject replay containing `seq <= lastSeq`; assert no duplicate chat mutation.
  - Pass: message count unchanged for duplicate seq.
- **A2. Session routing isolation**
  - Emit event for non-active sessionId; assert node state unchanged.
  - Pass: no mutation in message/pending/error atoms.
- **A3. Resume fallback**
  - Force `resumeSession` failure; assert resync note appears and replay continues from reopened session.
  - Pass: system message contains `session resynced after reconnect` and `snapshotResyncCount` increments.

## Gate B — Command and abort path integrity

- **B1. Send idempotence**
  - Send same `clientMessageId` twice.
  - Pass: second call accepted with no duplicated `send_accepted` side effects.
- **B2. Abort route**
  - Execute `remote:abort` for active agent.
  - Pass: command returns success envelope and no router error event.

## Gate C — Tool/extension bridge integrity

- **C1. Tool lifecycle telemetry**
  - Emit start/update/end and inspect `agentToolTimelineAtom`.
  - Pass: one execution transitions running→completed with non-null duration and accumulated partial output.
- **C2. Interactive extension request round-trip**
  - Emit `pi:extension_ui_request(method=input)` then `respond_extension_ui`.
  - Pass: pending queue entry appears then clears; no timeout log.

## Gate D — Telemetry envelope integrity

- **D1. Envelope field completeness**
  - Sample JSONL lines from ws/router/agent flows.
  - Pass: all required top-level keys present (`ts,component,event,...`).
- **D2. Correlation continuity**
  - For one request, verify same `correlationId` across ws inbound, router start, router ok/fail.
  - Pass: exactly one correlation chain per requestId.

## 5) Boundary ownership table (browser / client / server)

| Boundary | Primary owner | Contract responsibility | Hard evidence |
|---|---|---|---|
| Browser UI (Conductor testbed + reducer) | `src/components/testbed/conductor/agent-chat-stx.ts` | Applies chat event tags to node-local atom state, enforces seq dedupe, session routing, replay application | `agent-chat-stx.ts:274-417,432-498` |
| Browser UI shell | `src/components/testbed/ConductorTestbed.tsx`, `ConductorAgentChat.tsx` | Surfaces pending/error/stream state, reconnect action, pause affordance | `ConductorTestbed.tsx:2052-2116`, `ConductorAgentChat.tsx:844-866,1046-1066` |
| Client protocol adapter | `src/lib/pi-orchestrator/client/PiRemoteChatV2Client.ts` | Typed request/response decode for open/resume/send/snapshot + event demux for `remote:chat_v2_event` | `PiRemoteChatV2Client.ts:110-174` |
| Client transport | `src/lib/pi-orchestrator/client/PiRemoteWebSocketTransport.ts` | WS request envelope, request timeout/open timeout, event stream transport | `PiRemoteWebSocketTransport.ts:89-92,300-326,361` |
| Server command router | `src/lib/pi-orchestrator/server/PiRemoteCommandRouter.ts` | Command dispatch (`remote:*`) and `remote:ws_response` payload fulfillment | `PiRemoteCommandRouter.ts:161-336,371-391` |
| Server chat gateway | `src/lib/pi-orchestrator/server/ChatGatewayV2.ts` | Node/session mapping, send idempotence, event append sequencing, snapshot serving | `ChatGatewayV2.ts:244-421` |
| Server SDK bridge | `src/lib/pi-orchestrator/services/PiAgentHandle.ts` | SDK session control (`prompt/abort/...`), SDK→Pi event mapping, extension UI bridge | `PiAgentHandle.ts:201-315,393-428,793-971,1046` |
| Server telemetry/logging | `src/lib/pi-orchestrator/logging/jsonl.ts`, `PiOrchestratorRemoteWsServer.ts` | JSONL envelope shape + ws/server lifecycle event production | `jsonl.ts:3-29`, `PiOrchestratorRemoteWsServer.ts:151-347,392,412` |

## 6) Command/event schema map (critical path)

### 6.1 Remote command map (browser → server)

| Command tag | Schema source | Router handler | Downstream contract |
|---|---|---|---|
| `remote:chat_v2_open_session` | `remote.ts:101-104` | `PiRemoteCommandRouter.ts:287-297` | Returns `PiRemoteChatV2SessionPayload` (`remote.ts:213-220`) |
| `remote:chat_v2_resume_session` | `remote.ts:106-109` | `PiRemoteCommandRouter.ts:298-308` | Returns snapshot payload (`remote.ts:228-233`) |
| `remote:chat_v2_send` | `remote.ts:111-116` | `PiRemoteCommandRouter.ts:309-321` | Returns send ack payload (`remote.ts:222-226`) |
| `remote:chat_v2_get_snapshot` | `remote.ts:118-121` | `PiRemoteCommandRouter.ts:322-332` | Returns snapshot payload (`remote.ts:228-233`) |
| `remote:abort` | `remote.ts:76-78` | `PiRemoteCommandRouter.ts:263-267` | Must call handle.abort (`PiAgentHandle.ts:866-870,986`) |
| `remote:respond_extension_ui` | `remote.ts:49-52` | `PiRemoteCommandRouter.ts:237-241` | Resolves pending interactive request (`PiAgentHandle.ts:1046`) |

### 6.2 Stream event map (server → browser)

| Event tag | Schema source | Producer path | Browser consumer |
|---|---|---|---|
| `chat:v2/session_opened` | `chat-v2.ts:76-82` | `ChatGatewayV2.ts:292-302` | `agent-chat-stx.ts:292-296` |
| `chat:v2/send_accepted` | `chat-v2.ts:84-89` | `ChatGatewayV2.ts:358-366` | `agent-chat-stx.ts:298-326` |
| `chat:v2/assistant_start` | `chat-v2.ts:91-95` | `ChatGatewayV2.ts:177-185` | `agent-chat-stx.ts:328-358` |
| `chat:v2/assistant_delta` | `chat-v2.ts:97-102` | `ChatGatewayV2.ts:194-203` | `agent-chat-stx.ts:360-390` |
| `chat:v2/assistant_final` | `chat-v2.ts:104-109` | `ChatGatewayV2.ts:213-222` | `agent-chat-stx.ts:392-398` |
| `chat:v2/error` | `chat-v2.ts:120-125` | `ChatGatewayV2.ts:378-387` | `agent-chat-stx.ts:400-414` |

## 7) Error/tag taxonomy (operationally relevant)

| Class | Tags / codes | Semantic class | Source anchors |
|---|---|---|---|
| Transport errors | `PiRemoteTransportError` | WS open/write/request failures | `PiRemoteTransport.ts:14-20`, `PiRemoteWebSocketTransport.ts:281-326` |
| Protocol decode errors | `PiRemoteProtocolError` | Bad envelope/payload decode | `PiRemoteTransport.ts:22-29`, `PiRemoteChatV2Client.ts:27-40` |
| Router command errors | `PiRemoteCommandRouterError` | Command route/lookup/execution failures | `PiRemoteCommandRouter.ts:24-31,339-367` |
| SDK command timeouts/failures | `RpcRequestTimeoutError`, `RpcCommandFailedError`, `ProcessWriteError` | Command exceeded timeout / unsupported / SDK write path failures | `spawn.ts:24-57`, `PiAgentHandle.ts:772-783,909-939,963-971` |
| Chat domain error event | `chat:v2/error` (`code`, `message`) | User-visible stream failure in node chat | `chat-v2.ts:120-125`, `agent-chat-stx.ts:400-414` |
| WS envelope malformed | `invalid-json`, `invalid-envelope` + failure response | Reject malformed incoming request envelope | `PiOrchestratorRemoteWsServer.ts:36-47,254-263` |

## 8) Open contract gaps + task linkage

| Gap ID | Open gap | Why it matters | Task linkage |
|---|---|---|---|
| G1 | `chat:v2/tool_event` defined but ignored in reducer | Tool progress can be lost from UI contract despite server emission capacity | **#791** (consumed-vs-drop matrix) |
| G2 | `chat:v2/heartbeat` defined but ignored in reducer | No explicit liveness signal consumption at UI edge | **#791** |
| G3 | Reducer/snapshot replay uses `any` event typing | Compile-time drift can slip through when schema evolves | **#791** |
| G4 | Pause control not wired to backend abort path | UI affordance does not yet enforce stop semantics | **#792** (risk + mitigation plan) |
| G5 | Client event stream swallows decode/stream failures (`catchAll -> empty`) | Silent degradation risk: stream can die without hard error channel | **#792** |
| G6 | Correlation/latency checks are defined but not yet automated end-to-end | Operational regressions may pass until manual verification | **#792** |

**Gap anchors:**
- G1/G2: `chat-v2.ts:111-130`, `agent-chat-stx.ts:416-417`
- G3: `agent-chat-stx.ts:274-281`
- G4: `ConductorTestbed.tsx:2060-2062`
- G5: `PiRemoteChatV2Client.ts:174`
- G6: `NETWORK_SEQUENCE.md:7-9,82-85`

## Suggested execution commands

```bash
# Existing focused tests
bunx vitest run src/lib/pi-orchestrator/__tests__/remote-command-router.test.ts
bunx vitest run src/lib/pi-orchestrator/__tests__/remote-orchestrator.test.ts

# Manual transport + conductor checks
bun run pi-orchestrator:remote-ws
# then follow:
# src/lib/pi-orchestrator/TAURI_CONDUCTOR_MANUAL_CHECKLIST.md
```

---

## 9) Handoff note for downstream tasks (#791/#792)

- #791 should build a strict matrix: **"currently consumed" vs "must preserve" vs "safe to drop"** using this contract set as baseline.
- #792 should treat these risk hotspots as first-class:
  - resume fallback path,
  - extension UI pending resolution,
  - telemetry correlation breakage,
  - hidden stream failure due client-side event stream catch-all fallback.
