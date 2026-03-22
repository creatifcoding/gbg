# Entity Patterns

## Overview

Entities are **distributed actors** built on `@effect/cluster`. Each entity instance is keyed by a primary identifier (e.g., `siteId`) and maintains entity-scoped state. The entity layer combines three Effect-TS libraries:

- **`@effect/cluster` Entity** — distributed actor definition, sharding, RPC routing
- **`@effect/experimental` Machine** — state graph validation, typed procedures
- **`@effect/rpc` Rpc** — typed RPC definitions with payload/success/error schemas

## Entity Architecture (Machine + Entity)

Every entity follows this architecture:

```
External API (Rpc.make)       Internal Actor (Machine)        State Port
        |                           |                           |
   CreateRpc ──> handler ──> actor.send(InternalCreate) ──> state.create()
   GetRpc    ──> handler ──> actor.send(InternalGet)    ──> state.get()
   TransRpc  ──> handler ──> actor.send(InternalTrans)  ──> graph.validate() + state.set()
```

1. **External API**: `Rpc.make()` defines typed request/response contracts
2. **Entity**: `Entity.make()` groups RPCs into a distributed actor
3. **Handler Layer**: `Entity.toLayer()` boots a Machine and delegates to it
4. **Machine**: Validates state transitions via ISA-95 graphs, wraps state operations
5. **State Service**: Hexagonal port (in-memory or SQL-backed)

## Entity Definition

```typescript
// src/lib/iiot/entity/SiteEntity.ts

// 1. RPC Tags (string constants for routing)
export const SiteEntityType = 'Site' as const
export const SiteCreateTag = `${SiteEntityType}.Create` as const
export const SiteGetTag = `${SiteEntityType}.Get` as const
export const SiteBeginConstructionTag = `${SiteEntityType}.BeginConstruction` as const
// ... more lifecycle transitions

// 2. RPC Definitions (typed request/response)
export class CreateSiteRpc extends Rpc.make(SiteCreateTag, {
  payload: CreateSiteParams,
  primaryKey: ({ slug }) => slug,      // Routes to entity instance
  success: Site,
  error: RpcQueryError,
}) {}

export class BeginConstructionRpc extends Rpc.make(SiteBeginConstructionTag, {
  payload: Schema.Struct({ siteId: SiteId }),
  primaryKey: ({ siteId }) => siteId,
  success: Site,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

// 3. Entity (groups RPCs into a distributed actor)
export const SiteEntity = Entity.make(SiteEntityType, [
  CreateSiteRpc,
  GetSiteRpc,
  BeginConstructionRpc,
  CommissionRpc,
  SeasonalShutdownRpc,
  ReopenRpc,
  CloseRpc,
  DecommissionRpc,
])
```

## Handler Implementation

The handler layer boots a Machine actor and delegates all RPC calls to it:

```typescript
// src/lib/iiot/entity/SiteEntity.ts

export const SiteEntityHandlers = SiteEntity.toLayer(
  Effect.gen(function* () {
    // PORT INJECTION
    const state = yield* SiteState           // Port: state persistence
    const flags = yield* IIoTFeatureFlags    // Port: feature flags

    // MACHINE BOOT (internal actor)
    const siteMachine = makeSiteMachine({ state, flags })
    const actor = yield* Machine.boot(siteMachine)

    // HANDLERS DELEGATE TO MACHINE
    const handleCreate = (envelope: { payload: typeof CreateSiteParams.Type }) =>
      actor.send(new InternalCreateSite({ params: envelope.payload })).pipe(
        Effect.catchTag('MachineCreateError', (e) =>
          Effect.fail(new RpcQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleBeginConstruction = (envelope: { payload: { siteId: SiteId } }) =>
      actor.send(new InternalBeginConstruction({ siteId: envelope.payload.siteId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({
              siteId: e.entityId as SiteId,
              message: e.message,
            })),
        })
      )

    // Return entity handler mapping
    return SiteEntity.of({
      [SiteCreateTag]: handleCreate,
      [SiteGetTag]: handleGet,
      [SiteBeginConstructionTag]: handleBeginConstruction,
      [SiteCommissionTag]: handleCommission,
      // ... more handlers
    })
  })
)
```

## Error Mapping Pattern

Machine errors are internal. Handlers map them to RPC-friendly errors:

| Machine Error | RPC Error | When |
|---------------|-----------|------|
| `MachineCreateError` | `RpcQueryError` | Create operation fails |
| `MachineEntityNotFoundError` | `RpcNotFoundError` | Entity ID not found in state |
| `MachineInvalidTransitionError` | `RpcTransitionError` | State graph rejects transition |

```typescript
actor.send(new InternalCommission({ siteId })).pipe(
  Effect.catchTags({
    MachineEntityNotFoundError: (e) =>
      Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId })),
    MachineInvalidTransitionError: (e) =>
      Effect.fail(new RpcTransitionError({
        siteId: e.entityId as SiteId,
        message: e.message,
      })),
  })
)
```

## EntityStack — Pre-Composed Layers

The `EntityStack.ts` module provides pre-composed layer stacks:

```typescript
// src/lib/iiot/entity/EntityStack.ts

// All 12 entity handlers merged
export const EntityHandlersLayer = Layer.mergeAll(
  AlarmEntityHandlers,
  WorkOrderEntityHandlers,
  EquipmentStateEntityHandlers,
  EnterpriseEntityHandlers,
  SiteEntityHandlers,
  AreaEntityHandlers,
  PlantEntityHandlers,
  LineEntityHandlers,
  WorkCellEntityHandlers,
  MachineAssetEntityHandlers,
  DeviceEntityHandlers,
  SensorAssetEntityHandlers,
)

// Testing stack: in-memory state + events disabled
export const EntityTestingStack = EntityHandlersLayer.pipe(
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
)

// Production: handlers + events enabled (SQL state provided separately)
export const EntityProductionHandlersWithEvents = EntityHandlersLayer.pipe(
  Layer.provide(IIoTFeatureFlagsEnabledLayer),
)
```

## Entity Inventory

| Entity | Domain | Strategy | Lifecycle States |
|--------|--------|----------|-----------------|
| AlarmEntity | Alarms | Event Sourced | active, acknowledged, cleared, resolved |
| WorkOrderEntity | Work Orders | Event Sourced | created, assigned, in_progress, completed, cancelled |
| EquipmentStateEntity | Equipment | Event Sourced | running, idle, maintenance, fault, off |
| EnterpriseEntity | Assets | CRUD | active, inactive, archived |
| SiteEntity | Assets | CRUD | planned, under_construction, operational, seasonal_shutdown, closed, decommissioned |
| AreaEntity | Assets | CRUD | active, inactive, under_construction, decommissioned |
| PlantEntity | Assets | CRUD | planned, commissioning, operational, maintenance, decommissioned |
| LineEntity | Assets | CRUD | active, inactive, setup, maintenance |
| WorkCellEntity | Assets | CRUD | active, inactive, setup |
| MachineAssetEntity | Assets | CRUD | active, inactive, maintenance, fault, decommissioned |
| DeviceEntity | Assets | CRUD | active, inactive, firmware_update, fault |
| SensorAssetEntity | Assets | CRUD | active, inactive, calibrating, fault |

## Feature-Flag Controlled Event Emission

Entity handlers emit events conditionally based on feature flags. The `_helpers.ts` module provides non-blocking emission helpers:

```typescript
// src/lib/iiot/entity/_helpers.ts

export const maybeEmitAlarm = (
  flags: FeatureFlagsShape,
  eventType: string,
  payload: unknown
): Effect.Effect<void> => {
  if (!flags.alarmEventSourcingEnabled) {
    return Effect.void  // No-op when disabled
  }
  return Effect.logInfo(`[ES:Alarm] ${eventType}`, { payload }).pipe(
    Effect.catchAll((err) =>
      Effect.logWarning(`Event emission failed (non-blocking): ${String(err)}`)
    )
  )
}

// Generic version with explicit domain flag check
export const emitIfEnabled = (
  flags: FeatureFlagsShape,
  domain: 'WorkOrder' | 'Alarm' | 'EquipmentState',
  eventType: string,
  payload: unknown
): Effect.Effect<void> => { /* ... */ }

// Asset entities (no specific flag yet — always emit log)
export const maybeEmitAsset = (
  _flags: FeatureFlagsShape,
  entityType: string,
  eventType: string,
  payload: unknown
): Effect.Effect<void> => {
  return Effect.logInfo(`[ES:${entityType}] ${eventType}`, { payload }).pipe(
    Effect.catchAll((err) =>
      Effect.logWarning(`Event emission failed (non-blocking): ${String(err)}`)
    )
  )
}
```

Key design decisions:
- **Non-blocking**: Event emission failures never fail the parent operation
- **Feature-flag gated**: Each ES domain has its own toggle
- **Fire-and-forget**: `Effect.catchAll` swallows failures, logging only
- **Asset entities always emit**: No flag check for CRUD entities (log-only)

## RPC Group Derivation

Entity RPCs are exposed as RPC groups via `EntityProxy.toRpcGroup()`:

```typescript
// src/lib/iiot/rpc/SiteRpcs.ts

export class SiteEntityRpcs extends EntityProxy.toRpcGroup(SiteEntity) {}

export const SiteRpcs = RpcGroup.make(
  ...Array.from(SiteEntityRpcs.requests.values())
)
```

This generates for each entity RPC:
- `${entity.type}.${rpc._tag}` — standard call with entityId + payload
- `${entity.type}.${rpc._tag}Discard` — fire-and-forget variant

## Testing Entities

```typescript
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { IIoTTestLayer } from '../layers'

it.effect('creates a site through entity handler', () =>
  Effect.gen(function* () {
    // Use entity handlers directly via IIoTTestLayer
    const siteState = yield* SiteState
    const site = yield* siteState.create({
      slug: 'test-site',
      name: 'Test Site',
      enterpriseId: 'ENT-test' as EnterpriseId,
      timezone: 'UTC',
      status: Option.none(),
    })
    expect(site.id).toMatch(/^SIT-/)
    expect(site.status).toBe('planned')
  }).pipe(Effect.provide(IIoTTestLayer))
)
```

---

## Agent Quick Reference

### Key Imports

```typescript
import { Entity, EntityProxy } from '@effect/cluster'
import { Rpc, RpcGroup } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Schema, Effect, Layer } from 'effect'
```

### Minimal Example

```typescript
// 1. Define RPCs
const CreateTag = 'Site.Create' as const
class CreateSiteRpc extends Rpc.make(CreateTag, {
  payload: CreateSiteParams,
  primaryKey: ({ slug }) => slug,
  success: Site,
  error: RpcQueryError,
}) {}

// 2. Create Entity
const SiteEntity = Entity.make('Site', [CreateSiteRpc, GetSiteRpc])

// 3. Implement handlers
const SiteEntityHandlers = SiteEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* SiteState
    return SiteEntity.of({
      [CreateTag]: (req) => state.create(req.payload),
      // ... more handlers
    })
  })
)

// 4. Derive RPC group for HTTP/WS exposure
class SiteEntityRpcs extends EntityProxy.toRpcGroup(SiteEntity) {}
```

### Common Pitfalls

- Exposing Machine errors (`MachineInvalidTransitionError`) through RPC boundary -- always map to `RpcTransitionError` / `RpcNotFoundError`
- Forgetting `primaryKey` on Rpc.make -- required for entity instance routing
- Using `Entity.of()` without matching ALL RPC tags -- runtime error for unhandled RPCs
- Mixing up entity handlers with RPC group handlers -- entity handlers use `Entity.of()`, RPC server uses `RpcGroup.toLayer()`
- Not providing `SiteState` (or other ports) to `Entity.toLayer` -- missing service error at boot
- Creating entity instances inside handlers -- the entity IS the handler scope, state lives in injected ports

### Cross-References

- [schemas.md](./schemas.md) -- Schema.TaggedClass for entity types, Schema.TaggedError for RPC errors
- [repositories.md](./repositories.md) -- SQL persistence behind State service ports
- [event-sourcing.md](./event-sourcing.md) -- Feature-flag gated event emission in handlers
- [rpc-entity-workflow.md](./rpc-entity-workflow.md) -- Full RPC/Entity/Workflow API reference
- [effect-errors.md](./effect-errors.md) -- catchTags for Machine-to-RPC error mapping
```
