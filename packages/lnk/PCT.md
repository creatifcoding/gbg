# `pct` — Pact Protocol

**Status**: Draft 0.1 (working). Not published. Subject to change without notice.

**Codename**: `pct` — short for *pact*. Schemas are contracts; the registry is the shared pact-book.

---

## TL;DR

`pct` is a schema-first wire protocol for typed RPC over HTTP.

- **Schemas as wire artifacts.** A schema is data, not code. Schemas travel from registry to client via `SchemaRepresentation.Document` (Effect-rich, lossless for Effect-TS) or JSON Schema Draft 2020-12 (universal, lossy).
- **Registry as protocol-level concern.** `GET /schemas/{id}@{ver}` and `GET /capabilities` are part of the spec, not implementation choices. Backed by `EventLog` for audit + replay + sync.
- **Per-operation semver.** Multiple versions of an operation live simultaneously. Clients pin or negotiate (`Accept-Schema-Version: ^2.0.0`).
- **HTTP-RPC core, streams via SSE.** Optional WebSocket binding for duplex. No capability handles in v1 — typed RPC over stable IDs is enough.
- **Effect-TS native authoring; multi-language reach.** Author once with `Effect.Schema`. Other languages consume `SchemaRepresentation.Document` JSON or JSON Schema export.

---

## Goals

- **G1.** A schema-first wire that any HTTP client can target, no SDK required.
- **G2.** Schemas faithfully transmitted with their full runtime semantics (refinements, brands, transforms preserved on the receiving side).
- **G3.** Per-operation semver, allowing incremental migration without big-bang version cuts.
- **G4.** Audit-grade by default: every registry mutation is an event in an append-only log; deprecation is a flag, not a removal.
- **G5.** Multi-language reach. TypeScript via Effect.Schema is privileged; other languages can implement compliant servers/clients via JSON Schema interchange.
- **G6.** Stateful and stateless operations natively expressible.
- **G7.** Lnk-binding: when a client connects to a stream via Lnk, schemas for that stream's payloads come with the connection.

## Non-goals (for v1)

- **NG1.** Sub-millisecond latency RPC. (Use NATS, gRPC, or in-process channels.)
- **NG2.** GraphQL-style query languages. (Use GraphQL.)
- **NG3.** Capability handles / distributed object semantics. (Effect Cluster Entities can fill this in a v2 binding if needed.)
- **NG4.** High-throughput byte streams. (Streams are for events, not bulk data transfer.)
- **NG5.** Authentication / authorization at protocol level. (Orthogonal — handled by transport-layer mechanisms.)

---

## RFC keywords

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are used per [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## Vocabulary

| Term | Meaning |
|---|---|
| **Schema** | A typed contract for a value. In the Effect-TS reference, a `Schema.Schema<A>`. On the wire, a `SchemaRepresentation.Document`. |
| **Schema-Id** | A versioned identifier of the form `{namespace}/{name}@{semver}`. Example: `orders/Order@2.1.4`. |
| **Schema-Document** | The serialized JSON form of a Schema, produced by `SchemaRepresentation.fromAST` + `DocumentFromJson` codec. |
| **JSON Schema export** | The Draft 2020-12 representation of a Schema, produced by `SchemaRepresentation.toJsonSchemaDocument`. Lossy projection for non-Effect-TS clients. |
| **Operation** | A named, versioned procedure with input, output, and error schemas. |
| **Operation kind** | The execution model classification: `pure`, `query`, `mutation`, `stream`, `duplex`. |
| **Registry** | The authoritative system-of-record for schemas and operations. Backed by an EventLog. |
| **Capability catalog** | The result of `GET /capabilities` — a snapshot of all registered operations and their versions. |
| **Lnk** | (Existing in `@tmnl/lnk` Phase 2.) A typed handle to a stream. In Phase 3, also a schema-carrier. |
| **Compliant server** | A server that implements all `MUST` requirements at the conformance level it advertises. |

---

## Conformance levels

A `pct` implementation MAY claim conformance at one or more of the following levels:

- **L1 — Schema Codec.** Round-trips `SchemaRepresentation.Document` JSON faithfully and exposes deserialization.
- **L2 — Operation Semantics.** Implements at least `pure`, `query`, `mutation`, `stream` operation kinds. (`duplex` is L2-extended.)
- **L3 — Registry.** Exposes `/schemas` and `/capabilities` endpoints per §6.
- **L4 — HTTP Binding.** Accepts the canonical request shape (§5) and emits the canonical response shape.

A "compliant server" MUST implement L1+L2+L3+L4. L2's `duplex` operation kind is OPTIONAL for v1.

---

## Layered architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  L0  Authoring                                                       │
│      Effect.Schema (TypeScript) — privileged for the reference impl  │
│      Other languages: any tool producing SchemaRepresentation.       │
│      Document JSON or JSON Schema Draft 2020-12.                     │
├──────────────────────────────────────────────────────────────────────┤
│  L1  Schema codec (the wire IR for schemas)                          │
│      SchemaRepresentation.Document, encoded via DocumentFromJson.    │
│      Lossless for Effect-TS. Round-trip preserves brands,            │
│      refinements, transforms, literal unions, nested structs.        │
├──────────────────────────────────────────────────────────────────────┤
│  L2  Operation semantics                                             │
│      Operation kinds: pure / query / mutation / stream / duplex.     │
│      Each operation has typed input, output, error schemas.          │
│      Schema-Id format: {namespace}/{name}@{semver}.                  │
├──────────────────────────────────────────────────────────────────────┤
│  L3  Registry (event-sourced)                                        │
│      EventLog with EventGroup of registry events.                    │
│      Endpoints: /schemas, /capabilities.                             │
│      Audit trail = journal. Replay = re-fold the log.                │
│      Optional: EventLogRemote sync, EventLogEncryption signing.      │
├──────────────────────────────────────────────────────────────────────┤
│  L4  HTTP wire binding                                               │
│      POST /rpc/{namespace}/{name}@{version} for invocation.          │
│      GET /rpc/{namespace}/{name}@{version} for queries (cacheable).  │
│      GET ...?live=long-poll|sse for streams.                         │
│      Headers: Schema-Id, Accept-Schema-Version, Content-Schema-      │
│      Version. JSON body. Errors as tagged envelopes.                 │
├──────────────────────────────────────────────────────────────────────┤
│  L5  Optional bindings                                               │
│      WebSocket (duplex), CBOR (compact), in-process (test).          │
│      Each binding spec'd as a companion document.                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Schema format

### Authoring (informative)

Reference authoring is in TypeScript using `Effect.Schema`:

```ts
import { Schema } from "effect-v4"

const OrderId = Schema.String.check(
  Schema.isMinLength(4),
  Schema.isPattern(/^ord_[a-z0-9]+$/),
).pipe(Schema.brand("OrderId"))

const Order = Schema.Struct({
  id: OrderId,
  total: Schema.Number.check(Schema.isGreaterThan(0)),
  currency: Schema.Literals(["USD", "EUR", "GBP"]),
  customerEmail: Schema.String.check(Schema.isPattern(/@/)),
}).annotate({
  identifier: "Order",
  description: "A confirmed customer order.",
})
```

### Wire IR (normative)

A schema on the wire is a JSON document produced by:

```ts
import { Schema, SchemaRepresentation } from "effect-v4"

const document = SchemaRepresentation.fromAST(SomeSchema.ast)
const json = Schema.encodeUnknownSync(SchemaRepresentation.DocumentFromJson)(document)
// `json` is the wire artifact.
```

The receiving side reconstructs:

```ts
const document = Schema.decodeUnknownSync(SchemaRepresentation.DocumentFromJson)(json)
const Reconstructed = SchemaRepresentation.toSchema(document)
// `Reconstructed` validates and decodes equivalently to the original.
```

Servers MUST emit valid `SchemaRepresentation.Document` JSON when serving `application/vnd.pct.schema+json`.

### JSON Schema export (informative)

For non-Effect-TS clients, a server SHOULD also support `application/schema+json` (JSON Schema Draft 2020-12) on the same endpoint via content negotiation:

```http
GET /schemas/orders/Order@2.1.4
Accept: application/schema+json
```

This response is generated via `SchemaRepresentation.toJsonSchemaDocument(document)`. Receivers using non-Effect tooling consume the JSON Schema directly. Note that some Effect.Schema features (e.g. transforms, certain refinements) project lossily into JSON Schema and SHOULD NOT be relied on for round-trip fidelity.

---

## Operation kinds

| Kind | Idempotent | Cacheable | Wire | Description |
|---|---|---|---|---|
| `pure` | ✓ | ✓ | `GET` | Stateless, deterministic, no side effects. Cacheable per (Schema-Id, input). |
| `query` | ✓ | conditional | `GET` | Side-effect-free read of server state. Cacheable per `Stream-Cursor`. |
| `mutation` | ✗ | ✗ | `POST` | Stateful single-shot. Producer-Id headers MAY be supplied for idempotent retries. |
| `stream` | n/a | ✗ | `GET` + `Accept: text/event-stream` | Server→client unbounded sequence. Implemented via SSE. |
| `duplex` | n/a | ✗ | `WebSocket` (companion binding) | Bidirectional message exchange. Optional in v1. |

An operation declares its kind in the registry, and the server dispatches accordingly.

---

## Wire format (HTTP/JSON)

### Invoke an operation

```http
POST /rpc/orders/create
Schema-Id: orders/create@2.1.4
Content-Type: application/json
Accept-Schema-Version: ^2.0.0
Producer-Id: cashier-12             ← optional, for mutations
Producer-Epoch: 0                   ←
Producer-Seq: 4711                  ←

{ "customerId": "cus_xyz", "items": [...] }
```

```http
HTTP/1.1 200 OK
Content-Schema-Version: 2.1.4
Schema-Id: orders/create@2.1.4
Content-Type: application/json
Cache-Control: no-store

{ "_tag": "Order", "id": "ord_abc123", "total": 99.50, ... }
```

### Headers (canonical)

| Header | Direction | Required | Meaning |
|---|---|---|---|
| `Schema-Id` | request | yes | Operation identifier with version, e.g. `orders/create@2.1.4`. |
| `Accept-Schema-Version` | request | no | Semver range the client accepts, e.g. `^2.0.0`. Server picks compatible version. |
| `Content-Schema-Version` | response | yes | Version the server actually served. Client uses this to know what was returned. |
| `Schema-Id` | response | yes | Response Schema-Id. May differ from request if server up-versioned within the accepted range. |
| `Producer-Id` / `Producer-Epoch` / `Producer-Seq` | request (mutations only) | no | Idempotency triple. If supplied, server tracks dedup; retries return the original result. |
| `Content-Type` | both | yes | `application/json` for L4 default binding. |
| `Cache-Control` | response | yes | `no-store` for `mutation` and `stream`; `public, max-age=N` allowed for `pure` and `query` per server policy. |

### Status codes

| Status | Meaning |
|---|---|
| `200 OK` | Successful invocation. Body is the response. |
| `201 Created` | Mutation that created a new resource. Server SHOULD include a `Location` header. |
| `204 No Content` | Mutation succeeded; body intentionally empty (e.g. close-only operations). |
| `400 Bad Request` | Input failed schema validation OR malformed request envelope. Body is a typed-error envelope. |
| `404 Not Found` | Operation or schema-id not registered. |
| `409 Conflict` | Typed business error (e.g. dedup conflict, state precondition). Body is a typed-error envelope. |
| `410 Gone` | Operation hard-deprecated and removed. Body MAY include `Successor` header pointing to replacement. |
| `412 Precondition Failed` | `Accept-Schema-Version` cannot be satisfied. |
| `5xx` | Server-side error. Body MAY include a typed-error envelope; otherwise plain text. |

---

## Registry endpoints

### `GET /schemas`

Lists all registered schemas with their versions.

```http
GET /schemas
Accept: application/json
```

```json
{
  "schemas": [
    {
      "schemaId": "orders/Order",
      "versions": ["1.0.0", "2.0.0", "2.1.4"],
      "deprecated": ["1.0.0"]
    },
    { "schemaId": "orders/CreateOrderInput", "versions": ["2.1.4"], "deprecated": [] }
  ]
}
```

### `GET /schemas/{namespace}/{name}@{version}`

Fetches a specific schema document.

```http
GET /schemas/orders/Order@2.1.4
Accept: application/vnd.pct.schema+json
```

Response body is a `SchemaRepresentation.Document` JSON.

Alternative content negotiation:

```http
Accept: application/schema+json    → JSON Schema Draft 2020-12 export
```

### `GET /capabilities`

Returns the operation catalog — the live set of operations the server can handle, with their kinds, schema-ids, and version states.

```json
{
  "operations": [
    {
      "name": "orders/create",
      "kind": "mutation",
      "versions": [
        {
          "version": "1.0.0",
          "deprecated": "2025-03-01",
          "successor": "2.0.0",
          "inputSchemaId": "orders/CreateOrderInput@1.0.0",
          "outputSchemaId": "orders/Order@1.0.0",
          "errorSchemaIds": ["orders/InsufficientStock@1.0.0"]
        },
        {
          "version": "2.1.4",
          "inputSchemaId": "orders/CreateOrderInput@2.1.4",
          "outputSchemaId": "orders/Order@2.1.4",
          "errorSchemaIds": ["orders/InsufficientStock@1.0.0", "orders/InvalidCustomer@1.0.0"]
        }
      ]
    }
  ],
  "asOf": "2025-04-30T18:00:00Z",
  "registryRevision": 142
}
```

Clients use `/capabilities` to discover what to call. The `registryRevision` is monotonic; clients can poll for changes via conditional `If-Revision` header (informative, not normative).

### Optional: `GET /capabilities/stream`

Servers MAY expose a stream of registry change events as SSE for live capability discovery:

```http
GET /capabilities/stream
Accept: text/event-stream
```

Each event is one of `SchemaRegistered`, `SchemaDeprecated`, `OperationRegistered`, etc., with payload mirroring the underlying EventLog event group.

---

## Versioning and negotiation

Schemas and operations are versioned with semver. Multiple versions live in the registry simultaneously.

### Pin

```http
Schema-Id: orders/create@2.1.4
```

The client requires exactly `2.1.4`. Server returns `412 Precondition Failed` if not available.

### Range

```http
Accept-Schema-Version: ^2.0.0
```

The client accepts any compatible version. Server picks the highest live version in the range and returns it. The selected version is reported in `Content-Schema-Version`.

### Deprecation

A registered version MAY be marked deprecated. Deprecated versions remain callable until hard-removed. Servers SHOULD include a `Deprecation: true` and `Successor: orders/create@2.0.0` response header for deprecated calls.

### Removal

A version MAY be hard-deprecated and removed from the registry. Subsequent calls return `410 Gone` with `Successor` header pointing to the replacement.

### Progressive rollout

Servers MAY route a percentage of `^2.0.0`-pinned requests to a `2.2.0-beta` version (canary). The actual served version is always reported in `Content-Schema-Version` so clients can pin if they detect the canary.

---

## Error model

Every error response body is a JSON envelope:

```json
{
  "_tag": "InsufficientStock",
  "skuId": "sku_xyz",
  "requested": 10,
  "available": 3,
  "cause": null
}
```

- `_tag` is the discriminant. It MUST match an error class registered in the operation's `errorSchemaIds`.
- Other fields are the typed-error payload, validated against the schema for that error.
- `cause` is OPTIONAL; if present, it is itself a typed-error envelope (recursive cause chain, mirroring Effect's `Cause` model).

For non-typed errors (e.g. crashes, internal-server-errors), the body MAY be a plain string or a `_tag: "Internal"` envelope without a registered schema.

---

## Lnk binding (Phase 2.5)

A `pct`-aware `Lnk` carries the schemas needed to interface with its stream:

```ts
const lnk = yield* lnks.connect(streamId, contentType)
//             ↓ internally:
//             1. wire.head(streamId)                — metadata
//             2. registry.fetchPayloadSchema(streamId) — SchemaRepresentation.Document
//             3. SchemaRepresentation.toSchema(doc)    — typed Schema<A>
//             4. attach schema to Lnk<A>

// Inbound payloads validated via the attached schema
const message = yield* lnk             // : Option<Message<A>>

// Outbound payloads validated before wire encoding
yield* lnk.append(typedPayload)        // pre-validated against schema
```

A compliant `Lnk` implementation MUST:
- Fetch the stream's payload schema from the registry on connect.
- Reconstruct a usable `Schema.Schema<A>` from the document.
- Validate inbound payloads (post-decode) and outbound payloads (pre-encode) using this schema.
- Re-fetch the schema if `/capabilities/stream` reports a `SchemaRegistered` event for the stream's payload schema.

---

## Security considerations

`pct` is silent on authentication and authorization at the protocol level. Implementations rely on transport-layer mechanisms (TLS, bearer tokens, mTLS, OAuth, etc.).

The registry, however, is a security boundary:

- **Tamper evidence**: registries SHOULD use `EventLogEncryption.layerSubtle` to sign registry events. Compromised entries are detectable.
- **Schema authorship**: implementations MAY require schemas to be signed by a known authority before accepting registration. Out of scope for v1.
- **Replay protection**: registry endpoints SHOULD use idempotency keys for write operations (analogous to Producer-Id for mutations).

---

## Substrate (informative)

The reference implementation uses these Effect v4 primitives:

| Layer | Primitive | Path |
|---|---|---|
| Schema codec | `SchemaRepresentation` | `effect-v4/SchemaRepresentation` |
| JSON Schema export | `toJsonSchemaDocument` | `effect-v4/SchemaRepresentation` |
| Registry log | `EventLog`, `EventGroup` | `effect-v4/unstable/eventlog/` |
| Persistence | `EventJournal` (memory or SQL) | `effect-v4/unstable/eventlog/EventJournal` |
| Sync | `EventLogRemote` | `effect-v4/unstable/eventlog/EventLogRemote` |
| Encryption | `EventLogEncryption` | `effect-v4/unstable/eventlog/EventLogEncryption` |
| RPC contract authoring | `RpcGroup`, `Rpc.make` | `effect-v4/unstable/rpc/` |
| Sharding (post-1.0) | `effect/unstable/cluster/Entity` | for capability v2 |

`pct` does not require these specific primitives — they are simply how the reference implementation cashes them out. Other implementations are free to use any equivalent substrate.

---

## Open questions

- **Q1.** Schema authoring beyond TypeScript. Is JSON Schema Draft 2020-12 sufficient as an alternate authoring source, or do we need a separate IDL? *Tentative: JSON Schema is sufficient; lossy projection of Effect features is acceptable for non-Effect clients.*
- **Q2.** Capability handles. Should v2 add an `entity` operation kind backed by `effect/unstable/cluster/Entity`? *Defer until a real use case emerges.*
- **Q3.** Subscription multicast. Should `stream` operations support shared subscriptions (multiple clients, shared cursor) via `Stream-Cursor`? *Tentative: yes, per existing Lnk implementation.*
- **Q4.** Schema registry signing. Should the v1 spec mandate signed registry events, or recommend it? *Tentative: recommend, mandate in regulated profiles.*
- **Q5.** Naming. `pct` is a working codename. Does it stick?

---

## References

- Effect-TS v4 Schema: `effect-v4/Schema`
- SchemaRepresentation: `effect-v4/SchemaRepresentation`
- EventLog: `effect-v4/unstable/eventlog/`
- Cluster Entity (for v2 capability handles): `effect-v4/unstable/cluster/`
- Durable Streams (the protocol that inspired this work): https://durable-streams.com (or wherever the spec lands)
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12/json-schema-core.html
- RFC 2119 keywords: https://www.rfc-editor.org/rfc/rfc2119

---

## Changelog

- **0.1.0 (Draft)** — Initial draft. Schema-first wire over HTTP-RPC + streams. Registry as event-sourced backbone via `EventLog`. Schemas-over-the-wire via `SchemaRepresentation`. Per-operation semver. No capability handles in v1. Lnk-binding sketch.
