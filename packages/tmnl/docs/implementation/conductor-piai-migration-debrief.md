# Conductor pi-ai Hard-Cut Debrief

Reference plan (single source of truth):
`thoughts/shared/plans/conductor-open-lanes-strike-list-v1.md`

Date: 2026-02-11
Feature: #F216 Conductor Harness Migration: AgentSession → pi-ai

## Outcome

Conductor runtime lane is now hard-cut to a native pi-ai execution engine.

- New engine lives in: `src/lib/harness/PiAiHarnessEngine.ts`
- Harness runtime now routes only to pi-ai: `src/lib/pi-orchestrator/services/HarnessRuntime.ts`
- Active WS control plane no longer boots legacy AgentSession orchestrator runtime.

## Hard-Cut Changes

1. **Native pi-ai execution engine (separate track)**
   - Added `src/lib/harness/PiAiHarnessEngine.ts`
   - Added `src/lib/harness/index.ts`
   - Uses `@mariozechner/pi-ai` directly (`getModel`, `streamSimple`)
   - Projects stream events to chat-v2 protocol (`assistant_start/delta/final`, `tool_event`, `error`)

2. **HarnessRuntime pi-ai only**
   - `HarnessRuntimeLayer` now resolves to pi-ai path only
   - Removed fallback runtime routing semantics
   - Backend tagging stays explicit (`backend: 'pi-ai'`)

3. **Control-plane hardening (legacy path removed from active server lane)**
   - `PiOrchestratorRemoteWsServer` now wires retired orchestrator layer + harness runtime
   - Router chat-v2 operations now require harness runtime (no chat gateway fallback)

4. **Legacy provision shim retirement in Conductor service**
   - `ConductorAgentChatService` provision/acquire legacy path now returns explicit retired error
   - Guidance points to chat-v2 open_session on pi-ai runtime

## Validation Evidence

Executed with bun-only discipline:

- `bunx tsc --noEmit -p tsconfig.json`
- `bunx vitest run src/lib/pi-orchestrator/__tests__/remote-command-router.test.ts src/lib/pi-orchestrator/__tests__/chat-v2-client.test.ts src/lib/pi-orchestrator/__tests__/chat-session-store-memory.test.ts src/lib/pi-orchestrator/__tests__/chat-gateway-v2.test.ts src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`

Status: passing.

## Follow-on Hardening Backlog

1. Remove dormant AgentSession-centric modules not used by hard-cut server lane (`PiAgentHandle`, `PiAgentOrchestrator`, legacy tests/scripts) after dependent feature audit.
2. Add dedicated `src/lib/harness/__tests__/PiAiHarnessEngine.test.ts` coverage for:
   - abort behavior (`stopReason: aborted`)
   - toolcall streaming edge cases
   - context continuation across multiple turns
3. Add structured runtime health metrics for pi-ai engine:
   - `ackLatencyMs`
   - `firstDeltaLagMs`
   - `toolRoundTripMs`
   - `abortToStopMs`
4. Expand Tauri checklist rows to explicitly assert hard-cut behavior (no legacy command path exercised).

## Risk Notes

- Existing repository still contains non-active legacy modules for compatibility/testing contexts.
- Active conductor runtime path is hard-cut; remaining legacy code should be treated as deprecation cleanup surface.
