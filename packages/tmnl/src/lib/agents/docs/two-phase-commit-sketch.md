# Agent Task Logs — Transactional Outbox (Not Fallback Archive)

This module uses a **transactional outbox / WAL** pattern:

- **Final durability authority:** NATS JetStream
- **Local durability role:** idempotent WAL for *unacked* entries only
- **Recovery mode:** replay pending WAL entries until JetStream ack

This is **not** “local archive fallback.”

---

## 1) Why this pattern

For task logs, we need:

1. no loss while offline / reconnecting
2. idempotent replays
3. ack-gated completion
4. bounded, inspectable failure semantics

`PersistedQueue` gives exactly the right contract:

- `offer(value, { id })` is idempotent-by-id
- `take(f)` commits item only when `f` succeeds
- `take(f)` requeues on failure and increments attempts

So WAL lifecycle becomes deterministic:

`pending -> inflight -> acked` (or terminal failure after max attempts)

---

## 2) Concrete architecture in TMNL

### 2.1 Outbox envelope schema

`AgentTaskLogOutboxEnvelope` (Schema.TaggedClass)

- `taskId`
- `entry` (`AgentTaskLogEntry`)
- `enqueuedAt`
- `source` (`runtime | recovery`)

### 2.2 Custom queue store

`AgentTaskLogOutboxQueueStore` implements `PersistedQueueStore` using `BackingPersistence`:

- persisted per-queue state:
  - `ids: string[]`
  - `items: { id, attempts, element }[]`
- corrupted state recovery:
  - drop bad key
  - continue with empty queue

### 2.3 Durability publisher

`AgentTaskLogDurabilityService.publishAndAwaitAck(taskId, entry)`:

- `NatsStreamService.ensureStream(...)`
- `NatsStreamService.publish(..., { msgId: entry.id, expectStream })`
- returns `AgentTaskLogDurabilityReceipt`

### 2.4 Outbox orchestrator

`AgentTaskLogOutboxService`:

- `enqueue(taskId, entry)`
- `drainOne()`
- `drainForever()`

Drain callback wraps publish/ack in `Effect.uninterruptibleMask` so callback completion semantics stay atomic with queue commit.

---

## 3) Uninterruptible boundary (critical)

Use this shape in the drain callback:

```ts
queue.take(
  (envelope, metadata) =>
    Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        // restore(...) for potentially blocking/network work
        return yield* restore(
          durability.publishAndAwaitAck(envelope.taskId, envelope.entry),
        )
      }),
    ),
)
```

Why:

- queue commit/requeue decision depends on callback success/failure exit
- interruption must not produce ambiguous partial-commit behavior
- network call remains interruptible via `restore(...)`

---

## 4) Idempotency model

Two layers:

1. **Outbox offer idempotency** via queue `id = entry.id`
2. **JetStream publish idempotency** via `msgId = entry.id`

If replay happens, duplicate delivery resolves safely at JetStream ack layer.

---

## 5) Failure semantics

### Enqueue failure
- WAL write failed -> return enqueue error
- entry remains in hot in-memory path per UI policy, but not durable

### Drain/publish failure
- callback fails -> item requeued with incremented attempts
- continue replay loop

### Max attempts reached
- item removed from active replay set
- emit degraded signal / operator telemetry (follow-up integration)

---

## 6) Layer composition

Canonical composition:

- `AgentTaskServiceNatsDurable`
- `AgentTaskLogOutboxQueueLayer` (`PersistedQueue.layer` + custom store)
- `AgentTaskLogOutboxServiceDefault`

Optional merged stack:

- `AgentTaskServiceNatsOutbox`
- `AgentTaskServiceNatsOutboxMicro`

---

## 7) What this is NOT

- not 2PC coordinator across multiple resource managers
- not local archive as long-term truth
- not replacing JetStream durability

It is a **single-writer transactional outbox** with ack-gated completion and deterministic replay.

---

## 8) Implementation checklist

- [x] Schema-backed outbox envelope
- [x] Custom `PersistedQueueStore` for WAL state
- [x] `Effect.uninterruptibleMask` around drain callback
- [x] Idempotent offer + msgId publish
- [x] Retry-on-failure semantics via queue take
- [ ] dead-letter + degraded status atoms wiring
- [ ] startup replay fiber wiring in surface/controller
- [ ] observability counters for pending/inflight/retries/drop
