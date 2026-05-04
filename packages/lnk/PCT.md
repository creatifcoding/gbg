# `pct` — Pact Protocol

**Status**: Draft 0.2 (working). Not published. Subject to change without notice.

**Codename**: `pct` — short for *pact*. Schemas are contracts; the registry is the shared pact-book.

---

## TL;DR

`pct` is a schema-first wire protocol for typed RPC over HTTP, with an event-sourced federated schema registry as the system-of-record.

- **Procedures-as-values authoring.** `Procedure.pure(...)`, `Procedure.mutation(...)`, `Procedure.stream(...)` produce serializable values. Groups are records of procedures.
- **Event-sourced primary.** The server is a **fold over the registry's EventLog**. Specs change via `pact publish` (writes events), not source-code redeploys. `EventLogRemote` keeps federated registry nodes in sync.
- **Schemas-on-the-wire.** `SchemaRepresentation.Document` (Effect-rich, lossless for Effect-TS) ships from registry to client. JSON Schema Draft 2020-12 export is the universal alternative for non-Effect languages.
- **Per-operation semver, opaque on the wire.** Authoring uses `(name, version)` separately. The wire combines them as an opaque `Schema-Id` token whose format the registry chooses (default human-readable; compressible to short codes for high-traffic deployments).
- **Federated from day 1.** Multiple registry nodes peer via `EventLogRemote`. Signed events (`EventLogEncryption.layerSubtle`) give tamper-evidence; signed snapshots accelerate cold-start.
- **HTTP-RPC core, streams via SSE.** Optional WebSocket binding for duplex (post-1.0).
- **Lnk-binding native.** `Lnks.connect(streamId)` fetches the stream's payload schema from the registry, reconstructs it, and attaches it to a typed `Lnk<A>`.

---

## Goals

- **G1.** A schema-first wire that any HTTP client can target, no SDK required.
- **G2.** Schemas faithfully transmitted with full runtime semantics (refinements, brands, transforms preserved on the receiving side).
- **G3.** Per-operation semver, allowing incremental migration without big-bang version cuts.
- **G4.** Audit-grade by default: every registry mutation is an event in an append-only log; deprecation is a flag, not a removal.
- **G5.** Multi-language reach. TypeScript via Effect.Schema is privileged; other languages can implement compliant servers/clients via JSON Schema interchange.
- **G6.** Stateful and stateless operations natively expressible.
- **G7.** Lnk-binding: when a client connects to a stream via Lnk, schemas for that stream's payloads come with the connection.
- **G8.** Federated registry: multiple registry nodes converge via `EventLogRemote`; clients can connect to any node and get the same canonical view.

## Non-goals (for v1)

- **NG1.** Sub-millisecond latency RPC. (Use NATS, gRPC, or in-process channels.)
- **NG2.** GraphQL-style query languages. (Use GraphQL.)
- **NG3.** Capability handles / distributed object semantics. (Effect Cluster Entities can fill this in a v2 binding if needed; the Cluster substrate makes this cheap to add later.)
- **NG4.** High-throughput byte streams. (Streams are for events, not bulk data transfer.)
- **NG5.** Authentication / authorization at protocol level. (Orthogonal — handled by transport-layer mechanisms.)

---

## RFC keywords

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are used per [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## Vocabulary

| Term | Meaning |
|---|---|
| **Procedure** | A typed, named, versioned operation. The unit of authoring. Carries input/output/error schemas, kind, name, version. |
| **Procedure kind** | The execution model classification: `pure`, `query`, `mutation`, `stream`, `duplex`. |
| **ProcedureGroup** | A record of procedures, addressed by name. The unit of publishing and client construction. |
| **Schema** | A typed contract for a value. In the Effect-TS reference, a `Schema.Schema<A>`. On the wire, a `SchemaRepresentation.Document`. |
| **Schema-Id** | An **opaque** identifier issued by the registry that resolves to a (procedure-name, version) pair. Default format is human-readable (`orders.create@2.1.4`); the registry MAY issue compact codes (`pct:abc123`) for size-sensitive deployments. Clients MUST treat Schema-Ids as opaque. |
| **Schema-Document** | The serialized JSON form of a Schema, produced by `SchemaRepresentation.fromAST` + `DocumentFromJson` codec. |
| **Registry** | The authoritative system-of-record for procedures and schemas. Backed by an EventLog. Federated across nodes via `EventLogRemote`. |
| **Capability catalog** | The result of `GET /capabilities` — a snapshot of all registered procedures and their versions. |
| **Lnk** | (Existing in `@tmnl/lnk` Phase 2.) A typed handle to a stream. In Phase 3, also a schema-carrier. |
| **Compliant server** | A server that implements all `MUST` requirements at the conformance level it advertises. |

---

## Conformance levels

A `pct` implementation MAY claim conformance at one or more of the following levels:

- **L1 — Schema Codec.** Round-trips `SchemaRepresentation.Document` JSON faithfully. Optionally exports JSON Schema Draft 2020-12.
- **L2 — Procedure Semantics.** Implements at least `pure`, `query`, `mutation`, `stream` procedure kinds. (`duplex` is L2-extended.)
- **L3 — Registry.** Exposes the registry endpoints (§7) and accepts both `application/vnd.pct.schema+json` and `application/schema+json` content types for schema submission. **Federation (peering with other registries via EventLogRemote) is REQUIRED at L3.**
- **L4 — HTTP Binding.** Accepts the canonical request shape (§6) and emits the canonical response shape.

A "compliant server" MUST implement L1+L2+L3+L4. L2's `duplex` procedure kind is OPTIONAL for v1.

---

## Layered architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  L0  Authoring                                                       │
│      Effect.Schema (TypeScript) — privileged for the reference impl. │
│      Procedure.{pure,query,mutation,stream}(name, opts) → values.    │
│      ProcedureGroup.make(...procedures) → typed record.              │
│      Other languages: any tool producing valid SchemaRepresentation. │
│      Document JSON or JSON Schema Draft 2020-12 — both accepted.     │
├──────────────────────────────────────────────────────────────────────┤
│  L1  Schema codec (the wire IR for schemas)                          │
│      SchemaRepresentation.Document, encoded via DocumentFromJson.    │
│      Lossless for Effect-TS. Round-trip preserves brands,            │
│      refinements, transforms, literal unions, nested structs.        │
│      JSON Schema 2020-12 export via toJsonSchemaDocument (lossy).    │
├──────────────────────────────────────────────────────────────────────┤
│  L2  Procedure semantics                                             │
│      Procedure kinds: pure / query / mutation / stream / duplex.     │
│      Each procedure has typed input, output, error schemas.          │
│      Schema-Id format: opaque token (default: name@semver).          │
├──────────────────────────────────────────────────────────────────────┤
│  L3  Registry (event-sourced + federated)                            │
│      EventLog with EventGroup of registry events.                    │
│      Endpoints: /schemas, /capabilities, /publish, /federation.      │
│      Audit trail = journal. Replay = re-fold the log.                │
│      Federation via EventLogRemote (REQUIRED at L3).                 │
│      Signed events via EventLogEncryption.layerSubtle.               │
│      Signed snapshots for fast client cold-start.                    │
├──────────────────────────────────────────────────────────────────────┤
│  L4  HTTP wire binding                                               │
│      POST /rpc/{schemaId}                — invocation                │
│      GET  /rpc/{schemaId}?...            — pure/query/stream         │
│      Headers: Schema-Id, Accept-Schema-Version, Content-Schema-      │
│      Version, Producer-{Id,Epoch,Seq}.                               │
│      JSON body. Tagged-error envelopes.                              │
├──────────────────────────────────────────────────────────────────────┤
│  L5  Optional bindings                                               │
│      WebSocket (duplex), CBOR (compact), in-process (test).          │
│      Each binding spec'd as a companion document.                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Authoring (informative — TypeScript reference)

Procedures are values. Groups are records. Composition is functional.

```ts
import { Procedure, ProcedureGroup } from "@tmnl/pct"
import { Schema } from "effect-v4"

// Define schemas
const OrderId = Schema.String.check(
  Schema.isPattern(/^ord_[a-z0-9]+$/),
).pipe(Schema.brand("OrderId"))

const CreateOrderInput = Schema.Struct({ customerId: CustomerId, items: Schema.Array(OrderItem) })
const Order = Schema.Struct({ id: OrderId, total: Money, /* ... */ })

// Define procedures (values)
export const calculateTax = Procedure.pure("orders.calculateTax", {
  input: TaxInput,
  output: TaxOutput,
  version: "2.1.4",
})

export const createOrder = Procedure.mutation("orders.create", {
  input: CreateOrderInput,
  output: Order,
  errors: [InsufficientStock, InvalidCustomer],
  version: "2.1.4",
})

export const watchOrders = Procedure.stream("orders.watch", {
  output: OrderEvent,
  version: "2.1.4",
})

// Group them (record)
export const Orders = ProcedureGroup.make(calculateTax, createOrder, watchOrders)
```

A `Procedure` is a value that carries:
- `name` (string) — procedure name in dotted notation (`namespace.procedure`).
- `version` (semver string) — compressible by registry.
- `kind` — `"pure" | "query" | "mutation" | "stream" | "duplex"`.
- `input` / `output` / `errors` — Effect.Schema instances.

A procedure can be:
- Serialized to a `Procedure.Document` (its schemas as `SchemaRepresentation.Document`s plus metadata).
- Published to a registry via `Pact.publish`.
- Bound to a handler via `Pact.bind`.
- Used as a typed client surface via `PactClient.make`.

---

## Schema-Id encoding & compression

Authoring carries `(name, version)` separately. The wire MUST use the combined `Schema-Id` token. Schema-Ids are **opaque** to clients.

### Default human-readable form

```
orders.create@2.1.4
```

Servers SHOULD use this as the default issued form. Clients MUST NOT parse it.

### Compact form (registry choice)

A registry MAY issue compact Schema-Ids:

```
pct:01HKZQ7M
```

These are opaque base32 codes assigned by the registry. They're shorter on the wire and obscure version semantics from clients.

A registry MAY mix forms — long-form for active development versions, compact form for stable production versions.

### Negotiation

Clients indicate preference via:

```http
Accept-Schema-Id-Format: short
Accept-Schema-Id-Format: long       (default)
Accept-Schema-Id-Format: any        (server picks)
```

When the registry returns a Schema-Id (e.g., from `/publish`), it uses the negotiated format. Subsequent invocations use whatever the client received.

### Why compressible

Production deployments may have:
- Few major versions live at once (1–3)
- Few minor versions per major (5–20)
- Few patch versions per minor (1–100)

A compact Schema-Id token (4–8 base32 chars) saves ~20–40 bytes per request vs. `namespace.long.procedure.name@2.14.7-rc.3+build.42`. At 10k req/s this is megabytes/s of header savings. Registries that care can issue compact codes; those that don't can stay readable.

---

## Procedure kinds

| Kind | Idempotent | Cacheable | Wire | Description |
|---|---|---|---|---|
| `pure` | ✓ | ✓ | `GET` (or `POST`) | Stateless, deterministic, no side effects. Cacheable per (Schema-Id, input). |
| `query` | ✓ | conditional | `GET` (or `POST`) | Side-effect-free read of server state. Cacheable per `Stream-Cursor`. |
| `mutation` | ✗ | ✗ | `POST` | Stateful single-shot. Producer-Id headers MAY be supplied for idempotent retries. |
| `stream` | n/a | ✗ | `GET` + `Accept: text/event-stream` | Server→client unbounded sequence. SSE. |
| `duplex` | n/a | ✗ | `WebSocket` (companion binding) | Bidirectional. Optional in v1. |

A procedure declares its kind in the registry, and the server dispatches accordingly.

---

## Wire format (HTTP/JSON)

### Invoke a procedure

```http
POST /rpc/orders.create@2.1.4
Schema-Id: orders.create@2.1.4
Content-Type: application/json
Accept-Schema-Version: ^2.0.0
Producer-Id: cashier-12             ← optional, for mutations
Producer-Epoch: 0
Producer-Seq: 4711

{ "customerId": "cus_xyz", "items": [...] }
```

```http
HTTP/1.1 200 OK
Content-Schema-Version: 2.1.4
Schema-Id: orders.create@2.1.4
Content-Type: application/json
Cache-Control: no-store

{ "_tag": "Order", "id": "ord_abc123", "total": 99.50, ... }
```

The path `/rpc/{Schema-Id}` is the default URL convention. Implementations MAY use other paths so long as the `Schema-Id` header is the authoritative identifier.

### Headers (canonical)

| Header | Direction | Required | Meaning |
|---|---|---|---|
| `Schema-Id` | request | yes | Opaque Schema-Id from the registry. |
| `Accept-Schema-Version` | request | no | Semver range the client accepts (e.g. `^2.0.0`). Server picks compatible. |
| `Accept-Schema-Id-Format` | request | no | `long` (default), `short`, or `any` — preference for issued Schema-Id format. |
| `Content-Schema-Version` | response | yes | Version the server actually served. |
| `Schema-Id` | response | yes | Response Schema-Id. May differ from request if server up-versioned within the accepted range. |
| `Producer-Id` / `-Epoch` / `-Seq` | request (mutations) | no | Idempotency triple. |
| `Content-Type` | both | yes | `application/json` for L4 default. |
| `Cache-Control` | response | yes | `no-store` for `mutation`/`stream`; `public, max-age=N` allowed for `pure`/`query`. |

### Status codes

| Status | Meaning |
|---|---|
| `200 OK` | Successful invocation. |
| `201 Created` | Mutation that created a new resource. May include `Location`. |
| `204 No Content` | Mutation succeeded; body intentionally empty. |
| `400 Bad Request` | Input failed schema validation OR malformed request envelope. |
| `404 Not Found` | Schema-Id not registered. |
| `409 Conflict` | Typed business error (dedup conflict, state precondition). |
| `410 Gone` | Schema-Id hard-deprecated and removed. May include `Successor` header. |
| `412 Precondition Failed` | `Accept-Schema-Version` cannot be satisfied. |
| `5xx` | Server-side error. |

---

## Registry endpoints

The registry is event-sourced and federated. Each registry node has its own `EventLog`, peers with other nodes via `EventLogRemote`.

### `POST /publish`

Publishes one or more procedures. Accepts both content types:

```http
POST /publish
Content-Type: application/vnd.pct.schema+json     ← raw Document, fast path
```

```http
POST /publish
Content-Type: application/schema+json             ← JSON Schema 2020-12, parsed
```

The body is a `ProcedureGroup.Document` (a JSON envelope containing procedures and their schemas). On `application/schema+json`, the registry parses each schema via `SchemaRepresentation.fromJsonSchemaDocument`.

Internally, the registry writes:
- One `SchemaRegistered` event per unique input/output/error schema.
- One `OperationRegistered` event per procedure.

Response:

```json
{
  "publishedAt": "2025-04-30T18:00:00Z",
  "procedures": [
    {
      "name": "orders.create",
      "version": "2.1.4",
      "schemaId": "orders.create@2.1.4",
      "shortId": "pct:01HKZQ7M"
    }
  ],
  "registryRevision": 142
}
```

### `GET /schemas`

Lists all registered schemas with their versions. Same shape as v0.1.

### `GET /schemas/{schemaId}`

Fetches a specific schema document. Content negotiation:

- `Accept: application/vnd.pct.schema+json` → `SchemaRepresentation.Document` JSON
- `Accept: application/schema+json` → JSON Schema Draft 2020-12 (lossy projection)

### `GET /capabilities`

Returns the operation catalog — live procedures with their kinds, schema-ids, and version states.

```json
{
  "operations": [
    {
      "name": "orders.create",
      "kind": "mutation",
      "versions": [
        {
          "version": "1.0.0",
          "schemaId": "orders.create@1.0.0",
          "shortId": "pct:01HKZ4XX",
          "deprecated": "2025-03-01",
          "successor": "2.0.0",
          "inputSchemaId": "orders.CreateOrderInput@1.0.0",
          "outputSchemaId": "orders.Order@1.0.0",
          "errorSchemaIds": []
        },
        {
          "version": "2.1.4",
          "schemaId": "orders.create@2.1.4",
          "shortId": "pct:01HKZQ7M",
          "inputSchemaId": "orders.CreateOrderInput@2.1.4",
          "outputSchemaId": "orders.Order@2.1.4",
          "errorSchemaIds": ["orders.InsufficientStock@1.0.0", "orders.InvalidCustomer@1.0.0"]
        }
      ]
    }
  ],
  "asOf": "2025-04-30T18:00:00Z",
  "registryRevision": 142,
  "snapshot": {
    "url": "/snapshots/142",
    "signedBy": "pct:0a3f...trustroot...",
    "checksum": "sha256:..."
  }
}
```

### `GET /capabilities/stream`

SSE stream of registry change events for live capability discovery:

```http
GET /capabilities/stream
Accept: text/event-stream
```

### `GET /snapshots/{revision}`

Returns a signed snapshot of the materialized state at a given revision. Clients use this for fast cold-start: fetch snapshot → verify signature → start streaming new events from `/capabilities/stream`.

```json
{
  "revision": 142,
  "snapshot": { /* materialized state */ },
  "signature": "ed25519:...",
  "signedBy": "<registry public key>",
  "snapshottedAt": "2025-04-30T18:00:00Z"
}
```

### `GET /federation/peers`

Returns the registry's current peer set:

```json
{
  "self": {
    "id": "pct:0a3f...",
    "publicKey": "ed25519:...",
    "url": "https://registry.us-east.example.com"
  },
  "peers": [
    {
      "id": "pct:1b4e...",
      "publicKey": "ed25519:...",
      "url": "https://registry.eu-west.example.com",
      "syncStatus": "live",
      "lastSyncAt": "2025-04-30T17:59:50Z"
    }
  ]
}
```

### `POST /federation/peer`

Adds a peer relationship (typically issued by a coordinator or admin tool, not by clients).

---

## Federation

The registry is **federated from v1**. Multiple registry nodes peer with each other; events propagate via `EventLogRemote`.

### Topology

- Each registry node has its own `EventLog`, its own `Identity`, and its own signed events.
- Nodes peer mutually: each holds an `EventLogRemote` reference to its peers.
- `EventLogRemote` synchronizes new events between peers via push/pull.
- Reads are local: a client connects to any node and gets that node's view, which converges with peers within milliseconds.

### Conflict resolution

Two nodes registering the same `(name, version)` is a conflict.

- **Detection**: `SchemaRegistered` and `OperationRegistered` events are primary-keyed by `name@version`. Receiving a duplicate during sync triggers conflict resolution.
- **Resolution**: each event carries `(originNodeId, wallclock)`. Last-writer-wins by wallclock; ties broken by lex-ordered nodeId. The losing event is logged but the winning event prevails in materialized state.
- **Practice**: a coordinated CI pipeline should publish to one canonical node per (name, version); federation is for read availability and disaster recovery, not concurrent writes.

### Signed events & snapshots

`EventLogEncryption.layerSubtle` is REQUIRED at L3. Every event is signed by its origin node's private key; receivers verify against the published public key.

Snapshots are similarly signed: a registry node periodically materializes state, signs the result, and publishes it. Clients can:
- Fetch the latest signed snapshot via `GET /snapshots/{revision}`.
- Verify the signature against a known trust-root public key.
- Start streaming live changes from `revision+1`.

This gives O(1) cold-start regardless of journal length.

### Trust roots

A `pct` deployment defines a trust-root public key (or set of keys). Snapshots/events signed by these roots are trusted. Snapshots from peers that aren't in the trust set are ignored or treated as opaque.

This is a security model decision per deployment. v1 spec defines the mechanism; choosing the trust set is operational.

---

## Versioning and negotiation

Schemas and procedures are versioned with semver. Multiple versions live in the registry simultaneously.

- **Pin**: `Schema-Id: orders.create@2.1.4` — exact match required, else `412 Precondition Failed`.
- **Range**: `Accept-Schema-Version: ^2.0.0` — server picks highest compatible live version, reports it in `Content-Schema-Version`.
- **Deprecation**: `Deprecation: true` + `Successor: orders.create@2.0.0` response headers signal a path forward.
- **Removal**: hard-deprecated versions return `410 Gone` with `Successor` pointing to the replacement.
- **Progressive rollout**: server MAY route a percentage of `^2.0.0`-pinned requests to a `2.2.0-beta` canary. Actual served version is always reported in `Content-Schema-Version`.

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

- `_tag` is the discriminant. MUST match an error class registered in the procedure's `errorSchemaIds`.
- Other fields are typed-error payload, validated against the schema.
- `cause` is OPTIONAL recursive cause chain (mirroring Effect's `Cause`).

For non-typed errors, body MAY be a plain string or `_tag: "Internal"` envelope.

---

## Lnk binding

A `pct`-aware `Lnk` carries the schemas needed to interface with its stream:

```ts
const lnk = yield* lnks.connect(streamId, contentType)
//             ↓ internally:
//             1. wire.head(streamId)                                  — metadata
//             2. registry.fetchOperationByStream(streamId) → Procedure
//             3. SchemaRepresentation.toSchema(input/output)          — typed schemas
//             4. attach to Lnk<A>                                     — typed at boundary

const message = yield* lnk          // : Option<Message<A>>
yield* lnk.append(typedPayload)     // pre-validated against schema
```

A compliant `Lnk` implementation MUST:
- Fetch the stream's payload schema from the registry on connect.
- Reconstruct a usable `Schema.Schema<A>` from the document.
- Validate inbound payloads (post-decode) and outbound payloads (pre-encode).
- Re-fetch the schema if `/capabilities/stream` reports a `SchemaRegistered` event for the stream's payload schema.

---

## CLI: `pact`

The `pact` CLI (built on `effect/unstable/cli`) is the developer interface for publishing, inspecting, and managing the registry.

```
pact publish <spec-path>           Publish procedures from a spec file
pact diff <a-version> <b-version>  Show schema-level diff between versions
pact validate <spec-path>          Lint a spec for compatibility issues
pact deprecate <schema-id>         Mark a Schema-Id deprecated
  --successor <schema-id>            Point to replacement
  --reason <text>                    Human-readable reason
pact dev                           File-watch + auto-publish to local registry
pact registry status               Show registry health, peer status, revision
pact registry peers                List/add/remove peers
pact snapshot create               Snapshot current materialized state
pact snapshot verify <revision>    Verify a signed snapshot
```

`pact dev` is the local development mode: watches spec files, auto-publishes to an in-memory registry, hot-reloads connected servers. Saves the publish ritual during dev cycles.

CLI is implemented as Effect v4 `Command` values, fully typed, with auto-completion via `effect/unstable/cli/Completions`.

---

## Implementation: composition surface

`pct` is implemented as a set of Effect `Layer`s, not as a self-contained server. A single host process MUST be able to serve `pct` alongside other protocols (`lnk`, future ones, observability endpoints, admin tools) by composing each protocol's layers into one HTTP server.

### The HttpLayerRouter pattern

The canonical pattern is `HttpLayerRouter` from `@effect/platform` (v3 and onward; v4 backport pending in effect-smol as of HEAD 2026-04-28). Each protocol module ships **a layer that adds routes to a shared router service**. The host's server is just `HttpLayerRouter.serve(Layer.mergeAll(...))` over all protocol layers.

Key APIs (from `@effect/platform/HttpLayerRouter`):

```ts
// Route registration (these all return Layer<never, never, HttpRouter | ...>)
HttpLayerRouter.add(method, path, handler)             // single route
HttpLayerRouter.addAll(routes)                          // many routes
HttpLayerRouter.use((router) => Effect.gen(...))        // imperative add

// Middleware (per-route or global)
HttpLayerRouter.middleware(middlewareFn)                // returns a Layer

// Mounting an HttpApi
HttpLayerRouter.addHttpApi(api)                         // also a Layer

// Serve the merged layer
HttpLayerRouter.serve(appLayer)                         // returns Layer<HttpServer>
```

### What each protocol module exports

A `pct` implementation MUST export a `Layer` that adds the protocol's routes to the shared router. The reference TypeScript impl will export:

```ts
// @tmnl/pct exports
export const PctRoutes = (config?: PctConfig): Layer<
  never,
  never,
  HttpLayerRouter.HttpRouter | Pact.Registry
>

// @tmnl/lnk exports (the parallel for the lnk wire protocol)
export const LnkRoutes = (config?: LnkConfig): Layer<
  never,
  never,
  HttpLayerRouter.HttpRouter | Wire
>
```

Each config MAY accept a path prefix for namespace isolation:

```ts
PctRoutes({ prefix: "/v1/pct" })   // routes mounted under /v1/pct/...
LnkRoutes({ prefix: "/v1/lnk" })   // routes mounted under /v1/lnk/...
```

With default config (no prefix), routes mount at:
- `pct`: `/rpc/*`, `/schemas/*`, `/capabilities`, `/snapshots/*`, `/publish`, `/federation/*`
- `lnk`: `/streams/*`

These top-level path namespaces MUST NOT collide. Future protocols SHOULD claim their own top-level namespace (or accept a configurable prefix).

### Unified server example

```ts
import { Effect, Layer } from "effect-v4"
import { HttpLayerRouter } from "@effect/platform"          // pending v4 port
import { NodeHttpServer } from "@effect/platform-node"
import { LnkRoutes } from "@tmnl/lnk"
import { PctRoutes } from "@tmnl/pct"
import { Wire, InMemoryWire } from "@tmnl/lnk"
import { Pact } from "@tmnl/pct"

// Each protocol contributes its routes via Layer
const Routes = Layer.mergeAll(
  LnkRoutes(),                                              // /streams/*
  PctRoutes(),                                              // /rpc/*, /schemas/*, ...
)

// Compose with backing services + transport
const Server = HttpLayerRouter.serve(Routes).pipe(
  Layer.provide(InMemoryWire.layer),                        // backs LnkRoutes
  Layer.provide(Pact.Registry.layerMemory),                 // backs PctRoutes
  Layer.provide(NodeHttpServer.layer({ port: 8080 })),
)

Layer.launch(Server).pipe(NodeRuntime.runMain)
```

A single server, two protocols, clean separation. Adding a third protocol is one more entry in `Layer.mergeAll`.

### Middleware composition

Middleware (auth, rate limiting, observability, CORS) is also a Layer. It composes with the same `Layer.mergeAll`:

```ts
const ServerWithAuth = HttpLayerRouter.serve(
  Layer.mergeAll(
    LnkRoutes(),
    PctRoutes(),
    AuthMiddleware.bearerToken({ verify: ... }),            // global middleware
    HttpLayerRouter.cors({ origin: "*" }),
    Metrics.layer({ path: "/metrics" }),                    // adds /metrics route
  )
).pipe(
  Layer.provide(InMemoryWire.layer),
  Layer.provide(Pact.Registry.layerMemory),
  Layer.provide(NodeHttpServer.layer({ port: 8080 })),
)
```

Protocol layers, middleware layers, and infra layers all compose the same way. **There is no "PCT server" type as a top-level concept** — there are only layers that contribute routes/middleware/services to a host.

### Conformance implications

- `pct` implementations MUST be implementable as a Layer (or set of Layers) that adds routes to a host router. Self-contained servers that can't be embedded in a multi-protocol host are non-conforming.
- `pct` route paths MUST NOT exceed the protocol's documented namespace. New endpoints added in future spec versions MUST keep within the namespace.
- `pct` middleware (when published as part of the spec — e.g., signed-snapshot verification) MUST be expressible as composable middleware layers, not as wrapping framework code.

### v4 substrate notes

`HttpLayerRouter` is presently in `@effect/platform` (v3). In effect-smol (v4) the equivalent will live under `effect/unstable/http/HttpLayerRouter` once ported. Until that backport lands, implementations have three options, in order of preference:

1. Use `@effect/platform` v3 alongside `effect-v4` (mixed-version interop; most modules round-trip fine, but Layer composition across version boundaries needs validation).
2. Implement a minimal `HttpLayerRouter` equivalent in `@tmnl/http-layer-router` against `effect-v4/unstable/http/HttpRouter`. The API surface above is small and well-defined; ~200-400 LOC.
3. Wait for the upstream backport. Defensible if the timeline is short; otherwise blocks development.

The protocol spec is agnostic to which option an implementation chooses — it commits only to the **layer-composable shape**, not to a specific module path.

---

## Substrate (informative)

The reference implementation uses these Effect v4 primitives:

| Layer | Primitive | Path |
|---|---|---|
| Schema codec | `SchemaRepresentation` | `effect-v4/SchemaRepresentation` |
| JSON Schema export | `toJsonSchemaDocument` | `effect-v4/SchemaRepresentation` |
| Registry log | `EventLog`, `EventGroup` | `effect-v4/unstable/eventlog/` |
| Persistence | `EventJournal` (memory or SQL) | `effect-v4/unstable/eventlog/EventJournal` |
| Federation | `EventLogRemote` | `effect-v4/unstable/eventlog/EventLogRemote` |
| Encryption / signing | `EventLogEncryption` | `effect-v4/unstable/eventlog/EventLogEncryption` |
| RPC contract authoring | `RpcGroup`, `Rpc.make` | `effect-v4/unstable/rpc/` |
| HTTP base routing | `HttpRouter` | `effect-v4/unstable/http/HttpRouter` |
| Layer-first routing | `HttpLayerRouter` | `@effect/platform/HttpLayerRouter` (v3); v4 port pending |
| HTTP server | `HttpServer`, `NodeHttpServer` | `effect-v4/unstable/http/`, `@effect/platform-node` |
| HttpApi declarative builder | `HttpApi`, `HttpApiBuilder` | `effect-v4/unstable/httpapi/` |
| CLI | `Command`, `Flag`, `Param` | `effect-v4/unstable/cli/` |
| (Future v2 capabilities) | `Entity`, `Sharding` | `effect-v4/unstable/cluster/` |

---

## Open questions

- **Q1.** Snapshot format. JSON is the obvious default but can be large. Can we use CBOR for snapshots? *Tentative: JSON for v1, CBOR companion spec post-1.0.*
- **Q2.** Capability handles. v2 binding via `Entity`? *Defer until use case emerges. Cluster's substrate makes it cheap when needed.*
- **Q3.** Schema authorship beyond `pact publish`. Some teams want git-merged YAML/JSON schemas as the source-of-truth, with publish as a CI step. Should the spec mandate any particular authoring workflow, or is `pact publish ./specs/*` sufficient guidance? *Tentative: spec mandates the wire shape; workflow is informational.*
- **Q4.** `HttpLayerRouter` v4 port timeline. The pattern is committed; the implementation path depends on whether we wait, mix versions, or reimplement. *Tentative: implement a minimal `@tmnl/http-layer-router` against effect-v4 as a hedge; swap to upstream when the backport lands.*

---

## References

- Effect-TS v4 Schema: `effect-v4/Schema`
- SchemaRepresentation: `effect-v4/SchemaRepresentation`
- EventLog: `effect-v4/unstable/eventlog/`
- Effect CLI: `effect-v4/unstable/cli/`
- Cluster Entity (for v2 capability handles): `effect-v4/unstable/cluster/`
- Durable Streams: https://durable-streams.com (referenced for inspiration; pct's protocol is a separate work)
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12/json-schema-core.html
- RFC 2119 keywords: https://www.rfc-editor.org/rfc/rfc2119

---

## Changelog

- **0.2 (Draft, current)** — Major commitments:
  - Authoring style: procedures-as-values (B from design deck) — `Procedure.{pure,query,mutation,stream}` returns serializable values; groups are records.
  - Internal layering: event-sourced primary (iii from design deck) — server is a fold over the EventLog; specs change via `pact publish`, not code redeploys.
  - Federation REQUIRED at L3 (was optional in v0.1).
  - Schema-Id is opaque on the wire; registry chooses format. Compact codes supported via `Accept-Schema-Id-Format: short`. Authoring uses `(name, version)` separately.
  - Both `application/vnd.pct.schema+json` (raw `SchemaRepresentation.Document`) and `application/schema+json` (JSON Schema 2020-12) accepted on `/publish`.
  - Signed snapshots specced for fast client cold-start.
  - CLI section added — `pact` commands, built on `effect/unstable/cli`.

- **0.1 (Draft, prior)** — Initial draft: schema-first, HTTP-RPC + streams, registry as protocol-level concern, schemas-over-the-wire via `SchemaRepresentation`, per-operation semver. No capability handles in v1. Lnk-binding sketch.
