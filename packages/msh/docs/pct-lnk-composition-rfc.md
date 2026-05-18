# RFC: `@tmnl/pct` × `@tmnl/lnk` over `@tmnl/msh`

> Status: Draft accepted for Phase 3 planning  
> Owner: `@tmnl/msh` extraction workstream  
> Updated: 2026-05-17

## 1. Purpose

`@tmnl/msh` is the infrastructure substrate extracted from legacy Holonet. It owns NATS connectivity, auth, subject hygiene, JetStream/KV primitives, and tracing. It must **not** grow domain protocol policy.

This RFC defines how `@tmnl/pct` and `@tmnl/lnk` compose over `@tmnl/msh` without collapsing the layers into one adorable little monster, Prime.

## 2. Layer contract

```text
┌──────────────────────────────────────────────────────────────┐
│ Apps / domain packages (`@tmnl/dmn`, TMNL features)          │
│ - choose procedures, streams, tenants, ACL semantics         │
├──────────────────────────────────────────────────────────────┤
│ `@tmnl/pct` — schema/procedure protocol                      │
│ - Effect Schema documents, registry, procedure IDs           │
│ - request/response/event envelope schemas                    │
│ - semantic versioning and schema compatibility               │
├──────────────────────────────────────────────────────────────┤
│ `@tmnl/lnk` — durable stream handle protocol                 │
│ - stream offsets, producer fencing, live/catch-up semantics  │
│ - typed `Lnk<A>` handles and stx materializers               │
├──────────────────────────────────────────────────────────────┤
│ `@tmnl/msh` — mesh substrate                                 │
│ - NATS connection/auth, JetStream/KV, subjects, tracing      │
│ - no procedure semantics, no durable-stream wire policy      │
└──────────────────────────────────────────────────────────────┘
```

## 3. Boundary rules

### `@tmnl/msh` MUST own

- NATS connection lifecycle (`NatsConnectionService`, `NatsInnerService`).
- Native auth material construction (`MshAuthService`, `MshJwtService`).
- JetStream and KV wrappers (`NatsStreamService`, `NatsKVService`).
- Subject validation/composition utilities.
- Infrastructure spans (`MshSpan`).
- Mock/live transport seams for tests.

### `@tmnl/msh` MUST NOT own

- PCT procedure names, versions, or registry policy.
- LNK durable-stream offset math or producer fencing semantics.
- Domain authorization policy beyond native NATS permissions.
- Schema compatibility decisions.
- App tenant routing beyond generic subject composition.

### `@tmnl/pct` SHOULD own

- Schema documents and schema IDs.
- Procedure and registry event schemas.
- Request/response/error envelopes.
- Procedure publication and registry federation.
- Optional NATS binding that maps registry events/procedure invocations to MSH subjects.

### `@tmnl/lnk` SHOULD own

- Durable-stream handle semantics.
- Offset translation and resume behavior.
- Producer id/epoch/seq fencing.
- `stx` materialization of stream values.
- Optional NATS bridge that maps `Wire` operations to MSH JetStream/KV.

## 4. Proposed package integration points

### 4.1 `@tmnl/lnk` NATS bridge adapter

Add a new adapter in `@tmnl/lnk`, not `@tmnl/msh`:

```text
packages/lnk/src/services/wire/NatsMshWire.ts
```

Shape:

```ts
export interface NatsMshWireOptions {
  readonly streamPrefix?: string
  readonly kvBucket?: string
  readonly subjectRoot?: string
}

export const NatsMshWire = {
  layer: (options?: NatsMshWireOptions) => Layer.Layer<Wire, never, NatsStreamService | NatsKVService | SubjectRegistry>
}
```

Responsibilities:

- Implement `@tmnl/lnk`'s existing `Wire` contract using `NatsStreamService` and `NatsKVService`.
- Store stream metadata in KV when required by the Durable Streams protocol.
- Publish stream messages through JetStream.
- Translate JetStream sequence values to/from LNK opaque offsets **inside `@tmnl/lnk`**.
- Use MSH subject utilities only for validation/composition.

Non-responsibilities:

- MSH does not learn what `Stream-Next-Offset` means.
- MSH does not learn producer fencing.

### 4.2 `@tmnl/pct` NATS registry/invocation binding

Add a PCT-side binding:

```text
packages/pct/src/bindings/msh/index.ts
```

Shape:

```ts
export interface PctMshBindingOptions {
  readonly subjectRoot?: string
  readonly registryStream?: string
  readonly invocationStream?: string
}

export const PctMshBinding = {
  registryLayer: (options?: PctMshBindingOptions) => Layer.Layer<Registry, never, NatsStreamService | NatsKVService>,
  invocationLayer: (options?: PctMshBindingOptions) => Layer.Layer<PactTransport, never, NatsInnerService | NatsStreamService>
}
```

Responsibilities:

- Persist registry events over JetStream or KV.
- Optionally expose procedure invocation over NATS request/reply or JetStream-backed command/event streams.
- Encode all payloads with PCT schemas before they touch MSH.
- Decode all received payloads with PCT schemas after they leave MSH.

Non-responsibilities:

- MSH does not validate PCT procedure payloads.
- MSH does not select schema versions.

## 5. Subject namespace proposal

MSH should provide only the mechanical builders and validators. PCT/LNK choose their semantic namespaces.

Recommended defaults:

```text
_tmnl.msh.health.<node>
_tmnl.msh.auth.<event>

_tmnl.pct.registry.<node>.<event>
_tmnl.pct.invoke.<procedure-id>.<correlation-id>
_tmnl.pct.reply.<correlation-id>

_tmnl.lnk.stream.<stream-id>
_tmnl.lnk.meta.<stream-id>
_tmnl.lnk.control.<stream-id>.<command>
```

Rules:

- App/domain subjects SHOULD live outside `_tmnl.*` unless intentionally internal.
- Reply inboxes remain NATS-native (`_INBOX.>`) and are permissioned at the auth layer.
- PCT/LNK adapters MUST expose subject-root options for tests and multi-tenant deployments.

## 6. Auth and permissions model

`@tmnl/msh` supplies JWT/NKey/creds construction. Higher layers request subject grants.

Recommended permission envelopes:

### PCT registry node

```ts
{
  pub: { allow: ["_tmnl.pct.registry.>", "_tmnl.pct.reply.>", "$JS.API.>"] },
  sub: { allow: ["_tmnl.pct.registry.>", "_tmnl.pct.invoke.>", "_INBOX.>"] }
}
```

### LNK stream node

```ts
{
  pub: { allow: ["_tmnl.lnk.stream.>", "_tmnl.lnk.control.>", "$JS.API.>"] },
  sub: { allow: ["_tmnl.lnk.stream.>", "_tmnl.lnk.control.>", "_INBOX.>"] }
}
```

Observed live-test invariant: any service that eagerly creates a JetStream manager needs `$JS.API.>` publish and `_INBOX.>` subscribe permission.

## 7. Error mapping

- MSH errors stay infrastructure-shaped: connection, codec, auth, stream, KV, subject errors.
- PCT wraps MSH infrastructure errors at transport boundaries into PCT transport errors.
- LNK wraps MSH infrastructure errors at wire boundaries into LNK wire/fetch/retention errors.
- Do not leak NATS implementation details above adapter boundaries except as `cause`/diagnostic metadata.

## 8. Tracing

Span prefix ownership:

```text
msh.*  — substrate operations
pct.*  — schema/procedure/registry operations
lnk.*  — durable-stream handle/wire operations
```

Adapters SHOULD nest spans:

```text
lnk.wire.get
  msh.stream.fetch
    msh.inner.consumer.fetch
```

```text
pct.registry.publish
  msh.stream.publish
```

## 9. Test strategy

### `@tmnl/msh`

- Mock tests: deterministic wrappers and lifecycle behavior.
- Live tests: auth, JetStream, KV, server acceptance.

### `@tmnl/lnk` adapter

- Contract tests against existing `Wire` conformance suite using `NatsMshWire`.
- Live NATS smoke for offset/catch-up/live behavior.
- No PCT dependency required.

### `@tmnl/pct` binding

- Registry replay tests over mocked MSH stream/KV.
- Live NATS registry publish/fetch tests.
- Invocation binding tests with typed request/response/error envelopes.

## 10. Migration path

1. Finish `@tmnl/msh` package extraction and live auth/JetStream tests.
2. Add `@tmnl/lnk` dependency on `@tmnl/msh` only in the NATS bridge adapter entrypoint.
3. Port legacy Holonet durable-streams behavior into `NatsMshWire`, correcting it to LNK's spec-faithful wire model.
4. Add `@tmnl/pct` dependency on `@tmnl/msh` only in a binding subpath such as `@tmnl/pct/bindings/msh`.
5. Move TMNL consumers from `tmnl/src/lib/holonet/*` to package imports in this order:
   - direct substrate consumers → `@tmnl/msh`
   - durable-stream consumers → `@tmnl/lnk` + `NatsMshWire`
   - schema/procedure consumers → `@tmnl/pct`
6. Delete remaining legacy Holonet only after no imports remain.

## 11. Open questions

- Should PCT invocation over NATS be request/reply-first or JetStream-command-first?
  - Recommendation: request/reply for queries/pure calls; JetStream command streams for mutations that need audit/replay.
- Should LNK metadata live in KV or compacted JetStream subjects?
  - Recommendation: KV first for operational simplicity; stream events remain in JetStream.
- Should adapter packages be exported by default?
  - Recommendation: no. Use explicit subpaths (`@tmnl/lnk/services/wire/nats-msh`, `@tmnl/pct/bindings/msh`) to prevent accidental infrastructure coupling.

## 12. Acceptance criteria

- MSH remains protocol-neutral infrastructure.
- LNK owns Durable Streams semantics even when backed by MSH.
- PCT owns schema/procedure semantics even when backed by MSH.
- All cross-package dependencies are optional subpath bindings, not core imports.
- Live NATS tests remain the authority for server behavior.
