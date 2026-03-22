# AMS v2 Entity Pattern Research

**Date:** 2026-01-25  
**Status:** Complete  
**Purpose:** Document AMS v2 entity architecture to inform v3 design

---

## Executive Summary

AMS v2 uses Effect Cluster's Entity system with a clean CQRS architecture. The pattern separates concerns into:

1. **Entities** — RPC definitions (commands + queries) via `Rpc.make()`
2. **Commands** — Write operations via `Schema.TaggedRequest`
3. **Queries** — Read operations via `Schema.TaggedRequest`
4. **Handlers** — Entity behavior via `Entity.toLayer()`
5. **Services** — State management with swappable implementations
6. **Events** — Domain events via `EventGroup` for event sourcing

**Key insight:** The entity file (`entities/asset.ts`) consolidates ALL RPCs (command + query), making `commands/` and `queries/` files redundant except for error schemas and types.

---

## 1. Entity Definition Pattern

### File Location
```
src/lib/ams/v2/base/entities/asset.ts
```

### Structure

Entities are defined using `@effect/cluster`'s `Entity.make()`:

```typescript
export const AssetEntity = Entity.make('Asset', [
  // Command RPCs (8 total)
  CreateAssetRpc,
  UpdateAssetRpc,
  MoveAssetRpc,
  SetAssetPropertyRpc,
  RemoveAssetPropertyRpc,
  AddAssetTraitRpc,
  RemoveAssetTraitRpc,
  DeleteAssetRpc,
  
  // Query RPCs (13 total)
  GetAssetRpc,
  GetAssetSummaryRpc,
  AssetExistsRpc,
  ListAssetsBySiteRpc,
  ListAssetsBySectorRpc,
  ListAssetsByContainerRpc,
  SearchAssetsRpc,
  GetAssetPropertyRpc,
  GetAssetPropertiesRpc,
  CountAssetsBySiteRpc,
  CountAssetsByStatusRpc,
  CountAssetsByKindRpc,
])
```

### RPC Definition Pattern

All RPCs use `Rpc.make()` from `@effect/rpc`:

```typescript
export class CreateAssetRpc extends Rpc.make('CreateAsset', {
  payload: {
    siteId: SiteId,
    kind: AssetKind,
    label: AssetLabel,
    description: Schema.optional(AssetDescription),
    status: Schema.optional(AssetStatus),
    sectorId: Schema.optional(SectorId),
    containerId: Schema.optional(ContainerId),
    baseProperties: Schema.optional(BaseAssetProperties),
    tags: Schema.optional(Tags),
    createdBy: IdentityId,
  },
  success: Asset,
  error: AssetCommandError,
}) {}
```

**Key characteristics:**
- String identifier (first arg) matches class name without "Rpc" suffix
- `payload` — Effect Schema defining input parameters
- `success` — Effect Schema for success response
- `error` — Effect Schema union for all possible errors

---

## 2. Command Pattern

### File Location
```
src/lib/ams/v2/base/commands/asset.ts
```

### Purpose

Commands define **write operations** using `Schema.TaggedRequest`. However, **this pattern is redundant** with the RPC definitions in the entity file.

### Structure

```typescript
export class CreateAsset extends Schema.TaggedRequest<CreateAsset>()(
  'CreateAsset',
  {
    failure: AssetCommandError,
    success: Asset,
    payload: {
      siteId: SiteId,
      kind: AssetKind,
      label: AssetLabel,
      description: Schema.optional(AssetDescription),
      status: Schema.optional(AssetStatus),
      // ... (identical to RPC payload)
      createdBy: IdentityId,
    },
  }
) {}
```

**Key characteristics:**
- `Schema.TaggedRequest<T>()()` — double-call pattern for self-referencing generic
- `_tag` field auto-generated from string identifier (first arg)
- Identical structure to RPC definitions
- **Used by:** EventLog handlers (pattern matching), but NOT by entity handlers

### Error Schemas

Commands file defines error unions:

```typescript
export class AssetNotFoundError extends Schema.TaggedClass<AssetNotFoundError>()(
  'AssetNotFoundError',
  {
    assetId: AssetId,
    message: Schema.optional(Schema.String),
  }
) {}

export const AssetCommandError = Schema.Union(
  AssetNotFoundError,
  AssetValidationError,
  AssetConflictError,
  AssetPermissionError
)
```

**Error types:**
- `AssetNotFoundError` — Asset doesn't exist
- `AssetValidationError` — Field validation failure
- `AssetConflictError` — Concurrent modification (version mismatch)
- `AssetPermissionError` — Authorization failure

---

## 3. Query Pattern

### File Location
```
src/lib/ams/v2/base/queries/asset.ts
```

### Purpose

Queries define **read operations** using `Schema.TaggedRequest`. Like commands, **this is redundant** with RPC definitions.

### Structure

```typescript
export class GetAsset extends Schema.TaggedRequest<GetAsset>()('GetAsset', {
  failure: AssetNotFoundError,
  success: Asset,
  payload: {
    assetId: AssetId,
  },
}) {}
```

**Key characteristics:**
- Identical pattern to commands
- No side effects (read-only)
- Error type is `AssetNotFoundError` (not `AssetCommandError`)

### Pagination Support

Queries include pagination schemas:

```typescript
export class PaginationInput extends Schema.TaggedClass<PaginationInput>()(
  'PaginationInput',
  {
    limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
    cursor: Schema.optional(Schema.String),
    sortBy: Schema.optional(Schema.String),
    sortDirection: Schema.optional(Schema.Literal('asc', 'desc')),
  }
) {}

export class PageInfo extends Schema.TaggedClass<PageInfo>()('PageInfo', {
  nextCursor: Schema.NullOr(Schema.String),
  hasNextPage: Schema.Boolean,
  totalCount: Schema.optional(Schema.Number),
}) {}

export const PaginatedAssets = Schema.Struct({
  _tag: Schema.Literal('PaginatedAssets'),
  items: Schema.Array(AssetSummary),
  pageInfo: PageInfo,
})
```

**Pagination pattern:**
- Cursor-based (opaque string cursors, typically offset integers)
- Returns `PageInfo` with `nextCursor` and `hasNextPage`
- Optional `totalCount` (expensive for large datasets)

---

## 4. Handler Pattern

### File Location
```
src/lib/ams/v2/base/handlers/asset.ts
```

### Purpose

Handlers implement **entity behavior** by mapping RPCs to service calls and emitting events.

### Structure

Handlers use `Entity.toLayer()` to create an Effect Layer:

```typescript
export const AssetEntityHandlers = AssetEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* AssetState
    const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
    const writeEvent = Option.isSome(eventLogOption)
      ? yield* EventLog.makeClient(AmsEventLogSchema)
      : null

    return {
      CreateAsset: (envelope) =>
        Effect.gen(function* () {
          const asset = yield* state.create({
            siteId: envelope.payload.siteId,
            kind: envelope.payload.kind,
            // ...
          })

          yield* maybeEmit('AssetCreated', new AssetCreatedPayload({ ... }))

          return asset
        }),

      GetAsset: (envelope) => state.findById(envelope.payload.assetId),

      // ... (handlers for all RPCs)
    }
  }),
  { defectRetryPolicy: Schedule.exponential('100 millis', 2).pipe(Schedule.upTo('10 seconds')) }
)
```

**Key characteristics:**
- **Dependency injection** — `AssetState` service injected via `yield*`
- **Optional EventLog** — `Effect.serviceOption()` allows handlers to work with/without events
- **Command handlers** — Call service + emit events
- **Query handlers** — Direct service delegation (no events)
- **Retry policy** — Exponential backoff for defects (100ms → 200ms → ... up to 10s)

### Event Emission Pattern

```typescript
const maybeEmit = <T>(
  tag: Parameters<NonNullable<typeof writeEvent>>[0],
  payload: Parameters<NonNullable<typeof writeEvent>>[1]
) =>
  writeEvent
    ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void))
    : Effect.void
```

**Characteristics:**
- Non-blocking — Events swallowed on failure
- Optional — If EventLog not provided, no-op
- Client via `EventLog.makeClient(AmsEventLogSchema)`

---

## 5. Service Pattern (AssetState)

### File Locations
```
src/lib/ams/v2/base/services/asset-state.ts         # Default (in-memory)
src/lib/ams/v2/base/services/asset-state-shape.ts   # Interface
src/lib/ams/v2/base/services/asset-state-sql.ts     # SQL implementation
```

### Service Declaration

```typescript
export class AssetState extends Effect.Service<AssetState>()('@gbg/tmnl/ams/v2/AssetState', {
  effect: Effect.gen(function* () {
    const assets = yield* Ref.make(HashMap.empty<AssetId, AssetRecord>())
    const properties = yield* Ref.make(HashMap.empty<string, AssetProperty>())
    const traits = yield* Ref.make(HashMap.empty<string, TraitInstance>())

    return {
      // Commands (8)
      create,
      update,
      move,
      setProperty,
      removeProperty,
      addTrait,
      removeTrait,
      delete: deleteAsset,

      // Queries (11)
      findById,
      findSummaryById,
      exists,
      listBySite,
      listBySector,
      listByContainer,
      search,
      getProperty,
      getProperties,
      countBySite,
      countByStatus,
      countByKind,
    } as const
  }),
}) {}
```

**Key characteristics:**
- `Effect.Service<T>()()` — self-referencing service
- String identifier for DI: `@gbg/tmnl/ams/v2/AssetState`
- `effect` field defines service lifecycle
- Returns frozen object (`as const`)

### State Management

**In-memory implementation:**

```typescript
interface AssetRecord {
  asset: Asset
  version: number
}

const assets = yield* Ref.make(HashMap.empty<AssetId, AssetRecord>())
const properties = yield* Ref.make(HashMap.empty<string, AssetProperty>())
const traits = yield* Ref.make(HashMap.empty<string, TraitInstance>())
```

**Characteristics:**
- `Ref` for atomic updates
- `HashMap` for efficient lookup
- Composite keys for properties/traits: `${assetId}:${key}`
- Version tracking for optimistic concurrency

### Command Implementation Example

```typescript
const update = (params: {
  assetId: AssetId
  label?: AssetLabel
  description?: AssetDescription
  status?: AssetStatus
  tags?: Tags
  expectedVersion?: number
  updatedBy: IdentityId
}): Effect.Effect<Asset, AssetNotFoundError | AssetConflictError> =>
  Effect.gen(function* () {
    const current = yield* Ref.get(assets)
    const record = HashMap.get(current, params.assetId)

    if (Option.isNone(record)) {
      return yield* Effect.fail(
        new AssetNotFoundError({
          assetId: params.assetId,
          message: `Asset ${params.assetId} not found`,
        })
      )
    }

    const { asset, version } = record.value

    if (params.expectedVersion !== undefined && version !== params.expectedVersion) {
      return yield* Effect.fail(
        new AssetConflictError({
          assetId: params.assetId,
          reason: `Version mismatch: expected ${params.expectedVersion}, got ${version}`,
          expectedVersion: params.expectedVersion,
          actualVersion: version,
        })
      )
    }

    const updated = new Asset({
      ...asset,
      label: params.label ?? asset.label,
      description: params.description ?? asset.description,
      status: params.status ?? asset.status,
      tags: params.tags ?? asset.tags,
      updatedAt: now() as UpdatedAt,
    })

    yield* Ref.update(assets, HashMap.set(params.assetId, { asset: updated, version: version + 1 }))

    return updated
  })
```

**Characteristics:**
- Optimistic concurrency via `expectedVersion`
- Returns full `Asset` entity
- Immutable updates (new `Asset` instance)
- Version increment on success

### Query Implementation Example

```typescript
const listBySite = (params: {
  siteId: SiteId
  limit?: number
  cursor?: string
}): Effect.Effect<typeof PaginatedAssets.Type> =>
  Effect.gen(function* () {
    const current = yield* Ref.get(assets)
    const all = HashMap.values(current)
    const filtered = Array.from(all)
      .filter((r) => r.asset.siteId === params.siteId)
      .map((r) => r.asset)

    const limit = params.limit ?? 50
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0
    const sliced = filtered.slice(offset, offset + limit + 1)
    const hasNextPage = sliced.length > limit
    const items = hasNextPage ? sliced.slice(0, limit) : sliced

    const summaries = items.map(
      (a) =>
        new AssetSummary({
          id: a.id,
          kind: a.kind,
          label: a.label,
          status: a.status,
          siteId: a.siteId,
          sectorId: a.sectorId,
        })
    )

    return {
      _tag: 'PaginatedAssets' as const,
      items: summaries,
      pageInfo: {
        _tag: 'PageInfo' as const,
        nextCursor: hasNextPage ? String(offset + limit) : null,
        hasNextPage,
        totalCount: filtered.length,
      },
    }
  })
```

**Characteristics:**
- Cursor = offset integer (stringified)
- Fetch `limit + 1` to detect next page
- Return lightweight `AssetSummary` (not full `Asset`)
- Include `totalCount` (feasible for in-memory)

---

## 6. Event Pattern

### File Locations
```
src/lib/ams/v2/base/events/asset.ts    # Event payloads + EventGroup
src/lib/ams/v2/base/events/schema.ts   # EventLog schema
```

### Event Payload Structure

Events use `Schema.Class`:

```typescript
export class AssetCreatedPayload extends Schema.Class<AssetCreatedPayload>(
  'AssetCreatedPayload'
)({
  assetId: AssetId,
  siteId: SiteId,
  sectorId: Schema.optional(SectorId),
  containerId: Schema.optional(ContainerId),
  kind: AssetKind,
  label: AssetLabel,
  description: Schema.optional(AssetDescription),
  status: AssetStatus,
  tags: Schema.optional(Tags),
  createdBy: IdentityId,
  createdAt: CreatedAt,
}) {}
```

**Characteristics:**
- `Schema.Class` (not `TaggedClass`) — no `_tag` field
- Includes identity fields (`createdBy`, `createdAt`)
- Includes all relevant entity data for event replay

### EventGroup Definition

```typescript
export const AssetEvents = EventGroup.empty
  .add({
    tag: 'AssetCreated',
    payload: AssetCreatedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  .add({
    tag: 'AssetUpdated',
    payload: AssetUpdatedPayload,
    primaryKey: (payload) => payload.assetId,
  })
  // ... (8 events total)
```

**Characteristics:**
- `EventGroup.empty.add()` — builder pattern
- Each event has:
  - `tag` — Event type discriminator
  - `payload` — Schema for event data
  - `primaryKey` — Function to extract aggregate ID

### EventLog Schema

```typescript
export const AmsEventLogSchema = EventLog.schema(AssetEvents)
```

**Usage:**
- Consumed by `EventLog.makeClient(AmsEventLogSchema)` in handlers
- Enables event emission: `writeEvent('AssetCreated', payload)`
- Type-safe event matching in processors

---

## 7. Key Types and Schemas

### Identifiers (Branded Types)

All identifiers use `Schema.String.pipe(Schema.brand(...))`:

```typescript
export const AssetId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Asset/fields/AssetId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetId',
    description: 'Unique identifier for an Asset (DID or UUID)',
  })
)
```

**Branding pattern:**
- Brand path: `@gbg/tmnl/ams/v2/{Entity}/fields/{Field}`
- Annotation identifier: `@gbg/tmnl/ams/v2/{Field}`
- Prevents accidental mixing (e.g., `AssetId` ≠ `SiteId`)

**Full identifier set:**
```typescript
AssetId, AssetKind, AssetLabel, AssetDescription
SiteId, SectorId, ContainerId, CarrierId
PolicyId, PropertyKey, TraitId
IdentityId
AssetTypeId, ContainerTypeId, SectorTypeId
Tag
```

### Domain Entities (TaggedClass)

```typescript
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  bfoClass: BfoMaterialEntity,
  kind: AssetKind,
  label: AssetLabel,
  description: Schema.optional(AssetDescription),
  status: AssetStatus,
  location: AssetLocation,
  baseProperties: BaseAssetProperties,
  properties: AssetProperties,
  traits: AssetTraits,
  tags: Tags,
  policyIds: Schema.optional(PolicyIds),
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {
  isOperational(): boolean {
    return this.status !== 'maintenance' && this.status !== 'retired'
  }

  get siteId(): SiteId {
    return this.location.siteId
  }
}
```

**Characteristics:**
- `Schema.TaggedClass<T>()()` — self-referencing generic
- Auto-generated `_tag` field from string identifier
- Methods allowed (unlike `Schema.Struct`)
- Getters for derived fields

### Lightweight Projections

```typescript
export class AssetSummary extends Schema.TaggedClass<AssetSummary>()('AssetSummary', {
  id: AssetId,
  kind: AssetKind,
  label: AssetLabel,
  status: AssetStatus,
  siteId: SiteId,
  sectorId: Schema.optional(SectorId),
}) {}
```

**Usage:**
- Returned by list/search queries
- Avoids serializing full entity (properties, traits, etc.)
- Reduces payload size for pagination

### Property System

```typescript
export const PropertyValue = Schema.Unknown.pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Property/fields/PropertyValue'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/PropertyValue',
    description: 'Raw property value (validated via property definition)',
  })
)

export class AssetProperty extends Schema.TaggedClass<AssetProperty>()('AssetProperty', {
  key: PropertyKey,
  value: PropertyValue,
  provenance: Provenance,
  mutable: PropertyMutable,
}) {}
```

**Characteristics:**
- `PropertyValue` is `Schema.Unknown` — validated externally via registry
- Provenance tracking for audit trail
- Mutability flag for policy enforcement

### Provenance Tracking

```typescript
export class Provenance extends Schema.TaggedClass<Provenance>()('Provenance', {
  sourceType: SourceType,
  sourceId: Schema.optional(IdentityId),
  timestamp: CreatedAt,
  confidence: Schema.optional(Confidence),
  attestationRef: Schema.optional(AttestationRef),
}) {
  isHighConfidence(): boolean {
    return this.confidence !== undefined && this.confidence >= 0.8
  }

  isAttested(): boolean {
    return this.attestationRef !== undefined
  }
}
```

**Source types:**
```typescript
export const SourceType = Schema.Literal(
  'manual',
  'sensor',
  'ingestion_agent',
  'external_system'
)
```

**Characteristics:**
- Confidence score: 0..1 (high confidence >= 0.8)
- Optional on-chain attestation reference (Sui object ID)
- Identity tracking via `sourceId`

---

## 8. Code Examples from Implementation

### Creating an Asset

**RPC Definition:**
```typescript
export class CreateAssetRpc extends Rpc.make('CreateAsset', {
  payload: {
    siteId: SiteId,
    kind: AssetKind,
    label: AssetLabel,
    description: Schema.optional(AssetDescription),
    status: Schema.optional(AssetStatus),
    sectorId: Schema.optional(SectorId),
    containerId: Schema.optional(ContainerId),
    baseProperties: Schema.optional(BaseAssetProperties),
    tags: Schema.optional(Tags),
    createdBy: IdentityId,
  },
  success: Asset,
  error: AssetCommandError,
}) {}
```

**Handler Implementation:**
```typescript
CreateAsset: (envelope) =>
  Effect.gen(function* () {
    const asset = yield* state.create({
      siteId: envelope.payload.siteId,
      kind: envelope.payload.kind,
      label: envelope.payload.label,
      description: envelope.payload.description,
      status: envelope.payload.status,
      sectorId: envelope.payload.sectorId,
      containerId: envelope.payload.containerId,
      baseProperties: envelope.payload.baseProperties,
      tags: envelope.payload.tags,
      createdBy: envelope.payload.createdBy,
    })

    yield* maybeEmit(
      'AssetCreated',
      new AssetCreatedPayload({
        assetId: asset.id,
        siteId: asset.siteId,
        sectorId: asset.sectorId,
        containerId: asset.containerId,
        kind: asset.kind,
        label: asset.label,
        description: asset.description,
        status: asset.status,
        tags: asset.tags,
        createdBy: envelope.payload.createdBy,
        createdAt: asset.createdAt,
      })
    )

    return asset
  }),
```

**Service Implementation:**
```typescript
const create = (params: {
  siteId: SiteId
  kind: AssetKind
  label: AssetLabel
  description?: AssetDescription
  status?: AssetStatus
  sectorId?: SectorId
  containerId?: ContainerId
  baseProperties?: BaseAssetProperties
  tags?: Tags
  createdBy: IdentityId
}): Effect.Effect<Asset, AssetValidationError> =>
  Effect.gen(function* () {
    const id = generateId()
    const timestamp = now()

    const asset = new Asset({
      id,
      bfoClass: 'material_entity' as BfoMaterialEntity,
      kind: params.kind,
      label: params.label,
      description: params.description,
      status: params.status ?? ('available' as AssetStatus),
      location: new AssetLocation({
        siteId: params.siteId,
        sectorId: params.sectorId,
        containerId: params.containerId,
      }),
      baseProperties:
        params.baseProperties ?? new BaseAssetProperties({ quantity: 1 }),
      properties: [] as unknown as AssetProperties,
      traits: [] as unknown as AssetTraits,
      tags: params.tags ?? ([] as unknown as Tags),
      createdAt: timestamp as CreatedAt,
      updatedAt: timestamp as UpdatedAt,
    })

    yield* Ref.update(assets, HashMap.set(id, { asset, version: 1 }))

    return asset
  })
```

### Updating Asset Properties

**RPC Definition:**
```typescript
export class SetAssetPropertyRpc extends Rpc.make('SetAssetProperty', {
  payload: {
    assetId: AssetId,
    key: PropertyKey,
    value: PropertyValue,
    provenance: Provenance,
    changedBy: IdentityId,
  },
  success: Schema.Void,
  error: AssetCommandError,
}) {}
```

**Handler Implementation:**
```typescript
SetAssetProperty: (envelope) =>
  Effect.gen(function* () {
    const prevValue = yield* state
      .getProperty({
        assetId: envelope.payload.assetId,
        key: envelope.payload.key,
      })
      .pipe(Effect.option)

    const result = yield* state.setProperty({
      assetId: envelope.payload.assetId,
      key: envelope.payload.key,
      value: envelope.payload.value,
      provenance: envelope.payload.provenance,
      changedBy: envelope.payload.changedBy,
    })

    yield* maybeEmit(
      'PropertyChanged',
      new PropertyChangedPayload({
        assetId: envelope.payload.assetId,
        key: envelope.payload.key,
        previousValue: Option.isSome(prevValue) ? prevValue.value.value : null,
        newValue: envelope.payload.value,
        provenance: envelope.payload.provenance,
        changedBy: envelope.payload.changedBy,
        changedAt: DateTime.unsafeNow() as CreatedAt,
      })
    )

    return result
  }),
```

**Service Implementation:**
```typescript
const setProperty = (params: {
  assetId: AssetId
  key: PropertyKey
  value: PropertyValue
  provenance: Provenance
  changedBy: IdentityId
}): Effect.Effect<void, AssetNotFoundError> =>
  Effect.gen(function* () {
    const current = yield* Ref.get(assets)
    const record = HashMap.get(current, params.assetId)

    if (Option.isNone(record)) {
      return yield* Effect.fail(
        new AssetNotFoundError({
          assetId: params.assetId,
          message: `Asset ${params.assetId} not found`,
        })
      )
    }

    const prop = new AssetProperty({
      key: params.key,
      value: params.value,
      provenance: params.provenance,
      mutable: true as PropertyMutable,
    })

    const propKey = `${params.assetId}:${params.key}`
    yield* Ref.update(properties, HashMap.set(propKey, prop))
  })
```

### Searching Assets

**RPC Definition:**
```typescript
export class SearchAssetsRpc extends Rpc.make('SearchAssets', {
  payload: {
    query: Schema.optional(Schema.String),
    siteId: Schema.optional(SiteId),
    sectorId: Schema.optional(SectorId),
    containerId: Schema.optional(ContainerId),
    kind: Schema.optional(AssetKind),
    status: Schema.optional(AssetStatus),
    tags: Schema.optional(Tags),
    limit: Schema.optional(Schema.Number),
    cursor: Schema.optional(Schema.String),
  },
  success: PaginatedAssets,
  error: Schema.Never,
}) {}
```

**Handler Implementation:**
```typescript
SearchAssets: (envelope) =>
  state.search({
    query: envelope.payload.query,
    siteId: envelope.payload.siteId,
    sectorId: envelope.payload.sectorId,
    containerId: envelope.payload.containerId,
    kind: envelope.payload.kind,
    status: envelope.payload.status,
    tags: envelope.payload.tags,
    limit: envelope.payload.limit,
    cursor: envelope.payload.cursor,
  }),
```

**Service Implementation:**
```typescript
const search = (params: {
  query?: string
  siteId?: SiteId
  sectorId?: SectorId
  containerId?: ContainerId
  kind?: AssetKind
  status?: AssetStatus
  tags?: Tags
  limit?: number
  cursor?: string
}): Effect.Effect<typeof PaginatedAssets.Type> =>
  Effect.gen(function* () {
    const current = yield* Ref.get(assets)
    const all = HashMap.values(current)
    let filtered = Array.from(all).map((r) => r.asset)

    if (params.siteId) filtered = filtered.filter((a) => a.siteId === params.siteId)
    if (params.sectorId) filtered = filtered.filter((a) => a.sectorId === params.sectorId)
    if (params.containerId) filtered = filtered.filter((a) => a.containerId === params.containerId)
    if (params.kind) filtered = filtered.filter((a) => a.kind === params.kind)
    if (params.status) filtered = filtered.filter((a) => a.status === params.status)
    if (params.query) {
      const q = params.query.toLowerCase()
      filtered = filtered.filter(
        (a) =>
          a.label.toLowerCase().includes(q) ||
          (a.description?.toLowerCase().includes(q) ?? false)
      )
    }

    const limit = params.limit ?? 50
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0
    const sliced = filtered.slice(offset, offset + limit + 1)
    const hasNextPage = sliced.length > limit
    const items = hasNextPage ? sliced.slice(0, limit) : sliced

    const summaries = items.map(
      (a) =>
        new AssetSummary({
          id: a.id,
          kind: a.kind,
          label: a.label,
          status: a.status,
          siteId: a.siteId,
          sectorId: a.sectorId,
        })
    )

    return {
      _tag: 'PaginatedAssets' as const,
      items: summaries,
      pageInfo: {
        _tag: 'PageInfo' as const,
        nextCursor: hasNextPage ? String(offset + limit) : null,
        hasNextPage,
        totalCount: filtered.length,
      },
    }
  })
```

---

## 9. Architecture Insights for v3

### Redundancy: Commands/Queries vs Entity RPCs

**Current state (v2):**
- `entities/asset.ts` defines ALL RPCs (21 total)
- `commands/asset.ts` duplicates 8 command RPCs as `TaggedRequest`
- `queries/asset.ts` duplicates 13 query RPCs as `TaggedRequest`

**Redundancy analysis:**
- Entity handlers consume **RPC envelopes**, not `TaggedRequest` instances
- Commands/queries files only used for:
  1. Error schema exports (imported by entities)
  2. Union types for pattern matching
  3. (Unused) EventLog processors that pattern-match on `_tag`

**TODO comment in entity file (line 47):**
```typescript
// TODO: From what I can tell, this makes commands/ redundant. From commands,
// we only import the errors. I am thinking we can access the properties from
// the commands, e.g. payload of Rpc can be payload of the corresponding
// TaggedRequest. Make sure the strings we use are strongly typed.
// Schema.Literal backed enums, consult with your sources.
```

**v3 recommendation:**
1. **Consolidate RPC definitions in entity file** — Single source of truth
2. **Extract error schemas to separate file** — `errors/asset.ts`
3. **Remove commands/queries files** — Unless EventLog processors need them
4. **Use Schema.Literal for string literals** — Type-safe tag values

### Service Swappability

**Current pattern works well:**
- `AssetState` service with `Default` (in-memory) and `SQL` implementations
- Handlers inject via `yield* AssetState`
- Test layer: `Layer.provide(AssetState.Default)`
- Prod layer: `Layer.provide(AssetState.SQL)`

**v3 recommendation:**
- Keep this pattern
- Add interface file (`asset-state-shape.ts`) to enforce contract
- Consider code generation for service boilerplate

### Event Sourcing Integration

**Current pattern:**
- EventLog is **optional** — handlers work with/without it
- Events swallowed on failure (non-blocking)
- Separate EventLog processors for event handling

**v3 considerations:**
- Should events be mandatory?
- Dual-write problem: state + events (not transactional)
- Consider event-first architecture (EventLog as source of truth)

### Pagination

**Current pattern:**
- Cursor-based (offset integers, stringified)
- `limit + 1` fetch to detect next page
- Optional `totalCount` (expensive for SQL)

**v3 improvements:**
- True opaque cursors (e.g., base64-encoded offset+filter hash)
- Avoid `totalCount` by default (pagination should be lazy)
- Consider relay-style pagination (edges + nodes)

### Type Safety

**Strengths:**
- Branded identifiers prevent mixing
- Schema validation at runtime
- Effect error channels (no thrown exceptions)

**v3 improvements:**
- Auto-generate branded types from schema
- Enforce schema annotations (identifier, description)
- Consider Schema.brand for all domain types (not just IDs)

---

## 10. File Structure Summary

```
src/lib/ams/v2/base/
├── entities/
│   ├── asset.ts          # Entity + all RPCs (21 total)
│   └── index.ts          # Re-exports
├── commands/
│   └── asset.ts          # 8 command TaggedRequests + errors (REDUNDANT)
├── queries/
│   └── asset.ts          # 13 query TaggedRequests + pagination (REDUNDANT)
├── handlers/
│   ├── asset.ts          # Entity handlers (RPC → service + events)
│   ├── event-handlers.ts # EventLog processors
│   └── index.ts          # Re-exports
├── services/
│   ├── asset-state.ts         # In-memory implementation
│   ├── asset-state-shape.ts   # Interface
│   ├── asset-state-sql.ts     # SQL implementation
│   └── index.ts               # Re-exports
├── events/
│   ├── asset.ts          # 8 event payloads + EventGroup
│   ├── schema.ts         # AmsEventLogSchema
│   └── index.ts          # Re-exports
└── schemas/
    ├── asset.ts          # Asset, AssetSummary, AssetStatus
    ├── property.ts       # AssetProperty, PropertyValue
    ├── location.ts       # AssetLocation
    └── trait.ts          # AssetTraits, TraitInstance
```

**Line counts:**
- `entities/asset.ts`: 351 lines
- `commands/asset.ts`: 320 lines (REDUNDANT)
- `queries/asset.ts`: 385 lines (REDUNDANT)
- `handlers/asset.ts`: 391 lines
- `services/asset-state.ts`: 659 lines
- `events/asset.ts`: 276 lines

**Total redundancy:** ~705 lines (commands + queries could be eliminated)

---

## 11. Pattern Catalog

### Pattern: Effect Service with DI

```typescript
export class ServiceName extends Effect.Service<ServiceName>()('identifier', {
  effect: Effect.gen(function* () {
    const dependency = yield* Dependency
    
    return {
      method1: (params) => Effect.gen(function* () { /* ... */ }),
      method2: (params) => Effect.gen(function* () { /* ... */ }),
    } as const
  }),
}) {}
```

### Pattern: Entity Definition

```typescript
export const EntityName = Entity.make('EntityName', [
  CommandRpc1,
  CommandRpc2,
  QueryRpc1,
  QueryRpc2,
])
```

### Pattern: RPC Definition

```typescript
export class OperationRpc extends Rpc.make('Operation', {
  payload: { /* Effect Schemas */ },
  success: SuccessSchema,
  error: ErrorSchema,
}) {}
```

### Pattern: Entity Handlers

```typescript
export const EntityHandlers = EntityName.toLayer(
  Effect.gen(function* () {
    const service = yield* Service
    
    return {
      OperationRpc: (envelope) =>
        Effect.gen(function* () {
          const result = yield* service.operation(envelope.payload)
          return result
        }),
    }
  }),
  { defectRetryPolicy: Schedule.exponential('100 millis', 2) }
)
```

### Pattern: Event Emission

```typescript
const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
const writeEvent = Option.isSome(eventLogOption)
  ? yield* EventLog.makeClient(Schema)
  : null

const maybeEmit = (tag, payload) =>
  writeEvent
    ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void))
    : Effect.void
```

### Pattern: EventGroup Definition

```typescript
export const Events = EventGroup.empty
  .add({
    tag: 'EventName',
    payload: EventPayloadSchema,
    primaryKey: (payload) => payload.aggregateId,
  })
```

### Pattern: Branded Identifier

```typescript
export const FieldName = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@namespace/Entity/fields/FieldName'),
  Schema.annotations({
    identifier: '@namespace/FieldName',
    description: 'Description',
  })
)
```

### Pattern: Pagination

```typescript
const limit = params.limit ?? 50
const offset = params.cursor ? parseInt(params.cursor, 10) : 0
const sliced = filtered.slice(offset, offset + limit + 1)
const hasNextPage = sliced.length > limit
const items = hasNextPage ? sliced.slice(0, limit) : sliced

return {
  _tag: 'PaginatedResult',
  items,
  pageInfo: {
    _tag: 'PageInfo',
    nextCursor: hasNextPage ? String(offset + limit) : null,
    hasNextPage,
    totalCount: filtered.length,
  },
}
```

---

## 12. Gaps and TODOs from Code

From identifier schemas (`identifiers.ts`):

```typescript
// TODO: Need services in general, in particular, need an Id service, if it
// doesn't exist that creates system id, which would follow some UUID schema,
// and persisted mapping via Key/Value store to human readable labels.

// TODO: These strings need to be backed by robust Schema.Literals, wrapped in
// various sets Unions, or other Schema/type levels, for kind, label, and
// whatever other fields you see fit. Also support dynamics. Find a suitable
// approach. See bfo.ts for examples on how to implement.

// TODO: Per id service, need to support a mapping between that an array of
// valid labels for a particular Id's. need to think of conflict modalities.
```

From provenance schema (`provenance.ts`):

```typescript
// TODO: SourceTypes need to be made flexible in the core, need concretes, but
// allow for abstract extension. Profiles will define SourceTypes. This
// Schema.Literal will be attached to, or just have a corresponding
// Schema.TaggedClass that is the acquisition workflow itself. The sourcetype
// would be derived.

// TODO: Need a robust way of programmatically sharing descriptions, rules and
// policy for particular SourceTypes, and more specific SourceTypes, like e.g. a
// particular agent.

// TODO: Confidence is computed during Sourcing workflows.
// TODO: Attestation ref is computed during Sourcing workflows.
// TODO: Provenance record is computed during Sourcing workflows.
```

From events (`asset.ts`):

```typescript
// TODO: Shall these be updated to TaggedRequests, with rich annotations.
```

---

## 13. v3 Recommendations Summary

1. **Eliminate redundancy**
   - Remove `commands/` and `queries/` directories
   - Keep only RPC definitions in `entities/`
   - Extract error schemas to `errors/`

2. **Improve type safety**
   - Use `Schema.Literal` for all string literals
   - Auto-generate branded types
   - Enforce schema annotations

3. **Service interfaces**
   - Formalize service shape interfaces
   - Consider code generation for boilerplate
   - Add validation layer for service contracts

4. **Event sourcing**
   - Decide: optional vs mandatory EventLog
   - Address dual-write problem (state + events)
   - Consider event-first architecture

5. **Pagination**
   - Opaque cursors (base64-encoded)
   - Remove default `totalCount` (expensive)
   - Consider relay-style pagination

6. **ID management**
   - Implement ID service for UUID generation
   - Support human-readable label mapping
   - Consider DID integration

7. **Property system**
   - External property registry for validation
   - Policy-driven mutability
   - Schema evolution support

8. **Provenance**
   - Flexible source type extension
   - Workflow integration for confidence/attestation
   - Agent-specific source types

---

## 14. Code References

| File | Lines | Purpose |
|------|-------|---------|
| `entities/asset.ts` | 351 | Entity + all RPCs |
| `commands/asset.ts` | 320 | Command TaggedRequests (REDUNDANT) |
| `queries/asset.ts` | 385 | Query TaggedRequests (REDUNDANT) |
| `handlers/asset.ts` | 391 | Entity handlers |
| `services/asset-state.ts` | 659 | In-memory service |
| `services/asset-state-shape.ts` | 279 | Service interface |
| `events/asset.ts` | 276 | Event payloads + EventGroup |
| `schemas/asset.ts` | 141 | Asset entity schema |
| `schemas/property.ts` | 86 | Property schemas |
| `core/schemas/identifiers.ts` | 236 | Branded identifiers |
| `core/schemas/provenance.ts` | 90 | Provenance tracking |

---

**End of Research Document**
