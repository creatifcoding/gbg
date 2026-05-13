# Conductor pi-ai Harness Operator Guide

Date: 2026-02-11  
Feature lane: #F221 (Effect-Wrapped pi-ai Runtime Systemization)

## Purpose

Operate the standalone `src/lib/harness` runtime without relying on a UI surface.

This guide is for script/CLI operators and developers validating runtime behavior under load, aborts, and tool-call continuation.

## Runtime Surface

Primary entrypoint:
- `src/lib/harness/HarnessRuntime.ts`

Core implementation services:
- `PiAiHarnessEngine` (session lifecycle, streaming rounds, cancellation)
- `PiAiPolicy` (provider/model/policy config)
- `PiAiEventAdapter` (pi-ai stream event normalization)
- `PiAiToolRuntime` (tool execution contract)
- `HarnessSessionStore` (+ memory impl)

## Headless Smoke Command

Run a no-UI harness session from CLI:

```bash
bun run harness:piai:smoke "Summarize why deterministic cancellation matters"
# or
nx run tmnl:harness:piai:smoke -- "hello"
```

Script:
- `scripts/harness-piai-smoke.ts`

What it does:
1. opens a harness session
2. sends a prompt
3. waits for `chat:v2/assistant_final`
4. prints response + collected `chat:v2/metric` events

## Event Contract (high-signal)

Conversation lifecycle:
- `chat:v2/session_opened`
- `chat:v2/send_accepted`
- `chat:v2/assistant_start`
- `chat:v2/assistant_delta`
- `chat:v2/assistant_thinking_delta`
- `chat:v2/assistant_final`
- `chat:v2/error`

Tool lifecycle:
- `chat:v2/tool_event` (`start|update|end`)

Telemetry:
- `chat:v2/usage`
- `chat:v2/metric`
  - `ackLatencyMs`
  - `firstDeltaLagMs`
  - `toolRoundTripMs`
  - `abortToStopMs`
  - `retryCount`

## Reliability/Behavioral Test Coverage

Headless integration tests:
- `src/lib/harness/__tests__/PiAiHarnessEngine.integration.test.ts`

Coverage includes:
- tool-use continuation loop across assistant rounds
- abort then recover (send after abort) without UI dependency
- usage/cost and metric projection assertions

Provider contract tests (harness runtime-backed):
- `src/lib/ai-core/providers/pi/__tests__/PiProvider.test.ts`

Coverage includes:
- send projection from harness events to provider state
- fresh session clear behavior
- ProviderNotConfigured mapping on open-session failure

## Operational Notes

1. **Session clear semantics** (PiProvider): clear opens a fresh harness session node suffix.
2. **Snapshot sync after send**: provider now does explicit snapshot sync after send to avoid dropped event races.
3. **Event de-dup**: provider loop applies seq-based monotonic filtering.
4. **Tool continuation bound**: engine enforces `maxToolRounds` from tool runtime.

## Troubleshooting

- No final response event:
  - check provider/model resolution in `PiAiPolicy`
  - check `requestTimeoutMs` and retry policy
- Aborts not reflected:
  - verify `chat:v2/error` (`code=aborted`) and `chat:v2/metric` (`abortToStopMs`)
- Tool loop stalls:
  - inspect `chat:v2/tool_event` + `tool-round-limit-exceeded`

## Validation Commands

```bash
bunx tsc --noEmit -p tsconfig.json
bunx vitest run \
  src/lib/harness/__tests__/PiAiHarnessEngine.integration.test.ts \
  src/lib/ai-core/providers/pi/__tests__/PiProvider.test.ts
```
