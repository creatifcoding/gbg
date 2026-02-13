# Conductor pi-ai Hard-Cut Debrief

Reference plan (single source of truth):
`thoughts/shared/plans/conductor-open-lanes-strike-list-v1.md`

Date: 2026-02-11
Feature: #F216 Conductor Harness Migration: AgentSession → pi-ai

## Outcome

Conductor runtime lane is now hard-cut to a native pi-ai execution engine, with standalone harness systemization in progress under `#F221`.

- Core engine lives in: `src/lib/harness/PiAiHarnessEngine.ts`
- Runtime facade lives in: `src/lib/harness/HarnessRuntime.ts`
- Pi provider runtime bridge now consumes HarnessRuntime directly: `src/lib/ai-core/providers/pi/PiProvider.ts`
- Active WS control plane no longer boots legacy AgentSession orchestrator runtime.
- Browser-facing harness transport uses dedicated `GET /api/harness/ws` (legacy orchestrator WS route removed).

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

3. **Control-plane hardening (legacy path removed from server lane)**
   - Added dedicated `src/lib/harness/server/HarnessRemoteWsServer.ts`
   - Server route surface is harness-native (`/api/harness/ws`, `/api/harness/health`, `/health`)
   - Removed orchestrator router/chat gateway dependency from active runtime lane

4. **Legacy provision shim retirement in Conductor service**
   - `ConductorAgentChatService` provision/acquire legacy path now returns explicit retired error
   - Guidance points to chat-v2 open_session on pi-ai runtime

## Validation Evidence

Executed with bun-only discipline:

- `bunx tsc --noEmit -p tsconfig.json`
- `bunx vitest run src/lib/harness/__tests__/PiAiHarnessEngine.integration.test.ts src/lib/harness/__tests__/HarnessRuntimeBrowser.test.ts src/lib/harness/__tests__/hardcut-prune.test.ts src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`

Status: passing.

## Follow-on Hardening Backlog

1. Add dedicated `src/lib/harness/__tests__/PiAiHarnessEngine.test.ts` coverage for:
   - abort behavior (`stopReason: aborted`)
   - toolcall streaming edge cases
   - context continuation across multiple turns
2. Add structured runtime health metrics for pi-ai engine:
   - `ackLatencyMs`
   - `firstDeltaLagMs`
   - `toolRoundTripMs`
   - `abortToStopMs`
3. Expand Tauri checklist rows to explicitly assert hard-cut behavior (no legacy command path exercised).

## Risk Notes

- Legacy `src/lib/pi-orchestrator` source tree and companion scripts were removed from the active lane.
- Remaining references are documentation/history artifacts and should not be treated as runtime dependencies.
