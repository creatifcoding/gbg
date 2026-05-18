# RFC: NATS / MSH Role in PCT Journal and Federation

Status: Draft 0.1  
Scope: PCT production federation, EventJournal durability, MSH/NATS integration  
Related: `packages/msh/docs/pct-lnk-composition-rfc.md`, `packages/pct/RFC-IDENTITY.md`

## 1. Intent

Evaluate where NATS belongs in the PCT/Lnk federation architecture without turning NATS into a magic identity, authorization, and journal soup.

Prime’s hypothesis is correct to examine: NATS KV or streams might fit parts of the system very well. The question is **which parts**.

## 2. Source-grounded constraints

### 2.1 Effect-smol EventJournal has an SQL backend

Local Effect-smol source provides:

- `effect-v4/unstable/eventlog/SqlEventJournal`
- `SqlEventJournal.layer(options)`
- backing tables for entries and remote sequence tracking
- dialect support including `pg` inside the SQL implementation

This is the only source-supported durable EventJournal backend currently suitable for server production without writing our own EventJournal implementation.

### 2.2 MSH composition boundary is already defined

`packages/msh/docs/pct-lnk-composition-rfc.md` states:

- `@tmnl/msh` owns NATS connection/auth, JetStream/KV wrappers, subject hygiene, tracing.
- `@tmnl/msh` must not own PCT schema/procedure semantics or Lnk durable-stream semantics.
- PCT/Lnk adapters own domain semantics and map them onto MSH primitives.

### 2.3 Lnk NATS bridge seam already points to KV + JetStream

`packages/lnk/src/services/wire/nats-bridge/Port.ts` records:

- metadata should live in KV;
- stream messages should live in JetStream;
- JetStream sequence values must be translated to Lnk opaque offsets inside `@tmnl/lnk`;
- producer idempotency may use JetStream `msgID` plus KV for fencing state.

That same boundary discipline should guide PCT.

## 3. Decision summary

| Candidate | Recommended role | Reason |
| --- | --- | --- |
| Postgres / SQL | Canonical production EventJournal | Effect-smol already supports SQL EventJournal; preserves EventJournal semantics including `writeFromRemote` and remote sequence tracking. |
| NATS JetStream | Federation transport / fanout / optional PCT binding | Strong ordered append stream, excellent for distribution, but not currently an Effect-smol EventJournal backend without custom implementation. |
| NATS KV | Metadata, snapshots, capability/grant descriptors, stream state | KV fits latest-value records and operational metadata better than canonical event append logs. |
| NATS request/reply | Procedure invocation transport | Good for queries/pure calls and direct RPC-like operations. |
| NATS as canonical EventJournal | Deferred / research only | Possible, but requires a custom `EventJournal` implementation respecting Effect-smol remote sequence and duplicate semantics. |

## 4. Why Postgres first

PCT Flow C relies on Effect-smol `EventJournal` semantics:

- local entries are append-only;
- remote entries carry `remoteSequence`;
- `EventJournal.nextRemoteSequence(remoteId)` chooses resume point;
- `EventJournal.writeFromRemote(...)` owns duplicate detection and remote progress;
- server-side EventLogRemote changes streams must not confuse substrate sequence with PCT registry revision.

`SqlEventJournal` implements this contract directly. Postgres gives us a boring, durable, inspectable, transactional store. Boring is good here. The federation substrate does not need a jazz solo while identity is still being nailed down.

## 5. Where NATS fits well

### 5.1 EventLogRemote transport

NATS can carry EventLogRemote RPC/stream messages as a transport binding after the MSH seam is stable.

This is distinct from making NATS the EventJournal. A node may store its EventJournal in Postgres while using NATS to exchange changes with peers.

### 5.2 PCT registry broadcast binding

A PCT MSH binding can publish registry facts/events to JetStream subjects such as:

```txt
_tmnl.pct.registry.<node>.<event>
```

Consumers can subscribe for fanout, audit, or materialized views. This binding should be additive; the canonical local journal remains EventJournal.

### 5.3 Procedure invocation

Use NATS request/reply for queries and pure calls:

```txt
_tmnl.pct.invoke.<procedure-id>.<correlation-id>
_tmnl.pct.reply.<correlation-id>
```

For mutating commands requiring audit/replay, use JetStream command/event streams.

### 5.4 Lnk durable streams

Lnk should own the NATS mapping:

- stream metadata and producer fencing in KV;
- stream payloads in JetStream;
- JetStream sequence translated to Lnk opaque offsets inside `@tmnl/lnk`.

PCT should consume Lnk at the protocol level, not parse NATS offsets.

### 5.5 Identity/capability metadata

NATS KV is a reasonable substrate for public descriptors, peer pins, capability grant caches, or operational snapshots.

It is **not** by itself authorization. PCT capability verification remains a PCT decision.

## 6. Why NATS is not the first EventJournal backend

A NATS-backed EventJournal is possible, but it is not a small switch.

It would need to implement the full `EventJournal` service contract:

- `entries`
- `write`
- `writeFromRemote`
- `withRemoteUncommited`
- `nextRemoteSequence`
- `withLock`
- `destroy`

It must preserve these invariants:

1. exactly-once local application for remote entries by `(remoteId, remoteSequence)`;
2. deterministic duplicate detection on reconnect;
3. transactional write + registry handler fold, or a compensating design;
4. conflict tracking compatible with Effect-smol `EventLog` handlers;
5. clear mapping between NATS sequence and EventJournal entry IDs without confusing them.

JetStream sequence numbers are not EventJournal entry IDs and are not PCT registry revisions. Mixing those would be architectural vandalism with a messaging logo.

## 7. Proposed implementation path

### Step 1 — Postgres journal path

Already started in PCT:

```json
{
  "journal": {
    "backend": "postgres",
    "entryTable": "pct_event_journal",
    "remotesTable": "pct_event_remotes"
  }
}
```

This selects `SqlEventJournal.layer({ entryTable, remotesTable })` and requires a compatible `SqlClient` layer.

Open adapter question: `@effect/sql-pg` imports bare `effect/...`, while PCT currently imports `effect-v4/...`. We should not mix Effect module identities blindly. Options:

1. provide a compatible pg `SqlClient` from the host runtime;
2. add an alias-safe pg adapter package/path;
3. move strict-v4 packages to a consistent bare `effect` v4 resolution once the wider repo is ready.

### Step 2 — MSH/NATS seam

Use the accepted MSH composition RFC:

- MSH owns substrate services.
- PCT adds optional `bindings/msh` subpath.
- Lnk adds/finishes NATS bridge adapter behind explicit subpath.

### Step 3 — NATS as transport, not canonical journal

First NATS/PCT integration should be transport or fanout:

- EventLogRemote-over-MSH transport; or
- registry broadcast binding over JetStream; or
- procedure invocation transport.

Do not replace EventJournal with NATS until a dedicated EventJournal implementation RFC exists.

### Step 4 — Optional NATS EventJournal research

Only after live Postgres-backed Flow C works, evaluate a true NATS EventJournal implementation.

Acceptance for that future RFC:

- explicit mapping of EventJournal operations to JetStream/KV;
- proof of remote duplicate handling;
- reconnect/resume tests;
- failure-mode analysis for split brain, stream compaction, retention drops, and KV revision conflicts.

## 8. Current recommendation

Use:

```txt
Postgres = canonical local EventJournal durability
NATS JetStream = distribution / fanout / Lnk payload streams / command streams
NATS KV = metadata / descriptors / capability grant cache / Lnk stream metadata
MSH = substrate boundary for all NATS mechanics
PCT/Lnk = semantic adapters above MSH
```

That lets us finish Flow C without baking transport mechanics into identity or registry semantics. Elegant enough to survive contact with production, which is really the whole point.
