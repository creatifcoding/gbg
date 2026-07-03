# RFC — ProjectionWorker Runtime Hardening Beyond the Host Seam

Status: planning
Owner: PCT/LNK/MSH hardening portfolio
Date: 2026-05-25

## Purpose

The current ProjectionWorker slice proves the semantics in memory: pure source
messages become frame parts, parts merge into frame state, complete/partial
frames materialize, and optional frame-stream output emits receipts.

This RFC names the production knives before they cut us. The goal is to harden
ProjectionWorker runtime execution without violating the boundaries:

- **MSH remains substrate-only**: NATS, JetStream, KV, auth, subjects, micro-host
  seams.
- **LNK owns Durable Streams semantics**: offsets, producer fencing, stream close,
  read/tail semantics, retention, and stream append idempotency.
- **PCT owns projection contracts/control plane**: specs, compiled Timescale plans,
  scheduler/admission, migration previews, frame assembly semantics, and runtime
  port contracts.
- **Timescale is durable operational truth for projection state**: source facts,
  part ledger, frame state, materialized frame rows, and output/outbox ledger.

## Current state map

### Implemented

- `FrameProjectionSpec` declares source bindings, frame timing/completeness, and
  output table/stream materialization.
- `TimescaleProjectionCompiler` emits DDL for:
  - source fact hypertable;
  - active frame state table;
  - source-offset part ledger;
  - frame hypertable and indexes.
- `ProjectionAssembly` is pure and deterministic:
  - bucket calculation;
  - deterministic frame id;
  - source-message-to-part conversion;
  - merge/completeness;
  - timeout decision;
  - source-offset ledger decision.
- `ProjectionRuntime` is a memory proof over ports:
  - `ProjectionSourceReader`;
  - `TimescaleFrameWriter`;
  - `FrameStreamWriter`;
  - `ProjectionWorkerRunner.runOnce` integration.
- `ProjectionScheduler` is an Effect fiber supervisor over `ProjectionWorkerRunner`.
- `ProjectionScheduling` gives local SEDA admission:
  - duplicate singleflight;
  - hot target gate;
  - global budget;
  - parked/retry lanes;
  - internal diagnostic look.
- `ProjectionWorkerNatsHost` exposes control operations over generic MSH micro
  endpoint hosting.

### Not yet production-safe

The memory runtime has no crash recovery, durable leases, transactional source
ledger, persistent frame state, output outbox, source cursor store, or per-source
schema decoding provider. That is expected. The proof is a scalpel sketch, not a
battlefield hospital.

## Knives and disarms

### Knife 1 — Source offsets are mandatory, but LNK high-level reads can hide them

`ProjectionSourceMessage.offset` is required for idempotency. LNK `Message` only
carries an offset when it is the final message in a read batch. Intermediate
messages may have `offset: undefined` because the current wire protocol exposes
only the trailing `Stream-Next-Offset`.

Disarm:

1. Production source readers must use an LNK-owned API that yields one durable
   offset per message.
2. Until LNK grows a richer per-message read surface, the safe adapter uses
   `limit: 1` reads so the single message is always the trailing message and has
   an offset.
3. PCT must reject source messages without offsets at the port boundary. No
   synthetic offsets in PCT. The stream system owns offsets, darling.

Future LNK improvement:

- Add an LNK-owned `DurableMessageReader` / `readMessages` surface that returns
  per-message offsets directly from the bridge envelope, without PCT parsing MSH
  offsets or JetStream internals.

### Knife 2 — Recording source ledger before durable merge can lose parts

The memory runtime marks a source offset accepted before merging/output in local
state. A crash between ledger write and frame-state write would cause replay to
skip the source part and lose frame completeness.

Disarm:

- Production processing must wrap these operations in one Timescale/Postgres
  transaction:
  1. insert source fact, if enabled;
  2. insert source-offset ledger row with unique key;
  3. merge/upsert frame state;
  4. decide complete/timeout materialization;
  5. upsert materialized frame row;
  6. insert output-outbox row for optional frame stream.

The source-offset ledger is only authoritative when committed with state changes.

### Knife 3 — Dual output cannot be exactly-once without an outbox

Timescale frame rows and LNK frame-stream append are two durable systems. The
memory runtime writes both inline. A crash after one write and before the other
creates divergence.

Disarm:

- Treat Timescale frame rows + output outbox as the transaction boundary.
- Flush LNK frame-stream appends from an outbox worker after commit.
- Use LNK producer idempotency for frame-stream appends:
  - `producerId = projection-worker:<projectionId>`;
  - `epoch` assigned per worker lease/fence generation;
  - `seq` derived from outbox monotonic sequence or frame revision ledger.
- Mark outbox rows published only after LNK append succeeds or reports duplicate.

### Knife 4 — Local scheduler admission is not durable authority

`ProjectionScheduling` is local pressure control. It can coalesce, park, and
shape work, but it cannot prove exclusive production ownership after process
crash or network partition.

Disarm:

- Add a durable lease store backed by Timescale/Postgres.
- A worker must acquire a lease before processing a projection/lane/target.
- Lease rows carry:
  - `projection_id`;
  - `worker_id`;
  - `lane`;
  - `target_key`;
  - `fence_token`;
  - `leased_at`;
  - `expires_at`;
  - heartbeat/renewal metadata.
- Every durable write includes the active fence token where appropriate.
- Expired leases are reclaimable; stale workers cannot commit under an old fence.

Local admission still matters. It reduces pressure. It does not confer authority.

### Knife 5 — Cursor advancement must trail durable commit

A source reader that advances its cursor before the source ledger/frame-state
transaction commits can drop data on crash.

Disarm:

- Store source checkpoints per projection/source binding only after successful
  durable transaction.
- Treat cursor as a replay optimization, not idempotency authority.
- On restart, read from the last committed checkpoint and rely on the
  source-offset ledger to skip duplicates.

### Knife 6 — Timeout emission needs its own lane

The memory runtime checks timeouts only after reading source messages in a tick.
A quiet source stream could leave expired partial frames unprocessed forever.

Disarm:

- Add an explicit `timeout`/`sweep` lane, or reuse `replay` with a typed work
  kind, to scan `stateTable` by `deadline_at` where `complete = false`.
- Timeout work uses the same materialization/outbox transaction as source-part
  work.

### Knife 7 — Schema decoding belongs at the source adapter boundary

The memory proof accepts `payload: unknown`. Production must decode source
messages against `FrameSourceBinding.schemaId` and preserve decode failures.

Disarm:

- Source reader resolves each binding schema through PCT's SchemaResolver layer.
- Decode failures become structured dead letters with source provenance.
- Source facts may store raw payload + decode error metadata if configured.

### Knife 8 — Frame revision and output idempotency are underspecified

Memory materialization uses `frameRevision: 1`. Production needs deterministic
revision rules for late parts, partial-to-complete upgrades, and replays.

Disarm:

- Define revision policy:
  - first complete frame: revision 1;
  - partial timeout frame: revision 1 with `complete = false`;
  - late completion after partial: revision 2, complete=true, provenance includes
    late part;
  - replay duplicate: same revision, no new output.
- Use unique keys:
  - frame table: `(projection_id, frame_id, frame_revision)` or current-row plus
    revision history table;
  - outbox: `(projection_id, frame_id, frame_revision, output_kind)`.

## Target production ports

### `ProjectionDurableStateStore`

Owns transactional source-part ingestion and frame-state updates.

Suggested operations:

```ts
interface ProjectionDurableStateStore {
  ingestPart(input: {
    config: ProjectionWorkerConfig
    message: ProjectionSourceMessage
    part: FramePart
    fenceToken: string
  }): Effect<ProjectionIngestPartResult, ProjectionDurableStateError>

  sweepExpired(input: {
    projectionId: string
    now: number
    limit: number
    fenceToken: string
  }): Effect<ReadonlyArray<ProjectionTimeoutMaterialization>, ProjectionDurableStateError>
}
```

Responsibilities:

- source fact insert;
- source-offset ledger unique insert;
- frame state upsert/merge;
- completeness/timeout decision application;
- frame row upsert/insert;
- outbox row creation.

### `ProjectionLeaseStore`

Owns durable lease acquisition, renewal, and release.

```ts
interface ProjectionLeaseStore {
  acquire(input: ProjectionLeaseAcquire): Effect<ProjectionLease, ProjectionLeaseDenied>
  renew(input: ProjectionLeaseRenew): Effect<ProjectionLease, ProjectionLeaseLost>
  release(input: ProjectionLeaseRelease): Effect<void>
}
```

### `ProjectionCheckpointStore`

Owns source read checkpoint updates after commit.

```ts
interface ProjectionCheckpointStore {
  get(bindingKey: ProjectionSourceBindingKey): Effect<Offset | "-1">
  commit(input: { bindingKey: ProjectionSourceBindingKey; offset: Offset; fenceToken: string }): Effect<void>
}
```

### `ProjectionOutputOutbox`

Owns frame-stream publication backlog.

```ts
interface ProjectionOutputOutbox {
  pending(input: { projectionId?: string; limit: number }): Effect<ReadonlyArray<ProjectionOutboxRecord>>
  markPublished(input: { outboxId: string; receipt: ProjectionOutputReceipt }): Effect<void>
  markFailed(input: { outboxId: string; error: string; retryAt: number }): Effect<void>
}
```

### `LnkProjectionSourceReader`

LNK-owned adapter that yields source messages with guaranteed durable offsets.

Rules:

- no PCT parsing of MSH offsets;
- no PCT direct JetStream consumer logic;
- schema id preserved from stream metadata/binding;
- limit-1 fallback is allowed but marked as a throughput compromise.

### `LnkFrameStreamPublisher`

LNK-owned adapter for frame-stream output.

Rules:

- uses `streamId` from `FrameOutputSpec`;
- creates stream with `schemaId = output.schemaId` if absent;
- appends JSON materialized frame payload;
- uses producer fencing/idempotency from durable lease/outbox sequence.

## Runtime execution model

### Source-part lane

1. Scheduler requests work for projection/source binding.
2. Worker acquires durable lease/fence.
3. Reader gets messages from committed checkpoint.
4. For each message:
   - require real source offset;
   - decode schema;
   - derive `FramePart` via `ProjectionAssembly`;
   - call `ProjectionDurableStateStore.ingestPart` transaction;
   - commit checkpoint after transaction.
5. Outbox publisher runs independently.

### Timeout lane

1. Scheduler enqueues timeout sweep work.
2. Worker acquires durable lease/fence for projection timeout target.
3. Store scans expired incomplete frame states.
4. Store materializes partial/drop/dead-letter outcomes transactionally.
5. Outbox publisher handles optional frame stream events.

### Outbox lane

1. Scheduler or a dedicated publisher drains pending outbox records.
2. Publisher appends to LNK frame stream using producer idempotency.
3. Publisher marks published or failed with retry metadata.

## Suggested implementation slices

### Slice A — Production contracts only

Files:

- `packages/pct/src/frames/ProjectionDurableRuntime.ts`
- `packages/pct/test/projection-durable-runtime-contracts.test.ts`

Deliverables:

- schemas/errors/ports for durable state, lease, checkpoint, outbox;
- no real DB client yet;
- memory implementations with failure injection.

### Slice B — Transactional Timescale memory/conformance proof

Files:

- `packages/pct/test/projection-durable-runtime-memory.test.ts`

Deliverables:

- prove ledger+state atomicity;
- duplicate replay does not lose parts;
- partial-to-complete revision policy;
- timeout sweep with quiet streams.

### Slice B — Transactional Timescale memory/conformance proof

Implemented in memory as a conformance harness, not as a database client:

- `projectionDurableRuntimeMemoryLayerWithFaults(...)` injects pre-commit
  failures for ingest and sweep operations.
- Ingest failures before durable commit roll back ledger/state/output changes;
  replay of the same source offset is accepted, not misclassified as duplicate.
- Duplicate source-offset replay after completion creates no new output.
- Timeout sweeps handle quiet incomplete frames for emit/drop/dead-letter policy.
- Partial timeout materialization emits revision 1; late completion emits revision 2
  and creates a distinct outbox record.

Validation:

```bash
cd packages/pct
bunx vitest run test/projection-durable-runtime-memory.test.ts test/projection-durable-runtime-contracts.test.ts --reporter verbose
bunx tsc --noEmit --pretty false
```

### Slice C — LNK source reader and frame publisher adapters

Implemented as `ProjectionLnkAdapters` over LNK's public `Wire` service:

- `projectionSourceReaderLayerLnkWire(...)` reads each source binding with
  `limit: 1`, requiring LNK to return a durable `nextOffset` for the single
  message. This is the conservative path until LNK grows a richer per-message
  offset reader.
- The source reader derives `ProjectionSourceMessage` values from decoded JSON
  payloads using `FrameSourceBinding.timeField` and `keyFields`.
- `ProjectionFrameStreamPublisherService` publishes outbox records to the LNK
  frame stream, ensuring the stream with `outputSchemaId` and appending with the
  durable outbox producer tuple (`producerId`, `producerEpoch`, `producerSeq`).
- PCT does not parse MSH/JetStream offsets. It treats the LNK offset as opaque.

Validation:

```bash
cd packages/pct
bunx vitest run test/projection-lnk-adapters.test.ts --reporter verbose
bunx tsc --noEmit --pretty false
```

### Slice D — Scheduler lease integration

Implemented first integration seam:

- `projectionWorkerSchedulerLayerWithDurableLeases` composes the existing
  scheduler/control plane with `ProjectionLeaseStore`.
- Admitted work acquires a durable lease before invoking `ProjectionWorkerRunner`
  and releases it in an `ensuring` finalizer.
- Existing `projectionWorkerSchedulerLayerWithPorts` remains available for local
  tests and non-durable runners.
- Local SEDA admission still controls pressure; the durable lease/fence is the
  authority boundary for production work.

Deferred to the lease hardening follow-up:

- heartbeat/renewal during long tail runs;
- stale lease recovery and lease-lost failure snapshots;
- fence-token propagation into durable state commits.

Validation:

```bash
cd packages/pct
bunx vitest run test/projection-scheduler.test.ts --reporter verbose
bunx tsc --noEmit --pretty false
```

### Slice E — Outbox publisher lane

Implemented as `ProjectionOutboxPublisher`:

- `ProjectionOutboxPublisher.drain(...)` queries pending durable outbox records
  through `ProjectionOutputOutbox.pending`.
- Each pending record is handed to injected `ProjectionFrameStreamPublisherService`,
  keeping LNK publish mechanics behind a port.
- Success calls `markPublished`; failure calls `markFailed` with retry delay and
  poison-after-attempt policy.
- Tests cover successful mark-published and retry visibility after failed publish.

Crash note:

- The lane is now idempotent at the outbox/publisher boundary because every
  record carries `idempotencyKey`, `producerId`, `producerEpoch`, and
  `producerSeq`. A crash after publish but before `markPublished` replays the
  same producer tuple; LNK owns duplicate suppression.

Validation:

```bash
cd packages/pct
bunx vitest run test/projection-outbox-publisher.test.ts --reporter verbose
bunx tsc --noEmit --pretty false
```

### Slice F — Production DDL evolution

Implemented in `TimescaleProjectionCompiler` and `FrameProjectionSpec`:

- `FrameTimescaleSpec` can now override `leaseTable`, `checkpointTable`,
  `outboxTable`, and `emissionTable`.
- `ProjectionPlan` records those runtime hardening table names explicitly.
- Support DDL now includes:
  - `projection_worker_leases` for lease/fence authority;
  - `projection_source_checkpoints` for source cursor commits;
  - `projection_output_outbox` for LNK frame stream publish replay;
  - `projection_frame_emissions` for frame revision/partial-complete policy.
- Migration preview/apply picks these statements up automatically because it
  already runs against `ProjectionPlan.statements`.
- CAGG tests remain unchanged semantically: CAGGs still filter `WHERE "complete" = TRUE`
  over materialized frame tables only.

Validation:

```bash
cd packages/pct
bunx vitest run test/frame-projections.test.ts --reporter verbose
bunx tsc --noEmit --pretty false
```

## Acceptance criteria for the next implementation epic

- Crash after ledger insert but before frame state cannot lose a part.
- Crash after Timescale frame write but before LNK frame publish cannot lose the
  frame-stream event; outbox replay publishes or observes duplicate.
- Duplicate source offset replay produces no new frame revision/output.
- Late completion after emitted partial frame follows explicit revision policy.
- Source cursor only advances after durable transaction commits.
- Timeout sweep emits/drops/dead-letters quiet incomplete frames.
- PCT never parses MSH/JetStream offsets.
- MSH contains no projection semantics.

## Immediate next working unit

Implement **Slice A — Production contracts only**. Keep it boring and sharp:
ports, schemas, typed errors, memory conformance tests. No Timescale client, no
LNK adapter, no scheduler rewrite until the contracts stop bleeding.
