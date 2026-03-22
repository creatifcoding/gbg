# Conductor Harness Migration — Risk Register & Mitigations

**Feature:** #F217 (EDIN / Experiment)  
**Task:** #792  
**Date:** 2026-02-11

---

## 1) Risk Scale

- **Severity**: Critical / High / Medium / Low
- **Likelihood**: High / Medium / Low
- **Priority**: immediate if Severity=Critical or High+High likelihood

---

## 2) Active Risks

| Risk ID | Risk | Evidence | Severity | Likelihood | Mitigation | Owner Task |
|---|---|---|---|---|---|---|
| R1 | Chat stream can silently degrade when event decode fails (client stream emptied) | `src/lib/pi-orchestrator/client/PiRemoteChatV2Client.ts:174` | High | High | Replace catch-all empty with typed error event + retry/backoff policy + metric increment | #797 / #803 |
| R2 | Pause UX does not actually abort backend session | `src/components/testbed/ConductorTestbed.tsx:2060-2062` | High | Medium | Wire `onPause` to `remote:abort` command and add success/failure toast + telemetry | #799 |
| R3 | `tool_event` schema exists but reducer ignores it; tool progress may be invisible | `src/lib/pi-orchestrator/schemas/chat-v2.ts:111-118`, `src/components/testbed/conductor/agent-chat-stx.ts:416` | Medium | High | Either (A) formally de-scope tool_event in chat-v2 contract or (B) surface to timeline atom/UI | #795 / #800 |
| R4 | `heartbeat` schema exists but no consumer; liveness semantics are implicit | `chat-v2.ts:127-130`, `agent-chat-stx.ts:416` | Medium | Medium | Introduce explicit liveness state/timeout strategy or remove heartbeat from active contract | #794 / #797 |
| R5 | Reducer replay/event code is untyped (`any`), allowing schema drift regressions | `src/components/testbed/conductor/agent-chat-stx.ts:265-289` | Medium | Medium | Type reducer inputs as `ChatV2Event`; fail-fast on unknown tags | #794 |
| R6 | Interactive extension UI requests can timeout to fallback defaults, masking integration bugs | `src/lib/pi-orchestrator/services/PiAgentHandle.ts:387-436` | Medium | Medium | Emit explicit timeout diagnostics to UI + test timeout path in suite | #795 / #806 |
| R7 | Per-command timeouts tuned for SDK AgentSession may be wrong under pi-ai runtime | `PiAgentHandle.ts:160-178,763-778` | High | Medium | Move timeout config to HarnessRuntime policy table; baseline from measured p95 | #793 / #803 |
| R8 | Session replay uses in-memory event store; restart can lose durable continuity | `src/lib/pi-orchestrator/server/ChatGatewayV2.ts:96-104,410-428` | High | Medium | Implement persistence/replay cursor store for session events | #796 / #802 |
| R9 | Transport config has reconnect interval declared but no reconnect loop strategy at chat-client layer | `src/lib/pi-orchestrator/client/PiRemoteWebSocketTransport.ts:33,93` | Medium | Medium | Add explicit reconnect state machine + observable transitions | #797 / #804 |
| R10 | Provider compatibility/normalization complexity in pi-ai may surface edge regressions (tool ids/reasoning fields) | PureCastle audit pack (2026-02-11) | High | Medium | Adapter normalization tests + golden fixtures for assistant/tool events | #794 / #805 |
| R11 | CSP-limited argument validation contexts can weaken tool safety guarantees in browser/extension environments | PureCastle audit pack (2026-02-11) | High | Low-Med | Keep server-side validation authoritative; diagnostics when validation path downgraded | #795 / #806 |
| R12 | Synthetic tool-result insertion may hide upstream contract faults | PureCastle audit pack (2026-02-11) | Medium | Medium | Mark synthesized results in telemetry + fail quality gate if rate exceeds threshold | #803 / #806 |

---

## 3) Required Mitigation Deliverables

### D1 — Runtime Safety
- Typed error channel for transport/protocol failures
- Reconnect state machine with bounded retry and user-visible state
- Abort wiring from Conductor pause control

### D2 — Contract Integrity
- Strict typed reducer for chat events (`ChatV2Event`)
- Adapter tests for pi-ai -> chat-v2 mapping
- Idempotence test for duplicate `clientMessageId`

### D3 — Durability
- Session persistence + replay cursor with resume from `fromSeq`
- Recovery marker event for reopen fallback path

### D4 — Observability
- Correlation continuity checks (`wsId:requestId`)
- Tool lifecycle visibility including synthesized-result marker
- Timeout counters (transport/request/extension-ui)

---

## 4) Gate Conditions (must pass before default cutover)

### Gate G1 (Contract map approved)
- `conductor-piai-contract-set.md` and `conductor-piai-contract-matrix.md` reviewed and accepted.

### Gate G2 (Chat lane on pi-ai)
- Stream decode failures no longer disappear silently.
- Pause -> abort route verified.

### Gate G3 (Tool + extension bridge)
- Tool lifecycle visible and extension UI timeout path audited with diagnostics.

### Gate G4 (Persistence/resume)
- Resume from last seq survives reconnect and process restart path.

### Gate G5 (Legacy removal + telemetry)
- AgentSession path disabled/removed and telemetry envelope continuity remains green.

---

## 5) Immediate Implementation Order (no ceremony)

1. Fix silent stream degradation (R1).
2. Wire pause -> abort (R2).
3. Type reducer + formalize dropped tags (R3/R4/R5).
4. Add persistence/replay durability path (R8).
5. Land pi-ai adapter and compatibility fixtures (R10/R11/R12).

---

## 6) Evidence Anchors

- `src/components/testbed/conductor/agent-chat-stx.ts`
- `src/components/testbed/ConductorTestbed.tsx`
- `src/lib/pi-orchestrator/client/PiRemoteChatV2Client.ts`
- `src/lib/pi-orchestrator/client/PiRemoteWebSocketTransport.ts`
- `src/lib/pi-orchestrator/server/ChatGatewayV2.ts`
- `src/lib/pi-orchestrator/services/PiAgentHandle.ts`
- PureCastle findings pack (2026-02-11)
