# GEOINT Vertical Slice Architecture

## Overview

The GEOINT (Geospatial Intelligence) platform implements a fully reactive data pipeline with transactional consistency:

```
External APIs (OpenSky, ADSB.lol, Overpass, Open-Meteo, Planet, Sentinel)
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     INGESTERS (Node.js/Tauri)                       │
│  FlightIngester │ OsmIngester │ WeatherIngester │ ImageryIngester   │
└─────────────────────────────────────────────────────────────────────┘
        ↓ TRANSACTION (atomic)
┌─────────────────────────────────────────────────────────────────────┐
│  1. Write to PostgreSQL (raw.flight_positions, etc.)                │
│  2. Publish to DurableStream (FlightStreamHandle.appendBatch)       │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────┐     ┌────────────────────────────────┐
│     PostgreSQL/TimescaleDB│     │        DurableStreams          │
│  ┌─────────────────────┐  │     │  /flights                      │
│  │ raw.flight_positions│  │     │  /osm-pois                     │
│  │ raw.osm_elements    │  │     │  /weather                      │
│  │ raw.weather_obs     │  │     └────────────────────────────────┘
│  │ raw.imagery_items   │  │                ↓ SUBSCRIBE
│  └─────────────────────┘  │     ┌────────────────────────────────┐
│            ↓              │     │      ENTITY MATERIALIZERS      │
│  ┌─────────────────────┐  │     │  FlightEntityMaterializer      │
│  │ entity.entities     │←─┼─────│  OsmEntityMaterializer         │
│  │ entity.spatial      │  │     │  WeatherEntityMaterializer     │
│  │ entity.kinetic      │  │     └────────────────────────────────┘
│  │ entity.identifiable │  │
│  │ entity.weather      │  │
│  └─────────────────────┘  │
│            ↓              │
│  ┌─────────────────────┐  │
│  │   ElectricSQL Sync  │──┼──→ HTTP Shape Streams
│  └─────────────────────┘  │
└───────────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER/REACT                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  useFlightEntitiesWithTraits()  │  useEntities()            │   │
│  │  usePoiEntities()               │  useSpatialTraits()       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  geointRegistry (effect-atom)                               │   │
│  │  resultsAtom │ timelinePlaybackAtom │ layerVisibilityAtom   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  UI Components                                              │   │
│  │  GeointMap │ SearchPanel │ TimelineControls │ EntityDetail  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Patterns

### 1. Transactional Outbox Pattern

**Location**: `src/lib/geoint/ingestion/FlightIngester.ts:410-455`

```typescript
// TRANSACTIONAL: Write to Postgres + Publish to Stream in same transaction
return sql.withTransaction(
  Effect.gen(function* () {
    // 1. Insert into raw.flight_positions
    const insertedCount = yield* flightRepo.insertPositions(positions);

    // 2. Publish to DurableStream (within same transaction)
    yield* streamHandle.appendBatch(events);

    return insertedCount;
  })
);
```

**Guarantees**:
- If transaction fails, neither DB write nor stream publish happens
- Stream becomes append-only log for replay/recovery
- Materializers can resume from last committed offset

### 2. Entity Materializer Pattern

**Location**: `src/lib/geoint/persistence/FlightEntityMaterializer.ts`

```typescript
// Subscribe to DurableStream
const stream = yield* dsClient.subscribe<FlightPositionEvent>({
  url: `${config.durableStreamsUrl}${config.flightStreamPath}`,
  offset: '-1',
  live: 'auto',
})

// Process events → Upsert ECS entities
yield* stream.pipe(
  Stream.mapEffect((batch) =>
    sql.withTransaction(
      Effect.gen(function* () {
        for (const event of batch.items) {
          yield* upsertEntity(event)
          yield* upsertSpatialTrait(entity.id, event.position)
          yield* upsertKineticTrait(entity.id, event)
          yield* upsertIdentifiableTrait(entity.id, event.icao24, event.callsign)
        }
      })
    )
  ),
  Stream.runDrain
)
```

### 3. Stream Handle Service Pattern

**Location**: `src/lib/geoint/services/FlightStreamHandle.ts`

```typescript
export class FlightStreamHandle extends Context.Tag('geoint/FlightStreamHandle')<
  FlightStreamHandle,
  FlightStreamHandleShape
>() {}

interface FlightStreamHandleShape {
  getHandle: () => Effect<EffectStreamHandle<FlightPositionEvent>, Error, Scope>
  append: (event: FlightPositionEvent) => Effect<void, Error>
  appendBatch: (events: readonly FlightPositionEvent[]) => Effect<void, Error>
}
```

### 4. Electric Sync Hooks

**Location**: `src/lib/ecs/electric/index.ts`

```typescript
export function useFlightEntitiesWithTraits(): {
  data: FlightEntityWithTraits[]
  isLoading: boolean
  error: unknown
} {
  const entities = useFlightEntities()
  const spatial = useSpatialTraits()
  const kinetic = useKineticTraits()
  const identifiable = useIdentifiableTraits()

  // Join entities with traits by entity_id
  return entities.data.map(e => ({
    ...e,
    spatial: spatial.data.find(s => s.entity_id === e.id),
    kinetic: kinetic.data.find(k => k.entity_id === e.id),
    identifiable: identifiable.data.find(i => i.entity_id === e.id),
  }))
}
```

### 5. Atom Operations Pattern

**Location**: `src/lib/geoint/atoms/ingestion-operations.ts`

```typescript
// Browser-safe operations that trigger Node.js-side effects
export const startIngestion = async (pgConfig: PgConfig) => {
  if (!isNodeEnvironment()) {
    throw new Error('Ingestion requires Node.js environment')
  }

  // Dynamic imports for Node.js-only dependencies
  const { PgClient } = await import('@effect/sql-pg')
  const layer = await createIngestionLayer(pgConfig)

  // Run Effect program
  await Effect.runPromise(
    Effect.gen(function* () {
      const orchestrator = yield* IngestionOrchestratorTag
      yield* orchestrator.startAll()

      // Update atoms via registry
      geointRegistry.set(ingestionStatusAtom, yield* orchestrator.status())
    }).pipe(Effect.provide(layer))
  )
}
```

### 6. AtomRpc.Tag Caching Pattern

**Location**: `src/lib/geoint/clients/SearchClient.ts`

```typescript
// AtomRpc.Tag creates a client with automatic caching and reactivity
export const SearchClient = AtomRpc.Tag<SearchClient>()('SearchClient', {
  search: AtomRpc.procedure({
    input: SearchQuery,
    output: SearchResponse,
    // TTL-based caching (30 seconds)
    cache: { ttl: '30 seconds' },
    // Reactivity keys for selective invalidation
    reactivityKeys: (input) => [`search:${input.id}`, `bounds:${JSON.stringify(input.geoFilter)}`],
  }),
})

// Cache invalidation on mutation
export const invalidateSearchCache = (bounds: BBox) => {
  SearchClient.invalidate(`bounds:${JSON.stringify(bounds)}`)
}
```

**Demonstrates**:
- TTL-based query caching
- Reactivity keys for cache invalidation
- Mutation → cache invalidation flow
- See `AtomRpcTestbed` for interactive demo

### 7. Ingestion Orchestrator Pattern

**Location**: `src/lib/geoint/ingestion/IngestionOrchestrator.ts`

```typescript
// Effect.Service with Context.Tag for dependency injection
export class IngestionOrchestratorTag extends Context.Tag('geoint/IngestionOrchestrator')<
  IngestionOrchestratorTag,
  IngestionOrchestrator
>() {}

// Factory uses optional services via Effect.serviceOption()
export const makeIngestionOrchestrator = Effect.gen(function* () {
  const config = yield* IngestionOrchestratorConfigTag
  const flightIngester = yield* Effect.serviceOption(FlightIngesterTag)
  const osmIngester = yield* Effect.serviceOption(OsmIngesterTag)
  // ...

  // Fiber state tracked via Ref + HashMap
  const fibersRef = yield* Ref.make(HashMap.empty<IngesterName, FiberState>())

  // Start all enabled ingesters concurrently
  const start = () =>
    Effect.gen(function* () {
      const toStart: IngesterName[] = []
      if (config.enableFlight && Option.isSome(flightIngester)) toStart.push('flight')
      // ...
      yield* Effect.forEach(toStart, startOne, { concurrency: 'unbounded' })
    })

  // Graceful shutdown via Fiber.interrupt
  const stop = () =>
    Effect.gen(function* () {
      const fibers = yield* Ref.get(fibersRef)
      const running = Array.from(HashMap.keys(fibers))
      yield* Effect.forEach(running, stopOne, { concurrency: 'unbounded' })
    })

  return { start, stop, startIngester, stopIngester, status, config }
})
```

**Demonstrates**:
- Effect.Service<> with Context.Tag for type-safe DI
- Effect.serviceOption for optional dependencies
- Ref + HashMap for mutable fiber state
- Effect.forEach with concurrency for parallel operations
- Fiber.interrupt for graceful shutdown
- See `IngestionOrchestratorTestbed` for interactive demo

### 8. Entity UI Atoms Pattern

**Location**: `src/lib/geoint/kori/entity-atoms.ts`

```typescript
// Atom.family pattern - one atom per entity
const entityUIStateCache = new Map<string, Writable<EntityUIState, EntityUIState>>()

export function entityUIStateFamily(entityId: string): Writable<EntityUIState, EntityUIState> {
  let atom = entityUIStateCache.get(entityId)
  if (!atom) {
    atom = Atom.make<EntityUIState>(DEFAULT_ENTITY_UI_STATE)
    entityUIStateCache.set(entityId, atom)
  }
  return atom
}

// HashSet-based selection management
export const selectedEntityIds = Atom.make(HashSet.empty<string>())
export const hoveredEntityId = Atom.make(Option.none<string>())

// Synchronous operations via registry
export const entityOps = {
  select: (entityId: string) => {
    geointRegistry.update(selectedEntityIds, (ids) => HashSet.add(ids, entityId))
    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, selected: true }))
  },
  toggleSelect: (entityId: string) => {
    const uiAtom = entityUIStateFamily(entityId)
    const current = geointRegistry.get(uiAtom)
    if (current.selected) entityOps.deselect(entityId)
    else entityOps.select(entityId)
  },
  // ... more operations
}
```

**Demonstrates**:
- Atom.family via Map-based memoization (same ID → same atom)
- HashSet for immutable multi-select collections
- Option for single nullable hover state
- registry.get()/set() for synchronous React callback access
- Operations object pattern for encapsulated mutations
- See `EntityUIAtomsTestbed` for interactive demo

## File Structure

```
src/lib/geoint/
├── api/                          # External API clients
│   ├── ExternalApiClient.ts      # OpenSky, Overpass, Planet, etc.
│   ├── retry.ts                  # Resilient retry policies
│   └── tracing.ts                # OpenTelemetry integration
│
├── atoms/                        # Reactive state (effect-atom)
│   ├── index.ts                  # geointRegistry, viewportAtom, searchAtoms
│   ├── ingestion-operations.ts   # Ingestion control operations
│   └── layoutAtoms.ts            # Panel state
│
├── clients/                      # RPC clients
│   └── SearchClient.ts           # AtomRpc.Tag search client
│
├── cluster/                      # Effect Cluster (distributed)
│   ├── cluster-node.ts           # Cluster runner entry point
│   ├── SearchEntity.ts           # Sharded search entity
│   └── SearchEntityHandlers.ts   # Entity message handlers
│
├── components/                   # React UI components
│   ├── GeointShell.tsx           # Main dashboard shell
│   ├── SearchPanelCompound.tsx   # Search panel
│   ├── TimelineControlsV2.tsx    # Timeline playback
│   └── ...
│
├── ingestion/                    # Data ingesters
│   ├── FlightIngester.ts         # OpenSky + ADSB.lol
│   ├── OsmIngester.ts            # Overpass API
│   ├── WeatherIngester.ts        # Open-Meteo
│   ├── ImageryIngester.ts        # Planet + Sentinel
│   ├── IngestionOrchestrator.ts  # Coordinates all ingesters
│   └── index.ts                  # Barrel export
│
├── kori/                         # Entity management
│   ├── entity-atoms.ts           # Entity store atoms
│   ├── search-result-mapper.ts   # SearchResult → Entity
│   └── traits/                   # Trait schemas
│       ├── position.ts
│       ├── source-confidence.ts
│       └── ui-state.ts
│
├── machines/                     # XState v5 machines
│   ├── timelineMachine.ts        # Timeline playback FSM
│   ├── searchMachine.ts          # Search state FSM
│   └── ...
│
├── persistence/                  # Database layer
│   ├── FlightEntityMaterializer.ts   # Stream → ECS
│   ├── OsmEntityMaterializer.ts
│   ├── WeatherEntityMaterializer.ts
│   ├── TrackStore.ts             # Track persistence
│   └── postgis/                  # PostGIS repositories
│       ├── FlightRepository.ts
│       ├── PoiRepository.ts
│       ├── WeatherRepository.ts
│       ├── ImageryRepository.ts
│       ├── GeointRepository.ts   # Facade
│       └── schemas.ts            # DB models
│
├── schemas/                      # Effect Schema types
│   ├── core.ts                   # TrackId, BBox, Position
│   ├── search.ts                 # SearchQuery, SearchResponse
│   ├── flight-events.ts          # FlightPositionEvent
│   ├── errors.ts                 # SearchError union
│   └── index.ts                  # Barrel
│
├── server/                       # RPC server handlers
│   └── SearchRpcServer.ts        # Search RPC implementation
│
└── services/                     # Effect services
    ├── FlightStreamHandle.ts     # DurableStream handle
    ├── OsmStreamHandle.ts
    ├── WeatherStreamHandle.ts
    └── SearchService.ts          # Search orchestration

src/lib/ecs/
├── electric/
│   └── index.ts                  # Electric hooks (useFlightEntitiesWithTraits)
└── schemas/
    └── core.ts                   # EntityType, IntelSource

src/lib/durable-streams/
├── service.ts                    # DurableStreamClient service
└── ...
```

## Testbed Coverage

**`src/components/testbed/ECSVerticalSliceTestbed.tsx`**

Demonstrates complete vertical slice:
- ✅ Ingestion control (start/stop all ingesters)
- ✅ Individual ingester toggling
- ✅ Electric sync (useFlightEntitiesWithTraits)
- ✅ DurableStream subscription
- ✅ Materializer control
- ✅ Timeline playback
- ✅ Connection status monitoring
- ✅ ECS entity → SearchResult conversion

Route: `/testbed/ecs-vertical-slice`

## Docker Services

```yaml
# docker/docker-compose.yml
services:
  postgres:     # TimescaleDB + PostGIS
  electric:     # ElectricSQL sync
  durable-streams:  # Event streaming
  nats:         # Messaging (optional)
```

Connection strings:
- PostgreSQL: `postgres://tmnl:tmnl_dev_password@localhost:5432/tmnl`
- Electric: `http://localhost:3000`
- DurableStreams: `http://localhost:3030`

## All Vertical Slices

### Flight Vertical Slice ✅ COMPLETE
- FlightIngester → raw.flight_positions → FlightStreamHandle → FlightEntityMaterializer → entity.* → Electric → useFlightEntitiesWithTraits

### OSM/POI Vertical Slice ✅ COMPLETE
- OsmIngester → raw.osm_elements → OsmStreamHandle → OsmEntityMaterializer → entity.* → Electric → usePoiEntities

### Weather Vertical Slice ✅ COMPLETE
- WeatherIngester → raw.weather_observations → WeatherStreamHandle → WeatherEntityMaterializer → entity.* → Electric → useWeatherEntities

### Search Vertical Slice ✅ COMPLETE
- SearchClient (AtomRpc.Tag) → SearchRpcServer → External APIs + Repositories → SearchResponse → Atoms → UI

## Testbed Coverage

| Testbed | Route | Focus |
|---------|-------|-------|
| ECSVerticalSliceTestbed | /testbed/ecs-vertical-slice | Ingestion → Electric → UI flow |
| GeointTestbed | /testbed/geoint | Search + Map integration |
| AllintCopTestbed | /testbed/allint-cop | Multi-source search |
| GeointDashboardTestbed | /testbed/geoint-dashboard | Full dashboard with SearchClient |
| DurableStreamTestbed | /testbed/durable-stream | Streaming search with atom-based reactive state |
| SearchToKoriTestbed | /testbed/search-to-kori | Search → Kori Entity deduplication flow |
| TimelineSearchTestbed | /testbed/timeline-search | XState v5 → Atom filtering → Reactive results |
| AtomRpcTestbed | /testbed/atom-rpc | AtomRpc.Tag caching + reactivity keys + TTL |
| MaterializerFlowTestbed | /testbed/materializer-flow | Transactional Outbox: Ingestion → Stream → Materializer → Electric |
| IngestionOrchestratorTestbed | /testbed/ingestion-orchestrator | Effect.Service lifecycle: Fiber management, Layer composition, Ref+HashMap state |
| EntityUIAtomsTestbed | /testbed/entity-ui-atoms | Atom.family per-entity state, HashSet selection, Option hover, entityOps |
| ElectricSyncTestbed | /testbed/electric-sync | ElectricSQL shape subscriptions, trait hooks, useFlightEntitiesWithTraits() joins |
| SearchServiceTestbed | /testbed/search-service | Effect.Service + Atom patterns, Schema.TaggedClass validation, HashMap result grouping |

## Remaining Integration Work

1. **Effect Cluster Deployment** - cluster-node.ts ready but containers not deployed
2. ~~**Search Result Deduplication**~~ - ✅ SearchToKoriTestbed demonstrates Search → Kori Entity flow
3. ~~**Timeline + Search Integration**~~ - ✅ TimelineSearchTestbed demonstrates XState machine → Atom filtering
4. **Imagery Vertical Slice** - ImageryIngester exists but ImageryEntityMaterializer not implemented
