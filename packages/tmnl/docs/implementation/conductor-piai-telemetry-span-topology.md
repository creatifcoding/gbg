# Conductor Harness Migration — Telemetry Envelope + Span Topology

**Feature:** #F218 (EDIN / Design)  
**Task:** #797  
**Date:** 2026-02-11

---

## 1) Objective

Keep governance visibility intact while swapping runtime backend.

Telemetry contract must preserve:
- correlation continuity (`wsId:requestId`)
- command lifecycle logs
- stream/reconnect/resume diagnostics
- extension UI timeout/resolve traces

---

## 2) Canonical JSONL Envelope (unchanged)

Required keys:
- `ts`
- `level`
- `component`
- `event`
- `correlationId`
- `requestId`
- `wsId`
- `agentId`
- `commandTag`
- `durationMs`
- `message`

Source:
- `src/lib/pi-orchestrator/logging/jsonl.ts`

---

## 3) Span Topology

### Existing high-signal spans
- `pi-orchestrator.ws.connection`
- `pi-orchestrator.ws.outbound-writer-loop`
- `pi-orchestrator.server.lifecycle`
- `pi-orchestrator.orchestrator.acquire`
- `pi-orchestrator.orchestrator.get-for-node`

### Added in this phase (HarnessRuntime seam)
- `pi-orchestrator.harness.open-session`
- `pi-orchestrator.harness.resume-session`
- `pi-orchestrator.harness.send`
- `pi-orchestrator.harness.get-snapshot`
- `pi-orchestrator.harness.abort-session`
- `pi-orchestrator.harness.respond-extension-ui`

File:
- `src/lib/pi-orchestrator/services/HarnessRuntime.ts`

---

## 4) Event Family Expectations

1. WS lifecycle: `ws.connection.*`, `ws.inbound.*`, `ws.outbound.*`
2. Router lifecycle: `router.command.start|ok|fail`
3. Agent command lifecycle: `agent.command.start|ok|fail`
4. Chat-v2 lifecycle: `chat-v2.session.*`, `chat-v2.send.*`, `chat-v2.snapshot.*`
5. Extension UI lifecycle: `agent.extension_ui.request.*`, `agent.extension_ui.resolve.*`

---

## 5) Migration Delta Policy

When backend switches to `pi-ai`:
- event names may gain backend annotations,
- but envelope keys and correlation model must not break.

Any missing envelope fields at runtime is a gate failure.

---

## 6) Minimal Verification

1. One request trace from ws inbound to router outcome has same `correlationId`.
2. Harness spans appear around open/send/resume/abort paths.
3. Extension timeout and resolve paths produce corresponding telemetry events.
4. Stream error path is visible (no silent drop).

---

## 7) Acceptance for #797

- [x] Envelope contract documented
- [x] Span topology documented
- [x] HarnessRuntime spans added in code
- [x] Verification checklist defined
