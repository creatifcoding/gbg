# Concurrent Mutation Scenarios — Asset 123

**Date:** 2026-02-06
**Entity:** Any concrete entity (e.g., `PLT-123` routed through `PlantEntity`)
**Runtime:** Effect Cluster with `EntityManager`, `Mailbox`, optional `MessageStorage`

---

## The Actor: What Asset 123 Actually Is

```
                    ┌─────────────────────────────────────────────┐
                    │           EntityManager (Runner)             │
                    │                                             │
                    │   ┌───────────────────────────────────────┐ │
                    │   │         Entity: PLT-123               │ │
                    │   │                                       │ │
                    │   │   ┌─────────────┐   ┌─────────────┐  │ │
                    │   │   │  Mailbox    │   │  In-Memory  │  │ │
                    │   │   │  (FIFO)    │   │  State      │  │ │
                    │   │   │            │   │             │  │ │
                    │   │   │  ┌──────┐  │   │  name: "X"  │  │ │
                    │   │   │  │ msg1 │──┼──▶│  status: op │  │ │
                    │   │   │  ├──────┤  │   │  ...        │  │ │
                    │   │   │  │ msg2 │  │   │             │  │ │
                    │   │   │  ├──────┤  │   └─────────────┘  │ │
                    │   │   │  │ msg3 │  │                    │ │
                    │   │   │  └──────┘  │   concurrency = 1  │ │
                    │   │   └─────────────┘   (ONE AT A TIME)  │ │
                    │   │                                       │ │
                    │   └───────────────────────────────────────┘ │
                    └─────────────────────────────────────────────┘

 INVARIANT: There is exactly ONE active instance of PLT-123 across
            the entire cluster. The ShardManager guarantees this.
            The Mailbox guarantees serial message processing.
```

---

## Scenario 1: Happy Path — Two Sequential Mutations

Two clients rename PLT-123, one after the other.

```
 Client A                    Mailbox (PLT-123)              Entity Handler              State
 ────────                    ─────────────────              ──────────────              ─────
    │                              │                              │                       │
    │  Rename("Alpha")             │                              │                       │
    │─────────────────────────────▶│                              │                       │
    │                              │  dequeue msg1                │                       │
    │                              │─────────────────────────────▶│                       │
    │                              │                              │  write: name="Alpha"  │
    │                              │                              │──────────────────────▶│
    │                              │                              │           ok ◀────────│
    │                              │       reply: { name: "Alpha" }                       │
    │◀─────────────────────────────│◀─────────────────────────────│                       │
    │                              │                              │                       │
    │                              │                              │                       │

 Client B                         │                              │                       │
 ────────                         │                              │                       │
    │  Rename("Bravo")             │                              │                       │
    │─────────────────────────────▶│                              │                       │
    │                              │  dequeue msg2                │                       │
    │                              │─────────────────────────────▶│                       │
    │                              │                              │  write: name="Bravo"  │
    │                              │                              │──────────────────────▶│
    │                              │                              │           ok ◀────────│
    │       reply: { name: "Bravo" }                              │                       │
    │◀─────────────────────────────│◀─────────────────────────────│                       │
    │                              │                              │                       │

 Final state: name = "Bravo"
 Both clients got their reply. No conflict. Last-write-wins.
```

**Verdict:** Boring. Everything works. The mailbox serializes naturally.

---

## Scenario 2: Near-Simultaneous Arrival — The "Race"

Both clients send at the "same instant". What happens?

```
 Client A                    Client B
 ────────                    ────────
    │                           │
    │ Rename("Alpha")           │ Rename("Bravo")
    │────────┐                  │────────┐
    │        │                  │        │
    │        ▼                  │        ▼
    │   ┌─────────┐        ┌─────────┐  │
    │   │ Sharding│        │ Sharding│  │
    │   │ (route) │        │ (route) │  │
    │   └────┬────┘        └────┬────┘  │
    │        │                  │        │
    │        ▼                  ▼        │
    │   ┌──────────────────────────┐    │
    │   │  Mailbox (PLT-123)       │    │
    │   │                          │    │
    │   │  ┌────────────────────┐  │    │
    │   │  │ 1. Rename("Alpha") │  │    │
    │   │  ├────────────────────┤  │    │
    │   │  │ 2. Rename("Bravo") │  │    │
    │   │  └────────────────────┘  │    │
    │   │                          │    │
    │   │  Processing: FIFO        │    │
    │   │  Concurrency: 1          │    │
    │   └──────────────────────────┘    │
    │                                    │
    │   ╔══════════════════════════╗     │
    │   ║  SOMEONE arrives first.  ║     │
    │   ║  The mailbox decides.    ║     │
    │   ║  No torn state.          ║     │
    │   ║  No lost update.         ║     │
    │   ║  Just: ordering.         ║     │
    │   ╚══════════════════════════╝     │
    │                                    │
    │        Timeline:                   │
    │        ──────────────────────────▶ │
    │        t1: "Alpha" processed       │
    │        t2: "Bravo" processed       │
    │                                    │
    │  reply: "Alpha" ✓                  │  reply: "Bravo" ✓
    │◀───────────────                    │◀───────────────
```

**Verdict:** No race condition. The mailbox queue imposes a total order. Both clients get correct replies. The entity sees `Alpha` then `Bravo`. Final state: `Bravo`.

---

## Scenario 3: Client B Sends WHILE Handler Is Mid-Processing Client A

This is the "dangerous" scenario in traditional systems. Not here.

```
                        TIME ──────────────────────────────────────────────▶

 Client A    ╔═══════════════════════════════════════╗
             ║ Rename("Alpha")                       ║
             ║ sent at t=0                            ║
             ╚═══════════╤═══════════════════════════╝
                         │
 Mailbox     ────────────┼──────────────────────────────────────
                         │ enqueue                     ▲
                         ▼                             │ enqueue
             ┌──────────────────┐  ┌──────────────────┐
             │ msg1: "Alpha"    │  │ msg2: "Bravo"    │
             │ status: ACTIVE   │  │ status: QUEUED   │
             └────────┬─────────┘  └──────────────────┘
                      │                    ▲
                      │                    │
 Client B             │       ╔════════════╧═══════════════╗
                      │       ║ Rename("Bravo")            ║
                      │       ║ sent at t=50ms             ║
                      │       ║                            ║
                      │       ║ Arrives while "Alpha" is   ║
                      │       ║ being processed.           ║
                      │       ║                            ║
                      │       ║ Does NOT interrupt.        ║
                      │       ║ Does NOT queue-jump.       ║
                      │       ║ Just waits.                ║
                      │       ╚════════════════════════════╝
                      │
 Handler     ─────────┼────────────────────────────────────────
                      ▼
             ┌──────────────────────────────────┐
             │  Processing "Alpha"               │
             │  t=0ms: receive                   │
             │  t=10ms: validate                 │
             │  t=20ms: state transition         │
             │  t=30ms: persist state            │
             │  t=40ms: reply to Client A ✓      │
             └──────────────────┬───────────────┘
                                │
                                ▼  (msg1 done, dequeue msg2)
             ┌──────────────────────────────────┐
             │  Processing "Bravo"               │
             │  t=50ms: receive                  │
             │  t=60ms: validate                 │
             │  t=70ms: state transition         │
             │  t=80ms: persist state            │
             │  t=90ms: reply to Client B ✓      │
             └──────────────────────────────────┘

 ╔═════════════════════════════════════════════════╗
 ║  No interleaving. No partial state. No locks.   ║
 ║  The actor model makes concurrency boring.      ║
 ╚═════════════════════════════════════════════════╝
```

**Verdict:** Client B's message waits in the mailbox. The handler never sees two messages at once. This is the fundamental guarantee of the actor model.

---

## Scenario 4: Handler CRASHES Mid-Processing

This is where it gets interesting. What if PLT-123's handler dies between state mutation and reply?

```
 Client A                 Mailbox            Handler              MessageStorage
 ────────                 ───────            ───────              ──────────────
    │                        │                  │                       │
    │  Rename("Alpha")       │                  │                       │
    │  requestId: req-001    │                  │                       │
    │───────────────────────▶│                  │                       │
    │                        │                  │                       │
    │                        │  persist request │                       │
    │                        │──────────────────┼──────────────────────▶│
    │                        │                  │     stored: req-001   │
    │                        │                  │     status: UNPROCESSED
    │                        │  dequeue         │                       │
    │                        │─────────────────▶│                       │
    │                        │                  │                       │
    │                        │                  │  state = "Alpha" ✓    │
    │                        │                  │                       │
    │                        │                  │                       │
    │                        │               ╔══╧══════════════════╗    │
    │                        │               ║  💥 CRASH!          ║    │
    │                        │               ║  Runner dies.       ║    │
    │                        │               ║  Reply never sent.  ║    │
    │                        │               ╚═════════════════════╝    │
    │                        │                                          │
    │  ... waiting ...       │                                          │
    │                        │                                          │
    │                        │     ┌──────────────────────────────┐     │
    │                        │     │ ShardManager detects failure  │     │
    │                        │     │ Rebalances PLT-123 to        │     │
    │                        │     │ a new Runner                 │     │
    │                        │     └──────────────┬───────────────┘     │
    │                        │                    │                      │
    │                        │                    │  poll unprocessed    │
    │                        │                    │─────────────────────▶│
    │                        │                    │  found: req-001      │
    │                        │                    │◀─────────────────────│
    │                        │                    │                      │
    │                        │                    │  re-execute handler  │
    │                        │                    │  state already="Alpha"
    │                        │                    │  (idempotent check)  │
    │                        │                    │                      │
    │                        │                    │  persist reply       │
    │                        │                    │─────────────────────▶│
    │                        │                    │  status: PROCESSED   │
    │                        │                    │                      │
    │  reply: { name: "Alpha" }                   │                      │
    │◀────────────────────────────────────────────│                      │
    │                                                                    │

 ╔════════════════════════════════════════════════════════════════════╗
 ║  MessageStorage is the safety net.                                 ║
 ║                                                                    ║
 ║  1. Request persisted BEFORE handler runs                          ║
 ║  2. Reply persisted BEFORE delivery to client                      ║
 ║  3. Unprocessed messages re-polled after shard rebalance            ║
 ║  4. Request ID deduplication prevents double-application            ║
 ║                                                                    ║
 ║  WITHOUT MessageStorage (in-memory TestRunner):                    ║
 ║  → Message is LOST. Client gets no reply. State may be mutated     ║
 ║    but nobody knows. This is the in-memory trade-off.              ║
 ╚════════════════════════════════════════════════════════════════════╝
```

**Verdict:** With `MessageStorage` (production), the system recovers automatically. Without it (dev `TestRunner`), the message is lost — acceptable for development.

---

## Scenario 5: The Projection Question — Where It Gets Spicy

Now add a synchronous projection. The entity handler writes state AND an `asset_projection` row in the same operation.

### 5a: Same-Transaction Projection (No Outbox)

```
 Client A                 Handler (PLT-123)          Database
 ────────                 ─────────────────          ────────
    │                           │                       │
    │  Rename("Alpha")          │                       │
    │──────────────────────────▶│                       │
    │                           │                       │
    │                           │  BEGIN TRANSACTION    │
    │                           │──────────────────────▶│
    │                           │                       │
    │                           │  UPDATE plants        │
    │                           │  SET name = "Alpha"   │
    │                           │  WHERE id = 'PLT-123' │
    │                           │──────────────────────▶│  ✓
    │                           │                       │
    │                           │  UPSERT asset_projection
    │                           │  SET name = "Alpha",  │
    │                           │      kind = 'plant'   │
    │                           │  WHERE id = 'PLT-123' │
    │                           │──────────────────────▶│  ✓
    │                           │                       │
    │                           │  COMMIT               │
    │                           │──────────────────────▶│  ✓
    │                           │                       │
    │  reply: ok                │                       │
    │◀──────────────────────────│                       │
    │                           │                       │

 Client B (reading projection)  │                       │
 ─────────────────────────────  │                       │
    │                           │                       │
    │  Asset.Get("PLT-123")     │                       │
    │───────────────────────────┼──────────────────────▶│
    │                           │  SELECT FROM           │
    │                           │  asset_projection      │
    │  { name: "Alpha", kind: "plant" }                  │
    │◀──────────────────────────┼──────────────────────│
    │                           │                       │

 ╔═══════════════════════════════════════════════════╗
 ║  ATOMIC. Both writes in one transaction.          ║
 ║  Read-after-write: CONSISTENT.                    ║
 ║  No eventual consistency window.                  ║
 ║  No outbox relay lag.                             ║
 ║  No "stale read" surprise.                        ║
 ╚═══════════════════════════════════════════════════╝
```

### 5b: What If the Projection Write FAILS?

```
 Client A                 Handler (PLT-123)          Database
 ────────                 ─────────────────          ────────
    │                           │                       │
    │  Rename("Alpha")          │                       │
    │──────────────────────────▶│                       │
    │                           │                       │
    │                           │  BEGIN TRANSACTION    │
    │                           │──────────────────────▶│
    │                           │                       │
    │                           │  UPDATE plants ✓      │
    │                           │──────────────────────▶│
    │                           │                       │
    │                           │  UPSERT projection    │
    │                           │──────────────────────▶│
    │                           │                       │
    │                           │            ╔══════════╧══════════╗
    │                           │            ║  💥 CONSTRAINT      ║
    │                           │            ║  VIOLATION or       ║
    │                           │            ║  DISK FULL          ║
    │                           │            ╚══════════╤══════════╝
    │                           │                       │
    │                           │  ROLLBACK (automatic) │
    │                           │◀──────────────────────│
    │                           │                       │
    │                           │  BOTH writes rolled   │
    │                           │  back. State unchanged.│
    │                           │  Projection unchanged. │
    │                           │                       │
    │  reply: ERROR             │                       │
    │◀──────────────────────────│                       │
    │                           │                       │

 ╔═══════════════════════════════════════════════════╗
 ║  SAME TRANSACTION = SAME FATE.                    ║
 ║  If projection fails, state rolls back too.       ║
 ║  If state fails, projection never written.        ║
 ║  No inconsistency possible.                       ║
 ║                                                   ║
 ║  This is why you don't need an outbox.            ║
 ╚═══════════════════════════════════════════════════╝
```

---

## Scenario 6: The Outbox Anti-Pattern — What Happens If We ADD One

Now watch what happens when we "solve" a problem that doesn't exist.

```
 Client A                 Handler (PLT-123)     Entity DB        Outbox DB
 ────────                 ─────────────────     ─────────        ─────────
    │                           │                   │                │
    │  Rename("Alpha")          │                   │                │
    │──────────────────────────▶│                   │                │
    │                           │                   │                │
    │                           │  Write state      │                │
    │                           │──────────────────▶│ ✓              │
    │                           │                   │                │
    │                           │  Write outbox event                │
    │                           │───────────────────┼───────────────▶│
    │                           │                   │                │
    │                           │                   │   ╔════════════╧═══╗
    │                           │                   │   ║ 💥 NETWORK     ║
    │                           │                   │   ║ TIMEOUT /      ║
    │                           │                   │   ║ CONNECTION     ║
    │                           │                   │   ║ REFUSED        ║
    │                           │                   │   ╚════════════════╝
    │                           │                   │                │
    │                           │  State: "Alpha" ✓ │                │
    │                           │  Outbox: ✗ FAILED │                │
    │                           │                   │                │
    │                           │  ╔════════════════╧═══════════════╗│
    │                           │  ║  DUAL-WRITE INCONSISTENCY!     ║│
    │                           │  ║                                 ║│
    │                           │  ║  State says: name = "Alpha"    ║│
    │                           │  ║  Outbox says: (nothing)        ║│
    │                           │  ║  Projection: never updated     ║│
    │                           │  ║                                 ║│
    │                           │  ║  This is THE problem the       ║│
    │                           │  ║  outbox was supposed to solve. ║│
    │                           │  ║  Instead, we CREATED it by     ║│
    │                           │  ║  adding a second write target. ║│
    │                           │  ╚════════════════════════════════╝│
    │                           │                                    │


 ══════════════════════════════════════════════════════════════════
 "But wait, same database!" you say. Fine. Let's put them together:
 ══════════════════════════════════════════════════════════════════

 Client A                 Handler (PLT-123)     Same Database (state + outbox)
 ────────                 ─────────────────     ─────────────────────────────
    │                           │                          │
    │  Rename("Alpha")          │                          │
    │──────────────────────────▶│                          │
    │                           │                          │
    │                           │  BEGIN TX                │
    │                           │  UPDATE plants ...  ✓    │
    │                           │  INSERT outbox ...  ✓    │
    │                           │  COMMIT ✓                │
    │                           │                          │

 OK, that works. But now you have:

    ┌──────────────────────────────────────────────────┐
    │                Same Database                      │
    │                                                   │
    │  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
    │  │ plants   │  │ outbox   │  │ projection    │  │
    │  │ table    │  │ table    │  │ table         │  │
    │  └──────────┘  └──────────┘  └───────────────┘  │
    │       ✓             ✓              ???            │
    │                     │                             │
    │                     │  relay daemon polls         │
    │                     │  outbox every N ms          │
    │                     │  writes to projection       │
    │                     ▼                             │
    │              ┌──────────────┐                     │
    │              │ Relay Fiber  │                     │
    │              │ (polling)    │                     │
    │              └──────────────┘                     │
    └──────────────────────────────────────────────────┘

 vs. WITHOUT the outbox:

    ┌──────────────────────────────────────────────────┐
    │                Same Database                      │
    │                                                   │
    │  ┌──────────┐  ┌───────────────┐                 │
    │  │ plants   │  │ projection    │                 │
    │  │ table    │  │ table         │                 │
    │  └──────────┘  └───────────────┘                 │
    │       ✓              ✓                            │
    │       └──────────────┘                            │
    │        same transaction                           │
    │        no relay daemon                            │
    │        no polling                                 │
    │        no eventual consistency                    │
    └──────────────────────────────────────────────────┘

 ╔════════════════════════════════════════════════════════╗
 ║  The outbox + relay is a RUBE GOLDBERG MACHINE        ║
 ║  that adds:                                            ║
 ║    • an extra table                                    ║
 ║    • a polling fiber                                   ║
 ║    • eventual consistency (lag between write & read)   ║
 ║    • a monitoring obligation (outbox backlog)          ║
 ║    • a new failure mode (relay crashes)                ║
 ║                                                        ║
 ║  ...to achieve the exact same result as a              ║
 ║  second UPSERT in the same transaction.                ║
 ╚════════════════════════════════════════════════════════╝
```

---

## Scenario 7: The Interesting Edge — Two Mutations, One Depends on the Other

What if Client B's mutation is semantically dependent on Client A's result?

```
 Client A: Rename("Alpha")
 Client B: SetStatus("operational")  ← only valid if name is set

 ┌──────────────────────────────────────────────────────────────┐
 │                                                              │
 │  CASE 1: A arrives first (intended order)                    │
 │  ────────────────────────────────────────                    │
 │                                                              │
 │  Mailbox: [ Rename("Alpha") , SetStatus("operational") ]    │
 │                   ▼                                          │
 │  Handler: name = "Alpha"  ✓                                  │
 │                   ▼                                          │
 │  Handler: status = "operational"  ✓  (name exists, valid)    │
 │                                                              │
 │  Result: ✓ Both succeed                                      │
 │                                                              │
 ├──────────────────────────────────────────────────────────────┤
 │                                                              │
 │  CASE 2: B arrives first (unintended order)                  │
 │  ────────────────────────────────────────                    │
 │                                                              │
 │  Mailbox: [ SetStatus("operational") , Rename("Alpha") ]    │
 │                   ▼                                          │
 │  Handler: status = "operational" → ✗ INVALID                 │
 │           (plant has no name, fails validation)              │
 │                   ▼                                          │
 │  Handler: name = "Alpha"  ✓                                  │
 │                                                              │
 │  Result: Client B gets error. Client A succeeds.             │
 │          Client B must retry.                                │
 │                                                              │
 ├──────────────────────────────────────────────────────────────┤
 │                                                              │
 │  CASE 3: Saga variant — B waits for A                        │
 │  ────────────────────────────────────────                    │
 │                                                              │
 │  Client B does NOT fire-and-forget.                          │
 │  Client B AWAITS Client A's reply, THEN sends:              │
 │                                                              │
 │  const result = await rpc.Plant.Rename("Alpha")              │
 │  if (result.ok) await rpc.Plant.SetStatus("operational")     │
 │                                                              │
 │  Result: ✓ Guaranteed order. Client owns the saga.           │
 │                                                              │
 └──────────────────────────────────────────────────────────────┘

 ╔═══════════════════════════════════════════════════════════╗
 ║  The actor serializes. It does NOT coordinate.            ║
 ║  Semantic ordering is the CLIENT'S responsibility.        ║
 ║  The actor guarantees: no torn state, no lost update.     ║
 ║  It does NOT guarantee: your business workflow order.     ║
 ╚═══════════════════════════════════════════════════════════╝
```

---

## Scenario 8: The Read-Your-Writes Problem (Projection Lag)

With an **async** projection (outbox-based), a client can see stale data.
With a **sync** projection (same-transaction), this is impossible.

```
             ASYNC PROJECTION (outbox)              SYNC PROJECTION (same tx)
             ─────────────────────────              ─────────────────────────

 t=0ms  ┌─ Client A: Rename("Alpha")    ┌─ Client A: Rename("Alpha")
        │                                │
 t=10ms │  Handler: state="Alpha" ✓      │  Handler: state="Alpha" ✓
        │                                │           projection="Alpha" ✓
        │  Outbox: event written ✓       │           (same transaction)
        │                                │
 t=11ms │  Client A gets reply ✓         │  Client A gets reply ✓
        │                                │
 t=12ms │  Client A: Asset.Get(PLT-123)  │  Client A: Asset.Get(PLT-123)
        │                                │
        │  ┌────────────────────┐        │  ┌────────────────────┐
        │  │ Projection table:  │        │  │ Projection table:  │
        │  │ name = ??? (old)   │        │  │ name = "Alpha" ✓   │
        │  │                    │        │  │                    │
        │  │ Relay hasn't run   │        │  │ Already committed  │
        │  │ yet! Polling at    │        │  │ in same TX.        │
        │  │ 100ms intervals.   │        │  │                    │
        │  └────────────────────┘        │  └────────────────────┘
        │                                │
        │  ╔════════════════════╗        │  ╔════════════════════╗
        │  ║ 😱 STALE READ!    ║        │  ║ ✓ FRESH READ       ║
        │  ║ "I just renamed   ║        │  ║ Consistent.        ║
        │  ║  it! Why is it    ║        │  ║ Always.            ║
        │  ║  still the old    ║        │  ╚════════════════════╝
        │  ║  name?!"          ║        │
        │  ╚════════════════════╝        │
        │                                │
 t=100ms│  Relay polls outbox...         │
        │  Projection updated ✓          │
        │  (88ms too late)               │
        │                                │

 ╔═══════════════════════════════════════════════════════════════╗
 ║  The async projection trades freshness for decoupling.        ║
 ║  The sync projection trades decoupling for freshness.         ║
 ║                                                               ║
 ║  For a SINGLE DATABASE, you don't need the decoupling.        ║
 ║  Take the freshness. Skip the outbox.                         ║
 ║                                                               ║
 ║  When do you NEED the decoupling?                             ║
 ║  → When the projection is in a DIFFERENT database.            ║
 ║  → When external consumers (Kafka) need the events.           ║
 ║  → Neither of these is true today.                            ║
 ╚═══════════════════════════════════════════════════════════════╝
```

---

## Scenario 9: Mailbox Backpressure — What If We Flood PLT-123?

100 clients all send mutations simultaneously.

```
 100 Clients
 ───────────
    │││││││││ ... ││││
    │││││││││     ││││
    ▼▼▼▼▼▼▼▼▼     ▼▼▼▼
    ┌──────────────────────────────────────────┐
    │           Mailbox (PLT-123)               │
    │                                           │
    │  Capacity: entityMailboxCapacity (config)  │
    │                                           │
    │  ┌─────┬─────┬─────┬─────┬─────┬── ─ ─  │
    │  │msg1 │msg2 │msg3 │msg4 │msg5 │ ...    │
    │  └─────┴─────┴─────┴─────┴─────┴── ─ ─  │
    │                                           │
    │  Processing rate: ~1 msg per handler time  │
    │  If handler takes 10ms → 100 msg/s max    │
    │                                           │
    └──────────────────────┬───────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         UNDER CAPACITY            OVER CAPACITY
              │                         │
              ▼                         ▼
    ┌──────────────────┐   ┌──────────────────────┐
    │  All messages     │   │  Volatile messages:   │
    │  queued and       │   │  → MailboxFull error  │
    │  processed in     │   │  → Client gets 503    │
    │  FIFO order.      │   │                       │
    │                   │   │  Durable messages:     │
    │  Clients wait     │   │  → Retry after         │
    │  proportionally   │   │    sendRetryInterval   │
    │  longer.          │   │  → Eventually processed│
    └──────────────────┘   └──────────────────────┘

 ╔═══════════════════════════════════════════════════════════╗
 ║  This is natural backpressure. The actor self-regulates.  ║
 ║  No need for external rate limiting.                      ║
 ║  No need for queue infrastructure.                        ║
 ║  The mailbox IS the queue.                                ║
 ╚═══════════════════════════════════════════════════════════╝
```

---

## Summary: The Concurrency Landscape

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                                                                  │
 │              WHAT THE ACTOR MODEL GIVES YOU FOR FREE              │
 │              ───────────────────────────────────────              │
 │                                                                  │
 │  ✓ No torn state        (mailbox serializes)                     │
 │  ✓ No lost updates      (FIFO ordering)                         │
 │  ✓ No dirty reads       (in-memory state is authoritative)       │
 │  ✓ No deadlocks         (single-writer, no locks needed)         │
 │  ✓ Backpressure         (mailbox capacity)                       │
 │  ✓ Crash recovery       (MessageStorage + idempotency)           │
 │  ✓ At-least-once        (polling + request ID dedup)             │
 │                                                                  │
 │              WHAT YOU MUST HANDLE YOURSELF                        │
 │              ────────────────────────────                         │
 │                                                                  │
 │  ⚠ Semantic ordering    (client's responsibility)                │
 │  ⚠ Cross-entity txns    (no built-in saga)                       │
 │  ⚠ Read freshness       (sync projection solves this)            │
 │  ⚠ External delivery    (outbox needed ONLY for Kafka/NATS)      │
 │                                                                  │
 │              WHAT THE OUTBOX WOULD ADD                            │
 │              ────────────────────────                             │
 │                                                                  │
 │  ✗ A second write target  (creates dual-write risk)              │
 │  ✗ A relay daemon         (new failure mode)                     │
 │  ✗ Eventual consistency   (stale reads)                          │
 │  ✗ Monitoring surface     (outbox backlog alerts)                │
 │  ✗ Operational complexity (for zero benefit today)               │
 │                                                                  │
 └──────────────────────────────────────────────────────────────────┘

 The verdict for Asset 123:
 ┌──────────────────────────────────────────────────────────────────┐
 │                                                                  │
 │  Two mutations to PLT-123 → mailbox serializes → both succeed   │
 │  Two mutations at same time → one waits → both succeed           │
 │  Handler crashes → MessageStorage replays → client gets reply   │
 │  100 mutations flood in → backpressure → orderly processing     │
 │                                                                  │
 │  The actor IS the concurrency solution.                          │
 │  The outbox IS the concurrency problem.                          │
 │                                                                  │
 └──────────────────────────────────────────────────────────────────┘
```
