# ECS Service Architecture

> Design document for Canonical Entity System services
> Session: 2026-01-10

---

## Scope Clarification

### ECS Module (`src/lib/ecs/`)
**Primitives only** - base traits, provenance, core types.

Contains:
- Core schemas (EntityId, Confidence, Position, Classification)
- Trait schemas (SpatialTrait, TemporalTrait, KineticTrait, etc.)
- Provenance schemas (SourceContribution, EntityProvenance)
- Base services (EntityIdService, ProvenanceService, ConfidenceService)

Does NOT contain:
- Domain-specific entities (FlightEntity, PoiEntity)
- Domain-specific services (FlightIngester, OsmClient)

### Domain Modules (e.g., `src/lib/geoint/`)
**Domain-specific entities and services**.

Contains:
- FlightEntity, PoiEntity, TrackEntity, WeatherEntity, ImageryEntity
- Ingestion services (FlightIngester, OsmIngester, etc.)
- Domain-specific repositories and queries

---

## Service Catalog

### Layer 1: Core Identity Services

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **EntityIdService** | Generate unique entity IDs (UUID v4 with prefix) | None |
| **SlugService** | Generate human-readable slugs for entities | EntityIdService |
| **EntityTypeRegistry** | Register and validate entity types | None |

### Layer 2: Provenance Services

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **SourceRegistry** | Register intel sources with priority/weight | None |
| **ConfidenceService** | Calculate aggregate confidence from contributions | SourceRegistry |
| **StalenessService** | Track entity freshness, TTL management | Clock |
| **ProvenanceService** | Create/update provenance metadata | ConfidenceService, StalenessService |

### Layer 3: Persistence Services

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **EntityRepository** | CRUD for entity core table | SqlClient |
| **TraitRepository** | CRUD for trait tables (spatial, temporal, etc.) | SqlClient |
| **RawAuditRepository** | Store raw data references | SqlClient |
| **CheckpointRepository** | Store stream offsets/checkpoints | SqlClient |

### Layer 4: Stream Services

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **EntityEventPublisher** | Publish entity events to streams | DurableStreamClient |
| **EntityEventSubscriber** | Subscribe to entity event streams | DurableStreamClient |
| **StreamRegistry** | Track active streams and their offsets | CheckpointRepository |

### Layer 5: Lifecycle Services

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **EntityLifecycleService** | Create, update, archive, delete entities | EntityRepository, TraitRepository, ProvenanceService |
| **GarbageCollector** | Clean up stale/orphaned entities | StalenessService, EntityRepository |
| **VersioningService** | Track entity revisions, optimistic locking | EntityRepository |

### Layer 6: Query Services

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **EntityQueryService** | Find entities by ID, type, metadata | EntityRepository |
| **SpatialQueryService** | Spatial queries (bbox, radius, polygon) | TraitRepository (spatial) |
| **TemporalQueryService** | Time-range queries | TraitRepository (temporal) |
| **FusedQueryService** | Multi-trait compound queries | All trait repositories |

### Layer 7: Fusion Services

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **EntityResolver** | Match incoming data to existing entities | EntityQueryService |
| **EntityMerger** | Merge multi-source data into canonical entity | ProvenanceService, ConfidenceService |
| **ConflictResolver** | Resolve conflicting data from sources | SourceRegistry |
| **FusionPipeline** | Orchestrate resolve → merge → persist | EntityResolver, EntityMerger, EntityLifecycleService |

---

## Domain Services (GEOINT)

### Layer 8: Ingestion Services

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **FlightIngester** | Ingest from OpenSky, ADS-B, etc. | OpenSkyClient, FusionPipeline |
| **OsmIngester** | Ingest POIs from Overpass | OverpassClient, FusionPipeline |
| **WeatherIngester** | Ingest weather from Open-Meteo | OpenMeteoClient, FusionPipeline |
| **ImageryIngester** | Ingest imagery metadata | PlanetClient, SentinelClient, FusionPipeline |
| **IngestionOrchestrator** | Coordinate all ingesters | All ingesters |

### Layer 9: External API Clients

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **OpenSkyClient** | OpenSky Network API | HttpClient |
| **OverpassClient** | OSM Overpass API | HttpClient |
| **OpenMeteoClient** | Open-Meteo weather API | HttpClient |
| **PlanetClient** | Planet Labs API | HttpClient |
| **SentinelClient** | Sentinel Hub API | HttpClient |

### Layer 10: Search Services

| Service | Responsibility | Dependencies |
|---------|---------------|--------------|
| **SearchService** | Multi-source search orchestration | FusedQueryService, IngestionOrchestrator |
| **SearchIndexer** | Build/maintain search indices | EntityEventSubscriber |
| **SearchRankingService** | Rank and score search results | ConfidenceService |

---

## Dependency Graph

```
                                    ┌─────────────────┐
                                    │     Clock       │
                                    └────────┬────────┘
                                             │
┌─────────────────┐                 ┌────────▼────────┐
│ EntityIdService │                 │ StalenessService│
└────────┬────────┘                 └────────┬────────┘
         │                                   │
         │        ┌─────────────────┐        │
         │        │  SourceRegistry │        │
         │        └────────┬────────┘        │
         │                 │                 │
         │        ┌────────▼────────┐        │
         │        │ConfidenceService│        │
         │        └────────┬────────┘        │
         │                 │                 │
         │        ┌────────▼─────────────────▼─┐
         │        │    ProvenanceService       │
         │        └────────┬───────────────────┘
         │                 │
         │                 │
         │    ┌────────────┴────────────┐
         │    │                         │
┌────────▼────▼───┐         ┌───────────▼───────────┐
│   SqlClient     │         │  DurableStreamClient  │
└────────┬────────┘         └───────────┬───────────┘
         │                              │
         │                              │
┌────────▼────────┐         ┌───────────▼───────────┐
│EntityRepository │         │ EntityEventPublisher  │
│TraitRepository  │         │ EntityEventSubscriber │
│RawAuditRepo     │         │ StreamRegistry        │
└────────┬────────┘         └───────────┬───────────┘
         │                              │
         └──────────────┬───────────────┘
                        │
              ┌─────────▼─────────┐
              │EntityLifecycleServ│
              │  VersioningServ   │
              │  GarbageCollector │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │ EntityQueryService│
              │ SpatialQueryServ  │
              │ TemporalQueryServ │
              │ FusedQueryService │
              └─────────┬─────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
┌────────▼────┐ ┌───────▼──────┐ ┌─────▼──────┐
│EntityResolver│ │EntityMerger │ │ConflictRes │
└────────┬────┘ └───────┬──────┘ └─────┬──────┘
         │              │              │
         └──────────────┼──────────────┘
                        │
              ┌─────────▼─────────┐
              │  FusionPipeline   │
              └─────────┬─────────┘
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
┌───▼────────┐  ┌───────▼──────┐  ┌─────────▼───┐
│FlightIngest│  │ OsmIngester  │  │WeatherIngest│
└───┬────────┘  └───────┬──────┘  └─────────┬───┘
    │                   │                   │
    │    ┌──────────────┴──────────────┐    │
    │    │                             │    │
┌───▼────▼───┐              ┌──────────▼────▼─┐
│OpenSkyClient│              │ OverpassClient  │
│             │              │ OpenMeteoClient │
└─────────────┘              └─────────────────┘
```

---

## Service Interface Stubs

### Identity Services

```typescript
// EntityIdService
interface EntityIdService {
  readonly generate: (entityType: EntityType) => Effect<EntityId>
  readonly parse: (id: string) => Effect<EntityId, ParseError>
  readonly validate: (id: EntityId) => Effect<boolean>
}

// SlugService
interface SlugService {
  readonly generate: (entity: { name?: string; type: EntityType }) => Effect<string>
  readonly parse: (slug: string) => Effect<{ type: EntityType; id: string }>
}
```

### Provenance Services

```typescript
// SourceRegistry
interface SourceRegistry {
  readonly register: (source: IntelSource, config: SourceConfig) => Effect<void>
  readonly getPriority: (source: IntelSource) => Effect<number>
  readonly getWeight: (source: IntelSource) => Effect<number>
  readonly list: () => Effect<readonly SourceConfig[]>
}

// ConfidenceService
interface ConfidenceService {
  readonly calculate: (contributions: readonly SourceContribution[]) => Effect<Confidence>
  readonly compare: (a: Confidence, b: Confidence) => Effect<-1 | 0 | 1>
  readonly threshold: (confidence: Confidence, min: number) => Effect<boolean>
}

// StalenessService
interface StalenessService {
  readonly isStale: (entity: BaseEntity) => Effect<boolean>
  readonly getAge: (entity: BaseEntity) => Effect<Duration>
  readonly markStale: (entityId: EntityId) => Effect<void>
  readonly refresh: (entityId: EntityId) => Effect<void>
}

// ProvenanceService
interface ProvenanceService {
  readonly create: (params: CreateProvenanceParams) => Effect<EntityProvenance>
  readonly addContribution: (provenance: EntityProvenance, contribution: SourceContribution) => Effect<EntityProvenance>
  readonly recalculate: (provenance: EntityProvenance) => Effect<EntityProvenance>
}
```

### Lifecycle Services

```typescript
// EntityLifecycleService
interface EntityLifecycleService {
  readonly create: <E extends BaseEntity>(entity: E) => Effect<E, CreateError>
  readonly update: <E extends BaseEntity>(entity: E) => Effect<E, UpdateError | ConcurrencyError>
  readonly archive: (entityId: EntityId) => Effect<void, NotFoundError>
  readonly delete: (entityId: EntityId) => Effect<void, NotFoundError>
  readonly restore: (entityId: EntityId) => Effect<void, NotFoundError>
}

// VersioningService
interface VersioningService {
  readonly getVersion: (entityId: EntityId) => Effect<number, NotFoundError>
  readonly checkVersion: (entityId: EntityId, expected: number) => Effect<boolean, NotFoundError>
  readonly incrementVersion: (entityId: EntityId) => Effect<number, NotFoundError | ConcurrencyError>
}
```

### Fusion Services

```typescript
// EntityResolver
interface EntityResolver {
  readonly resolve: (incoming: IncomingData) => Effect<EntityId | null>
  readonly match: (a: BaseEntity, b: BaseEntity) => Effect<MatchScore>
  readonly findCandidates: (criteria: MatchCriteria) => Effect<readonly BaseEntity[]>
}

// EntityMerger
interface EntityMerger {
  readonly merge: (existing: BaseEntity, incoming: IncomingData) => Effect<BaseEntity>
  readonly selectValue: <T>(field: string, candidates: readonly FieldCandidate<T>[]) => Effect<T>
}

// FusionPipeline
interface FusionPipeline {
  readonly process: (incoming: IncomingData) => Effect<FusionResult>
  readonly processStream: (stream: Stream<IncomingData>) => Stream<FusionResult>
}
```

---

## Schema Improvements Needed

### 1. Schema Annotations
Add rich annotations for documentation, validation, and serialization:

```typescript
export const EntityId = Schema.String.pipe(
  Schema.pattern(/^[a-z]+-[0-9a-f]{8}$/),
  Schema.brand('EntityId'),
  Schema.annotations({
    identifier: 'EntityId',
    title: 'Entity Identifier',
    description: 'Unique identifier with type prefix (e.g., flight-a1b2c3d4)',
    examples: ['flight-a1b2c3d4', 'poi-e5f6g7h8'],
  })
)
```

### 2. Canonical Slugs
Add slug generation patterns:

```typescript
// Format: {type}/{source}/{external_id}
// Examples:
//   flight/opensky/abc123
//   poi/osm/node-123456
//   track/manual/TRK-001
```

### 3. EntityId via Service
Remove `generateEntityId()` function, replace with service:

```typescript
// Before (function)
const id = generateEntityId()

// After (service)
const id = yield* EntityIdService.generate('flight')
```

---

## Next Steps

1. [ ] Stub out service interfaces in `src/lib/ecs/services/`
2. [ ] Add Schema.annotations to all core schemas
3. [ ] Move domain entities to `src/lib/geoint/entities/`
4. [ ] Implement EntityIdService first (no dependencies)
5. [ ] Implement SourceRegistry (no dependencies)
6. [ ] Build up dependency chain from there
