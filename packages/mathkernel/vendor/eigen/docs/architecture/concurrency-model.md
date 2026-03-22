# Concurrency Model

> Consolidated from `thoughts/shared/plans/asset-123-concurrency-scenarios.md`
> Original date: 2026-02-06

## Overview

This document analyzes concurrent mutation scenarios for entity actors in the `@effect/cluster` system. The key invariant: **there is exactly ONE active instance of any entity across the entire cluster**. The ShardManager guarantees uniqueness; the Mailbox guarantees serial message processing.

## The Actor Model

```
EntityManager (Runner)
  Entity: PLT-123
    Mailbox (FIFO)       In-Memory State
      msg1  -------->    name: "X"
      msg2               status: operational
      msg3               ...

    concurrency = 1 (ONE AT A TIME)

INVARIANT: There is exactly ONE active instance of PLT-123 across
           the entire cluster. The ShardManager guarantees this.
           The Mailbox guarantees serial message processing.
```

## Scenario 1: Sequential Mutations (Happy Path)

Two clients rename PLT-123 one after the other. The mailbox serializes naturally. Both clients get correct replies. Final state reflects last write.

**Verdict**: No conflict. Last-write-wins.

## Scenario 2: Near-Simultaneous Arrival ("The Race")

Both clients send at the "same instant". The mailbox queue imposes a **total order**. One message arrives first (network non-determinism decides). Both are processed sequentially.

**Verdict**: No race condition. The mailbox serializes. Both clients get correct replies. Final state: whichever arrived second.

## Scenario 3: Mid-Processing Arrival

Client B sends while Client A's handler is mid-execution. The critical property: messages are **enqueued** regardless of processing state. Client B's message waits in the mailbox until Client A's handler completes.

**Verdict**: No torn state. No interleaving. The mailbox provides linearizability.

## Scenario 4: State Transition Conflicts

Client A sends `Commission` (planned -> operational) while Client B sends `BeginConstruction` (planned -> under_construction). Both are valid transitions from `planned`, but only one can win:

1. First message dequeued: Machine validates `planned -> X` -- succeeds
2. Second message dequeued: Machine validates `X -> Y` -- may fail if invalid from new state

**Verdict**: The Machine state graph rejects invalid transitions. First-come-first-served. Second client gets `MachineInvalidTransitionError` mapped to `RpcTransitionError`.

## Scenario 5: Entity Passivation and Reactivation

If PLT-123 is idle for too long, the Runner **passivates** it (evicts from memory). On next message:

1. Runner detects no active instance
2. Recreates entity actor
3. Loads state from State Service (SQL or in-memory)
4. Processes message against loaded state

**Verdict**: Seamless. The State Service is the source of truth for persistent state. Passivation/reactivation is transparent to clients.

## Scenario 6: Cluster Rebalancing

A node goes down. The ShardManager redistributes shards. PLT-123's shard moves to a new node:

1. Old node's entity is terminated
2. New node's Runner creates a fresh actor
3. State loaded from State Service
4. Messages in-flight are retried by @effect/cluster

**Verdict**: Brief unavailability during rebalance. No data loss (State Service is persistent). Clients may see transient errors, retried automatically.

## Key Guarantees

| Property | Guarantee | Mechanism |
|----------|-----------|-----------|
| **Single-instance** | One active entity per ID across cluster | ShardManager + consistent hashing |
| **Serial processing** | Messages processed one at a time per entity | Mailbox (FIFO, concurrency=1) |
| **No torn state** | State is always consistent between messages | No concurrent handler execution |
| **Graph validation** | Invalid transitions rejected | Machine state graph |
| **Persistence** | State survives passivation/restart | State Service (SQL-backed in prod) |
| **Ordering** | Total order within entity mailbox | FIFO queue |

## Implications for Client Design

1. **Optimistic UI is safe**: The entity guarantees serial consistency
2. **No client-side locking needed**: The actor model handles concurrency
3. **Retry on transient errors**: Cluster rebalancing may cause brief failures
4. **Last-write-wins for data updates**: No MVCC or conflict resolution needed
5. **Transition errors are expected**: Competing state transitions will reject the slower client
