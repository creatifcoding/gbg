# Quickstart: Build Your First IIoT Entity

This guide walks through creating a complete IIoT entity in the v3 architecture — from schema to testable RPC handlers.

## Prerequisites

- Bun runtime installed
- Working knowledge of Effect-TS (Schema, Layer, Effect.gen)
- Familiarity with ISA-95 equipment hierarchy concepts

## Step 1: Define the Schema

Every entity starts with an Effect Schema. Create branded identifiers, status enum, and the entity class.

```typescript
// src/lib/iiot/schemas/assets/site/schema.ts

import { Schema } from 'effect'
import { BaseAssetFields } from '../common'
import { EnterpriseId } from '../enterprise/schema'
import { HierarchyPath } from '../../hierarchy'

// 1a. Branded identifier with prefix pattern
export const SiteId = Schema.String.pipe(
  Schema.pattern(/^SIT-[a-zA-Z0-9-]+$/),
  Schema.brand('SiteId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SiteId',
    description: 'Site identifier with SIT- prefix and slug',
  })
)
export type SiteId = typeof SiteId.Type

// 1b. Factory function
export const makeSiteId = (slug: string): SiteId => `SIT-${slug}` as SiteId

// 1c. Domain-specific status enum
export const SiteStatus = Schema.Literal(
  'planned',
  'under_construction',
  'operational',
  'seasonal_shutdown',
  'closed',
  'decommissioned'
)
export type SiteStatus = typeof SiteStatus.Type

// 1d. Entity class with TaggedClass
export class Site extends Schema.TaggedClass<Site>()('Site', {
  id: SiteId,
  ...BaseAssetFields,           // Spread shared fields
  status: SiteStatus,           // Override generic status
  enterpriseId: EnterpriseId,   // Required parent
  timezone: Schema.String,      // Site-specific
}) {
  // Instance methods
  isOperational(): boolean {
    return this.status === 'operational'
  }
}

// 1e. Command schemas
export const CreateSiteParams = Schema.Struct({
  slug: Schema.String.pipe(Schema.pattern(/^[a-zA-Z0-9-]+$/)),
  name: Schema.NonEmptyString,
  enterpriseId: EnterpriseId,
  timezone: Schema.String,
  status: Schema.optionalWith(SiteStatus, { as: 'Option' }),
})
export type CreateSiteParams = Schema.Schema.Type<typeof CreateSiteParams>
```

## Step 2: Define the State Service

The state service is a hexagonal port — an interface with swappable implementations.

```typescript
// src/lib/iiot/state/SiteState.ts

import { Effect, Context, Layer, Option, Ref } from 'effect'
import { Site, CreateSiteParams, SiteId } from '../schemas'

// 2a. Error type
export class SiteStateNotFoundError {
  readonly _tag = 'SiteStateNotFoundError'
  constructor(readonly siteId: SiteId) {}
}

// 2b. Service shape (contract)
export interface SiteStateShape {
  readonly create: (params: CreateSiteParams) => Effect.Effect<Site>
  readonly get: (id: SiteId) => Effect.Effect<Site, SiteStateNotFoundError>
  readonly set: (site: Site) => Effect.Effect<void>
  readonly list: (filter: SiteFilter) => Effect.Effect<readonly Site[]>
  readonly delete: (id: SiteId) => Effect.Effect<boolean>
}

// 2c. Context tag
export class SiteState extends Context.Tag('iiot/SiteState')<
  SiteState,
  SiteStateShape
>() {}

// 2d. In-memory implementation (for testing)
export const SiteStateInMemory: Layer.Layer<SiteState> = Layer.effect(
  SiteState,
  Ref.make(new Map<SiteId, Site>()).pipe(
    Effect.map((store) => ({
      create: (params) => Effect.gen(function* () {
        const id = makeSiteId(`gen-${Date.now()}`)
        const site = new Site({ id, name: params.name, /* ... */ })
        yield* Ref.update(store, (m) => new Map(m).set(id, site))
        return site
      }),
      get: (id) => Ref.get(store).pipe(
        Effect.flatMap((m) =>
          m.has(id)
            ? Effect.succeed(m.get(id)!)
            : Effect.fail(new SiteStateNotFoundError(id))
        )
      ),
      // ... set, list, delete
    }))
  )
)
```

## Step 3: Define the Entity

The entity groups RPC definitions and creates a distributed actor.

```typescript
// src/lib/iiot/entity/SiteEntity.ts

import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'

// 3a. RPC error schemas
export class RpcNotFoundError extends Schema.TaggedError<RpcNotFoundError>()(
  'RpcSiteNotFoundError',
  { siteId: SiteId }
) {}

// 3b. RPC definitions
export class CreateSiteRpc extends Rpc.make('Site.Create', {
  payload: CreateSiteParams,
  primaryKey: ({ slug }) => slug,
  success: Site,
  error: RpcQueryError,
}) {}

export class GetSiteRpc extends Rpc.make('Site.Get', {
  payload: Schema.Struct({ siteId: SiteId }),
  primaryKey: ({ siteId }) => siteId,
  success: Site,
  error: RpcNotFoundError,
}) {}

// 3c. Entity definition
export const SiteEntity = Entity.make('Site', [
  CreateSiteRpc,
  GetSiteRpc,
  // ... more RPCs
])

// 3d. Handler layer (delegates to Machine)
export const SiteEntityHandlers = SiteEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* SiteState
    const flags = yield* IIoTFeatureFlags

    const siteMachine = makeSiteMachine({ state, flags })
    const actor = yield* Machine.boot(siteMachine)

    return SiteEntity.of({
      'Site.Create': (envelope) =>
        actor.send(new InternalCreateSite({ params: envelope.payload })).pipe(
          Effect.catchTag('MachineCreateError', (e) =>
            Effect.fail(new RpcQueryError({ operation: 'create', message: e.message }))
          )
        ),
      'Site.Get': (envelope) =>
        actor.send(new InternalGetSite({ siteId: envelope.payload.siteId })).pipe(
          Effect.catchTag('MachineEntityNotFoundError', (e) =>
            Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId }))
          )
        ),
    })
  })
)
```

## Step 4: Compose the Layer Stack

```typescript
// src/lib/iiot/entity/EntityStack.ts

// Add to the EntityHandlersLayer
export const EntityHandlersLayer = Layer.mergeAll(
  AlarmEntityHandlers,
  SiteEntityHandlers,  // <-- your new entity
  // ... others
)

// Testing stack (self-contained)
export const EntityTestingStack = EntityHandlersLayer.pipe(
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
)
```

## Step 5: Write Tests

```typescript
// src/lib/iiot/__tests__/site-entity.test.ts

import { describe, it, expect } from 'vitest'
import { Effect, Option } from 'effect'
import { SiteState } from '../state'
import { IIoTTestLayer } from '../layers'

describe('SiteEntity', () => {
  it('creates a site in planned state', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* SiteState
        const site = yield* state.create({
          slug: 'test-site',
          name: 'Test Site',
          enterpriseId: 'ENT-test' as any,
          timezone: 'UTC',
          status: Option.none(),
        })
        expect(site.id).toMatch(/^SIT-/)
        expect(site.status).toBe('planned')
        expect(site.name).toBe('Test Site')
        return site
      }).pipe(Effect.provide(IIoTTestLayer))
    )
  })
})
```

Run tests:

```bash
bun test src/lib/iiot/__tests__/site-entity.test.ts
```

## Step 6: Expose via RPC Group

```typescript
// src/lib/iiot/rpc/SiteRpcs.ts

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { SiteEntity } from '../entity/SiteEntity'

export class SiteEntityRpcs extends EntityProxy.toRpcGroup(SiteEntity) {}

export const SiteRpcs = RpcGroup.make(
  ...Array.from(SiteEntityRpcs.requests.values())
)
```

## Architecture Recap

The lifecycle of a new entity:

```
Schema (source of truth)
  -> State Service (hexagonal port, in-memory + SQL)
  -> Machine (state graph validation)
  -> Entity (distributed actor, RPC routing)
  -> Entity Handler Layer (Machine boot + delegation)
  -> EntityStack (composed testing/production stacks)
  -> RPC Group (EntityProxy.toRpcGroup)
  -> HTTP / WebSocket transport
```

## Next Steps

- Add SQL persistence: Create a Model, Repository, and SQL state layer adapter
- Add a state transition graph: Define ISA-95 compliant transitions in a Machine
- Add event sourcing: Use feature flags and `maybeEmitAsset()` helpers
- Expose via HTTP: Add fermion HTTP API handlers
- Add realtime: Create streaming RPCs for WebSocket distribution
