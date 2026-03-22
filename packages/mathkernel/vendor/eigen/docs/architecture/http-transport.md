# HTTP Transport Architecture

> Consolidated from `thoughts/shared/plans/phase4-http-architecture.md`
> Original date: 2026-02-06 | Status: Partially implemented

## Overview

The IIoT v3 service architecture exposes ~130 RPCs across 13 entity files over HTTP via two complementary interfaces:

1. **HttpApi (REST)** -- For external consumers, with OpenAPI + Swagger UI
2. **RpcServer (binary/JSON RPC)** -- For internal service-to-service communication

Both route through `@effect/cluster` to entity actors. The cluster is the router.

## Architecture: Dual Interface

```
External consumers (REST)          Internal services (RPC)
        |                                  |
        v                                  v
  HttpApi (OpenAPI + Swagger)      RpcServer (binary/JSON)
        |                                  |
        +----------+----------------------+
                   |
            @effect/cluster
            EntityProxy routing
                   |
            Entity Actors
```

**Rationale**: REST for humans and external integrations (dashboards, mobile apps, third-party systems). Raw RPC for internal microservice communication (higher performance, type-safe, streaming support).

## Full Stack

```
HttpApiBuilder.serve(HttpMiddleware.logger)
  via BunHttpServer.layer({ port: 3000 })

  Middleware:
    HttpApiBuilder.middlewareCors()
    HttpMiddleware.logger
    (auth JWT/bearer -- planned)

  Route Table:
    ENTITY PROXY (POST, via EntityProxyServer):
      /api/alarms/*      -> AlarmEntity
      /api/enterprises/* -> EnterpriseEntity
      /api/sites/*       -> SiteEntity
      /api/areas/*       -> AreaEntity
      /api/plants/*      -> PlantEntity
      /api/lines/*       -> LineEntity
      /api/workcells/*   -> WorkCellEntity
      /api/machines/*    -> MachineAssetEntity
      /api/devices/*     -> DeviceAssetEntity
      /api/sensors/*     -> SensorAssetEntity
      /api/workorders/*  -> WorkOrderEntity
      /api/equipment/*   -> EquipmentStateEntity
      /api/assets/*      -> AssetEntity

    STATELESS QUERIES (GET, stub handlers):
      /api/queries/plants/*    -> AssetQuery (8 GET endpoints)
      /api/queries/readings/*  -> SensorQuery (4 GET endpoints)
      /api/queries/alarms/*    -> AlarmQuery (3 GET endpoints)

    /health  -> healthCheck()
    /docs    -> Swagger UI (HttpApiSwagger)

  @effect/cluster
    EntityProxy routes to correct entity actor:
    POST /api/alarms/alarm-create/:entityId -> AlarmEntity
    POST /api/plants/plant-create/:entityId -> PlantEntity
```

## HttpApi Definition (Class-based)

```typescript
export class IIoTApi extends HttpApi.make('iiot-api')
  .annotateContext(OpenApi.annotations({
    title: 'IIoT Asset Management API',
    version: '3.0.0',
  }))
  // 13 entity groups via EntityProxy.toHttpApiGroup()
  .add(EntityProxy.toHttpApiGroup('alarms', AlarmEntity).prefix('/api/alarms'))
  .add(EntityProxy.toHttpApiGroup('sites', SiteEntity).prefix('/api/sites'))
  // ... all 13 entities
  // 3 stateless query groups (manual HttpApiGroups)
  .add(AssetQueryGroup.prefix('/api'))
  .add(SensorQueryGroup.prefix('/api'))
  .add(AlarmQueryGroup.prefix('/api'))
{}
```

## Layer Composition

```typescript
// Proxy handlers (entity-derived)
const ProxyHandlers = Layer.mergeAll(
  EntityProxyServer.layerHttpApi(IIoTApi, 'alarms', AlarmEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'enterprises', EnterpriseEntity),
  // ... all 13 entities
)

// Full server layer
const IIoTHttpServerLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provide(ProxyHandlers),
  Layer.provide(QueryHandlers),
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
)
```

## Key Implementation Notes

- Uses **class-based HttpApi** with `.add()` chaining (not pipe-based)
- Entity proxy uses `EntityProxy.toHttpApiGroup()` for automatic route generation
- Stateless query endpoints are stub handlers returning `Effect.succeed([])`
- OpenAPI spec auto-generated from HttpApi annotations
- CORS enabled via `HttpApiBuilder.middlewareCors()`
