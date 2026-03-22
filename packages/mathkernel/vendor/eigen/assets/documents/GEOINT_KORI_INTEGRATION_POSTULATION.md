# GEOINT + Kori Integration Postulation

**Document Type**: Architectural Postulation
**Status**: Conceptual Draft
**Date**: 2026-01-10

---

## Thesis

> **GEOINT entities ARE Kori entities. Search results, tracks, POIs, weather observations —
> they are all entities with traits. The UI state attached to them (selected, hovered, expanded)
> are also traits. Atom.family becomes the reactive bridge. XState orchestrates transitions.**

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           GEOINT-KORI UNIFIED ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              SEARCH INFRASTRUCTURE                               │   │
│   │                         (Already exists - no RPC needed)                         │   │
│   │                                                                                  │   │
│   │   SearchEntityHandlers ──► FlightRepo ──► PostGIS ──► SearchResultItem[]        │   │
│   │                        ──► PoiRepo                                               │   │
│   │                        ──► WeatherRepo                                           │   │
│   └──────────────────────────────────┬──────────────────────────────────────────────┘   │
│                                      │                                                   │
│                                      ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              KORI WORLD                                          │   │
│   │                     (ECS container for GEOINT entities)                          │   │
│   │                                                                                  │   │
│   │   SearchResult[] ────────────► KoriWorld.spawn() ────────► Entity + Traits      │   │
│   │                                                                                  │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│   │   │   Flight    │  │    POI      │  │   Weather   │  │   Track     │            │   │
│   │   │   Entity    │  │   Entity    │  │   Entity    │  │   Entity    │            │   │
│   │   │             │  │             │  │             │  │             │            │   │
│   │   │ +Position3D │  │ +Position2D │  │ +Position2D │  │ +Position2D │            │   │
│   │   │ +Velocity3D │  │ +Name       │  │ +Temperature│  │ +Velocity2D │            │   │
│   │   │ +FlightData │  │ +Category   │  │ +WeatherCode│  │ +TrackData  │            │   │
│   │   │ +UIState    │  │ +UIState    │  │ +UIState    │  │ +UIState    │            │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│   │                                                                                  │   │
│   └──────────────────────────────────┬──────────────────────────────────────────────┘   │
│                                      │                                                   │
│                                      ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                           KORI QUERY STREAM                                      │   │
│   │                    (Reactive subscriptions to entity changes)                    │   │
│   │                                                                                  │   │
│   │   subscribe({ filter: { with: ["UIState", "Selected"] } })                      │   │
│   │        │                                                                         │   │
│   │        ├──► Stream<EntityAdded | EntityUpdated | EntityRemoved>                 │   │
│   │        │                                                                         │   │
│   │        └──► Atom.family integration (reactive bridge)                           │   │
│   │                                                                                  │   │
│   └──────────────────────────────────┬──────────────────────────────────────────────┘   │
│                                      │                                                   │
│                                      ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              ATOM.FAMILY BRIDGE                                  │   │
│   │                     (Hyper-granular reactive state per entity)                   │   │
│   │                                                                                  │   │
│   │   entityAtomFamily(entityId) ◄───────────────────► KoriWorld.getTrait(id, ...)  │   │
│   │                                                                                  │   │
│   │   ┌─────────────────────────────────────────────────────────────────────┐       │   │
│   │   │  Two-Way Sync:                                                       │       │   │
│   │   │                                                                      │       │   │
│   │   │  KoriWorld.setTrait(id, "UIState", {...}) ──► atom update ──► React │       │   │
│   │   │  registry.set(entityAtom(id), {...})      ──► KoriWorld mutation    │       │   │
│   │   └─────────────────────────────────────────────────────────────────────┘       │   │
│   │                                                                                  │   │
│   └──────────────────────────────────┬──────────────────────────────────────────────┘   │
│                                      │                                                   │
│                                      ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              XSTATE ORCHESTRATION                                │   │
│   │                        (Layout transitions, UI state machines)                   │   │
│   │                                                                                  │   │
│   │   layoutMachine ◄────────────────────────────────► floatingPanelFamily          │   │
│   │   searchMachine ◄────────────────────────────────► searchStateAtom              │   │
│   │   entityDetailMachine ◄──────────────────────────► entityAtomFamily             │   │
│   │                                                                                  │   │
│   │   KoriActor.spawn(entityId, machine) ──► Entity-bound state machines            │   │
│   │                                                                                  │   │
│   └──────────────────────────────────┬──────────────────────────────────────────────┘   │
│                                      │                                                   │
│                                      ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              REACT UI LAYER                                      │   │
│   │                                                                                  │   │
│   │   useGeointEntity(id) ──► useAtomValue(entityAtomFamily(id))                    │   │
│   │   useGeointPanel(panel) ──► useAtomValue(panelAtomFamily(panel))                │   │
│   │   useGeointLayout() ──► useAtomValue(layoutModeAtom) + useMachine()             │   │
│   │                                                                                  │   │
│   │   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐           │   │
│   │   │   SearchPanel     │  │   EntityPanel     │  │   GeointMap       │           │   │
│   │   │   (Compound)      │  │   (Compound)      │  │   (MapGL)         │           │   │
│   │   │                   │  │                   │  │                   │           │   │
│   │   │ .Root             │  │ .Root             │  │ EntityMarkers     │           │   │
│   │   │ .Input            │  │ .Header           │  │ (per-entity atom) │           │   │
│   │   │ .Results          │  │ .Details          │  │                   │           │   │
│   │   │ .StatusBar        │  │ .Actions          │  │                   │           │   │
│   │   └───────────────────┘  └───────────────────┘  └───────────────────┘           │   │
│   │                                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Kori?

### Current Problem

GEOINT has **three separate state systems** that don't talk to each other:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE FRAGMENTATION                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. SEARCH RESULTS (arrays)          2. UI STATE (useState/atoms)      │
│   ┌─────────────────────────┐         ┌─────────────────────────┐       │
│   │ resultsAtom: Result[]   │         │ selectedAtom: string    │       │
│   │                         │    ✗    │ hoveredAtom: string     │       │
│   │ (data lives here)       │◄───────►│ expandedAtom: Set       │       │
│   │                         │ No link │                         │       │
│   └─────────────────────────┘         └─────────────────────────┘       │
│                                                                          │
│   3. XSTATE MACHINES (isolated)                                          │
│   ┌─────────────────────────┐                                           │
│   │ layoutMachine           │                                           │
│   │ searchMachine           │    ✗ No sync with atoms                   │
│   │ entityDetailMachine     │                                           │
│   └─────────────────────────┘                                           │
│                                                                          │
│   RESULT: State divergence, prop drilling, stale data                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Kori Solution

**Entities unify data + UI state as traits on the same object:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      KORI UNIFIED ENTITY MODEL                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Entity: "flight-ABC123"                                                │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                                                                  │   │
│   │   DATA TRAITS                    UI TRAITS                       │   │
│   │   ┌───────────────────┐          ┌───────────────────┐          │   │
│   │   │ Position3D        │          │ UIState           │          │   │
│   │   │ { x, y, altitude }│          │ { selected: true  │          │   │
│   │   ├───────────────────┤          │   hovered: false  │          │   │
│   │   │ FlightData        │          │   expanded: true  │          │   │
│   │   │ { icao24, call... }          │   highlighted: f. }          │   │
│   │   ├───────────────────┤          ├───────────────────┤          │   │
│   │   │ Velocity3D        │          │ ViewportPresence  │          │   │
│   │   │ { dx, dy, dz }    │          │ { inView: true }  │          │   │
│   │   └───────────────────┘          └───────────────────┘          │   │
│   │                                                                  │   │
│   │   ACTOR TRAIT (optional)                                         │   │
│   │   ┌───────────────────┐                                         │   │
│   │   │ BoundActor        │                                         │   │
│   │   │ { machine: ref }  │  ◄── XState actor for this entity       │   │
│   │   └───────────────────┘                                         │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   SINGLE SOURCE OF TRUTH: KoriWorld                                     │
│   REACTIVE ACCESS: KoriQueryStream → Atom.family → React                │
│   BEHAVIOR: KoriActor (per-entity state machines)                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Trait Taxonomy for GEOINT

### Data Traits (from search infrastructure)

```typescript
// Position traits
const Position2D = defineTrait({
  id: "Position2D",
  schema: Schema.Struct({
    _tag: Schema.Literal("Position2D"),
    x: Schema.Number,  // longitude
    y: Schema.Number,  // latitude
  }),
})

const Position3D = defineTrait({
  id: "Position3D",
  schema: Schema.Struct({
    _tag: Schema.Literal("Position3D"),
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,  // altitude in meters
  }),
})

// Source-specific data traits
const FlightData = defineTrait({
  id: "FlightData",
  schema: Schema.Struct({
    _tag: Schema.Literal("FlightData"),
    icao24: Schema.String,
    callsign: Schema.optional(Schema.String),
    heading: Schema.Number,
    velocity: Schema.Number,
    verticalRate: Schema.Number,
    onGround: Schema.Boolean,
    source: Schema.Literal("opensky", "adsb_lol"),
    lastSeen: Schema.DateFromNumber,
  }),
})

const PoiData = defineTrait({
  id: "PoiData",
  schema: Schema.Struct({
    _tag: Schema.Literal("PoiData"),
    osmId: Schema.String,
    name: Schema.optional(Schema.String),
    category: Schema.String,
    tags: Schema.Record(Schema.String, Schema.String),
  }),
})

const WeatherData = defineTrait({
  id: "WeatherData",
  schema: Schema.Struct({
    _tag: Schema.Literal("WeatherData"),
    temperature: Schema.Number,
    humidity: Schema.Number,
    weatherCode: Schema.Number,
    windSpeed: Schema.Number,
    windDirection: Schema.Number,
    observedAt: Schema.DateFromNumber,
  }),
})

const TrackData = defineTrait({
  id: "TrackData",
  schema: Schema.Struct({
    _tag: Schema.Literal("TrackData"),
    trackId: Schema.String,
    classification: Schema.optional(Schema.String),
    confidence: Schema.Number,
    history: Schema.Array(Schema.Struct({
      time: Schema.DateFromNumber,
      position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
    })),
  }),
})
```

### UI Traits (hyper-granular state)

```typescript
// Core UI state - attached to every GEOINT entity
const UIState = defineTrait({
  id: "UIState",
  schema: Schema.Struct({
    _tag: Schema.Literal("UIState"),
    selected: Schema.Boolean,
    hovered: Schema.Boolean,
    expanded: Schema.Boolean,
    highlighted: Schema.Boolean,
    pinned: Schema.Boolean,
    focusRing: Schema.Boolean,  // for keyboard navigation
  }),
})

// Source confidence (Multi-INT fusion from C2 patterns)
const SourceConfidence = defineTrait({
  id: "SourceConfidence",
  schema: Schema.Struct({
    _tag: Schema.Literal("SourceConfidence"),
    confidence: Schema.Number,  // 0-1
    staleness: Schema.Number,   // seconds since last update
    conflicting: Schema.Boolean, // sources disagree
    sources: Schema.Array(Schema.String),
  }),
})

// Viewport presence (Bloomberg monitor chain pattern)
const ViewportPresence = defineTrait({
  id: "ViewportPresence",
  schema: Schema.Struct({
    _tag: Schema.Literal("ViewportPresence"),
    inMapView: Schema.Boolean,
    inTimelineView: Schema.Boolean,
    inListView: Schema.Boolean,
    zIndex: Schema.Number,
  }),
})

// Animation state (for anime.js transitions)
const AnimationState = defineTrait({
  id: "AnimationState",
  schema: Schema.Struct({
    _tag: Schema.Literal("AnimationState"),
    entering: Schema.Boolean,
    exiting: Schema.Boolean,
    morphing: Schema.Boolean,
    targetPosition: Schema.optional(Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
    })),
  }),
})
```

### Marker Traits (for queries)

```typescript
// Tag traits for fast filtering
const IsFlight = defineTrait({ id: "IsFlight", schema: Schema.Struct({ _tag: Schema.Literal("IsFlight") }) })
const IsPoi = defineTrait({ id: "IsPoi", schema: Schema.Struct({ _tag: Schema.Literal("IsPoi") }) })
const IsWeather = defineTrait({ id: "IsWeather", schema: Schema.Struct({ _tag: Schema.Literal("IsWeather") }) })
const IsTrack = defineTrait({ id: "IsTrack", schema: Schema.Struct({ _tag: Schema.Literal("IsTrack") }) })
const IsSelected = defineTrait({ id: "IsSelected", schema: Schema.Struct({ _tag: Schema.Literal("IsSelected") }) })
const IsInViewport = defineTrait({ id: "IsInViewport", schema: Schema.Struct({ _tag: Schema.Literal("IsInViewport") }) })
```

---

## The Atom.family ↔ Kori Bridge

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              ATOM.FAMILY ↔ KORI BRIDGE                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                                  │   │
│   │   Atom.family(entityId)                    KoriWorld                            │   │
│   │   ┌───────────────────┐                    ┌───────────────────┐                │   │
│   │   │                   │                    │                   │                │   │
│   │   │  entityAtom(id)   │◄──── sync ────────►│  Entity + Traits  │                │   │
│   │   │                   │                    │                   │                │   │
│   │   │  { selected,      │                    │  UIState trait    │                │   │
│   │   │    hovered,       │                    │  { selected,      │                │   │
│   │   │    expanded,      │                    │    hovered,       │                │   │
│   │   │    ... }          │                    │    expanded }     │                │   │
│   │   │                   │                    │                   │                │   │
│   │   └─────────┬─────────┘                    └─────────┬─────────┘                │   │
│   │             │                                        │                          │   │
│   │             │  useAtomValue()                        │  KoriQueryStream         │   │
│   │             │                                        │                          │   │
│   │             ▼                                        ▼                          │   │
│   │   ┌───────────────────┐                    ┌───────────────────┐                │   │
│   │   │                   │                    │                   │                │   │
│   │   │   React Component │                    │  Stream<Event>    │                │   │
│   │   │                   │◄─── subscribe ─────│                   │                │   │
│   │   │   - re-renders on │                    │  - EntityAdded    │                │   │
│   │   │     atom change   │                    │  - EntityUpdated  │                │   │
│   │   │                   │                    │  - EntityRemoved  │                │   │
│   │   └───────────────────┘                    └───────────────────┘                │   │
│   │                                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
│   IMPLEMENTATION:                                                                        │
│                                                                                          │
│   // Bridge service that syncs Kori ↔ Atoms                                             │
│   export class GeointKoriBridge extends Effect.Service<GeointKoriBridge>()(...) {       │
│                                                                                          │
│     // Spawn entity from search result, create corresponding atom                       │
│     spawnFromSearchResult: (result: SearchResultItem) => Effect<KoriEntity>             │
│                                                                                          │
│     // Subscribe to UIState changes, update atoms                                       │
│     syncUIStateToAtoms: () => Effect<void>                                              │
│                                                                                          │
│     // Subscribe to atom changes, update Kori traits                                    │
│     syncAtomsToUIState: () => Effect<void>                                              │
│   }                                                                                      │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Sketch

```typescript
// src/lib/geoint/kori/GeointKoriBridge.ts

import { Effect, Stream, Layer } from 'effect'
import { Atom, Registry } from '@effect-atom/atom'
import { KoriWorld, KoriQueryStream } from '@/lib/kori'
import type { SearchResultItem } from '../schemas'

// Atom family for per-entity UI state
export const entityUIStateFamily = Atom.family((entityId: string) =>
  Atom.make<UIStateData>({
    selected: false,
    hovered: false,
    expanded: false,
    highlighted: false,
    pinned: false,
    focusRing: false,
  }).pipe(Atom.keepAlive)
)

// Bridge service
export class GeointKoriBridge extends Effect.Service<GeointKoriBridge>()('geoint/KoriBridge', {
  effect: Effect.gen(function* () {
    const world = yield* KoriWorld
    const queryStream = yield* KoriQueryStream
    const registry = geointRegistry // module-level registry

    // Spawn entity from search result
    const spawnFromSearchResult = (result: SearchResultItem) =>
      Effect.gen(function* () {
        const traits = searchResultToTraits(result)
        const entity = yield* world.spawn(traits)

        // Initialize corresponding atom
        registry.set(entityUIStateFamily(entity.id), {
          selected: false,
          hovered: false,
          expanded: false,
          highlighted: false,
          pinned: false,
          focusRing: false,
        })

        return entity
      })

    // Sync Kori → Atoms (when traits change)
    const syncKoriToAtoms = Effect.gen(function* () {
      const subscription = yield* queryStream.subscribe({
        filter: { with: ["UIState"] },
        bufferSize: 1000,
      })

      yield* subscription.stream.pipe(
        Stream.runForEach((event) => {
          if (event.type === 'updated' && event.traitId === 'UIState') {
            registry.set(entityUIStateFamily(event.entity.id), event.data as UIStateData)
          }
          return Effect.void
        })
      )
    })

    // Sync Atoms → Kori (when atoms change externally)
    const syncAtomsToKori = (entityId: string) => {
      return registry.subscribe(entityUIStateFamily(entityId), (newState) => {
        // Update Kori trait (fire-and-forget)
        Effect.runFork(
          world.setTrait(entityId, "UIState", { _tag: "UIState", ...newState })
        )
      })
    }

    return {
      spawnFromSearchResult,
      syncKoriToAtoms,
      syncAtomsToKori,
    }
  }),
  dependencies: [KoriWorldLive, KoriQueryStreamLive],
}) {}
```

---

## XState + Kori Actor Integration

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           XSTATE + KORI ACTOR INTEGRATION                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   LAYOUT ORCHESTRATION (global)           ENTITY BEHAVIOR (per-entity)                  │
│   ┌─────────────────────────────┐         ┌─────────────────────────────┐               │
│   │                             │         │                             │               │
│   │     layoutMachine           │         │   KoriActor.spawn(          │               │
│   │     ┌─────────────────┐     │         │     entityId,               │               │
│   │     │                 │     │         │     entityDetailMachine     │               │
│   │     │  command ──────►│     │         │   )                         │               │
│   │     │     │           │     │         │                             │               │
│   │     │     ▼           │     │         │   Entity-bound actor:       │               │
│   │     │  focus ────────►│     │         │   ┌─────────────────────┐   │               │
│   │     │     │           │     │         │   │ idle                │   │               │
│   │     │     ▼           │     │         │   │   │                 │   │               │
│   │     │  analytics      │     │         │   │   ▼ SELECT          │   │               │
│   │     │                 │     │         │   │ selected            │   │               │
│   │     └─────────────────┘     │         │   │   │                 │   │               │
│   │                             │         │   │   ▼ EXPAND          │   │               │
│   │   Actions sync to atoms:    │         │   │ expanded ──► fetch  │   │               │
│   │   entry: syncLayoutAtom     │         │   │   │         detail  │   │               │
│   │                             │         │   │   ▼                 │   │               │
│   │                             │         │   │ detailed            │   │               │
│   │                             │         │   └─────────────────────┘   │               │
│   │                             │         │                             │               │
│   └─────────────────────────────┘         └─────────────────────────────┘               │
│                                                                                          │
│   COORDINATION: Layout machine events trigger entity actor events                       │
│                                                                                          │
│   layoutMachine.send('SET_LAYOUT', { layout: 'focus' })                                 │
│       │                                                                                  │
│       └──► For each selected entity:                                                    │
│               KoriActor.send(entityId, { type: 'LAYOUT_CHANGED', layout: 'focus' })    │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Monitor Chain Pattern (Bloomberg-Inspired)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              MONITOR CHAIN PATTERN                                       │
│                        (Selection propagation via Kori traits)                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   USER ACTION: Click entity in SearchPanel                                              │
│       │                                                                                  │
│       ▼                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │ 1. Update Kori trait                                                             │   │
│   │    world.setTrait(entityId, "UIState", { ...state, selected: true })            │   │
│   │    world.addTrait(entityId, "IsSelected", { _tag: "IsSelected" })               │   │
│   └──────────────────────────────────────┬──────────────────────────────────────────┘   │
│                                          │                                               │
│                                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │ 2. KoriQueryStream emits                                                         │   │
│   │    { type: 'updated', entityId, traitId: 'UIState', data: { selected: true } }  │   │
│   └──────────────────────────────────────┬──────────────────────────────────────────┘   │
│                                          │                                               │
│                  ┌───────────────────────┼───────────────────────┐                      │
│                  │                       │                       │                      │
│                  ▼                       ▼                       ▼                      │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐            │
│   │ 3a. SearchPanel     │  │ 3b. EntityPanel     │  │ 3c. GeointMap       │            │
│   │                     │  │                     │  │                     │            │
│   │ useAtomValue(       │  │ useAtomValue(       │  │ useAtomValue(       │            │
│   │   entityUIState(id) │  │   entityUIState(id) │  │   entityUIState(id) │            │
│   │ )                   │  │ )                   │  │ )                   │            │
│   │                     │  │                     │  │                     │            │
│   │ → Highlight row     │  │ → Show details      │  │ → Pan to entity     │            │
│   │                     │  │                     │  │ → Highlight marker  │            │
│   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘            │
│                                                                                          │
│   ALL PANELS REACT TO SINGLE SOURCE OF TRUTH (Kori entity trait)                        │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Search Result → Kori Entity Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         SEARCH RESULT → KORI ENTITY FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   1. SEARCH EXECUTES                                                                    │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                                  │   │
│   │   SearchEntityHandlers.AggregatedSearch(bounds, sources)                        │   │
│   │       │                                                                          │   │
│   │       ├──► FlightRepo.findInBbox()  ──► SearchResultFlight[]                    │   │
│   │       ├──► PoiRepo.findInBbox()     ──► SearchResultPoi[]                       │   │
│   │       ├──► WeatherRepo.findNearest() ──► SearchResultWeather[]                  │   │
│   │       └──► TrackRepo.findInBbox()   ──► SearchResultTrack[]                     │   │
│   │                                                                                  │   │
│   │   Result: SearchResultItem[] (discriminated union)                              │   │
│   │                                                                                  │   │
│   └──────────────────────────────────────┬──────────────────────────────────────────┘   │
│                                          │                                               │
│                                          ▼                                               │
│   2. HYDRATE KORI WORLD                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                                  │   │
│   │   const hydrateResults = (results: SearchResultItem[]) =>                       │   │
│   │     Effect.gen(function* () {                                                   │   │
│   │       const bridge = yield* GeointKoriBridge                                    │   │
│   │                                                                                  │   │
│   │       // Clear stale entities                                                   │   │
│   │       yield* bridge.clearStaleEntities()                                        │   │
│   │                                                                                  │   │
│   │       // Spawn entities for each result                                         │   │
│   │       yield* Effect.forEach(results, (result) =>                                │   │
│   │         bridge.spawnFromSearchResult(result),                                   │   │
│   │         { concurrency: 10 }                                                     │   │
│   │       )                                                                          │   │
│   │     })                                                                           │   │
│   │                                                                                  │   │
│   └──────────────────────────────────────┬──────────────────────────────────────────┘   │
│                                          │                                               │
│                                          ▼                                               │
│   3. ENTITY EXISTS WITH ALL TRAITS                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                                  │   │
│   │   Entity: "flight-ABC123"                                                       │   │
│   │   ├── Position3D: { x: -122.4, y: 37.7, z: 10000 }                             │   │
│   │   ├── FlightData: { icao24: "ABC123", callsign: "UAL123", ... }                │   │
│   │   ├── UIState: { selected: false, hovered: false, ... }                        │   │
│   │   ├── SourceConfidence: { confidence: 0.95, staleness: 5 }                     │   │
│   │   ├── ViewportPresence: { inMapView: true, inListView: true }                  │   │
│   │   └── IsFlight (marker)                                                         │   │
│   │                                                                                  │   │
│   │   Corresponding atom: entityUIStateFamily("flight-ABC123")                      │   │
│   │                                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Benefits of Kori Integration

### 1. Single Source of Truth

| Before | After |
|--------|-------|
| `resultsAtom` + `selectedAtom` + `hoveredSet` | Entity with `UIState` trait |
| Three places to update | One place: `world.setTrait()` |
| State can diverge | Always consistent |

### 2. Efficient Queries

```typescript
// Get all selected flights
const selectedFlights = yield* world.queryWith("IsFlight", "IsSelected")

// Get entities in viewport
const inViewport = yield* world.queryWith("IsInViewport")

// Get entities with stale data (C2 pattern)
const stale = yield* world.queryWith("SourceConfidence").pipe(
  Effect.map(entities => entities.filter(e =>
    e.traits.get("SourceConfidence").staleness > 60
  ))
)
```

### 3. Reactive Subscriptions

```typescript
// Subscribe to selection changes
yield* queryStream.subscribe({
  filter: { with: ["IsSelected"] }
}).pipe(
  Stream.runForEach(event => {
    // Animate selection change
    animateSelectionRing(event.entity)
  })
)
```

### 4. Entity-Bound State Machines

```typescript
// Each entity can have its own behavior
yield* koriActor.spawn(entityId, {
  machine: flightTrackingMachine,
  context: { entityId, initialPosition: position },
})

// Receives events specific to this entity
yield* koriActor.send(entityId, { type: 'POSITION_UPDATE', position: newPos })
```

### 5. Trait Merging for Conflicting Data (C2 Pattern)

```typescript
// When two sources report different positions
yield* merge.configure("Position3D", {
  strategy: "custom",
  merger: (existing, incoming) => ({
    ...incoming,
    // Weight by source confidence
    x: (existing.x * existingConfidence + incoming.x * incomingConfidence)
       / (existingConfidence + incomingConfidence),
    // ... same for y, z
  }),
})
```

---

## Implementation Phases

### Phase 1: Trait Definitions
- Define all GEOINT data traits (Position, FlightData, PoiData, etc.)
- Define UI traits (UIState, SourceConfidence, ViewportPresence)
- Define marker traits (IsFlight, IsPoi, IsSelected, etc.)

### Phase 2: Bridge Service
- Implement GeointKoriBridge
- `spawnFromSearchResult()` - convert search results to entities
- Two-way sync between Kori traits and Atom.family

### Phase 3: Query Integration
- Replace `resultsAtom` with KoriWorld queries
- Subscribe to entity changes via KoriQueryStream
- Update components to use `useGeointEntity(id)` hook

### Phase 4: XState Integration
- Bind layoutMachine to Kori atom sync
- Implement entity-specific actors via KoriActor
- Coordinate layout transitions with entity state

### Phase 5: Advanced Patterns
- Multi-INT fusion with trait merging
- What-if probes (clone entity, project trajectory)
- Monitor chain formalization

---

## Open Questions

1. **Entity Lifecycle**: When do entities get destroyed? On new search? On viewport change?

2. **Scope Management**: Use persistent scope (testbed pattern) or scope-per-search?

3. **Performance**: How many entities before KoriWorld becomes slow? Need virtualization?

4. **Persistence**: Should entity selections survive page reload? (localStorage sync)

5. **Collaboration**: How does Kori integrate with Y-sweet for multi-user COP?

---

## References

- `src/lib/kori/KORI.md` - Kori documentation
- `assets/documents/GEOINT_UI_PATTERNS_BRIEFING.md` - UI research
- `assets/documents/GEOINT_ATOM_FAMILY_ARCHITECTURE.md` - Atom.family design
- `assets/documents/GEOINT_XSTATE_ATOM_ARCHITECTURE.md` - stx pattern
- `/fermion-patterns` skill - Atom.family patterns
- `/xstate-integration` skill - XState v5 patterns
