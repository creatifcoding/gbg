# Phase 4: HTTP Transport Architecture Spec

**Date**: 2026-02-06
**Status**: PARTIALLY IMPLEMENTED — **Updated 2026-02-06 post-implementation**
**Author**: Val (team-lead) + http-researcher + kraken (implementation)
**Scope**: Epics 17-18 — RPC Composition + HTTP Transport Layer

---

## Executive Summary

The IIoT V3 service architecture has ~130 RPCs defined across 13 entity files using `@effect/cluster` Entity + `@effect/rpc` Rpc.make(). Phase 4 exposes these over HTTP via two complementary interfaces:

1. **HttpApi (REST)** — For external consumers, with OpenAPI + Swagger UI
2. **RpcServer (binary/JSON RPC)** — For internal service-to-service communication

Both route through `@effect/cluster` to entity actors. The cluster is the router.

---

## Architecture Decision: Dual Interface

```
External consumers (REST)          Internal services (RPC)
        │                                  │
        ▼                                  ▼
  HttpApi (OpenAPI + Swagger)      RpcServer (binary/JSON)
        │                                  │
        └──────────┬───────────────────────┘
                   │
            @effect/cluster
            EntityProxy routing
                   │
            Entity Actors
```

**Rationale**: REST for humans and external integrations (dashboards, mobile apps, third-party systems). Raw RPC for internal microservice communication (higher performance, type-safe, streaming support).

---

## Full Stack Diagram (Updated to match implementation)

```
┌─────────────────────────────────────────────────────┐
│  HttpApiBuilder.serve(HttpMiddleware.logger)          │
│  (via BunHttpServer.layer({ port: 3000 }))           │
│                                                      │
│  ┌── Middleware (Layer) ──────────────────────────┐  │
│  │  HttpApiBuilder.middlewareCors()                │  │
│  │  HttpMiddleware.logger                          │  │
│  │  (auth JWT/bearer — NOT YET IMPLEMENTED)       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌── Route Table ─────────────────────────────────┐  │
│  │  ENTITY PROXY (POST, via EntityProxyServer):    │  │
│  │  /api/alarms/*      → AlarmEntity               │  │
│  │  /api/enterprises/* → EnterpriseEntity           │  │
│  │  /api/sites/*       → SiteEntity                 │  │
│  │  /api/areas/*       → AreaEntity                 │  │
│  │  /api/plants/*      → PlantEntity                │  │
│  │  /api/lines/*       → LineEntity                 │  │
│  │  /api/workcells/*   → WorkCellEntity             │  │
│  │  /api/machines/*    → MachineAssetEntity          │  │
│  │  /api/devices/*     → DeviceAssetEntity           │  │
│  │  /api/sensors/*     → SensorAssetEntity           │  │
│  │  /api/workorders/*  → WorkOrderEntity             │  │
│  │  /api/equipment/*   → EquipmentStateEntity        │  │
│  │  /api/assets/*      → AssetEntity                 │  │
│  │                                                   │  │
│  │  STATELESS QUERIES (GET, stub handlers):          │  │
│  │  /api/queries/plants/*           → AssetQuery     │  │
│  │  /api/queries/lines/*            → AssetQuery     │  │
│  │  /api/queries/machines/*         → AssetQuery     │  │
│  │  /api/queries/sensors/*          → AssetQuery     │  │
│  │  /api/queries/readings/*         → SensorQuery    │  │
│  │  /api/queries/alarms/*           → AlarmQuery     │  │
│  │                                                   │  │
│  │  /rpc            → NOT YET (Task #12)             │  │
│  │  /health         → healthCheck()                  │  │
│  │  /docs           → Swagger UI (HttpApiSwagger)    │  │
│  └─────────────────────┬────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────┐
│  @effect/cluster                                        │
│                                                         │
│  EntityProxy routes to correct entity actor:            │
│  POST /api/alarms/alarm-create/:entityId → AlarmEntity  │
│  POST /api/plants/plant-create/:entityId → PlantEntity  │
│                                                         │
│  ┌─ TestRunner.layer (dev) / BunClusterHttp (prod) ─┐  │
│  │  RunnerStorage → entity shard routing              │  │
│  │  (ShardManager REMOVED — advisory locks instead)   │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────┬────────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────────┐
│  Entity Actors (Machine.boot per entity instance)       │
│  → Graph validators → State mutations → Events          │
└────────────────────────────────────────────────────────┘
```

---

## Layer Composition (Pseudocode → ACTUAL)

> **NOTE**: Original pseudocode used Node.js platform and pipe-based HttpApi.
> Actual implementation uses Bun platform and class-based HttpApi.
> Updated below to reflect implemented code.

```typescript
// ── ACTUAL: src/lib/iiot/http/api.ts ─────────────────
// Class-based HttpApi with .add() chaining (NOT pipe-based)
export class IIoTApi extends HttpApi.make('iiot-api')
  .annotateContext(OpenApi.annotations({
    title: 'IIoT Asset Management API',
    version: '3.0.0',
  }))
  // 13 entity groups via EntityProxy.toHttpApiGroup()
  .add(EntityProxy.toHttpApiGroup('alarms', AlarmEntity).prefix('/api/alarms'))
  .add(EntityProxy.toHttpApiGroup('enterprises', EnterpriseEntity).prefix('/api/enterprises'))
  .add(EntityProxy.toHttpApiGroup('sites', SiteEntity).prefix('/api/sites'))
  .add(EntityProxy.toHttpApiGroup('areas', AreaEntity).prefix('/api/areas'))
  .add(EntityProxy.toHttpApiGroup('plants', PlantEntity).prefix('/api/plants'))
  .add(EntityProxy.toHttpApiGroup('lines', LineEntity).prefix('/api/lines'))
  .add(EntityProxy.toHttpApiGroup('workcells', WorkCellEntity).prefix('/api/workcells'))
  .add(EntityProxy.toHttpApiGroup('machines', MachineAssetEntity).prefix('/api/machines'))
  .add(EntityProxy.toHttpApiGroup('devices', DeviceAssetEntity).prefix('/api/devices'))
  .add(EntityProxy.toHttpApiGroup('sensors', SensorAssetEntity).prefix('/api/sensors'))
  .add(EntityProxy.toHttpApiGroup('workorders', WorkOrderEntity).prefix('/api/workorders'))
  .add(EntityProxy.toHttpApiGroup('equipment', EquipmentStateEntity).prefix('/api/equipment'))
  .add(EntityProxy.toHttpApiGroup('assets', AssetEntity).prefix('/api/assets'))
  // 3 stateless query groups (manual HttpApiGroups, NOT entity-derived)
  .add(AssetQueryGroup.prefix('/api'))    // 8 GET endpoints
  .add(SensorQueryGroup.prefix('/api'))   // 4 GET endpoints
  .add(AlarmQueryGroup.prefix('/api'))    // 3 GET endpoints
{}

// ── ACTUAL: src/lib/iiot/http/proxy-handlers.ts ──────
const ProxyHandlers = Layer.mergeAll(
  EntityProxyServer.layerHttpApi(IIoTApi, 'alarms', AlarmEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'enterprises', EnterpriseEntity),
  // ... all 13 entities
)

// ── ACTUAL: src/lib/iiot/http/query-handlers.ts ──────
// Stub handlers for stateless query endpoints
const QueryHandlers = Layer.mergeAll(
  AssetQueryHandlersLive,   // Effect.succeed([]) for lists, Effect.die for lookups
  SensorQueryHandlersLive,  // Effect.succeed(null) for getLatest, [] for queries
  AlarmQueryHandlersLive,   // Effect.succeed([]) for queries, die for stats
)

// ── ACTUAL: src/lib/iiot/http/cluster.ts ─────────────
// NOTE: Uses BUN platform, NOT Node.js
import { TestRunner } from '@effect/cluster'
import { BunClusterHttp } from '@effect/platform-bun'

export const ClusterDev = TestRunner.layer  // in-memory, zero dependencies
export const ClusterProd = BunClusterHttp.layer({
  transport: 'http',
  storage: 'sql',
  serialization: 'msgpack'
})

// ── ACTUAL: src/lib/iiot/http/server.ts ──────────────
import { BunHttpServer, BunRuntime } from '@effect/platform-bun'

const ApiLive = HttpApiBuilder.api(IIoTApi).pipe(
  Layer.provide(ProxyHandlers),
  Layer.provide(QueryHandlers)
)

export const IIoTHttpServerDev = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provide(ApiLive),
  Layer.provide(EntityHandlersLayer),
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
  Layer.provide(ClusterDev),
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)

export const main = Layer.launch(IIoTHttpServerDev).pipe(
  BunRuntime.runMain
)
```

### Pending: Raw RPC Endpoint (Not Yet Implemented)

```typescript
// PLANNED: src/lib/iiot/http/rpc-route.ts (Task #12)
const RpcRoute = RpcServer.layerHttpRouter({
  group: IIoTRpcs,
  path: "/rpc",
  protocol: "http"  // MUST be explicit — defaults to websocket!
}).pipe(Layer.provide(RpcSerialization.layerJson))
```

---

## Key Design Decisions

### 1. Single `/rpc` Endpoint for Raw RPC

All ~130 RPCs behind one `RpcServer.layerHttpRouter({ group: IIoTRpcs, path: "/rpc" })`. RPC protocol discriminates by tag (`Alarm.Create`, `Plant.Get`, etc.) — path-based splitting is redundant.

### 2. Domain-Split `/api/*` for REST

Each entity gets its own REST path via `EntityProxy.toHttpApiGroup()`. This gives clean URLs (`POST /api/alarms`, `GET /api/plants/:id`) and organized OpenAPI specs.

### 3. Protocol Default is WebSocket

`RpcServer.layerHttpRouter()` defaults to `protocol: "websocket"`. We MUST explicitly set `protocol: "http"` for HTTP transport.

### 4. Serialization Strategy

| Environment | Format | Reason |
|-------------|--------|--------|
| Development | `RpcSerialization.layerJson` | Human-readable, debuggable |
| Production | `RpcSerialization.layerNdjson` or `layerMsgPack` | Performance, binary efficiency |

MsgPack is especially valuable for streaming sensor data via the `SensorReading.Subscribe` RPC.

### 5. Cluster: BunClusterHttp.layer (CORRECTED — Bun, not Node)

> **ORIGINAL SPEC SAID `NodeClusterHttp`** — WRONG. We use Bun.
> Actual implementation uses `BunClusterHttp` from `@effect/platform-bun`.
> Dev mode uses `TestRunner.layer` from `@effect/cluster` (zero dependencies).

**ShardManager and ShardManagerClient have been REMOVED.** Replaced by `RunnerStorage` + DB advisory locks.

| Mode | Layer | Behavior |
|------|-------|----------|
| Dev/Test | `TestRunner.layer` | In-memory RunnerStorage, single-node, zero deps |
| Production | `BunClusterHttp.layer(...)` | Bun HTTP transport, SQL storage, multi-node |

```typescript
// DEV (IMPLEMENTED — src/lib/iiot/http/cluster.ts)
export const ClusterDev = TestRunner.layer

// PROD (IMPLEMENTED — src/lib/iiot/http/cluster.ts)
export const ClusterProd = BunClusterHttp.layer({
  transport: 'http',
  storage: 'sql',          // requires SqlClient
  serialization: 'msgpack'  // cluster inter-node serialization
})
```

**BunClusterHttp.layer accepted options** (verified from .d.ts):
- `transport`: `"http"` | `"websocket"`
- `storage?`: `"local"` | `"sql"` | `"byo"`
- `serialization?`: `"msgpack"` | `"ndjson"`
- `shardingConfig?`: Partial shard config

**Output**: Provides `Sharding` + `Runners` services.

### 6. EntityProxyServer — The Critical Bridge (ADDED)

**THIS IS THE KEY FINDING.**

`RpcServer.layerHttpRouter({ group: IIoTRpcs })` does NOT route through the cluster. It only executes local handlers.

The bridge is **EntityProxyServer**:

```
EntityProxy.toHttpApiGroup("alarms", AlarmEntity)
  → Derives REST endpoints with entityId in path params

EntityProxyServer.layerHttpApi(IIoTApi, "alarms", AlarmEntity)
  → Implements handlers that call entity.client(entityId)
  → entity.client routes through Sharding → Runner → EntityManager → Mailbox
```

**Request flow WITH EntityProxyServer:**
```
HTTP POST /api/alarms/acknowledge/alarm-123
  → HttpLayerRouter (route match)
    → EntityProxyServer handler
      → entity.client("alarm-123").Acknowledge(payload)
        → Sharding service (consistent hash → ShardId)
          → Local EntityManager OR remote runner
            → Entity mailbox → Entity behavior executes → Reply
```

**Request flow WITHOUT EntityProxyServer (WRONG — bypasses cluster):**
```
HTTP POST /rpc { _tag: "Alarm.Acknowledge" }
  → RpcServer (local handler only — no cluster routing!)
```

### 7. Two Proxy Paths

| Path | API | Bridge | OpenAPI | Use Case |
|------|-----|--------|---------|----------|
| **HTTP** | `EntityProxy.toHttpApiGroup()` | `EntityProxyServer.layerHttpApi()` | Yes | External consumers, REST |
| **RPC** | `EntityProxy.toRpcGroup()` | `EntityProxyServer.layerRpcHandlers()` | No | Internal service-to-service |

**We want the HTTP path** for REST + OpenAPI + Swagger UI.

---

## ACTUAL Implementation (Replaces Original Pseudocode)

> **This section replaces the earlier "CORRECTED Layer Composition" which still
> used `NodeClusterHttp`, `NodeHttpServer`, `NodeRuntime`, and `HttpLayerRouter`.**
> The actual implementation uses **Bun platform** and **`HttpApiBuilder`** (not `HttpLayerRouter`).

See the "Layer Composition (Pseudocode -> ACTUAL)" section above for the real code.

### Implementation Status

| Component | File | Status |
|-----------|------|--------|
| IIoTApi (HttpApi class) | `api.ts` | IMPLEMENTED (13 entity groups + 3 query groups) |
| ProxyHandlers (EntityProxyServer) | `proxy-handlers.ts` | IMPLEMENTED (13 entities) |
| QueryHandlers (stateless stubs) | `query-handlers.ts` | IMPLEMENTED (15 stub handlers) |
| QueryGroups (HttpApiGroup) | `query-api.ts` | IMPLEMENTED (8+4+3 = 15 GET endpoints) |
| ClusterDev (TestRunner) | `cluster.ts` | IMPLEMENTED |
| ClusterProd (BunClusterHttp) | `cluster.ts` | IMPLEMENTED (needs SqlClient) |
| Server composition | `server.ts` | IMPLEMENTED (BunHttpServer + BunRuntime) |
| CORS middleware | `server.ts` | IMPLEMENTED (HttpApiBuilder.middlewareCors) |
| Swagger UI | `server.ts` | IMPLEMENTED (HttpApiSwagger.layer at /docs) |
| Health endpoint | `health.ts` | IMPLEMENTED |
| Integration tests | `__tests__/api.test.ts` | IMPLEMENTED (8 tests passing) |
| Raw /rpc endpoint | — | NOT IMPLEMENTED (Task #12, blocked on primaryKey) |
| HttpApiSecurity (JWT) | — | NOT IMPLEMENTED |

---

## Resolved Questions

1. **EntityProxy.toHttpApiGroup() endpoint shape**: POST endpoints per RPC, with `:entityId` path param auto-injected. **RPC tags are kebab-cased**: `Enterprise.Create` -> `POST /api/enterprises/enterprise-create/:entityId` (NOT `Enterprise.Create/:entityId`).

2. **Cluster layer chain**: Dev uses `TestRunner.layer` (zero deps). Prod uses `BunClusterHttp.layer({ transport, storage, serialization })`. ShardManager is REMOVED — replaced by RunnerStorage + DB advisory locks.

3. **HttpApiBuilder.serve()**: Used for the actual implementation. Composes with `Layer.provide()` chain. `HttpLayerRouter.serve()` is the lower-level alternative. We chose `HttpApiBuilder.serve(HttpMiddleware.logger)`.

4. **Dual server**: YES — HttpApi (REST) routes and RpcServer (binary) routes can coexist. REST is implemented; raw RPC endpoint is Task #12 (pending).

5. **HttpApiSecurity**: Still pending — JWT/bearer token integration with HttpApi groups.

6. **toWebHandler for testing**: `HttpApiBuilder.toWebHandler(layer)` works for serverless testing. Layer must be composed with `Layer.provideMerge()` (NOT `Layer.mergeAll`) to wire dependency chain correctly. Requires `HttpServer.layerContext` for DefaultServices.

7. **CORS middleware**: `HttpApiBuilder.middlewareCors()` returns `Layer.Layer<never>` — composable with `HttpApiBuilder.serve()` via `Layer.provide()`.

8. **Bun ESM type exports**: `export { InterfaceName }` fails for interfaces in Bun's ESM resolver. Must use `export type { InterfaceName }` for type-only re-exports.

---

## Dependencies (VERIFIED — all installed)

```json
{
  "@effect/cluster": "^0.56.1",
  "@effect/experimental": "0.58.0",
  "@effect/rpc": "^0.73.0",
  "@effect/platform": "installed",
  "@effect/platform-bun": "installed"
}
```

**Key imports verified:**
- `EntityProxy`, `EntityProxyServer`, `TestRunner` from `@effect/cluster`
- `HttpApi`, `HttpApiBuilder`, `HttpApiSwagger`, `HttpApiEndpoint`, `HttpApiGroup`, `HttpServer` from `@effect/platform`
- `BunHttpServer`, `BunRuntime`, `BunClusterHttp` from `@effect/platform-bun`
- No `@effect/platform-node` needed (we use Bun, not Node)

---

## File Structure (ACTUAL — implemented)

```
src/lib/iiot/http/
├── api.ts              # IIoTApi class — HttpApi.make + EntityProxy.toHttpApiGroup + query groups
├── proxy-handlers.ts   # EntityProxyServer.layerHttpApi for all 13 entities
├── query-api.ts        # Manual HttpApiGroup definitions for 15 stateless query endpoints
├── query-handlers.ts   # Stub handlers for query groups (Effect.succeed([]) / Effect.die)
├── cluster.ts          # ClusterDev (TestRunner) + ClusterProd (BunClusterHttp)
├── health.ts           # healthCheck() endpoint
├── server.ts           # IIoTHttpServerDev full composition + BunRuntime boot
├── index.ts            # Barrel exports
└── __tests__/
    └── api.test.ts     # HttpApi integration tests (toWebHandler, 8 tests passing)
```

---

## Related Documents

- [RPC Inventory](./phase4-rpc-inventory.md) — All 130+ RPC definitions
- [Research Findings](./phase4-http-research.md) — DeepWiki research on HttpLayerRouter, RpcServer, HttpApi
- [Cluster Routing Research](./phase4-http-research.md#critical-cluster-routing) — EntityProxyServer bridge
- [WBS Tracker](../../.claude/plans/enumerated-crafting-otter.md) — Epic 17-18 progress
- [Full WBS](./2026-01-26-v3-service-architecture-wbs.md) — Original WBS specification
