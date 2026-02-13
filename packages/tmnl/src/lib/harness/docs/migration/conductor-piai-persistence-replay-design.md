# Conductor Harness Migration — Session Persistence + Replay Cursor Design

**Feature:** #F218 (EDIN / Design)  
**Task:** #796  
**Date:** 2026-02-11

---

## 1) Objective

Guarantee reconnect/resume correctness across:

1. transient websocket disconnects,
2. browser refresh,
3. control-plane restart.

No silent event loss. Replay must be sequence-based and deterministic.

---

## 2) Durable Data Model (schema-backed)

Implemented schema contracts:

- `src/lib/pi-orchestrator/schemas/chat-v2-persistence.ts`
  - `ChatV2SessionEnvelope`
  - `ChatV2EventEnvelope`
  - `ChatV2ReplayCursor`
  - `ChatV2DurableSnapshot`

Key fields:
- session envelope stores `backend`, `headSeq`, `status`
- event envelope stores full normalized `ChatV2Event` per `seq`
- replay cursor stores `lastAppliedSeq` per session consumer

---

## 3) Store Boundary

Implemented contract:

- `src/lib/pi-orchestrator/contracts/ChatSessionStore.ts`

Methods:
- `upsertSession`
- `appendEvent`
- `loadSession`
- `loadEventsAfter(sessionId, fromSeq)`
- `saveCursor`
- `loadCursor`
- `deleteSession`

Utilities:
- `deriveHeadSeq`
- `toReplayEvents`

---

## 4) Replay Algorithm

1. Resolve session envelope by `sessionId`.
2. Determine replay start seq:
   - if caller passes `fromSeq`, use it;
   - else use persisted cursor if available;
   - else start from 0.
3. Load events where `event.seq > fromSeq`.
4. Return `{ session, events }` snapshot.
5. After client applies events, persist cursor with latest `lastAppliedSeq`.

Guarantees:
- monotonic replay
- idempotent re-apply protection via reducer seq guard
- deterministic resume semantics

---

## 5) Integration Plan

- `ChatGatewayV2.appendEvent` will dual-write:
  - in-memory pubsub path (existing)
  - `ChatSessionStore.appendEvent` (durable)
- `getSnapshot` will prefer durable rows when store is present.
- fallback to in-memory snapshot if store unavailable (degraded mode, telemetry warning).

---

## 6) Acceptance for #796

- [x] Schema-backed persistence model defined
- [x] Store contract boundary defined
- [x] Replay cursor algorithm specified
- [x] Integration plan documented
