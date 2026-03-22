# Conductor Completion Execution Board (P0/P1 Locked)

Owner: Val  
Feature: #F203  
Date: 2026-02-10

## Scope Lock

This board governs **Conductor completion only** for current chat/runtime scope.

- **P0** = release-blocking runtime hard cut + reliability gates
- **P1** = protocol/service hardening required to prevent regressions
- UX redesign work may proceed as **design artifacts only** until P0 closes

---

## P0 — Runtime Hard Cut + Reliability Gates (#F204)

Execution order is dependency-locked:

1. **#726** Remove old timeout/poll runtime path
2. **#727** Finalize reconnect + resumeFromSeq + snapshot resync
3. **#728** Emit V2 lifecycle JSONL logs end-to-end
4. **#729** Add reliability metrics
5. **#730** Run/automate 20-turn + reconnect replay suite
6. **#731** Execute Tauri Conductor manual checklist
7. **#732** Promote V2 as only active Conductor runtime path

### P0 Exit Criteria
- Legacy polling path no longer active in runtime send flow
- Reconnect replay verified under disruption scenarios
- 20-turn + reconnect suite green and repeatable
- Tauri manual checklist complete
- V2 path is sole production runtime path

---

## P1 — Protocol + Service Hardening (#F205)

Parallelizable with controlled dependency order:

1. **#733** Add optional protocol version envelope field
2. **#734** Normalize protocol errors to tagged domain errors
3. **#735** Add `Effect.catchTags` mapping for chat error boundaries
4. **#736** Finalize inspector send routing to service boundary
5. **#737** Finalize compound chat API + slot semantics
6. **#738** Implement storyboard behavior set on finalized API
7. **#739** Validation + deferred capability docs

### P1 Exit Criteria
- Stable error taxonomy across transport/router/service/UI
- Inspector/chat send path uses service boundary without direct transport assumptions
- Compound API frozen for phase implementation
- Storyboard behavior + docs/tests updated

---

## Current Known Progress Inputs

- WS server transport deadlock fixed by startup-constructed singleton router closure
- Chat V2 probe path validated (open/send/delta/final)
- 20-turn soak script result captured: `/tmp/tmnl/pi-chat-v2-20turn-report.json` (`ok: true`)

---

## Non-Negotiable Rules

1. No new runtime feature expansion before #F204 completion.
2. No legacy fallback resurrection during bugfixes.
3. Every regression fix must preserve stream-first semantics (ack fast, delta/final event-driven).
4. All remaining failures must be observable in JSONL with request/session/message correlation keys.
