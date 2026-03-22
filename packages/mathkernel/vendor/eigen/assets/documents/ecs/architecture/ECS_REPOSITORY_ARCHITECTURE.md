# ECS Repository Architecture Design Record

> Design session: 2026-01-10
> Participants: Val (AI), Prime (Human)
> Status: **Complete**

---

## Context

This document captures the iterative design process for the ECS (Canonical Entity System) repository layer. The repository layer provides type-safe data access for canonical entities and their traits, building on the persistence architecture defined in `ECS_PERSISTENCE_ARCHITECTURE.md`.

### Prerequisites
- ECS persistence schema defined (entity.* tables)
- GEOINT repositories exist as reference patterns
- Effect SQL (@effect/sql-pg) for database operations
- Effect.Service pattern for dependency injection

### Existing Repository Patterns (GEOINT)

From analysis of existing GEOINT repositories:

```typescript
// Pattern 1: Context.Tag for DI
class FlightRepositoryTag extends Context.Tag('geoint/FlightRepository')<
  FlightRepositoryTag,
  FlightRepository
>() {}

// Pattern 2: Interface-first design
interface FlightRepository {
  readonly insertPosition: (input: FlightPositionInput) => Effect.Effect<void, FlightRepositoryError>
  readonly findCurrentFlights: (options?: CurrentFlightSearchOptions) => Effect.Effect<...>
}

// Pattern 3: Factory function
const makeFlightRepository = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  // ... implementation
  return { ... } satisfies FlightRepository
})

// Pattern 4: Layer for composition
const FlightRepositoryLive = Layer.effect(FlightRepositoryTag, makeFlightRepository)

// Pattern 5: Unified facade
const GeointRepositoryLive = Layer.effect(GeointRepositoryTag, makeGeointRepository)
  .pipe(Layer.provide(AllRepositoriesLive))
```

### Design Goals

1. Base repository primitives that GEOINT repos can extend/compose
2. Trait-aware operations (spatial, temporal, kinetic queries)
3. Polymorphic entity handling (works for any entity type)
4. DurableStreams integration (write-through publishing)
5. Effect-atom caching integration

---

## Part 1: Repository Structure

### Q1.1: Repository Granularity
**Q**: What is the repository structure?
- (A) Single EntityRepository handling all operations
- (B) Separate repository per trait (SpatialRepository, TemporalRepository, etc.)
- (C) EntityRepository + composable TraitRepository mixins
- (D) Base + Domain pattern (EcsBaseRepository + GeointFlightRepository)

**Current GEOINT Pattern**: Domain-specific repos (FlightRepository, PoiRepository) with a unified facade (GeointRepository).

**A**: **(D) + (B) Hybrid** — Base + Domain pattern with separate trait repositories, accessed through the Entity Management Kernel.

**Design Insight**: The Entity Management Kernel acts as the coordination layer, providing access to both base entity operations and trait-specific repositories. This allows:
- Clean separation of trait concerns
- Domain repos extend base with domain-specific logic
- Kernel orchestrates cross-cutting operations

---

### Q1.2: Core Entity Operations
**Q**: What operations belong in the base ECS layer?
- (A) CRUD only (create, read, update, delete)
- (B) CRUD + trait operations (addSpatialTrait, updateTemporalTrait)
- (C) CRUD + trait + common queries (findByType, findWithTrait)
- (D) Minimal base, domain layers add operations

**Reference**: `entity.entities` table has: id, entity_id, entity_type, created_at, updated_at, revision, confidence, is_stale, ttl_seconds, provenance, metadata

**A**: **Strategy/Plugin Pattern** — Base layer defines operation interfaces; implementations are pluggable.

**Design Insight**: The base ECS layer defines the shape of operations (interfaces/protocols), but accepts implementations from domains. This inverts control:
- Base defines: `EntityOperations<T>` interface
- Domain provides: `FlightOperations implements EntityOperations<FlightEntity>`
- Kernel binds implementations at runtime

---

### Q1.3: Trait Coupling
**Q**: How tightly coupled are trait repositories to the entity repository?
- (A) Completely separate - called independently
- (B) Owned by EntityRepository - internal implementation detail
- (C) Composable - EntityRepository delegates to TraitRepositories
- (D) Transaction-scoped - trait ops always within entity transaction

**Context**: Entity creation requires inserting core entity + any initial traits atomically.

**A**: **(B) + (C) Hybrid** — Composable but owned internally. Trait repos are separate modules but coordinated by the entity repository.

**Design Insight**: Trait repositories exist as distinct modules (SpatialRepository, TemporalRepository) but are "owned" by the entity layer in the sense that:
- Entity operations coordinate trait operations
- Transactions span entity + traits atomically
- External callers access traits through entity operations, not directly

**Deferred**: Exact coupling semantics → separate design concern (Trait Coordination Protocol)

---

### Q1.4: Query Responsibility
**Q**: Where do domain-specific queries live?
- (A) All in base ECS repositories
- (B) All in domain repositories (GEOINT)
- (C) Common queries in ECS, domain-specific in domains
- (D) Query builder returns generic, domain repos interpret

**Current Pattern**: FlightRepository has `findCurrentFlights(bounds, sinceMinutes, ...)` - domain-specific.

**A**: **(C) Split** — Common queries in ECS, domain-specific in domains.

**Conceptual Model**: An entity is an **instantiation of a durable object** with attached **facts** (traits/records).

**Design Insight**:
- **ECS queries**: Generic operations on the durable object (findByType, findWithTrait, countByEntityType)
- **Domain queries**: Operations meaningful to the domain (findCurrentFlights, findActiveTracksByCallsign)
- Facts/traits are the "records" attached to the durable entity object

---

## Part 2: Type System Design

### Q2.1: Generic Constraints
**Q**: How should repositories be typed?
- (A) Concrete types only (no generics)
- (B) Generic over entity type: `EntityRepository<T extends BaseEntity>`
- (C) Generic over entity + error: `EntityRepository<T, E extends Error>`
- (D) Schema-driven generics: `EntityRepository<S extends Schema.Schema>`

**Effect Pattern**: Effect services often use `Effect.Effect<A, E, R>` with explicit error types.

**A**: **(C) Generic over entity + error** — `EntityRepository<T extends BaseEntity, E extends Error>`

**Design Insight**: Full type control over both the entity type and error type enables:
- Domain-specific error handling (FlightRepositoryError vs PoiRepositoryError)
- Type-safe composition of repository operations
- Error type propagation through Effect pipelines

---

### Q2.2: Entity Type Discrimination
**Q**: How do repositories know which entity type they're handling?
- (A) Runtime type field (entity_type column)
- (B) Compile-time generic parameter
- (C) Schema with _tag discriminator
- (D) All of the above, layered

**Current ECS**: EntityType is `Schema.Literal('flight', 'poi', 'track', 'weather', 'imagery')` + extensible.

**A**: **(D) All of the above, layered** — Runtime + compile-time + Schema _tag discrimination.

**Design Insight**: Layered discrimination provides defense in depth:
1. **Compile-time**: Generic `T` constrains types during development
2. **Schema _tag**: Effect Schema discriminator for runtime validation
3. **Runtime field**: `entity_type` column for database queries and filtering

```typescript
// All three layers working together:
class FlightRepository extends EntityRepository<FlightEntity, FlightError> {
  // Compile-time: T = FlightEntity
  // Schema: FlightEntity has _tag: 'FlightEntity'
  // Runtime: WHERE entity_type = 'flight'
}
```

---

### Q2.3: Trait Presence in Types
**Q**: How do we type entities with optional traits?
- (A) Union type: `Entity | EntityWithSpatial | EntityWithTemporal | ...`
- (B) Optional fields: `{ spatial?: SpatialTrait, temporal?: TemporalTrait }`
- (C) Record of traits: `{ traits: Record<TraitKey, Trait> }`
- (D) Type-level trait composition: `Entity & WithSpatial & WithTemporal`

**Current ECS Base**:
```typescript
const BaseEntity = Schema.Struct({
  entityId: EntityId,
  entityType: EntityType,
  spatial: Schema.optionalWith(SpatialTrait, { as: 'Option' }),
  temporal: Schema.optionalWith(TemporalTrait, { as: 'Option' }),
  // ...
})
```

**A**: **(C) Record + Schema-shaped Effect data type** — Traits as a Record, but each trait is Schema-shaped with custom Effect-based data types.

**Design Insight**:
- Traits stored as `Record<TraitKey, Trait>` for dynamic access
- Each trait value is Schema-defined (runtime validation)
- Custom Effect-based data types for trait values (e.g., `Spatial` as an Effect data type with methods)

```typescript
// Conceptual model:
interface EntityWithTraits {
  readonly entityId: EntityId
  readonly entityType: EntityType
  readonly traits: TraitRecord  // Record<TraitKey, SchemaTrait>
}

// Each trait is a Schema-defined Effect data type:
const SpatialTrait = Schema.TaggedClass<SpatialTrait>()('SpatialTrait', {
  position: Position3D,
  bounds: Schema.optionalWith(BBox, { as: 'Option' }),
  // Methods can be attached via Data.TaggedClass patterns
})
```

---

### Q2.4: Return Type Precision
**Q**: What should find operations return?
- (A) Always full entity with all traits loaded
- (B) Configurable: `find({ includeSpatial: true })`
- (C) Lazy loading: returned entity fetches traits on access
- (D) Projection-based: specify exactly which fields

**Trade-off**: Simpler API vs query efficiency vs type safety.

**A**: **Configurable for all behaviors** — Support full, configurable includes, lazy loading, and projection.

**Design Insight**: Different use cases require different loading strategies:
- **Full (A)**: Simple operations where all data is needed
- **Configurable includes (B)**: Optimization when caller knows what's needed
- **Lazy loading (C)**: Interactive UIs where traits are loaded on demand
- **Projection (D)**: High-performance queries with minimal data transfer

```typescript
interface FindOptions<T extends BaseEntity> {
  // (A) Full - default
  readonly mode?: 'full'

  // (B) Configurable includes
  readonly include?: {
    readonly spatial?: boolean
    readonly temporal?: boolean
    readonly kinetic?: boolean
  }

  // (C) Lazy loading
  readonly lazy?: boolean  // Returns entity with trait accessors

  // (D) Projection
  readonly select?: (keyof T)[]
}

// Usage:
repo.find({ mode: 'full' })                        // All traits
repo.find({ include: { spatial: true } })          // Only spatial
repo.find({ lazy: true })                          // Lazy-loaded traits
repo.find({ select: ['entityId', 'entityType'] })  // Projection
```

---

## Part 3: Effect Integration

### Q3.1: Service Pattern
**Q**: Which Effect service pattern for repositories?
- (A) `Effect.Service<>()` with `accessors: true` (recommended for new services)
- (B) Manual `Context.Tag` + interface (current GEOINT pattern)
- (C) Class-based with decorators
- (D) Hybrid - base uses Effect.Service, domains use Tags

**Effect Canonical**: Effect.Service<>() is the modern approach with auto-generated accessors.

**A**: **(B) Manual Context.Tag + interface** — Consistent with GEOINT pattern, full control over interface and Tag naming.

**Design Insight**: The manual pattern provides:
- Explicit interface definition (documentation value)
- Clear separation: interface → Tag → make function → Layer
- Flexibility in implementation details
- Familiar pattern for existing codebase

```typescript
interface EntityRepository<T extends BaseEntity, E extends Error> {
  readonly create: (entity: T) => Effect.Effect<T, E>
  readonly findById: (id: EntityId) => Effect.Effect<Option.Option<T>, E>
}

class EntityRepositoryTag extends Context.Tag('ecs/EntityRepository')<
  EntityRepositoryTag,
  EntityRepository<BaseEntity, RepositoryError>
>() {}
```

---

### Q3.2: Error Handling
**Q**: Repository error strategy?
- (A) Single RepositoryError type with operation/entity fields
- (B) Per-repository error types (EntityError, SpatialError, etc.)
- (C) Hierarchical: BaseRepositoryError → EntityRepositoryError → FlightRepositoryError
- (D) Effect's tagged errors with defects for unexpected failures

**Current Pattern**:
```typescript
class FlightRepositoryError extends Schema.TaggedError<FlightRepositoryError>()(
  'FlightRepositoryError',
  { operation: Schema.String, message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}
```

**A**: **(C) + (D) + (B) Hybrid** — Hierarchical error types with tagged errors for expected failures and defects for unexpected.

**Design Insight**: Multi-layered error strategy:
1. **Hierarchical (C)**: `BaseRepositoryError` → `EntityRepositoryError` → `FlightRepositoryError`
2. **Tagged errors (D)**: All errors use `Schema.TaggedError` for runtime discrimination
3. **Per-repository (B)**: Domain repos have their own error types extending the hierarchy
4. **Defects**: Unexpected failures (connection loss, corruption) are defects, not errors

```typescript
// Base error
class BaseRepositoryError extends Schema.TaggedError<BaseRepositoryError>()(
  'BaseRepositoryError',
  { operation: Schema.String, message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

// Entity-level error
class EntityRepositoryError extends Schema.TaggedError<EntityRepositoryError>()(
  'EntityRepositoryError',
  { ...BaseRepositoryError.fields, entityType: EntityType }
) {}

// Domain error
class FlightRepositoryError extends Schema.TaggedError<FlightRepositoryError>()(
  'FlightRepositoryError',
  { ...EntityRepositoryError.fields, icao24: Schema.optional(Schema.String) }
) {}
```

---

### Q3.3: Transaction Management
**Q**: How are transactions exposed?
- (A) Implicit - repository handles transactions internally
- (B) Explicit - `repo.withTransaction(Effect.gen(...))`
- (C) Layer-based - provide a transaction scope layer
- (D) Connection-based - transaction bound to SqlClient lifecycle

**Current Pattern**: Single operations are atomic. No explicit transaction API in GEOINT repos.

**A**: **(A) default + (B) explicit when needed** — Implicit transactions for single operations, explicit `withTransaction` for multi-operation atomicity.

**Design Insight**:
- **Default (A)**: Single operations (create, update, delete) are implicitly atomic
- **Explicit (B)**: Multi-step operations use `withTransaction` for caller control
- Entity + traits creation uses implicit transaction (always atomic)

```typescript
interface EntityRepository<T, E> {
  // Implicit transaction - single op
  readonly create: (entity: T) => Effect.Effect<T, E>

  // Explicit transaction - caller controls scope
  readonly withTransaction: <A, E2>(
    effect: Effect.Effect<A, E2>
  ) => Effect.Effect<A, E | E2>
}

// Usage:
yield* repo.withTransaction(
  Effect.gen(function* () {
    const entity = yield* repo.create(baseEntity)
    yield* repo.spatial.attach(entity.id, spatialData)
    yield* repo.temporal.attach(entity.id, temporalData)
  })
)
```

---

### Q3.4: Streaming Results
**Q**: How do we handle large result sets?
- (A) Pagination only (offset/limit)
- (B) Cursor-based pagination
- (C) Effect.Stream for streaming results
- (D) Both pagination and streaming options

**Context**: GEOINT entities can number in thousands (flights in bbox). DurableStreams already uses Stream.

**A**: **(C) Effect.Stream only** — All queries return streams. Consistent, powerful, composable.

**Design Insight**: Stream-first design provides:
- Consistent API across all query methods
- Back-pressure handling for large result sets
- Composability with DurableStreams
- Easy conversion to arrays when needed (`Stream.runCollect`)

```typescript
interface EntityRepository<T, E> {
  // All queries return streams
  readonly findAll: () => Stream.Stream<T, E>
  readonly findByType: (type: EntityType) => Stream.Stream<T, E>
  readonly findWithTrait: (trait: TraitKey) => Stream.Stream<T, E>

  // Spatial queries as streams
  readonly findInBounds: (bounds: BBox) => Stream.Stream<T, E>
}

// Usage:
const flights = yield* repo.findInBounds(bbox).pipe(
  Stream.filter(isActive),
  Stream.take(100),
  Stream.runCollect
)

// Or process as stream
yield* repo.findAll().pipe(
  Stream.tap(entity => publishToKafka(entity)),
  Stream.runDrain
)
```

---

## Part 4: Trait Repository Composition

### Q4.1: Spatial Trait Repository
**Q**: Spatial repository interface design?
- (A) Generic: `findInBounds<T>(bounds, entityType)`
- (B) Returns IDs only: `findEntityIdsInBounds(bounds)`
- (C) Returns full entities: `findEntitiesInBounds(bounds)`
- (D) Composable filter: `withSpatialFilter(bounds).findEntities()`

**PostGIS Operations**: ST_Within, ST_DWithin, ST_Intersects, ST_Contains

**A**: **All approaches, IDs as foundation** — All patterns are useful; start with ID returns, add composable filters.

**Design Insight**:
- **Foundation**: All spatial queries START with returning IDs
- **Composable filter (D)**: Excellent for fluent API
- **Multiple functions**: Namespace will contain various calling conventions
- **Deferred**: Specific spatial API design → separate design task

```typescript
interface SpatialRepository<E extends Error> {
  // Foundation - returns IDs
  readonly findIdsInBounds: (bounds: BBox) => Stream.Stream<EntityId, E>
  readonly findIdsWithinRadius: (center: Position, radiusM: number) => Stream.Stream<EntityId, E>

  // Composable filter
  readonly withBounds: (bounds: BBox) => SpatialFilter
  readonly withRadius: (center: Position, radiusM: number) => SpatialFilter

  // Full entity (convenience)
  readonly findEntitiesInBounds: <T>(bounds: BBox) => Stream.Stream<T, E>
}

// Deferred to: ECS_SPATIAL_QUERY_DESIGN.md
```

---

### Q4.2: Temporal Trait Repository
**Q**: Temporal query patterns?
- (A) Time range only: `findInTimeRange(from, to)`
- (B) Validity-aware: `findValidAt(timestamp)`
- (C) Observation-aware: `findObservedSince(timestamp)`
- (D) All temporal dimensions as filter options

**Temporal Trait Fields**: valid_from, valid_to, observed_at, timezone

**A**: **(D) All temporal dimensions** — Support all temporal query patterns as filter options.

**Design Insight**: Full temporal query capability:
- **Time range (A)**: `findInTimeRange(from, to)`
- **Validity (B)**: `findValidAt(timestamp)` - point-in-time queries
- **Observation (C)**: `findObservedSince(timestamp)` - freshness queries
- **Combined**: All as composable filter options

```typescript
interface TemporalFilter {
  readonly validFrom?: Date
  readonly validTo?: Date
  readonly validAt?: Date        // Point-in-time
  readonly observedSince?: Date  // Freshness
  readonly observedBefore?: Date
  readonly timezone?: string
}

interface TemporalRepository<E extends Error> {
  readonly findIds: (filter: TemporalFilter) => Stream.Stream<EntityId, E>
  readonly withTemporal: (filter: TemporalFilter) => TemporalFilterBuilder
}
```

---

### Q4.3: Trait Composition Strategy
**Q**: How do trait queries compose?
- (A) Separate queries, join in memory
- (B) Single query with joins
- (C) Query builder accumulates filters
- (D) Repository method composition: `spatial.inBounds().temporal.since().execute()`

**Example**: "Find flights in this bounding box observed in the last 5 minutes"

**A**: **RPC → DSL Translation via Handlers** — Query composition at repository level translates to target query DSL through successive handler calls.

**Design Insight**: Repository composition follows RPC pattern:
1. **Repository calls**: Successive filter/query method calls
2. **Handler translation**: Each call translates to target DSL (SQL, ElasticSearch, etc.)
3. **Domain handlers**: Define how queries execute in their domain
4. **DSL agnostic**: Repository API doesn't assume SQL - handlers interpret

```typescript
// Repository API (DSL-agnostic)
const query = repo
  .withSpatial({ bounds: bbox })
  .withTemporal({ observedSince: fiveMinutesAgo })
  .forType('flight')

// Handler translates to SQL
const sqlHandler = {
  translate: (query) => sql`
    SELECT e.entity_id FROM entity.entities e
    JOIN entity.spatial s ON e.id = s.entity_id
    JOIN entity.temporal t ON e.id = t.entity_id
    WHERE ST_Within(s.position, ${query.spatial.bounds})
      AND t.observed_at >= ${query.temporal.observedSince}
      AND e.entity_type = ${query.entityType}
  `
}

// Or to ElasticSearch
const esHandler = {
  translate: (query) => ({
    query: {
      bool: {
        filter: [
          { geo_bounding_box: { position: query.spatial.bounds } },
          { range: { observed_at: { gte: query.temporal.observedSince } } }
        ]
      }
    }
  })
}
```

---

### Q4.4: Trait Loading Strategy
**Q**: When fetching an entity, how are traits loaded?
- (A) Always join all trait tables
- (B) Lazy load on access
- (C) Explicit include list
- (D) Default set + overrides

**Trade-off**: Query complexity vs round trips vs payload size.

**A**: **Subscription + AtomRpc.Tag materialization** — Caller subscribes to traits; traits passed as IDs and materialized via AtomRpc.Tag.

**Design Insight**: Trait loading follows reactive subscription pattern:
1. **Traits as IDs**: Traits are passed around primarily as IDs (lightweight)
2. **Subscription**: Caller subscribes to specific traits attached to an entity
3. **Materialization**: AtomRpc.Tag mechanisms materialize full trait data on demand
4. **Reactive**: Trait updates propagate to subscribers

```typescript
// Entity returned with trait IDs, not full data
interface EntityWithTraitIds {
  readonly entityId: EntityId
  readonly traitIds: {
    readonly spatial?: TraitId
    readonly temporal?: TraitId
    readonly kinetic?: TraitId
  }
}

// Caller subscribes to materialize
const entity = yield* repo.findById(id)
const spatial = yield* AtomRpc.materialize(SpatialTrait, entity.traitIds.spatial)

// Or subscribe for reactive updates
const spatialAtom = AtomRpc.subscribe(SpatialTrait, entity.traitIds.spatial)
// spatialAtom updates when trait changes

// Atom.family pattern for trait materialization
const spatialTraitFamily = Atom.family<TraitId, SpatialTrait>(
  (traitId) => AtomRpc.fetch(SpatialTrait, traitId)
)
```

---

## Part 5: Integration Points

### Q5.1: DurableStreams Write-Through
**Q**: How should repositories publish to DurableStreams?
- (A) Always publish on write (insert, update, delete)
- (B) Opt-in per operation
- (C) Opt-out per operation (default on)
- (D) Separate publishing service, repos just persist

**From Persistence Design**: Write-through to DurableStreams with opt-out capability.

**A**: **(C) Opt-out per operation (default on)** — Write-through by default, disable for bulk imports/migrations.

**Design Insight**:
- Default behavior: Every write publishes to DurableStreams
- Opt-out: Bulk imports, migrations, replay operations can disable
- Consistency: Write-through ensures event stream matches DB state

```typescript
interface WriteOptions {
  readonly publish?: boolean  // default: true
}

// Default - publishes
yield* repo.create(entity)

// Opt-out for bulk import
yield* repo.create(entity, { publish: false })

// Bulk with opt-out
yield* repo.createBatch(entities, { publish: false })
```

---

### Q5.2: Event Payload Design
**Q**: What goes in the published event?
- (A) Full entity (after state)
- (B) Delta (changed fields only)
- (C) Entity ID + operation type
- (D) Configurable per entity type

**Consideration**: Event size vs consumer reconstruction complexity.

**A**: **RpcSchema.streaming with stream-specific payload schema** — Payload is a typed stream following RpcSchema patterns.

**Design Insight**:
- Events are structured as RpcSchema streams
- Each entity type has its own payload schema
- Stream-native: Events are part of Effect Stream infrastructure
- Schema-validated: Payloads are decoded/encoded via Effect Schema

```typescript
// Entity event schema
const EntityEventPayload = Schema.TaggedStruct('EntityEvent', {
  operation: Schema.Literal('create', 'update', 'delete'),
  entityId: EntityId,
  entityType: EntityType,
  timestamp: Schema.DateTimeUtc,
  // Payload varies by operation
  payload: Schema.Union(
    Schema.TaggedStruct('Created', { entity: BaseEntity }),
    Schema.TaggedStruct('Updated', { changes: Schema.Record(Schema.String, Schema.Unknown) }),
    Schema.TaggedStruct('Deleted', { reason: Schema.optional(Schema.String) })
  )
})

// RpcSchema for streaming
const EntityEventStream = RpcSchema.streaming({
  payload: EntityEventPayload,
  // Stream metadata
})
```

---

### Q5.3: Effect-Atom Integration
**Q**: How do repositories integrate with effect-atom caching?
- (A) Repositories are cache-unaware; caching handled elsewhere
- (B) Repositories update atoms directly
- (C) Publish-subscribe: atoms subscribe to repo events
- (D) Atom.family fetcher uses repository

**Current GEOINT Pattern**: Atoms defined separately, service operations update them via `ctx.set()`.

**A**: **(D) Atom.family fetcher uses repository** — Atom.family calls repository to fetch entities.

**Design Insight**: Unified access pattern via Atom.family:
- Atom.family defines the fetcher that calls repository
- Single source of truth for entity access
- Automatic caching via atom infrastructure
- Reactive updates when underlying data changes

```typescript
// Entity Atom.family - fetcher uses repository
const entityFamily = Atom.family<EntityId, EntityWithTraits>({
  key: 'entity',
  fetch: (entityId) => Effect.gen(function* () {
    const repo = yield* EntityRepositoryTag
    const entity = yield* repo.findById(entityId)
    return Option.getOrThrow(entity)
  })
})

// Usage in components
const entity = useAtomValue(entityFamily(entityId))

// Trait families
const spatialTraitFamily = Atom.family<TraitId, SpatialTrait>({
  key: 'spatial-trait',
  fetch: (traitId) => Effect.gen(function* () {
    const repo = yield* SpatialRepositoryTag
    return yield* repo.findById(traitId)
  })
})
```

---

### Q5.4: Domain Repository Extension
**Q**: How do GEOINT repositories extend ECS base?
- (A) Inheritance: `class FlightRepo extends EntityRepo<FlightEntity>`
- (B) Composition: FlightRepo wraps EntityRepo, adds domain methods
- (C) Mixin: `makeFlightRepository` composes trait repos
- (D) Delegation: FlightRepo delegates to EntityRepo for base ops

**Design Goal**: Domain repos use ECS primitives without reimplementing base logic.

**A**: **Defined elsewhere** — Domain extension pattern documented in Entity Management Kernel design.

**Reference**: See `ENTITY_MANAGEMENT_KERNEL.md` for domain repository extension patterns.

---

## Part 6: Testing Strategy

### Q6.1: Test Database Strategy
**Q**: How do we test repositories?
- (A) Real PostgreSQL (docker-compose)
- (B) In-memory mock
- (C) Test containers per test
- (D) Shared test database with transaction rollback

**Current Pattern**: Integration tests use real PostGIS (`*.integration.test.ts`).

**A**: **(A) Real PostgreSQL (docker-compose)** — Integration tests against real PostGIS, consistent with current pattern.

**Design Insight**:
- Docker-compose provides consistent test environment
- Real PostGIS for spatial query verification
- Same database setup as development
- CI/CD runs against containerized PostgreSQL

---

### Q6.2: Test Isolation
**Q**: How do we isolate tests?
- (A) Transaction rollback per test
- (B) Truncate tables between tests
- (C) Unique test schemas per run
- (D) Test-specific prefixed IDs

**A**: **(A) Transaction rollback per test** — Each test wrapped in transaction, rollback ensures clean state.

**Design Insight**:
- Fast: No data cleanup overhead
- Isolated: Each test sees clean state
- Realistic: Uses real SQL transactions
- Parallelizable with care (connection per test)

```typescript
// Test wrapper pattern
const withTestTransaction = <A, E>(
  test: Effect.Effect<A, E>
): Effect.Effect<A, E | SqlError> =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    yield* sql`BEGIN`
    const result = yield* test
    yield* sql`ROLLBACK`
    return result
  })

// Usage in vitest
it.effect('creates entity', () =>
  withTestTransaction(
    Effect.gen(function* () {
      const repo = yield* EntityRepositoryTag
      const entity = yield* repo.create(testEntity)
      expect(entity.entityId).toBeDefined()
    })
  )
)
```

---

### Q6.3: Test Helpers
**Q**: What test utilities should ECS provide?
- (A) Factory functions for test entities
- (B) Pre-seeded test data
- (C) Mock repository implementations
- (D) All of the above

**A**: **(D) All of the above** — Factories, pre-seeded data, and mock repos.

**Design Insight**: Comprehensive test utilities:
1. **Factory functions (A)**: `createTestFlight()`, `createTestPoi()`, etc.
2. **Pre-seeded data (B)**: Standard fixtures for common scenarios
3. **Mock repos (C)**: In-memory implementations for unit tests

```typescript
// Factory functions
const createTestFlight = (overrides?: Partial<FlightEntity>): FlightEntity => ({
  _tag: 'FlightEntity',
  entityId: `flight-${crypto.randomUUID()}` as EntityId,
  entityType: 'flight',
  icao24: 'abc123',
  ...overrides,
})

// Pre-seeded fixtures
const testFixtures = {
  flights: [
    createTestFlight({ icao24: 'test01' }),
    createTestFlight({ icao24: 'test02' }),
  ],
  pois: [
    createTestPoi({ name: 'Test Airport' }),
  ],
}

// Mock repository
class MockEntityRepository implements EntityRepository<BaseEntity, never> {
  private entities = new Map<EntityId, BaseEntity>()

  create = (entity: BaseEntity) => Effect.succeed(entity)
  findById = (id: EntityId) => Effect.succeed(Option.fromNullable(this.entities.get(id)))
  // ...
}
```

---

## Design Decisions Summary

| Category | Decision | Choice | Rationale |
|----------|----------|--------|-----------|
| **Structure** | Granularity | Base+Domain + Separate Trait Repos | Kernel coordinates, clean separation |
| **Structure** | Core Operations | Strategy/Plugin Pattern | Base defines interface, domains provide impl |
| **Structure** | Trait Coupling | Composable, owned internally | Separate modules, coordinated by entity layer |
| **Structure** | Query Responsibility | Split ECS/Domain | Generic in ECS, domain-specific in domains |
| **Types** | Generic Constraints | `<T, E extends Error>` | Full type control for entity and error |
| **Types** | Discrimination | Layered (compile+schema+runtime) | Defense in depth |
| **Types** | Trait Presence | Record + Schema data types | Dynamic access, Schema validation |
| **Types** | Return Precision | Configurable (all modes) | Full, includes, lazy, projection |
| **Effect** | Service Pattern | Manual Context.Tag + interface | Consistent with GEOINT, full control |
| **Effect** | Error Handling | Hierarchical + tagged + per-repo | Multi-layered error strategy |
| **Effect** | Transactions | Implicit default + explicit option | Single ops atomic, explicit for multi-op |
| **Effect** | Streaming | Effect.Stream only | Consistent, composable, back-pressure |
| **Traits** | Spatial API | IDs as foundation + composable filters | Deferred to separate design |
| **Traits** | Temporal API | All dimensions as filter options | Full temporal query capability |
| **Traits** | Composition | RPC → DSL translation via handlers | DSL-agnostic, handler interprets |
| **Traits** | Loading | Subscription + AtomRpc.Tag materialization | IDs passed, materialized on demand |
| **Integration** | DurableStreams | Opt-out per operation (default on) | Write-through, disable for bulk |
| **Integration** | Event Payload | RpcSchema.streaming + typed payload | Stream-native, Schema-validated |
| **Integration** | Atom Cache | Atom.family fetcher uses repo | Unified access, automatic caching |
| **Integration** | Domain Extension | See Entity Management Kernel | Defined elsewhere |
| **Testing** | Database | Real PostgreSQL (docker-compose) | Consistent with current pattern |
| **Testing** | Isolation | Transaction rollback per test | Fast, isolated, realistic |
| **Testing** | Utilities | All (factories, fixtures, mocks) | Comprehensive test support |

---

## Repository Interfaces (Final) — Schema-Based

All interfaces use Effect Schema with tagged structures for runtime validation and type safety.

```typescript
// =============================================================================
// Error Hierarchy (Schema.TaggedError)
// =============================================================================

class BaseRepositoryError extends Schema.TaggedError<BaseRepositoryError>()(
  'BaseRepositoryError',
  { operation: Schema.String, message: Schema.String, cause: Schema.optional(Schema.Unknown) }
) {}

class EntityRepositoryError extends Schema.TaggedError<EntityRepositoryError>()(
  'EntityRepositoryError',
  { ...BaseRepositoryError.fields, entityType: EntityType }
) {}

// =============================================================================
// Schema-Based Trait Types
// =============================================================================

const TraitId = Schema.String.pipe(Schema.brand('TraitId'))
type TraitId = typeof TraitId.Type

const TraitKey = Schema.Literal('spatial', 'temporal', 'kinetic', 'classified', 'identifiable')
type TraitKey = typeof TraitKey.Type

const TraitIdRecord = Schema.Record(TraitKey, Schema.optionalWith(TraitId, { as: 'Option' }))
type TraitIdRecord = typeof TraitIdRecord.Type

// =============================================================================
// Schema-Based Options Types
// =============================================================================

const WriteOptions = Schema.TaggedStruct('WriteOptions', {
  publish: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
type WriteOptions = typeof WriteOptions.Type

const IncludeSpec = Schema.TaggedStruct('IncludeSpec', {
  spatial: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  temporal: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  kinetic: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

const FindOptions = Schema.TaggedStruct('FindOptions', {
  mode: Schema.optionalWith(Schema.Literal('full', 'lazy', 'projection'), { default: () => 'full' as const }),
  include: Schema.optionalWith(IncludeSpec, { as: 'Option' }),
  select: Schema.optionalWith(Schema.Array(Schema.String), { as: 'Option' }),
})
type FindOptions = typeof FindOptions.Type

const TemporalFilter = Schema.TaggedStruct('TemporalFilter', {
  validFrom: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  validTo: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  validAt: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  observedSince: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  observedBefore: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  timezone: Schema.optionalWith(Schema.String, { default: () => 'UTC' }),
})
type TemporalFilter = typeof TemporalFilter.Type

// =============================================================================
// Schema-Based Result Types
// =============================================================================

const EntityUpdateResult = Schema.TaggedStruct('EntityUpdateResult', {
  entityId: EntityId,
  updated: Schema.Boolean,
  revision: Schema.Number,
  traitsUpdated: Schema.Array(TraitKey),
})
type EntityUpdateResult = typeof EntityUpdateResult.Type

const TraitUpdateResult = Schema.TaggedStruct('TraitUpdateResult', {
  traitId: TraitId,
  entityId: EntityId,
  traitKey: TraitKey,
  merged: Schema.Boolean,  // true if fused with existing
  newConfidence: Schema.Number,
})
type TraitUpdateResult = typeof TraitUpdateResult.Type

// =============================================================================
// Base Entity Repository Interface
// =============================================================================

interface EntityRepository<T extends BaseEntity, E extends Error> {
  // CRUD - all return streams or single effects
  readonly create: (entity: T, options?: WriteOptions) => Effect.Effect<T, E>
  readonly findById: (id: EntityId, options?: FindOptions<T>) => Effect.Effect<Option.Option<T>, E>
  readonly update: (id: EntityId, updates: Partial<T>, options?: WriteOptions) => Effect.Effect<T, E>
  readonly delete: (id: EntityId, options?: WriteOptions) => Effect.Effect<boolean, E>

  // Query - all return streams
  readonly findAll: (options?: FindOptions<T>) => Stream.Stream<T, E>
  readonly findByType: (type: EntityType, options?: FindOptions<T>) => Stream.Stream<T, E>
  readonly findWithTrait: (trait: TraitKey, options?: FindOptions<T>) => Stream.Stream<T, E>
  readonly count: (options?: CountOptions) => Effect.Effect<number, E>

  // Transaction support
  readonly withTransaction: <A, E2>(effect: Effect.Effect<A, E2>) => Effect.Effect<A, E | E2>

  // Trait access (returns IDs for lazy materialization)
  readonly getTraitIds: (entityId: EntityId) => Effect.Effect<TraitIdRecord, E>
}

// =============================================================================
// Trait Repository Interfaces
// =============================================================================

interface SpatialRepository<E extends Error> {
  // ID-based queries (foundation)
  readonly findIdsInBounds: (bounds: BBox) => Stream.Stream<EntityId, E>
  readonly findIdsWithinRadius: (center: Position, radiusM: number) => Stream.Stream<EntityId, E>

  // Composable filters
  readonly withBounds: (bounds: BBox) => SpatialFilter
  readonly withRadius: (center: Position, radiusM: number) => SpatialFilter

  // Trait operations
  readonly attach: (entityId: EntityId, spatial: SpatialTrait) => Effect.Effect<TraitId, E>
  readonly update: (traitId: TraitId, spatial: SpatialTrait) => Effect.Effect<void, E>
  readonly findById: (traitId: TraitId) => Effect.Effect<Option.Option<SpatialTrait>, E>
}

interface TemporalRepository<E extends Error> {
  // Temporal queries
  readonly findIds: (filter: TemporalFilter) => Stream.Stream<EntityId, E>
  readonly withTemporal: (filter: TemporalFilter) => TemporalFilterBuilder

  // Trait operations
  readonly attach: (entityId: EntityId, temporal: TemporalTrait) => Effect.Effect<TraitId, E>
  readonly update: (traitId: TraitId, temporal: TemporalTrait) => Effect.Effect<void, E>
  readonly findById: (traitId: TraitId) => Effect.Effect<Option.Option<TemporalTrait>, E>
}

// =============================================================================
// Options Types
// =============================================================================

interface WriteOptions {
  readonly publish?: boolean  // default: true (DurableStreams)
}

interface FindOptions<T extends BaseEntity> {
  readonly mode?: 'full'
  readonly include?: { spatial?: boolean; temporal?: boolean; kinetic?: boolean }
  readonly lazy?: boolean
  readonly select?: (keyof T)[]
}

interface TemporalFilter {
  readonly validFrom?: Date
  readonly validTo?: Date
  readonly validAt?: Date
  readonly observedSince?: Date
  readonly observedBefore?: Date
  readonly timezone?: string
}

// =============================================================================
// Context Tags
// =============================================================================

class EntityRepositoryTag extends Context.Tag('ecs/EntityRepository')<
  EntityRepositoryTag,
  EntityRepository<BaseEntity, EntityRepositoryError>
>() {}

class SpatialRepositoryTag extends Context.Tag('ecs/SpatialRepository')<
  SpatialRepositoryTag,
  SpatialRepository<EntityRepositoryError>
>() {}

class TemporalRepositoryTag extends Context.Tag('ecs/TemporalRepository')<
  TemporalRepositoryTag,
  TemporalRepository<EntityRepositoryError>
>() {}
```

---

## Part 7: External Writer Pattern (Multi-Source Fusion)

### Q7.1: External Writer Ingest Path
**Q**: How should external writers submit updates to canonical entities?

**A**: **RPC request to Entity Kernel** — External writers call Kernel RPC; Kernel applies updates with provenance tracking.

**Design Insight**: The Entity Kernel is the single point of entry for all entity mutations:
- External systems don't write directly to repositories
- Kernel validates, transforms, and applies provenance
- Raw data → Canonical form transformation happens in Kernel
- Audit trail maintained for all mutations

```typescript
// External writer calls Kernel RPC
interface EntityKernel {
  // Submit raw observation from external source
  readonly submitObservation: (params: {
    readonly source: IntelSource
    readonly entityRef: EntityRef  // ID or external ID to resolve
    readonly observation: RawObservation
    readonly timestamp: Date
    readonly confidence: number
  }) => Effect.Effect<EntityUpdateResult, KernelError>

  // Update specific trait with source attribution
  readonly updateTrait: (params: {
    readonly source: IntelSource
    readonly entityId: EntityId
    readonly trait: TraitKey
    readonly data: unknown  // Raw data, Kernel transforms to canonical
    readonly confidence: number
  }) => Effect.Effect<TraitUpdateResult, KernelError>
}

// Example: External ADS-B source updates flight position
yield* kernel.submitObservation({
  source: 'adsb_exchange',
  entityRef: { icao24: 'abc123' },  // Kernel resolves to EntityId
  observation: {
    position: { lon: -122.4, lat: 37.8, alt: 10000 },
    velocity: { speed: 450, heading: 90 },
    timestamp: new Date(),
  },
  confidence: 0.85,
})
// Kernel:
// 1. Resolves icao24 → EntityId (or creates new entity)
// 2. Transforms raw → canonical SpatialTrait, KineticTrait
// 3. Applies fusion with existing data
// 4. Updates provenance with source contribution
// 5. Persists via repository (with DurableStreams publish)
```

---

### Q7.2: Aggregate Fusion Strategy
**Q**: How should aggregate updates handle confidence/provenance?

**A**: **Configurable per trait** — Different traits have different fusion strategies.

**Design Insight**: Not all traits should fuse the same way:

| Trait | Fusion Strategy | Rationale |
|-------|-----------------|-----------|
| Spatial | Weighted average by confidence | Position uncertainty varies by source |
| Temporal | Most recent wins | Time observations are definitive |
| Kinetic | Kalman filter / weighted | Velocity benefits from sensor fusion |
| Identifiable | Union of IDs | All known IDs should accumulate |
| Classified | Highest confidence | Classification is authoritative |

```typescript
// Fusion strategy configuration per trait
const FusionConfig = Schema.Struct({
  spatial: Schema.Literal('weighted_average', 'most_recent', 'kalman'),
  temporal: Schema.Literal('most_recent', 'earliest'),
  kinetic: Schema.Literal('weighted_average', 'kalman', 'most_recent'),
  identifiable: Schema.Literal('union', 'replace'),
  classified: Schema.Literal('highest_confidence', 'most_recent'),
})

// Kernel applies fusion based on config
interface TraitFusionService {
  readonly fuse: <T extends Trait>(
    trait: TraitKey,
    existing: Option.Option<T>,
    incoming: T,
    incomingConfidence: number,
    strategy: FusionStrategy
  ) => Effect.Effect<{ merged: T; newConfidence: number }, FusionError>
}

// Example: Weighted average for spatial
const fuseSpatial = (existing: SpatialTrait, incoming: SpatialTrait, confidence: number) => {
  const existingWeight = existing.confidence
  const incomingWeight = confidence
  const totalWeight = existingWeight + incomingWeight

  return {
    position: {
      lon: (existing.position.lon * existingWeight + incoming.position.lon * incomingWeight) / totalWeight,
      lat: (existing.position.lat * existingWeight + incoming.position.lat * incomingWeight) / totalWeight,
      alt: (existing.position.alt * existingWeight + incoming.position.alt * incomingWeight) / totalWeight,
    },
    confidence: (existingWeight + incomingWeight) / 2,  // Simplified
  }
}
```

---

### Q7.3: Provenance Tracking
**Q**: How is source contribution tracked through fusion?

**A**: Provenance accumulates source contributions with timestamps and confidence.

```typescript
// Provenance structure (from ECS_PERSISTENCE_ARCHITECTURE.md)
interface EntityProvenance {
  readonly sources: readonly SourceContribution[]
  readonly primarySource: IntelSource | null  // Highest confidence contributor
}

interface SourceContribution {
  readonly source: IntelSource
  readonly confidence: number
  readonly contributedAt: Date
  readonly traits: readonly TraitKey[]  // Which traits this source contributed to
  readonly rawAuditRef?: RawAuditRef    // Link to raw data for replay
}

// After fusion, provenance updated:
// - New source added to sources array
// - primarySource updated if new source has higher confidence
// - traits array updated to reflect what was contributed
```

---

## Part 8: Repository Extension Pattern

### Base Repository Extension via Effect.Service

Domain repositories extend ECS base repositories using composition with Effect.Service pattern for trait repos.

```typescript
// =============================================================================
// Base Trait Repository (Effect.Service pattern)
// =============================================================================

export class SpatialRepositoryBase extends Effect.Service<SpatialRepositoryBase>()(
  'ecs/SpatialRepositoryBase',
  {
    effect: Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      return {
        findIdsInBounds: (bounds: BBox) =>
          Stream.fromEffect(sql`
            SELECT entity_id FROM entity.spatial
            WHERE ST_Within(position, ST_MakeEnvelope(${bounds[0]}, ${bounds[1]}, ${bounds[2]}, ${bounds[3]}, 4326))
          `).pipe(Stream.mapEffect(row => Effect.succeed(row.entity_id as EntityId))),

        attach: (entityId: EntityId, spatial: SpatialTrait) =>
          Effect.gen(function* () {
            const result = yield* sql`
              INSERT INTO entity.spatial (entity_id, position, bounds)
              VALUES (${entityId}, ST_SetSRID(ST_MakePoint(${spatial.position.lon}, ${spatial.position.lat}, ${spatial.position.alt}), 4326), ${spatial.bounds})
              RETURNING id
            `
            return result[0].id as TraitId
          }),

        findById: (traitId: TraitId) =>
          Effect.gen(function* () {
            const rows = yield* sql`SELECT * FROM entity.spatial WHERE id = ${traitId}`
            return rows.length > 0 ? Option.some(decodeSpatialTrait(rows[0])) : Option.none()
          }),
      }
    }),
  }
) {}

// =============================================================================
// Base Entity Repository (Effect.Service pattern)
// =============================================================================

export class EntityRepositoryBase extends Effect.Service<EntityRepositoryBase>()(
  'ecs/EntityRepositoryBase',
  {
    dependencies: [SpatialRepositoryBase.Default, TemporalRepositoryBase.Default],
    effect: Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const spatialRepo = yield* SpatialRepositoryBase
      const temporalRepo = yield* TemporalRepositoryBase

      return {
        create: (entity: BaseEntity, options?: WriteOptions) =>
          Effect.gen(function* () {
            // Insert core entity
            const [row] = yield* sql`
              INSERT INTO entity.entities (entity_id, entity_type, confidence, provenance)
              VALUES (${entity.entityId}, ${entity.entityType}, ${entity.confidence}, ${entity.provenance})
              RETURNING *
            `
            // Attach traits if present
            if (Option.isSome(entity.spatial)) {
              yield* spatialRepo.attach(row.id, entity.spatial.value)
            }
            if (Option.isSome(entity.temporal)) {
              yield* temporalRepo.attach(row.id, entity.temporal.value)
            }
            return decodeEntity(row)
          }),

        findById: (id: EntityId) =>
          Effect.gen(function* () {
            const rows = yield* sql`SELECT * FROM entity.entities WHERE entity_id = ${id}`
            if (rows.length === 0) return Option.none()
            return Option.some(decodeEntity(rows[0]))
          }),

        // Trait repositories exposed for composition
        spatial: spatialRepo,
        temporal: temporalRepo,
      }
    }),
  }
) {}

// =============================================================================
// Domain Repository Extension (composes base)
// =============================================================================

// Interface extends base with domain-specific methods
interface FlightRepository extends EntityRepositoryBase {
  readonly findCurrentFlights: (options: FlightSearchOptions) => Stream.Stream<FlightEntity, FlightRepositoryError>
  readonly findByIcao24: (icao24: string) => Effect.Effect<Option.Option<FlightEntity>, FlightRepositoryError>
}

// Tag for domain repo
class FlightRepositoryTag extends Context.Tag('geoint/FlightRepository')<
  FlightRepositoryTag,
  FlightRepository
>() {}

// Factory composes base + domain methods
const makeFlightRepository = Effect.gen(function* () {
  const base = yield* EntityRepositoryBase
  const sql = yield* PgClient.PgClient

  // Domain-specific methods
  const findCurrentFlights: FlightRepository['findCurrentFlights'] = (options) =>
    base.spatial.findIdsInBounds(options.bounds).pipe(
      Stream.mapEffect(id => base.findById(id)),
      Stream.filterMap(identity),
      Stream.filter(e => e.entityType === 'flight'),
    )

  const findByIcao24: FlightRepository['findByIcao24'] = (icao24) =>
    Effect.gen(function* () {
      const rows = yield* sql`
        SELECT e.* FROM entity.entities e
        JOIN entity.identifiable i ON e.id = i.entity_id
        WHERE i.external_ids->>'icao24' = ${icao24}
      `
      return rows.length > 0 ? Option.some(decodeFlightEntity(rows[0])) : Option.none()
    })

  // Compose: spread base + add domain methods
  return {
    ...base,
    findCurrentFlights,
    findByIcao24,
  } satisfies FlightRepository
})

// Layer provides domain repo with base already composed
const FlightRepositoryLive = Layer.effect(FlightRepositoryTag, makeFlightRepository).pipe(
  Layer.provide(EntityRepositoryBase.Default)
)
```

### Extension Pattern Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    Repository Extension Flow                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐     ┌──────────────────────┐          │
│  │ SpatialRepositoryBase│     │TemporalRepositoryBase│          │
│  │   (Effect.Service)   │     │   (Effect.Service)   │          │
│  └──────────┬───────────┘     └──────────┬───────────┘          │
│             │                            │                       │
│             └──────────┬─────────────────┘                       │
│                        ▼                                         │
│              ┌─────────────────────┐                             │
│              │ EntityRepositoryBase│                             │
│              │   (Effect.Service)  │                             │
│              │  - composes traits  │                             │
│              │  - base CRUD        │                             │
│              └──────────┬──────────┘                             │
│                         │                                        │
│          ┌──────────────┴───────────────┐                        │
│          ▼                              ▼                        │
│  ┌───────────────────┐        ┌───────────────────┐             │
│  │ FlightRepository  │        │   PoiRepository   │             │
│  │  (Context.Tag)    │        │   (Context.Tag)   │             │
│  │  - extends base   │        │   - extends base  │             │
│  │  - domain methods │        │   - domain methods│             │
│  └───────────────────┘        └───────────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points**:
1. **Trait repos**: Effect.Service pattern, auto-composed via dependencies
2. **Entity base**: Effect.Service, composes trait repos, provides base CRUD
3. **Domain repos**: Context.Tag + interface, composes base + adds domain methods
4. **Layer composition**: Domain layer provides base automatically

---

## Implementation Plan
- [ ] Define core interfaces
- [ ] Implement base EntityRepository
- [ ] Add trait repository mixins

### Phase 2: Integration
- [ ] DurableStreams write-through
- [ ] Effect-atom caching hooks
- [ ] Transaction support

### Phase 3: Domain Extension
- [ ] Refactor FlightRepository to use ECS base
- [ ] Refactor PoiRepository to use ECS base
- [ ] Update GeointRepository facade

### Phase 4: Testing
- [ ] Integration test infrastructure
- [ ] Factory functions
- [ ] Mock implementations

---

## Related Documents

- `ECS_PERSISTENCE_ARCHITECTURE.md` - Database schema design
- `ECS_SERVICE_ARCHITECTURE.md` - Service catalog
- `GEOINT_ATOM_FAMILY_ARCHITECTURE.md` - Atom patterns
- `GEOINT_XSTATE_ATOM_ARCHITECTURE.md` - State machine integration

---

## Next Steps

- [ ] Complete Q&A rounds (Parts 1-6)
- [ ] Finalize design decisions
- [ ] Define concrete interfaces
- [ ] Implement base repository
- [ ] Refactor GEOINT repositories
