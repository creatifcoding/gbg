# RFC: PCT NATS Control Plane

Status: draft / proof-backed
Related seams:

- `@tmnl/msh` generic micro endpoint host: `MshMicroEndpointHost`
- `@tmnl/pct` NATS schema resolver provider: `NatsSchemaResolverLayer`
- `@tmnl/lnk` typed consumer contract: `SchemaResolver.fetchSchema`
- `@tmnl/lnk` NATS data plane: `MshBridgeWire`

## Summary

PCT can run as either an HTTP registry service or as a NATS-native control plane.
The key architectural rule is that the transport changes, not the consumer
contract:

```text
TypedLnk / Lnks.connectTypedById
        │
        ▼
LNK SchemaResolver.fetchSchema(schemaId)
        │
        ├─ HTTP provider: PactClient.fetchSchema(/schemas/:id)
        └─ NATS provider: request ${subjectRoot}.schema.get
```

LNK stays ignorant of PCT transport. MSH stays ignorant of PCT semantics.
PCT owns registry semantics and adapts them to the chosen control-plane binding.

## Layer boundaries

### MSH: substrate only

MSH owns generic NATS infrastructure:

- connection lifecycle;
- core request/reply;
- microservice endpoint hosting and discovery;
- JetStream/KV/Object Store primitives;
- schema-backed payload codec helpers;
- tracing spans for substrate operations.

MSH MUST NOT know PCT concepts such as schema ids, manifests, procedures, or
registry semantics.

The generic host seam is:

```ts
MshMicroEndpointHost.host(serviceConfig, endpointSpecs)
```

Each endpoint spec provides:

- endpoint name and subject;
- request schema;
- response schema;
- Effect handler;
- optional domain error mapper.

### PCT: registry semantics

PCT owns:

- schema publication;
- schema reconstruction from `SchemaRepresentation.Document`;
- capabilities manifests;
- procedure metadata;
- federation policy;
- mapping PCT registry failures into transport-level service errors.

PCT MAY expose these semantics through HTTP, NATS micro endpoints, or future
transport providers. The schema document and semantic error contract should stay
consistent across providers.

### LNK: durable stream and typed binding semantics

LNK owns:

- `SchemaResolver.fetchSchema(schemaId)` as the typed binding seam;
- typed decode/encode through Effect Schema;
- durable stream behavior;
- stream offsets, framing, close semantics, retention, and producer fencing;
- data-plane `MshBridgeWire` over MSH primitives.

LNK MUST NOT know whether a schema came from HTTP, NATS, cache, or a local test
fixture. That is the point of `SchemaResolver`.

## Current proofed endpoints

The production host is `PctNatsControlPlane` / `natsControlPlaneLayer` from
`@tmnl/pct/server`. It starts schema-backed NATS micro endpoints over MSH's
generic `MshMicroEndpointHost`.

```ts
natsControlPlaneLayer({
  subjectRoot: "pct.v1",
  serviceName: "pct-control-plane",
  serviceVersion: "0.1.0",
})
```

`pact serve` is NATS-first when configured through `PactConfig`: the
`natsControl.mode` field controls whether the runtime mounts this host.

```json
{
  "lnk": {
    "backend": "msh-bridge",
    "msh": { "servers": "ws://localhost:9222" }
  },
  "natsControl": {
    "mode": "auto",
    "subjectRoot": "pct.v1",
    "serviceName": "pct-control-plane",
    "serviceVersion": "0.1.0"
  }
}
```

Modes:

- `auto` — host when the configured LNK backend uses MSH/NATS, or when
  `natsControl.servers` is explicitly supplied.
- `enabled` — always host and fail fast if NATS is unavailable.
- `disabled` — do not host from `pact serve`; programmatic layer composition
  remains available.

Environment variables follow the `Config` module's `PCT_*` mapping, e.g.:

```bash
PCT_NATS_CONTROL_MODE=enabled
PCT_NATS_CONTROL_SUBJECT_ROOT=pct.v1
PCT_NATS_CONTROL_SERVERS=ws://localhost:9222
```

### `schema.get`

Default subject:

```text
pct.v1.schema.get
```

Configurable as:

```ts
natsSchemaResolverLayer({
  subjectRoot: "pct.v1",
  endpoint: "schema.get",
  timeoutMs: 5_000,
})
```

Request:

```ts
Schema.Struct({
  schemaId: Schema.String,
})
```

Response mirrors HTTP `GetSchemaResponse`:

```ts
{
  schemaId: string
  version: string
  schemaDocument: SchemaRepresentation.DocumentJson
  description: string | null
  registeredAt: number
  originNodeId: string
  deprecated: Deprecation | null
}
```

Client reconstruction:

```text
NATS response bytes
  → GetSchemaResponse
  → SchemaRepresentation.DocumentFromJson
  → SchemaRepresentation.toSchema(document)
  → Schema.Top
```

## Error mapping

The client provider reads service errors in this order:

1. `ServiceError.toServiceError(msg)`
2. manual fallback headers:
   - `Nats-Service-Error`
   - `Nats-Service-Error-Code`

Mapping:

| Source failure | LNK-facing error |
| --- | --- |
| service error `404` | `SchemaResolverNotFound` |
| service error non-404 | `FetchError` |
| request timeout / no responders / connection failure | `FetchError` |
| request encoding failure | `FetchError` |
| response codec/schema failure | `FetchError` |
| schema document reconstruction failure | `FetchError` |

This keeps LNK's resolver algebra unchanged while preserving not-found as a
first-class typed condition.

## Subject strategy

Current proof default is readable:

```text
pct.v1.schema.get
```

Production deployments MAY choose a more internal root, for example:

```text
_tmnl.pct.v1.schema.get
```

The provider treats `subjectRoot` as configuration. No subject is hard-coded in
LNK.

### `capabilities.get`

Default subject:

```text
pct.v1.capabilities.get
```

Request:

```ts
Schema.Struct({})
```

Response is the PCT `Manifest` wire form. It is built from one atomic registry
snapshot and the current `Identity`, matching the HTTP `/capabilities` semantic
surface without involving HTTP.

## Candidate future endpoints

| Endpoint | Purpose | Consumer |
| --- | --- | --- |
| `schema.list` | Discover known schemas | PCT admin / tooling |
| `schema.publish` | Register/update schema documents | PCT federation/admin |
| `procedure.get` | Fetch procedure metadata/contract | future execution control plane |

Prime directive: add endpoints only when a caller exists. No decorative control
surfaces, darling.

## Validation evidence

Readable demo:

```bash
cd packages/pct
bun run demo:nats-control-plane
```

Proof tests:

```bash
cd packages/pct

LNK_LIVE_NATS=1 bunx vitest run \
  test/pct-nats-schema-resolver.test.ts \
  test/pct-lnk-msh-typed-proof.test.ts \
  --reporter verbose
```

Additional type validation:

```bash
cd packages/pct && bunx tsc --noEmit --pretty false
cd packages/lnk && bunx tsc --noEmit --pretty false
```

The shared live NATS harness discovers `nats-server` via:

1. `NATS_SERVER_BIN`
2. PATH scan for `nats-server` without shelling out
3. Nix store fallback: `/nix/store/*-nats-server-*/bin/nats-server`

This is validation infrastructure only; it does not change product semantics.

## Commit boundaries

Recommended split:

1. `test(lnk): make live NATS harness discover nats-server outside devshell`
2. `feat(pct): add NATS schema resolver provider and control-plane host`
3. `docs(pct): document NATS control-plane boundaries`
4. Existing PCT backend alias / LNK MSH bridge proof work should remain its own
   logical change if not already committed.

## Resolved hosting decision

PCT production is NATS-first. `pact serve` SHOULD auto-host the NATS control
plane from the `Config` module when `natsControl.mode` resolves to enabled.
The programmatic `natsControlPlaneLayer` remains the lower-level composition
seam for custom runtimes.

`pact serve` does not start a NATS daemon. It connects to configured NATS
infrastructure and fails fast when hosting is enabled but the connection cannot
be established.

## Open questions

- Should production subject roots default to `pct.v1` or `_tmnl.pct.v1`?
- Should schema resolution support an optional local cache in PCT provider, or
  should caching live in LNK's resolver composition?
- Which endpoint, if any, must become stable after `schema.get`?

## Non-goals

- MSH does not gain PCT semantics.
- LNK does not gain PCT transport awareness.
- NATS micro discovery is not a schema registry.
- The current provider does not replace HTTP; it gives PCT a second transport
  binding behind the same LNK contract.
