# RFC: Flow C — Effect-smol `EventLogRemote` Replication for PCT

Status: Draft 0.1  
Scope: `@tmnl/pct` federation replication substrate  
Predecessors: Flow B manifest replay, Flow B+ PCT-native `RegistryDelta`

## 1. Intent

Flow C migrates PCT federation from application-level registry replay to Effect-smol's native event-log remote replication.

The goal is **not** to disguise Flow B+ deltas as remote entries. Flow B+ remains the PCT-native fallback and compatibility path. Flow C uses the actual Effect-smol APIs:

- `EventLogRemote.id`
- `EventLogRemote.changes({ identity, storeId, startSequence })`
- `EventLogRemote.write({ identity, storeId, entries })`
- `EventLogRemote.whenAuthenticated(effect)`
- `EventLog.registerRemote(remote)`
- `EventJournal.nextRemoteSequence(remote.id)`
- `EventJournal.writeFromRemote(...)`
- `EventLogServer.layerRpcHandlers(...)`

Primary source grounding:

- `submodules/effect-smol/packages/effect/src/unstable/eventlog/EventLogRemote.ts`
- `submodules/effect-smol/packages/effect/src/unstable/eventlog/EventLog.ts`
- `submodules/effect-smol/packages/effect/src/unstable/eventlog/EventJournal.ts`
- `submodules/effect-smol/packages/effect/src/unstable/eventlog/EventLogServer.ts`

## 2. Current State

PCT now has three sync layers available or planned:

| Flow | Transport | Envelope | Status | Purpose |
| --- | --- | --- | --- | --- |
| B | HTTP `GET /capabilities` | `Manifest` snapshot | implemented | lowest-common-denominator convergence |
| B+ | HTTP `GET /federation/delta/:revision` | PCT `RegistryDelta` | implemented | efficient application-level incremental sync |
| C | Effect RPC | `EventLogRemote` / `RemoteEntry` | planned | substrate-native replication with remote sequence tracking |

Flow B+ deliberately tracks **registry applied revisions**. Flow C tracks **remote substrate sequences**. These are different coordinate systems and must not be collapsed.

## 3. Effect-smol API Facts

### 3.1 Remote service

`EventLogRemote` is a Context service whose shape includes:

```ts
{
  id: RemoteId
  changes(options: {
    identity: EventLog.Identity.Service
    storeId: StoreId
    startSequence: number
  }): Effect<Queue.Dequeue<RemoteEntry, EventLogRemoteError>, never, Scope>
  write(options: {
    identity: EventLog.Identity.Service
    storeId: StoreId
    entries: ReadonlyArray<Entry>
  }): Effect<void, EventLogRemoteError>
  whenAuthenticated(effect): Effect<..., EventLogRemoteError, ... | Identity>
}
```

`EventLogRemote.makeWith(...)` registers the remote with Effect's event-log registry via `registry.registerRemote(remote)`.

### 3.2 Local event-log registry

`EventLog.Registry` has:

```ts
registerRemote(remote): Effect<void, never, Scope>
handleRemote(handler): Effect<void>
```

The registry starts a scoped remote fiber for each registered remote.

### 3.3 Journal remote substrate

`EventJournal` has remote-specific methods:

```ts
nextRemoteSequence(remoteId): Effect<number, EventJournalError>
writeFromRemote({ remoteId, entries, compact?, effect }): Effect<{ duplicateEntries }, EventJournalError>
withRemoteUncommited(remoteId, f): Effect<...>
```

This means Flow C should let the journal own duplicate detection, remote sequence tracking, compaction brackets, and conflict handling.

### 3.4 Server handlers

`EventLogServer.layerRpcHandlers({ remoteId, getOrCreateSessionAuthBinding, onWrite, changes })` exposes the RPC handler layer for:

- hello/authenticate
- write single/chunked
- changes stream

The PCT server layer must adapt this to the existing HTTP/RPC serving surface without introducing a bespoke raw transport.

## 4. Proposed PCT Architecture

### 4.1 New config switch

Extend federation config with:

```json
{
  "federation": {
    "transport": "delta",
    "eventLogRemote": {
      "enabled": false
    }
  }
}
```

Allowed values:

- `manifest` — force Flow B snapshot replay
- `delta` — prefer Flow B+ delta, fallback to manifest
- `eventlog-remote` — use Flow C remote replication, fallback based on explicit policy

Initial implementation may keep this internal until route/server layer support is proven.

### 4.2 New module layout

```txt
src/federation/eventlog-remote/
├── Protocol.ts        # store IDs, remote IDs, stable constants
├── Server.ts          # EventLogServer.layerRpcHandlers adapter
├── Client.ts          # EventLogRemote client construction
├── Layer.ts           # compose client/server layers into PCT runtime
└── README.md          # operational notes after spike lands
```

Prime, we are not pouring this into `Default.ts` like architectural soup. Keep Flow B/B+ and Flow C seams visible.

### 4.3 Store identity

PCT registry events are already grouped by `RegistryGroup`. Flow C needs a stable store id for the registry journal.

Proposal:

```ts
const PctRegistryStoreId = "pct:registry"
```

If Effect-smol requires branded `StoreId`, construct through the official schema/constructor in `EventLogMessage.ts` rather than string-casting in userland.

### 4.4 Server side

A PCT EventLogRemote server layer must:

1. Provide a stable `remoteId`.
2. Persist session-auth bindings.
3. Implement `onWrite(data)` by decoding remote `Entry` batches and writing via `EventJournal.writeFromRemote` or the lower-level server helper expected by `EventLogServer`.
4. Implement `changes({ publicKey, storeId, startSequence })` by streaming encoded local changes starting at `startSequence`.
5. Reuse the same `EventJournal` instance as PCT registry state.

### 4.5 Client side

A Flow C peer registration must:

1. Build an Effect RPC client for the peer.
2. Construct `EventLogRemote` via `makeWith` / encrypted constructor.
3. Register the remote with local `EventLog.Registry`.
4. Let Effect's remote runner pull `changes(...)` from `EventJournal.nextRemoteSequence(remote.id)`.

Do not manually map `RegistryDelta.revision` to `RemoteEntry.remoteSequence`. The journal must determine remote sequence progress.

## 5. Migration Plan

### Step 1 — Loopback spike

Create an isolated test that runs two EventLog runtimes in-process and proves one registry event written on A appears on B through `EventLogRemote` mechanics.

Acceptance:

- Uses Effect-smol `EventLogRemote` constructors.
- Uses `EventJournal.writeFromRemote` indirectly or directly through canonical remote runner.
- Does not call PCT `applyManifest` or `applyDelta`.

### Step 2 — Server adapter

Add PCT server layer for Effect RPC handlers.

Acceptance:

- Uses `EventLogServer.layerRpcHandlers`.
- Shares the same `EventJournal` as Registry/Notary/PCT routes.
- Keeps auth binding persistence explicit, even if memory-backed initially.

### Step 3 — Peer transport mode

Add `federation.transport = "manifest" | "delta" | "eventlog-remote"`.

Acceptance:

- Existing Flow B and B+ tests still pass.
- `eventlog-remote` can be opt-in without destabilizing `pact serve` defaults.

### Step 4 — E2E Flow C

Add a two-server test equivalent to `serve-federation.test.ts`, but using EventLogRemote mode.

Acceptance:

- Publish to A.
- B converges without hitting `/capabilities` or `/federation/delta` in the sync path.
- Remote sequence dedupe prevents duplicate application on reconnect.

## 6. Non-goals

- No bespoke raw NATS/JetStream inside PCT or Lnk.
- No mapping PCT `RegistryDelta` into fake `RemoteEntry` objects.
- No replacing Flow B+; it remains useful for HTTP-only peers and debugging.
- No production identity persistence in the first spike unless required by Effect auth semantics.

## 7. Risks

1. **RPC transport mismatch** — PCT currently serves plain HTTP routes via `HttpRouter`; EventLogRemote uses Effect RPC groups. We must identify the correct Effect-smol RPC HTTP adapter before coding server exposure.
2. **StoreId branding** — avoid string casts; ground against `EventLogMessage.ts` before implementation.
3. **Auth binding persistence** — `EventLogServer.layerRpcHandlers` asks for `getOrCreateSessionAuthBinding`; memory-backed is acceptable for spike, persistent needed later.
4. **Shared runtime identity** — server handlers must share PCT's `EventLog.Identity`, `EventJournal`, and registry handler layer. A duplicate runtime would create a beautiful little lie.

## 8. Success Criteria

Flow C is complete when:

- PCT can register an EventLogRemote peer.
- Registry events replicate via Effect-smol remote machinery.
- Reconnect/dedup behavior is owned by `EventJournal.nextRemoteSequence` / `writeFromRemote`.
- Flow B+ remains available as fallback.
- Tests show EventLogRemote convergence and no regression in manifest/delta federation.
