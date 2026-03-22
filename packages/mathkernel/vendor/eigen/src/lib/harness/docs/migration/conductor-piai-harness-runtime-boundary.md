# Conductor HarnessRuntime Boundary (Design)

**Feature:** #F218 (EDIN / Design)  
**Task:** #793  
**Date:** 2026-02-11

---

## 1) Objective

Create one runtime seam so Conductor never talks directly to backend-specific session APIs again.

- Old backend: AgentSession/SDK path
- New backend: pi-ai/agent-core path
- Conductor contract remains chat-v2 semantics

This is the anti-chaos boundary. Prime gets flexibility; we keep architecture clean.

---

## 2) Implemented Boundary Artifacts

### 2.1 New schema contract
- `src/lib/pi-orchestrator/schemas/harness-runtime.ts`

Includes:
- `HarnessRuntimeBackend = 'agent-session' | 'pi-ai'`
- `HarnessSessionView`
- `HarnessSendAck`
- `HarnessSnapshot`
- `HarnessCommand` union (`open`, `resume`, `send`, `abort`, `respond_extension_ui`)

### 2.2 New runtime contract
- `src/lib/pi-orchestrator/contracts/HarnessRuntime.ts`

Defines:
- `openSession`
- `resumeSession`
- `send`
- `getSnapshot`
- `abortSession`
- `respondExtensionUI`
- `events` stream (`ChatV2Event`)

### 2.3 Legacy-backed implementation (adapter)
- `src/lib/pi-orchestrator/services/HarnessRuntime.ts`
- `LegacySdkHarnessRuntimeLive`

Behavior:
- Delegates open/send/snapshot to `ChatGatewayV2`
- Delegates extension response + abort via resolved `agentId` and `PiAgentOrchestrator`
- Emits backend-tagged payloads (`backend: 'agent-session'`)

### 2.4 Runtime routing switch (kill-switch/rollout control)
- `HarnessRuntimeConfig` + `HarnessRuntimeConfigDefault`
- Env flag: `PI_HARNESS_RUNTIME_BACKEND=agent-session|pi-ai`
- `HarnessRuntimeLayer` selects backend implementation
- `pi-ai` path is currently explicit-unavailable placeholder (no silent fallback)

---

## 3) Why this boundary is correct

1. **Session-scoped API**: caller uses `sessionId`, not `agentId`, reducing leakage of internals into Conductor UI.
2. **Backend-tagged payloads**: every response carries `backend` for observability and migration routing.
3. **Drop-in future adapter**: `PiAiHarnessRuntimeLive` can implement same contract without touching UI reducer.
4. **Schema-first**: boundary is Effect Schema-defined; no raw ad-hoc payload types.

---

## 4) Known limitations in current adapter (intentional for phase)

1. `abortSession/respondExtensionUI` resolve `agentId` from snapshot history (`session_opened` event lookup).
   - Works now, but should be replaced with explicit `sessionId -> agentId` lookup API in runtime state.
2. Backend is still legacy (`agent-session`) for execution.
3. No pi-ai adapter implementation yet (this is the seam creation step).

---

## 5) Next tasks unlocked

- **#794** event adapter design (pi-ai events -> chat-v2 reducer actions)
- **#795** tool/extension adapter design
- **#796** persistence + replay cursor model
- **#797** telemetry envelope + span topology

---

## 6) Acceptance check for #793

- [x] Runtime seam exists as typed contract (`HarnessRuntime`)
- [x] Legacy implementation provided (`LegacySdkHarnessRuntimeLive`)
- [x] Session/send/snapshot/abort/respond APIs exposed with schema-backed payloads
- [x] No Conductor UI contract changes required to adopt seam
