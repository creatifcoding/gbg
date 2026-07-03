# PCT Federation Exploration Report

## Hypothesis
**PCT federation in `packages/pct` is currently implemented as periodic in-process/in-memory **state convergence via manifest pull + re-application, not full network protocol replication.**

## Method
- Read-only inspection of:
  - `packages/pct/src/federation/*.ts`
  - `packages/pct/src/registry/*.ts`
  - `packages/pct/src/manifest/*.ts`
  - `packages/pct/src/server/*.ts`
  - `packages/pct/src/client/*.ts`
  - `packages/pct/src/cli/*.ts`
  - tests under `packages/pct/test/*.ts`
- Confirmed target path note: `packages/pct/docs` does **not** exist in this package.

## Findings (evidence)

### 1) Federation is pull-based + manifest-replay, not event-stream transport
- `packages/pct/src/federation/Federation.ts:4-9` describes federation as **pull-based polling** using `GET /capabilities`, then replaying manifest entries into local event log.
- `packages/pct/src/federation/Default.ts:48-55` builds a daemon that polls peer set on interval; peers are local runtime members in a `Ref` map.
- `packages/pct/src/federation/Default.ts:72-74` stores peers in-memory (`ReadonlyMap` + `Ref.make`).
- `packages/pct/src/federation/Default.ts:85-105` and `:129-146` call `client.capabilities` then `applyManifest` and write to local `EventLog`.

### 2) No remote replication API/transport primitives yet
- `packages/pct/src/server/Routes.ts:9-15` comments list `/federation/*` as **deferred** and the layer only exposes three active endpoints (`/capabilities`, `/schemas/:schemaId`, `/publish`).
- `packages/pct/src/cli/serve.ts:165-190` startup path logs only `PCT /capabilities, /schemas/:id, /publish`.
- `packages/pct/src/cli/commands.ts` exposes only `registry status`, `publish`, and `serve`—no peer management/connect command.

### 3) Event/state convergence is intentional and deterministic via local precedence rules
- `packages/pct/src/registry/RegistryState.ts:18-33` documents conflict resolution: timestamp + nodeId total ordering; lower precedence arrivals skipped.
- `packages/pct/src/registry/RegistryState.ts:120-126` applies updates only when incoming precedence outranks existing event.
- `packages/pct/src/registry/RegistryState.ts:130-157` (`onSchemaRegistered`) explicitly skips out-of-order events.
- `packages/pct/src/federation/Sync.ts:14-17` and `:19-26` says in-memory state convergence works because of registry precedence; notes this is a simplified “rebuild events from manifest” approach.

### 4) Tests reflect a partial/phase implementation
- `packages/pct/test/federation.test.ts:2-7,10-16` documents “Phase 3.7” and in-test convergence checks via polling peers.
- Same test uses two **in-process** nodes and a custom `crossNodeFetch` HTTP bridge (`:101-120`), rather than true network-discovery transport.
- Test validates `syncOnAdd`/`peer`/`peers`/`unpeer` API only, not remote authentication, streaming deltas, or push updates (`:146-301`).

### 5) Missing docs path requested
- `packages/pct/docs` directory is missing (`missing` from shell check).

## Verdict
**Partially implemented** (not complete network federation).

Current implementation achieves deterministic state convergence across peers **only** by repeatedly pulling peers’ manifests and replaying as local events, with in-memory peer management and deferred features acknowledged in code.

## Output/Errors
- No production file edits performed.
- No runtime tests executed.
- One expected-check command confirmed missing docs path.

## Next required work
1. Implement actual federation surface endpoints (at least `/federation/*`) with peer auth and stateful peer metadata.
2. Replace/augment manifest-replay flow with event-level replication (or delta streaming) using revision-aware transport.
3. Add `/federation/since/:revision` or push/pull delta protocol; remove full-manifest rebuild as default path.
4. Add CLI/API for peer management and sync status.
5. Update `packages/pct/docs` (or equivalent) with concrete network-federation protocol docs and failure/reconciliation behavior.
