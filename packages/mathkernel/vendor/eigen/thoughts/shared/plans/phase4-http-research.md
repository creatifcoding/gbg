# Phase 4: HTTP Transport Research Findings

**Date**: 2026-02-06
**Source**: http-researcher agent via DeepWiki (`Effect-TS/effect`)
**Status**: VERIFIED (all findings traced to deepwiki)

---

## 1. HttpLayerRouter vs HttpRouter

### HttpRouter (`@effect/platform/HttpRouter`)
- Direct, imperative route registration: `HttpRouter.get("/path", handler)`
- Chain methods: `.get()`, `.post()`, `.mount()`, `.mountApp()`, `.concat()`
- Simpler for basic apps without heavy Layer composition

### HttpLayerRouter (`@effect/platform/HttpLayerRouter`) — Experimental (v0.87.7+)
- Routes registered as `Layer`s, composable via `Layer.mergeAll()`
- Integrates with Effect's dependency injection system
- Routes defined via:
  - `HttpLayerRouter.add("GET", "/path", handler)` — returns a Layer
  - `HttpLayerRouter.use(Effect.fn(...))` — yields router, adds routes
  - `Layer.effectDiscard(Effect.gen(...))` — manual router access
- Supports middleware as Layers (including typed middleware that provides services)

**Verdict**: HttpLayerRouter for our ~130 RPC system. Layer-based composition is essential at scale.

---

## 2. RpcServer.layerHttpRouter()

**Package**: `@effect/rpc`

```typescript
RpcServer.layerHttpRouter<Rpcs extends Rpc.Any>(options: {
  readonly group: RpcGroup.RpcGroup<Rpcs>
  readonly path: HttpRouter.PathInput
  readonly protocol?: "http" | "websocket" | undefined  // ⚠️ DEFAULTS TO WEBSOCKET
  readonly disableTracing?: boolean
  readonly spanPrefix?: string
  readonly spanAttributes?: Record<string, unknown>
  readonly concurrency?: number | "unbounded"
  readonly disableFatalDefects?: boolean
}): Layer.Layer<
  never,
  never,
  | RpcSerialization.RpcSerialization
  | HttpLayerRouter.HttpRouter
  | Rpc.ToHandler<Rpcs>
  | Rpc.Context<Rpcs>
  | Rpc.Middleware<Rpcs>
>
```

**CRITICAL CAVEAT**: `protocol` defaults to `"websocket"`, NOT `"http"`. You MUST explicitly set `protocol: "http"` for HTTP transport.

**Usage**:
```typescript
const RpcRoute = RpcServer.layerHttpRouter({
  group: UserRpcs,
  path: "/rpc",
  protocol: "http"
}).pipe(
  Layer.provide(UserHandlers),
  Layer.provide(RpcSerialization.layerJson)
)
```

---

## 3. RpcServer.layerProtocolHttpRouter()

Lower-level than `layerHttpRouter`:

```typescript
RpcServer.layerProtocolHttpRouter(options: {
  readonly path: HttpRouter.PathInput
}): Layer.Layer<Protocol, never, RpcSerialization.RpcSerialization | HttpLayerRouter.HttpRouter>
```

- `layerHttpRouter` internally delegates to either `layerProtocolHttpRouter` (HTTP) or `layerProtocolWebsocketRouter` (WebSocket)
- For our use case, `layerHttpRouter` with `protocol: "http"` is sufficient

---

## 4. HttpLayerRouter.serve()

Takes a `Layer` containing all routes and starts the HTTP server.

```typescript
HttpLayerRouter.serve(AllRoutes).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
  Layer.launch,
  NodeRuntime.runMain
)
```

**Required layers**:
1. `appLayer` — merged routes (RPC + REST + middleware)
2. `NodeHttpServer.layer(createServer, { port: N })` — concrete HTTP server

---

## 5. RpcSerialization Options

**Package**: `@effect/rpc/RpcSerialization`

| Format | Layer | Content-Type | Framing | Use Case |
|--------|-------|-------------|---------|----------|
| JSON | `layerJson` | `application/json` | No | Development, debugging |
| NDJSON | `layerNdjson` | `application/ndjson` | Newline | Streaming |
| MsgPack | `layerMsgPack` | `application/msgpack` | Yes | Production, binary sensor data |
| JSON-RPC | `layerJsonRpc()` | JSON | No | Standard JSON-RPC protocol |
| NDJSON-RPC | `layerNdJsonRpc()` | JSON | Newline | Framed JSON-RPC |

**Recommendation**: JSON for dev, MsgPack for production sensor streams.

---

## 6. HttpLayerRouter.cors()

```typescript
HttpLayerRouter.cors({
  allowedOrigins: ["https://example.com"] | ((origin) => boolean),
  allowedMethods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  allowedHeaders: [],       // empty = reflect client's headers
  exposedHeaders: [],
  maxAge: 3600,             // seconds for preflight cache
  credentials: false
})
```

Usage as global middleware:
```typescript
const AllRoutes = Layer.mergeAll(RpcRoutes, RestRoutes).pipe(
  Layer.provide(HttpLayerRouter.cors())
)
```

---

## 7. HttpLayerRouter.addHttpApi() — Mixing RPC + REST

**YES**, RPC and HttpApi routes compose on the same router.

```typescript
HttpLayerRouter.addHttpApi<Id, Groups, E, R>(
  api: HttpApi.HttpApi<Id, Groups, E, R>,
  options?: {
    readonly openapiPath?: `/${string}` | undefined
  }
): Layer.Layer<never, never, /* dependencies */>
```

**Combining RPC + REST + OpenAPI**:
```typescript
// REST API with OpenAPI
const HttpApiRoutes = HttpLayerRouter.addHttpApi(MyApi, {
  openapiPath: "/docs/openapi.json"
}).pipe(Layer.provide(HandlersLayer))

// RPC routes
const RpcRoute = RpcServer.layerHttpRouter({
  group: IIoTRpcs, path: "/rpc", protocol: "http"
}).pipe(
  Layer.provide(Handlers),
  Layer.provide(RpcSerialization.layerJson)
)

// Merge
const AllRoutes = Layer.mergeAll(HttpApiRoutes, RpcRoute)
```

---

## 8. RpcServer.toWebHandler() — Serverless/Testing

Returns standard Web Fetch API handler `(Request) => Promise<Response>`.

```typescript
const { handler, dispose } = RpcServer.toWebHandler(MyRpcs, {
  layer: Layer.mergeAll(Handlers, RpcSerialization.layerJson)
})

// Testing
const response = await handler(new Request("http://localhost/rpc", {
  method: "POST",
  body: JSON.stringify({ _tag: "Alarm.Create", payload: {...} })
}))

// Cleanup
await dispose()
```

**Use for**: Integration tests (no server needed), serverless deployments (Cloudflare Workers).

---

## 9. Multiple RpcGroups at Different Paths

Works with `Layer.mergeAll`:

```typescript
const AlarmRoute = RpcServer.layerHttpRouter({
  group: AlarmRpcs, path: "/rpc/alarms", protocol: "http"
}).pipe(Layer.provide(AlarmHandlers), Layer.provide(RpcSerialization.layerJson))

const AssetRoute = RpcServer.layerHttpRouter({
  group: AssetRpcs, path: "/rpc/assets", protocol: "http"
}).pipe(Layer.provide(AssetHandlers), Layer.provide(RpcSerialization.layerJson))

const AllRpcRoutes = Layer.mergeAll(AlarmRoute, AssetRoute)
```

**However**: For our system, single `/rpc` with unified `IIoTRpcs` is simpler. RPC tag discriminates internally.

---

## 10. EntityProxy.toHttpApiGroup()

**Package**: `@effect/cluster`

```typescript
EntityProxy.toHttpApiGroup<Name, Type, Rpcs>(
  name: Name,
  entity: Entity.Entity<Type, Rpcs>
): HttpApiGroup.HttpApiGroup<Name, ConvertHttpApi<Rpcs>>
```

- Derives REST endpoints from entity RPC definitions
- Auto-generates POST endpoints for each RPC
- Creates "discard" (fire-and-forget) variants
- Routes through cluster to entity actors

**This is the bridge**: Entity → HttpApi → REST + OpenAPI + Cluster routing

---

## 11. OpenAPI from Effect

**Module**: `@effect/platform/OpenApi`

```typescript
const spec = OpenApi.fromApi(myHttpApi)
// Returns OpenAPI 3.1.0 spec object
```

**Interactive Swagger UI**: `HttpApiSwagger.layer()`

```typescript
HttpApiBuilder.serve().pipe(
  Layer.provide(HttpApiSwagger.layer()),   // serves /docs
  Layer.provide(MyApiLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)
```

**Key insight**: OpenAPI generation works with `HttpApi` endpoints. Raw RPC routes don't generate OpenAPI unless derived via `EntityProxy.toHttpApiGroup()`.

---

## Round 2: Cluster Routing Research (CRITICAL)

### 12. EntityProxyServer — The Bridge

**CRITICAL FINDING**: `RpcServer.layerHttpRouter({ group })` does NOT route through the cluster. It only executes local handlers. The bridge is `EntityProxyServer`.

**Two bridge APIs:**

| Bridge | For | OpenAPI |
|--------|-----|---------|
| `EntityProxyServer.layerHttpApi(api, groupName, entity)` | HttpApi REST endpoints | Yes |
| `EntityProxyServer.layerRpcHandlers(entity)` | Raw RPC handlers | No |

**Request flow WITH EntityProxyServer:**
```
HTTP POST /api/alarms/acknowledge/alarm-123
  → HttpLayerRouter (route match)
    → EntityProxyServer handler
      → entity.client("alarm-123").Acknowledge(payload)
        → Sharding service (consistent hash → ShardId)
          → Local EntityManager OR remote runner
            → Entity mailbox → Entity behavior → Reply
```

### 13. NodeClusterHttp.layer — Cluster Infrastructure

**ShardManager and ShardManagerClient are REMOVED.** Replaced by RunnerStorage + DB advisory locks.

```typescript
NodeClusterHttp.layer({
  transport: "http" | "websocket",
  serialization: "msgpack" | "ndjson",
  storage: "local" | "sql" | "byo",
  runnerHealth: "ping" | "k8s",
  clientOnly: false,
  shardingConfig: { /* partial */ }
})
```

**Internal layers provided:**

| Service | `local` | `sql` |
|---------|---------|-------|
| RunnerStorage | layerMemory | SqlRunnerStorage.layer |
| MessageStorage | layerNoop | SqlMessageStorage.layer |
| RunnerHealth | layerPing | layerPing |
| ShardingConfig | layerFromEnv | layerFromEnv |
| RpcSerialization | layerMsgPack | layerMsgPack |
| HttpClient | NodeHttpClient.layerUndici | NodeHttpClient.layerUndici |

**Output**: Provides `Sharding` + `Runners` services.

### 14. Full Layer Chain (RESOLVED)

```
HttpLayerRouter.serve(AllRoutes)
  │
  ├── NodeHttpServer.layer(createServer, { port })
  │
  ├── NodeClusterHttp.layer({ transport, storage, runnerHealth })
  │     ├── HttpRunner.layerHttp (inter-node cluster RPCs)
  │     ├── RunnerStorage (memory or SQL)
  │     ├── MessageStorage (noop or SQL)
  │     ├── RunnerHealth (ping or k8s)
  │     └── RpcSerialization (msgpack)
  │
  ├── SqlClient.layer (PostgreSQL — for storage: "sql")
  │
  ├── EntityHandlersLayer (entity behaviors via Entity.toLayer)
  │
  └── AllRoutes = Layer.mergeAll(
        HttpLayerRouter.addHttpApi(IIoTApi, { openapiPath }),
        HealthRoute,
        HttpLayerRouter.cors()
      )
```

**Key**: HttpRunner uses HttpLayerRouter internally — cluster inter-node routes coexist with app routes.

### 15. entityId Routing via primaryKey

EntityProxy adds `entityId` to ALL payloads. RPCs must define `primaryKey` for cluster routing:

```typescript
Rpc.make("Acknowledge", {
  payload: { alarmId: Schema.String, operatorId: Schema.String },
  primaryKey: ({ alarmId }) => alarmId,  // ← THIS routes to the right shard
  success: Schema.Struct({ acknowledged: Schema.Boolean })
})
```

### 16. Caveats

1. **ShardManager/ShardManagerClient REMOVED** — replaced by RunnerStorage + advisory locks
2. **NodeClusterHttp may have moved** from `@effect/platform-node` to `@effect/cluster`
3. **entity.toLayer() registers with Sharding** — must be provided alongside cluster layers
4. **EntityProxy adds entityId to ALL payloads** — RPCs need primaryKey
5. **HttpRunner uses HttpLayerRouter internally** — cluster routes share the router

---

## Resolved Research Questions

| # | Question | Answer |
|---|----------|--------|
| 1 | EntityProxy endpoint shape | POST per RPC, `:entityId` path param auto-injected |
| 2 | Cluster layer chain | `NodeClusterHttp.layer` bundles everything (RunnerStorage, Sharding, etc.) |
| 3 | serve() entry point | Both `HttpApiBuilder.serve()` and `HttpLayerRouter.serve()` work |
| 4 | Dual server | YES — HttpApi + RpcServer coexist on same HttpLayerRouter |
| 5 | OpenAPI from RPC | Only via `EntityProxy.toHttpApiGroup()` → `addHttpApi({ openapiPath })` |

## Still Pending

1. **HttpApiSecurity** — JWT/bearer token integration pattern

## Resolved Since Initial Research

1. **primaryKey audit** — COMPLETED (Task #1). All 13 entities audited. Task #11 is implementing the actual primaryKey additions to all 14 Rpc.make() calls.
2. **Platform correction** — NodeClusterHttp / NodeHttpServer references in research are WRONG for our project. Actual implementation uses:
   - `BunClusterHttp` from `@effect/platform-bun` (NOT `NodeClusterHttp`)
   - `BunHttpServer` from `@effect/platform-bun` (NOT `NodeHttpServer`)
   - `BunRuntime` from `@effect/platform-bun` (NOT `NodeRuntime`)
   - `TestRunner.layer` from `@effect/cluster` for dev (NOT `NodeClusterHttp.layer({ storage: "local" })`)
3. **toWebHandler testing** — VERIFIED working. `HttpApiBuilder.toWebHandler()` requires `Layer.provideMerge()` composition (NOT `Layer.mergeAll`) and `HttpServer.layerContext` for DefaultServices. 8 integration tests passing.
4. **EntityProxy URL pattern** — RPC tags are auto-kebab-cased: `Enterprise.Create` -> `/enterprise-create/:entityId`.
5. **Stateless query endpoints** — 15 GET endpoints implemented via manual `HttpApiGroup` definitions in `query-api.ts` with stub handlers in `query-handlers.ts`.

---

## Architecture Recommendations (Updated — Post-Implementation)

1. Use `HttpApiBuilder.serve()` with `Layer.provide()` chain for composition (simpler than `HttpLayerRouter`)
2. Use `EntityProxy.toHttpApiGroup()` for REST + OpenAPI (through cluster) -- IMPLEMENTED
3. Use `EntityProxyServer.layerHttpApi()` as the bridge -- IMPLEMENTED for all 13 entities
4. `TestRunner.layer` for dev, `BunClusterHttp.layer({ storage: "sql" })` for production -- IMPLEMENTED
5. Explicitly set `protocol: "http"` on any raw RpcServer calls -- for Task #12
6. Start with `layerJson` for dev debugging, plan `layerMsgPack` for production
7. Use `HttpApiBuilder.toWebHandler()` for integration testing (no server boot needed) -- IMPLEMENTED, 8 tests
8. CORS via `HttpApiBuilder.middlewareCors()` -- IMPLEMENTED
9. OpenAPI via `OpenApi.annotations()` on IIoTApi class -- IMPLEMENTED
10. Swagger UI via `HttpApiSwagger.layer({ path: '/docs' })` -- IMPLEMENTED
