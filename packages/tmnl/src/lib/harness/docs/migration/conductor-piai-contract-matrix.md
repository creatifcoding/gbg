# Conductor Harness Migration — Consumed vs Preserve vs Drop Matrix

**Feature:** #F217 (EDIN / Experiment)  
**Task:** #791  
**Date:** 2026-02-11  
**Policy:** no bug parity

---

## 1) Classification Rules

- **Consumed**: actively read/applied by Conductor browser reducer/runtime.
- **Preserve**: must exist after pi-ai cutover (adapter can translate).
- **Drop**: not required for Conductor critical path in this migration.

---

## 2) Chat-v2 Event Matrix

| Event tag | Producer path | Browser consumer | Status | Cutover action |
|---|---|---|---|---|
| `chat:v2/session_opened` | `src/lib/pi-orchestrator/server/ChatGatewayV2.ts:244-317` | `src/components/testbed/conductor/agent-chat-stx.ts:292-296` | **Consumed + Preserve** | Keep invariant fields (`sessionId`,`seq`,`at`,`agentId`) |
| `chat:v2/send_accepted` | `ChatGatewayV2.ts:318-409` | `agent-chat-stx.ts:298-326` | **Consumed + Preserve** | Keep ack semantics and pending=true transition |
| `chat:v2/assistant_start` | `ChatGatewayV2.ts:158-188` | `agent-chat-stx.ts:328-358` | **Consumed + Preserve** | Keep message shell creation behavior |
| `chat:v2/assistant_delta` | `ChatGatewayV2.ts:189-206` | `agent-chat-stx.ts:360-390` | **Consumed + Preserve** | Keep delta append semantics |
| `chat:v2/assistant_final` | `ChatGatewayV2.ts:208-236` | `agent-chat-stx.ts:392-398` | **Consumed + Preserve** | Keep closeout semantics (pending false, stream id clear) |
| `chat:v2/error` | `ChatGatewayV2.ts:378-387` | `agent-chat-stx.ts:400-414` | **Consumed + Preserve** | Keep user-visible error line + error atom |
| `chat:v2/tool_event` | schema only (`src/lib/pi-orchestrator/schemas/chat-v2.ts:111-118`) | ignored (`agent-chat-stx.ts:416`) | **Drop (for now)** | Optional follow-up: promote into UI timeline later |
| `chat:v2/heartbeat` | schema only (`chat-v2.ts:127-130`) | ignored (`agent-chat-stx.ts:416`) | **Drop (for now)** | Optional follow-up: wire as liveness signal |

---

## 3) Chat-v2 Command Matrix (Browser → Server)

| Command | Client callsite | Router handler | Downstream | Status | Cutover action |
|---|---|---|---|---|---|
| `remote:chat_v2_open_session` | `PiRemoteChatV2Client.ts:89-99` | `PiRemoteCommandRouter.ts:287-297` | `ChatGatewayV2.openSession` | **Consumed + Preserve** | Maintain idempotent node->session behavior |
| `remote:chat_v2_resume_session` | `PiRemoteChatV2Client.ts:101-111` | `PiRemoteCommandRouter.ts:298-308` | currently proxied to `getSnapshot` | **Consumed + Preserve** | Keep replay semantics (`fromSeq`) |
| `remote:chat_v2_send` | `PiRemoteChatV2Client.ts:113-129` | `PiRemoteCommandRouter.ts:309-321` | `ChatGatewayV2.send` | **Consumed + Preserve** | Keep `clientMessageId` dedupe behavior |
| `remote:chat_v2_get_snapshot` | `PiRemoteChatV2Client.ts:131-141` | `PiRemoteCommandRouter.ts:322-332` | `ChatGatewayV2.getSnapshot` | **Consumed + Preserve** | Keep full + incremental replay |
| `remote:abort` | currently routed, not wired from pause UX | `PiRemoteCommandRouter.ts:263-267` | `PiAgentHandle.abort` | **Preserve (not consumed by pause yet)** | Wire Conductor `onPause` to this route |
| `remote:chat_v2_set_config` | not present in remote command schema | n/a | n/a | **Drop in current path** | If needed, add explicit v2 command in later phase |

---

## 4) Reducer/Session Semantics Matrix

| Behavior | Evidence | Status | Cutover requirement |
|---|---|---|---|
| Session-gated event apply (`event.sessionId === currentSession`) | `agent-chat-stx.ts:448-455` | **Consumed + Preserve** | Adapter must route by session id |
| Monotonic seq dedupe (`event.seq <= lastSeq` ignored) | `agent-chat-stx.ts:274-281` | **Consumed + Preserve** | Preserve strict dedupe |
| Reconnect path: resume then replay | `agent-chat-stx.ts:460-468` | **Consumed + Preserve** | Maintain from-seq incremental replay |
| Resume failure fallback: reopen + full snapshot + note | `agent-chat-stx.ts:469-498` | **Consumed + Preserve** | Preserve deterministic fallback note + cursor reset |
| Stream subscription once per node | `agent-chat-stx.ts:445-458` | **Consumed + Preserve** | Keep single-subscription guard |

---

## 5) Legacy Surface Matrix (AgentSession path)

| Surface | Evidence | Status |
|---|---|---|
| SDK event translation (`AgentSessionEvent` -> `PiAgentEvent`) | `src/lib/pi-orchestrator/services/PiAgentHandle.ts:183-315` | **Preserve semantics, replace source with pi-ai events** |
| Interactive extension UI pending queue + timeout | `PiAgentHandle.ts:387-436` | **Preserve behavior (including timeout safety)** |
| Per-command timeout wrapper | `PiAgentHandle.ts:763-778` | **Preserve guardrails, retune defaults under pi-ai** |
| Detached prompt/steer/follow_up dispatch | `PiAgentHandle.ts:801-839` | **Preserve non-blocking behavior** |
| Unsupported remote bridge UI methods (`setTheme` etc) | `PiAgentHandle.ts:522-577` | **Drop from migration scope** |

---

## 6) pi-ai Adapter Contract (Minimum)

The new adapter must emit a Conductor-compatible stream implementing:

1. `session_opened`
2. `send_accepted`
3. `assistant_start`
4. `assistant_delta`
5. `assistant_final`
6. `error`

with invariants:

- `sessionId` stable per node mapping
- `seq` monotonic per session
- replay API supports `fromSeq`
- duplicate `clientMessageId` is idempotent
- abort command remains available on active session

---

## 7) Immediate Patch Suggestions (pre-cutover hardening)

1. **Pause wiring**: connect `onPause` in Conductor to `remote:abort` route.
   - Current placeholder: `src/components/testbed/ConductorTestbed.tsx:2060-2062`
2. **Typed replay reducer**: replace `event: any` in `applyChatEventToNode`/`applySnapshotReplay` with `ChatV2Event`.
   - Current untyped reducers: `agent-chat-stx.ts:265-289`
3. **Stream decode visibility**: remove silent swallow `Stream.catchAll(() => Stream.empty)` and surface a typed transport/protocol error event.
   - Current swallow: `src/lib/pi-orchestrator/client/PiRemoteChatV2Client.ts:174`

---

## 8) Task Completion Note

This matrix is the canonical consumed/preserve/drop reference for #F217 and unlocks #792 risk register and #F218 design tasks.
