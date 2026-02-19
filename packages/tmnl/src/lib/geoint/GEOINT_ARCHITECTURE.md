# GEOINT Architecture Analysis
**Generated:** 2026-01-20
**Status:** Complete system audit with integration gap analysis

---

## Executive Summary

The `src/lib/geoint/` directory is a comprehensive ALLINT COP (All-Source Intelligence Common Operating Picture) system with **286 TypeScript files** across 15 subsystems.

**Critical Finding:** **74% of components (38/51) are fully implemented but never integrated.**

### Statistics
- **51 React components** (13 active, 38 orphaned)
- **9 Effect services** with atom-based state management
- **47 Effect schemas** (TaggedClass, TaggedStruct, TaggedError)
- **14 XState machines** (only 3-4 actively used)
- **5 API clients** (OpenSky, Overpass OSM, ADSB.lol, Planet Labs, Sentinel Hub)
- **4 ingestion pipelines** (Flight, OSM, Weather, Imagery)
- **PostGIS integration** via Effect Cluster for distributed search

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GEOINT ALLINT COP SYSTEM                           │
│                         (All-Source Intelligence)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
                 ▼                                         ▼
    ┌─────────────────────────┐              ┌─────────────────────────┐
    │   PRESENTATION LAYER    │              │   INTEGRATION LAYER     │
    │   (React Components)    │              │   (genifer)         │
    └───────────┬─────────────┘              └───────────┬─────────────┘
                │                                        │
    ┌───────────┴───────────┐                            │
    │                       │                            │
    ▼                       ▼                            ▼
┌─────────┐         ┌─────────────┐        ┌──────────────────────────┐
│ ACTIVE  │         │  ORPHANED   │        │ geoint-domain-catalog.tsx│
│ (13)    │         │  (38)       │        │  - GeointDashboard       │
│         │         │             │        │  - NO atomic components  │
│ - Shell │         │ - Minimap   │        └──────────────────────────┘
│ - Map   │         │ - ImmersiveHUD│
│ - Search│         │ - NetworkGraph│              │
│ - Entity│         │ - CommandPalette│            │
│ - Timeline│       │ - ... (34 more)│              ▼
└─────────┘         └─────────────┘      ┌──────────────────────────┐
                                         │  GeointDashboardPanel    │
                                         │  (Primary Entry Point)   │
                                         └────────────┬─────────────┘
                                                      │
                           ┌──────────────────────────┴──────────────────────────┐
                           │                                                     │
                           ▼                                                     ▼
                  ┌─────────────────┐                              ┌──────────────────────┐
                  │  GeointShell    │                              │   SearchProvider     │
                  │  (Layout Slots) │                              │   (Atom.runtime)     │
                  └────────┬────────┘                              └──────────┬───────────┘
                           │                                                  │
        ┌──────────────────┼──────────────────┬───────────────┐             │
        │                  │                  │               │             │
        ▼                  ▼                  ▼               ▼             │
   ┌─────────┐       ┌─────────┐       ┌─────────┐    ┌──────────┐        │
   │ Header  │       │ Sidebar │       │   Map   │    │  Intel   │        │
   │ (Layout │       │(Search) │       │(DeckGL) │    │ (Entity) │        │
   │Controls)│       └────┬────┘       └────┬────┘    └────┬─────┘        │
   └─────────┘            │                 │              │              │
                          │                 │              │              │
                          ▼                 ▼              ▼              ▼
                  ┌───────────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐
                  │SearchPanel    │  │GeointMap  │  │EntityPanel│  │Timeline  │
                  │Compound       │  │           │  │Content    │  │Panel     │
                  └───────┬───────┘  └─────┬─────┘  └─────┬─────┘  └────┬─────┘
                          │                │              │             │
                          │                │              │             │
                          └────────────────┴──────────────┴─────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STATE MANAGEMENT LAYER                              │
│                         (effect-atom - Atom.make)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Viewport:          viewportAtom, viewportBoundsAtom                        │
│  Search:            searchStatusAtom, searchQueryAtom, searchErrorAtom      │
│  Results:           resultsAtom, resultsBySourceAtom, sourceCountsAtom      │
│  Selection:         selectedResultAtom, hoveredResultAtom                   │
│  Filters:           activeFiltersAtom, filteredResultsAtom                  │
│  Layers:            layerVisibilityAtom, layerOpacityAtom                   │
│  Timeline:          timelinePlaybackAtom, timelineFilteredResultsAtom       │
│  Layout:            layoutModeAtom ('command' | 'focus' | 'analytics')      │
│                                                                             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE LAYER                                      │
│                       (Effect Services)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SearchService          - ALLINT search orchestration (ctx.set operations) │
│  GeointService          - Real-time data subscriptions                     │
│  FlightStreamHandle     - DurableStream typed access (flights)             │
│  OsmStreamHandle        - DurableStream typed access (POIs)                │
│  WeatherStreamHandle    - DurableStream typed access (weather)             │
│  GeoPositionService     - Lat/lon ↔ screen pixel transformations           │
│  MapProjectionService   - Projection transformations                       │
│  LiveDataService        - ⚠️ UNUSED (SSE/WebSocket feeds)                 │
│  SceneGraphBridge       - ⚠️ UNUSED (3D scene graph integration)          │
│                                                                             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RPC LAYER                                          │
│                    (AtomRpc.Tag - Browser ↔ Server)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SearchClient         → SearchRpcServer      → SearchEntity (Cluster)      │
│  IngestionClient      → IngestionRpcServer   → IngestionEntity (Cluster)   │
│  IntelClient          → ⚠️ NO HANDLER FOUND                               │
│  FeatureClient        → ⚠️ NO HANDLER FOUND                               │
│  GeospatialClient     → ⚠️ NO HANDLER FOUND                               │
│                                                                             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EFFECT CLUSTER LAYER                                   │
│                   (Distributed Search Coordination)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SearchEntity                 - Orchestrate multi-source search            │
│    └─ SearchEntityHandlers    - Parallel API query handlers               │
│                                                                             │
│  IngestionEntity              - Background data polling orchestration      │
│    └─ IngestionEntityHandlers - Start/stop/status ingester handlers       │
│                                                                             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                 ┌────────────────┴────────────────┬─────────────────┐
                 │                                 │                 │
                 ▼                                 ▼                 ▼
┌──────────────────────────┐  ┌──────────────────────────┐  ┌─────────────┐
│   EXTERNAL API LAYER     │  │   PERSISTENCE LAYER      │  │  STREAMING  │
│   (HTTP Clients)         │  │   (PostGIS)              │  │  LAYER      │
└────────┬─────────────────┘  └────────┬─────────────────┘  └──────┬──────┘
         │                             │                           │
    ┌────┴────┬────────┬──────────────┼──────────┐               │
    │         │        │              │          │               │
    ▼         ▼        ▼              ▼          ▼               ▼
┌─────┐  ┌──────┐  ┌──────┐  ┌────────────┐  ┌──────┐  ┌─────────────┐
│OpenSky│ │Overpass│ │ADSB  │  │FlightRepo  │  │PoiRepo│  │DurableStream│
│Network│ │  OSM   │ │.lol  │  │ImageryRepo │  │Weather│  │(Flight/POI/ │
│(Flight)│ │ (POI)  │ │(Flight)│ │WeatherRepo │  │Repo   │  │Weather)     │
└─────┘  └──────┘  └──────┐  └────────────┘  └──────┘  └─────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
    ┌──────────┐                    ┌─────────────┐
    │Planet Labs│                    │Sentinel Hub │
    │ (Imagery)│                    │  (Imagery)  │
    └──────────┘                    └─────────────┘
```

---

## Data Flow: Search Request

```
┌────────────┐
│   User     │  Enters search query
└─────┬──────┘
      │
      ▼
┌──────────────────────┐
│ SearchPanelCompound  │  User interaction
└─────────┬────────────┘
          │
          │ calls searchOps.search(query)
          ▼
┌──────────────────────┐
│  SearchProvider      │  Provides searchOps via context
│  (Atom.runtime)      │
└─────────┬────────────┘
          │
          │ searchOps → runtimeAtom.fn
          ▼
┌──────────────────────┐
│  SearchService       │  Effect service with ctx.set()
│                      │
│  1. ctx.set(searchStatusAtom, 'searching')
│  2. yield* SearchClient.search(query)
│  3. ctx.set(resultsAtom, results)
│  4. ctx.set(searchStatusAtom, 'completed')
│
└─────────┬────────────┘
          │
          │ AtomRpc.Tag RPC
          ▼
┌──────────────────────┐
│  SearchRpcServer     │  Server-side RPC handler
│  (AtomRpc.router)    │
└─────────┬────────────┘
          │
          │ Routes to cluster entity
          ▼
┌──────────────────────┐
│  SearchEntity        │  Effect Cluster node
│  (Distributed)       │
└─────────┬────────────┘
          │
          │ Parallel API queries
          ▼
    ┌─────┴─────┬──────────┬───────────┐
    │           │          │           │
    ▼           ▼          ▼           ▼
┌────────┐  ┌─────────┐ ┌──────┐  ┌─────────┐
│OpenSky │  │Overpass │ │ADSB  │  │Planet   │
│API     │  │API      │ │.lol  │  │Labs     │
│        │  │         │ │      │  │         │
│Flights │  │POIs     │ │Flights│ │Imagery  │
└────┬───┘  └────┬────┘ └───┬──┘  └────┬────┘
     │           │          │          │
     └───────────┴──────────┴──────────┘
                 │
                 │ Aggregate results
                 ▼
         ┌───────────────┐
         │ SearchResponse│
         │ (typed schema)│
         └───────┬───────┘
                 │
                 │ RPC response
                 ▼
         ┌───────────────┐
         │ SearchService │
         │ ctx.set(      │
         │   resultsAtom,│
         │   results     │
         │ )             │
         └───────┬───────┘
                 │
                 │ Atom subscription
                 ▼
      ┌──────────────────────┐
      │ VirtualizedResultsList│
      │ useAtomValue(         │
      │   filteredResultsAtom │
      │ )                     │
      └──────────┬─────────────┘
                 │
                 │ User clicks result
                 ▼
         ┌───────────────┐
         │ selectResult()│
         │ ctx.set(      │
         │   selectedResultAtom,│
         │   result      │
         │ )             │
         └───────┬───────┘
                 │
                 │ Atom subscription
                 ▼
      ┌──────────────────────┐
      │ EntityPanelContent   │
      │ useAtomValue(        │
      │   selectedResultAtom │
      │ )                    │
      └──────────────────────┘
                 │
                 │ Display entity details
                 ▼
            ┌─────────┐
            │  User   │
            └─────────┘
```

---

## Integration Analysis

### genifer Integration (PRIMARY)

**Single Entry Point:** `GeointDashboardPanel` registered in `geoint-domain-catalog.tsx`

```typescript
// src/lib/genifer/catalog/geoint-domain-catalog.tsx
export const geointDomainCatalog: DomainCatalog = {
  name: 'TMNL Geoint',
  components: {
    GeointDashboard: {
      schema: GeointDashboardPropsSchema,
      renderer: GeointDashboardRenderer,
      description: 'ALLINT COP Dashboard',
      hasChildren: false, // ⚠️ Self-contained, no composition
    },
  },
}
```

**Component Hierarchy:**
```
GeointDashboardPanel (genifer entry)
└── GeointShell (layout orchestrator)
    ├── GeointShell.Header (layout controls)
    ├── GeointShell.Sidebar
    │   └── SearchPanelCompound
    │       └── SearchProvider (Atom.runtime context)
    ├── GeointShell.Map
    │   └── GeointMap (DeckGL + Mapbox)
    ├── GeointShell.Intel
    │   └── EntityPanelContent
    │       └── VirtualizedResultsListV2
    └── GeointShell.Timeline
        └── TimelinePanel
            └── TimelineControlsV2
```

**Missing Integrations:**
- **NO atomic components** in catalog (can't compose custom dashboards)
- **NO Minimap** rendering anywhere
- **38 orphaned components** not wired into UI

---

## Component Inventory

### ✅ ACTIVE Components (13/51 = 26%)

| Component | Used In | Purpose |
|-----------|---------|---------|
| `GeointDashboardPanel` | genifer catalog | Primary integration point |
| `GeointShell` | GeointDashboardPanel | Layout orchestrator with slots |
| `GeointMap` | GeointDashboardPanel | DeckGL + Mapbox map canvas |
| `SearchProvider` | GeointDashboardPanel | Search context with Atom.runtime |
| `SearchPanelCompound` | GeointDashboardPanel | Search UI with composable parts |
| `EntityPanelContent` | GeointDashboardPanel | Entity details display |
| `TimelinePanel` | GeointDashboardPanel | Temporal filtering + playback |
| `SearchFilterBridge` | Multiple | Wires FilterBar → SearchProvider |
| `SearchHydrationBridge` | Multiple | Auto-hydrates Kori entities |
| `TimelineMapBridge` | Multiple | Syncs timeline ↔ map filters |
| `VirtualizedResultsListV2` | EntityDetailPanelV2 | High-performance result list |
| `TimelineControlsV2` | Timeline components | XState-integrated playback |
| `MultiSelectActionBar` | Results panels | Batch operations UI |

### ⚠️ ORPHANED Components (38/51 = 74%)

#### Tier 1: High-Value (Integrate Next)

1. **Minimap** ⭐ **USER-REPORTED MISSING**
   - **Status:** Fully implemented (537 lines)
   - **Features:** Canvas rendering, entity dots, viewport bounds, click-to-navigate, drag-to-pan, zoom controls, anime.js animations
   - **Why orphaned:** No parent component imports it
   - **Integration path:**
     ```typescript
     // Option 1: Floating overlay on map
     <GeointShell.Map>
       <GeointMap instanceId="..." />
       <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
         <Minimap
           viewport={viewportAtom}
           onViewportChange={setViewport}
           entities={filteredResults}
         />
       </div>
     </GeointShell.Map>

     // Option 2: ImmersiveHUD integration
     <ImmersiveHUD.Minimap
       viewport={viewport}
       onViewportChange={handleViewportChange}
       entities={visibleEntities}
     />

     // Option 3: EntityDetailCard location preview
     <EntityDetailCard.Overview showMinimap={true}>
       <Minimap
         viewport={{ longitude: entity.longitude, latitude: entity.latitude, zoom: 14 }}
         onViewportChange={flyTo}
         entities={[entity]}
       />
     </EntityDetailCard.Overview>
     ```

2. **ImmersiveHUD** - Glassmorphism fullscreen HUD
   - **XState machine:** `immersiveHudMachine.ts`
   - **Dependencies:** Would be primary consumer of Minimap
   - **Compound parts:** Root, Header, Footer, Sidebar, Minimap, Stats
   - **Reason orphaned:** Likely planned for fullscreen/presentation mode

3. **NetworkGraph** - Entity relationship visualization
   - **XState machine:** `networkGraphMachine.ts`
   - **Library:** @xyflow/react
   - **Compound parts:** Canvas, Controls, EdgeLegend, Minimap (separate from geoint Minimap)
   - **Use case:** Intel analysis, entity correlation

4. **CommandPalette** - M-x style global commands
   - **Pattern:** Command registry with fuzzy search
   - **Binding:** Likely Ctrl+K or Ctrl+P
   - **Use case:** Fast navigation, power user workflows

5. **RadialCommandDial** - Ctrl+Click entity actions
   - **XState machine:** `radialDialMachine.ts` with gesture detection
   - **Use case:** Context menu on map entities
   - **Integration:** Map interaction layer

6. **KeyboardShortcutsOverlay** - Which-key style help
   - **Data:** `GEOINT_SHORTCUTS` defined
   - **Binding:** Likely `?` hotkey
   - **Use case:** Keyboard shortcut discovery

7. **MeasurementTools** - Distance/area/bearing measurement
   - **Features:** Line, polygon, radius, bearing tools
   - **Use case:** Spatial analysis on map

8. **SpatialQueryPanel** - Visual polygon/radius search
   - **Features:** Draw search areas on map
   - **Use case:** Geographic filtering

#### Tier 2: Evaluate Demand

9. **AlertPanel** - Real-time intel notifications
10. **BookmarksPanel** - Saved views and locations
11. **CollectionManager** - Entity watchlists
12. **TrackHistoryPlayer** - Entity movement playback
13. **LiveFeedIndicator** - Stream status display
14. **ExportPanel** - Data export with format options

#### Tier 3: Premium/Future Features

15. **SwimlaneTimeline** - Temporal entity swimlanes
    - **XState machine:** `swimlaneMachine.ts`
16. **TemporalHeatmap** - Activity density over time
    - **XState machine:** `heatmapMachine.ts`
17. **FusionView** - Multi-source intelligence fusion
    - **XState machine:** `fusionViewMachine.ts`
18. **MissionPlanner** - Mission planning with objectives/waypoints
    - **XState machine:** `missionPlannerMachine.ts`
19. **SplitCompareView** - Temporal comparison views
    - **XState machine:** `splitCompareMachine.ts`
20. **CorrelationView** - Entity relationship graph

**Plus 18 more orphaned components** (V2 implementations, XState variants, etc.)

---

## State Management (Atoms)

### Core Atoms (`atoms/index.ts` - 730 lines)

**Viewport State:**
```typescript
viewportAtom: Atom<ViewportState>          // lon, lat, zoom, pitch, bearing
viewportBoundsAtom: Atom<BBox>             // Derived bounding box
```

**Search State:**
```typescript
searchStatusAtom: Atom<'idle' | 'validating' | 'searching' | 'completed' | 'error'>
searchQueryAtom: Atom<string>
searchErrorAtom: Atom<string>              // Human-readable error
searchTypedErrorAtom: Atom<SearchError>    // Discriminated union error
searchRetryCountAtom: Atom<number>
canRetrySearchAtom: Atom<boolean>          // Derived retry eligibility
lastSearchTimeAtom: Atom<number>
```

**Results State:**
```typescript
resultsAtom: Atom<SearchResultItem[]>
resultsBySourceAtom: Atom<HashMap<Source, SearchResultItem[]>>  // Derived
sourceCountsAtom: Atom<HashMap<Source, number>>                 // Derived
totalResultCountAtom: Atom<number>                              // Derived
```

**Selection State:**
```typescript
selectedResultAtom: Atom<SearchResultItem | null>     // Single selection
hoveredResultAtom: Atom<SearchResultItem | null>      // Hover highlight
selectedResultsAtom: Atom<SearchResultItem[]>         // Multi-select
```

**Filter State:**
```typescript
activeFiltersAtom: Atom<FilterConfig>
filteredResultsAtom: Atom<SearchResultItem[]>         // Derived
```

**Layer State:**
```typescript
layerVisibilityAtom: Atom<Record<LayerId, boolean>>
layerOpacityAtom: Atom<Record<LayerId, number>>
```

**Timeline State:**
```typescript
timelinePlaybackAtom: Atom<TimelinePlaybackState>
timelineFilteredResultsAtom: Atom<SearchResultItem[]>  // Derived
```

**Layout State (`atoms/layoutAtoms.ts`):**
```typescript
layoutModeAtom: Atom<'command' | 'focus' | 'analytics'>
// Derived atoms for panel visibility per layout
```

---

## Schema System

### SearchResultItem (Discriminated Union)

```typescript
type SearchResultItem =
  | SearchResultTrack
  | SearchResultPoi
  | SearchResultFlight
  | SearchResultFeature
  | SearchResultWeather
  | SearchResultImagery
```

**Each variant has:**
- `_tag` discriminator
- `SpatialTrait` (longitude, latitude, altitude?)
- `TemporalTrait` (timestamp)
- Source-specific fields

### SearchError (Discriminated Union)

```typescript
type SearchError =
  | SearchNetworkError       // recoverable
  | SearchTimeoutError       // recoverable
  | SearchRateLimitError     // recoverable
  | SearchServerError        // recoverable (500-503)
  | SearchValidationError    // NOT recoverable
  | SearchNotFoundError      // NOT recoverable
  | SearchAuthError          // NOT recoverable
  | SearchUnknownError       // NOT recoverable
```

**Utilities:**
- `parseError(error: unknown): SearchError`
- `toSearchErrorData(error: SearchError): SearchErrorData`
- `createErrorState(error: SearchError): ErrorState`
- `incrementRetry(state: SearchState): SearchState`

### External API Schemas

**Pattern:** All external APIs use `*FromApi` wire schemas + `transform()` to domain schemas.

```typescript
// Wire format (JSON from API)
OpenSkyResponseFromApi: Schema<...>

// Domain format (internal representation)
OpenSkyResponse: Schema<...>

// Transform
Schema.transform(
  OpenSkyResponseFromApi,
  OpenSkyResponse,
  { decode: wireToModel, encode: modelToWire }
)
```

**APIs with wire transformations:**
- ADSB.lol
- Planet Labs
- Sentinel Hub
- Open-Meteo

---

## Service Layer

### Effect Services (9 total)

| Service | Type | Atom Properties | Status |
|---------|------|-----------------|--------|
| `SearchService` | ALLINT COP orchestration | 11 atoms (status, results, errors, history) | ✅ ACTIVE |
| `GeointService` | Real-time data subscriptions | Layer config atoms | ✅ ACTIVE |
| `FlightStreamHandle` | DurableStream typed access | Stream config | ✅ ACTIVE |
| `OsmStreamHandle` | DurableStream typed access | Stream config | ✅ ACTIVE |
| `WeatherStreamHandle` | DurableStream typed access | Stream config | ✅ ACTIVE |
| `GeoPositionService` | Lat/lon ↔ screen pixel | Viewport atoms | ✅ ACTIVE |
| `MapProjectionService` | Projection transformations | None | ✅ ACTIVE |
| `LiveDataService` | SSE/WebSocket live feeds | Connection atoms | ⚠️ UNUSED (superseded by DurableStream?) |
| `SceneGraphBridge` | 3D scene graph integration | None | ⚠️ UNUSED (3D not implemented) |

### RPC Clients (5 total)

| Client | Tag | Methods | Status |
|--------|-----|---------|--------|
| `SearchClient` | `SearchClientTag` | `search`, `searchStream` | ✅ ACTIVE |
| `IngestionClient` | `IngestionClientTag` | `start`, `stop`, `status` | ✅ ACTIVE |
| `IntelClient` | `IntelClientTag` | Track queries | ⚠️ DEFINED, NO HANDLER |
| `FeatureClient` | `FeatureClientTag` | Feature queries | ⚠️ DEFINED, NO HANDLER |
| `GeospatialClient` | `GeospatialClientTag` | Tile + imagery queries | ⚠️ DEFINED, NO HANDLER |

---

## External API Integration

### Active APIs (6)

1. **OpenSky Network** - Flight tracking
   - Endpoint: `https://opensky-network.org/api/states/all`
   - Schema: `OpenSkyResponse` → `OpenSkyStateVector[]`
   - Maps to: `SearchResultFlight`

2. **Overpass API** - OpenStreetMap POIs
   - Endpoint: `https://overpass-api.de/api/interpreter`
   - Query: `[out:json];node(bbox)[amenity];out;`
   - Schema: `OverpassResponse` → `OverpassElement[]`
   - Maps to: `SearchResultPoi`

3. **ADSB.lol** - Real-time flight data
   - Endpoint: `https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{dist}`
   - Wire: `AdsbLolResponseFromApi` → `AdsbLolResponse`
   - Maps to: `SearchResultFlight`

4. **Planet Labs Data API** - Satellite imagery
   - Wire: `PlanetSearchResponseFromApi` → `PlanetSearchResponse`
   - Maps to: `SearchResultImagery`

5. **Sentinel Hub** - ESA satellite data
   - Wire: `SentinelSearchResponseFromApi` → `SentinelSearchResponse`
   - Maps to: `SearchResultImagery`

6. **Open-Meteo** - Weather forecasts
   - Endpoint: `https://api.open-meteo.com/v1/forecast`
   - Wire: `OpenMeteoForecastFromApi` → `WeatherForecast`
   - Maps to: `SearchResultWeather`

---

## Kori ECS Integration

**Bridge:** `GeointKoriBridge.ts`

**Flow:**
1. `SearchHydrationBridge` component listens to `resultsAtom`
2. On new results, calls `GeointKoriBridge.hydrateSearchResults(results)`
3. Bridge uses `search-result-mapper.ts` to map `SearchResultItem` → Kori entity
4. Kori traits applied:
   - `PositionTrait` - Lat/lon position
   - `MarkerTrait` - Map marker config
   - `SourceConfidenceTrait` - Source + confidence score
   - `UIStateTrait` - Selected, hovered, visible
   - `ViewportPresenceTrait` - In viewport?
   - Source-specific traits:
     - `FlightTrait` - `icao24`, `callsign`, `velocity`
     - `PoiTrait` - `category`, `amenity`
     - `TrackTrait` - `trackId`, `classification`
     - `ImageryTrait` - `provider`, `collection`
     - `WeatherTrait` - `temperature`, `windSpeed`

**Kori Entity Atoms:** `kori/entity-atoms.ts`

---

## XState Machines (14 total)

### Active Machines (3-4)

- `searchMachine.ts` - Search workflow (idle → validating → searching → completed)
- `layoutMachine.ts` - Layout mode transitions
- `timelineMachine.ts` - Timeline playback
- `dashboardMachine.ts` - Dashboard orchestration (partial usage)

### Orphaned Machines (10+)

- `immersiveHudMachine.ts` - HUD overlay management
- `radialDialMachine.ts` - Radial gesture detection
- `swimlaneMachine.ts` - Swimlane visualization
- `splitCompareMachine.ts` - Split view comparison
- `fusionViewMachine.ts` - Multi-source fusion
- `missionPlannerMachine.ts` - Mission planning workflow
- `heatmapMachine.ts` - Heatmap aggregation
- `networkGraphMachine.ts` - Graph layout
- `filterBarMachine.ts` - Filter presets
- `entityDetailMachine.ts` - Entity detail tabs
- `searchFormMachine.ts` - Search form validation

**Issue:** Machines defined but no parent component renders the corresponding provider.

---

## Recommendations

### Immediate Actions (High Priority)

#### 1. Integrate Minimap ⭐
**Why:** User explicitly reported it's missing. Fully implemented, just needs wiring.

**Option A - Floating Overlay (Recommended):**
```typescript
// In GeointDashboardPanel.tsx
<GeointShell.Map>
  <GeointMap instanceId={props.instanceId} />

  {/* Add Minimap as floating overlay */}
  <div style={{
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 10,
  }}>
    <Minimap
      viewport={viewportAtom}
      onViewportChange={setViewport}
      entities={filteredResults}
      width={220}
      height={160}
      collapsed={false}
    />
  </div>
</GeointShell.Map>
```

**Option B - ImmersiveHUD Integration:**
```typescript
// After implementing ImmersiveHUD
<ImmersiveHUD.Root>
  <ImmersiveHUD.Minimap
    viewport={viewport}
    onViewportChange={handleViewportChange}
    entities={visibleEntities}
  />
</ImmersiveHUD.Root>
```

**Option C - EntityDetailCard Preview:**
```typescript
// In EntityDetailCard.tsx, when showMinimap={true}
<EntityDetailCard.Overview showMinimap={true}>
  <Minimap
    viewport={{
      longitude: entity.longitude,
      latitude: entity.latitude,
      zoom: 14,
    }}
    onViewportChange={flyTo}
    entities={[entity]}
    width={200}
    height={150}
  />
</EntityDetailCard.Overview>
```

#### 2. Register Atomic Components in genifer Catalog

**Why:** Enable LLMs to compose custom dashboards. Currently only `GeointDashboard` is registered.

**Add to `geoint-domain-catalog.tsx`:**
```typescript
export const geointDomainCatalog: DomainCatalog = {
  name: 'TMNL Geoint',
  components: {
    // Existing
    GeointDashboard: { ... },

    // Add atomic components
    GeointMap: {
      schema: GeointMapPropsSchema,
      renderer: GeointMapRenderer,
      description: 'DeckGL + Mapbox map with GEOINT layers',
      hasChildren: false,
    },
    SearchPanel: {
      schema: SearchPanelPropsSchema,
      renderer: SearchPanelRenderer,
      description: 'ALLINT search interface',
      hasChildren: false,
    },
    Minimap: {
      schema: MinimapPropsSchema,
      renderer: MinimapRenderer,
      description: 'Canvas-based navigation minimap',
      hasChildren: false,
    },
    TimelinePanel: {
      schema: TimelinePanelPropsSchema,
      renderer: TimelinePanelRenderer,
      description: 'Temporal filtering and playback controls',
      hasChildren: false,
    },
    EntityDetailCard: {
      schema: EntityDetailCardPropsSchema,
      renderer: EntityDetailCardRenderer,
      description: 'Entity details with tabs',
      hasChildren: false,
    },
  },
}
```

#### 3. Audit Orphaned Services

**LiveDataService** - ⚠️ Likely deprecated
- No parent component renders `<LiveDataProvider>`
- Superseded by DurableStream integration (FlightStreamHandle, OsmStreamHandle, WeatherStreamHandle)
- **Action:** Confirm with team, then remove if unused

**SceneGraphBridge** - ⚠️ 3D not implemented
- No imports outside of `positioning/index.ts`
- Likely planned for 3D visualization (not yet built)
- **Action:** Keep if 3D is roadmapped, otherwise remove

**IntelClient, FeatureClient, GeospatialClient** - ⚠️ No handlers
- RPC clients defined but no `*RpcServer` handlers found
- May be used by services (not components)
- **Action:** Audit service layer for usage, document or remove

### Medium Priority

#### 4. Tier 1 Component Integration

Integrate high-value orphaned components:
1. **CommandPalette** - Add global Ctrl+K binding
2. **RadialCommandDial** - Add map entity context menu
3. **KeyboardShortcutsOverlay** - Add `?` hotkey help
4. **MeasurementTools** - Add to map toolbar
5. **SpatialQueryPanel** - Add to search panel tabs

#### 5. XState Machine Audit

**Issue:** 14 machines defined, only 3-4 actively used.

**Action:**
- Remove machines for orphaned components (reduces maintenance)
- OR integrate corresponding components (use the machines)
- Document which machines are production vs. experimental

### Low Priority

#### 6. Component Backlog Review

**Tier 2 components** (evaluate demand):
- AlertPanel, BookmarksPanel, CollectionManager
- TrackHistoryPlayer, LiveFeedIndicator, ExportPanel

**Tier 3 components** (future/premium):
- NetworkGraph, SwimlaneTimeline, TemporalHeatmap
- FusionView, MissionPlanner, SplitCompareView

**Action:**
- Prioritize Tier 2 for next sprint
- Archive or remove Tier 3 if not planned

#### 7. Long-Term Architecture

1. **Modularize catalog:** Split atomic vs. compound component catalogs
2. **Document integration patterns:** Create guide for wiring orphaned components
3. **Performance monitoring:** Add telemetry for search latency, render performance
4. **ImmersiveHUD roadmap:** Is fullscreen/presentation mode planned?

---

## Open Questions

1. **LiveDataService vs DurableStream:** Is LiveDataService deprecated? Can it be removed?
2. **IntelClient, FeatureClient, GeospatialClient:** Are these used by services? No component imports found.
3. **SceneGraphBridge:** Is 3D visualization planned? No usage found.
4. **Orphaned components roadmap:** Is there a plan to integrate the 38 unused components?
5. **Minimap intent:** Where should Minimap be integrated? (ImmersiveHUD? EntityDetailCard? Floating overlay?)
6. **ImmersiveHUD status:** Is fullscreen/presentation mode roadmapped?

---

## File Manifest (286 files)

### Animation (3 files)
- `animation/AnimationOrchestrator.ts`
- `animation/layoutTransitions.ts`
- `animation/index.ts`

### API (10 files)
- `api/ExternalApiClient.ts` - Base HTTP client with retry/circuit breaker
- `api/SearchApi.ts` - Aggregated search API
- `api/circuit-breaker.ts` - Fault tolerance
- `api/rate-limiting.ts` - Token bucket rate limiter
- `api/retry.ts` - Exponential backoff
- `api/tracing.ts` - OpenTelemetry integration
- `api/__tests__/` (4 test files)

### Atoms (4 files)
- `atoms/index.ts` - **730 lines** - Dashboard atoms (viewport, search, results, filters)
- `atoms/layoutAtoms.ts` - Layout mode atoms
- `atoms/operations.ts` - Atom operations (Effect.gen with ctx.set)
- `atoms/ingestion-operations.ts` - Ingestion control ops

### Cards (5 files)
- `cards/registry.ts` - Card type registry
- `cards/renderers.tsx` - Card renderers for search results
- `cards/traits.ts` - Card trait system
- `cards/actions.ts` - Card actions
- `cards/hooks.ts` - useCard hook

### Clients (6 files)
- `clients/SearchClient.ts` - **ACTIVE** - ALLINT search RPC client
- `clients/IngestionClient.ts` - **ACTIVE** - Ingestion control RPC client
- `clients/IntelClient.ts` - ⚠️ NO HANDLER
- `clients/FeatureClient.ts` - ⚠️ NO HANDLER
- `clients/GeospatialClient.ts` - ⚠️ NO HANDLER

### Cluster (6 files)
- `cluster/cluster-node.ts` - Base ClusterNode setup
- `cluster/SearchEntity.ts` - **ACTIVE** - Search entity with distributed handlers
- `cluster/SearchEntityHandlers.ts` - **ACTIVE** - Search request handlers
- `cluster/IngestionEntity.ts` - **ACTIVE** - Ingestion orchestration entity
- `cluster/IngestionEntityHandlers.ts` - **ACTIVE** - Start/stop ingester handlers

### Components (51 files)

**ACTIVE (13):**
- `GeointDashboardPanel.tsx` - **295 lines** - genifer panel wrapper
- `GeointShell.tsx` - Layout orchestrator (compound component)
- `GeointMap.tsx` - DeckGL + Mapbox map component
- `SearchProvider.tsx` - SearchContext with Atom.runtime
- `SearchPanelCompound.tsx` - Search UI (compound)
- `EntityPanelContent.tsx` - Entity details display
- `TimelinePanel.tsx` - Temporal filtering + playback
- `TimelineControlsV2.tsx` - XState-integrated playback
- `VirtualizedResultsListV2.tsx` - High-performance results
- `SearchFilterBridge.tsx` - FilterBar → SearchProvider wiring
- `SearchHydrationBridge.tsx` - Auto-hydrate Kori entities
- `TimelineMapBridge.tsx` - Timeline ↔ Map sync
- `MultiSelectActionBar.tsx` - Batch operations

**ORPHANED (38):**
- `Minimap.tsx` - ⚠️ **537 lines** - Canvas-based minimap (USER-REPORTED MISSING)
- `ImmersiveHUD.tsx` - Glassmorphism fullscreen HUD
- `NetworkGraph.tsx` - Entity relationship graph
- `CommandPalette.tsx` - M-x style commands
- `RadialCommandDial.tsx` - Ctrl+Click actions
- `KeyboardShortcutsOverlay.tsx` - Which-key style help
- `MeasurementTools.tsx` - Distance/area/bearing measurement
- `SpatialQueryPanel.tsx` - Visual polygon search
- `SwimlaneTimeline.tsx` - Temporal swimlanes
- `TemporalHeatmap.tsx` - Activity density viz
- `FusionView.tsx` - Multi-source fusion
- `MissionPlanner.tsx` - Mission planning UI
- `SplitCompareView.tsx` - Temporal comparison
- `CorrelationView.tsx` - Relationship viz
- `AlertPanel.tsx` - Real-time alerts
- `BookmarksPanel.tsx` - Saved views
- `CollectionManager.tsx` - Entity watchlists
- `TrackHistoryPlayer.tsx` - Movement playback
- `LiveFeedIndicator.tsx` - Stream status
- `ExportPanel.tsx` - Data export
- *(Plus 18 more V2/XState variants)*

### Entities (6 files)
- `entities/flight.ts`
- `entities/poi.ts`
- `entities/track.ts`
- `entities/imagery.ts`
- `entities/weather.ts`

### Hooks (8 files)
- `hooks/useGeointEntity.ts` - Entity CRUD operations
- `hooks/useGeointPanel.ts` - Panel state management
- `hooks/useGeointLayout.ts` - Layout mode switching
- `hooks/useGeointSelection.ts` - Multi-select logic
- `hooks/useGeointFloatingPanel.ts` - Floating panel positioning
- `hooks/useTimelinePlayback.ts` - Timeline playback control
- `hooks/useKoriBridge.tsx` - Kori ECS integration
- `hooks/useViewportSearch.ts` - Auto-search on viewport change

### Ingestion (16 files)
- `ingestion/IngestionOrchestrator.ts` - Coordinate all ingesters
- `ingestion/FlightIngester.ts` - Poll OpenSky + ADSB.lol
- `ingestion/OsmIngester.ts` - Poll Overpass API (POIs)
- `ingestion/ImageryIngester.ts` - Poll Planet Labs + Sentinel Hub
- `ingestion/WeatherIngester.ts` - Poll Open-Meteo
- `ingestion/__tests__/` (11 integration + unit tests)

### Kori (18 files)
- `kori/GeointKoriBridge.ts` - SearchResult → Kori entity hydration
- `kori/entity-atoms.ts` - Kori entity atoms
- `kori/search-result-mapper.ts` - Map search results to Kori
- `kori/traits/` (14 trait implementations)
  - `position.ts`, `markers.ts`, `animation-state.ts`
  - `source-confidence.ts`, `ui-state.ts`, `viewport-presence.ts`
  - `flight.ts`, `poi.ts`, `track.ts`, `imagery.ts`, `weather.ts`
- `kori/__tests__/` (integration tests)

### Layers (6 files)
- `layers/searchResults.ts` - Search result markers
- `layers/tracks.ts` - Track polylines
- `layers/features.ts` - GeoJSON features
- `layers/heatmap.ts` - Density heatmap
- `layers/tiles.ts` - Tile layers

### Machines (19 files)

**ACTIVE:**
- `machines/searchMachine.ts` - Search workflow
- `machines/layoutMachine.ts` - Layout mode transitions
- `machines/timelineMachine.ts` - Timeline playback
- `machines/dashboardMachine.ts` - Dashboard orchestration

**ORPHANED:**
- `machines/immersiveHudMachine.ts`
- `machines/radialDialMachine.ts`
- `machines/swimlaneMachine.ts`
- `machines/splitCompareMachine.ts`
- `machines/fusionViewMachine.ts`
- `machines/missionPlannerMachine.ts`
- `machines/heatmapMachine.ts`
- `machines/networkGraphMachine.ts`
- `machines/filterBarMachine.ts`
- `machines/entityDetailMachine.ts`
- `machines/searchFormMachine.ts`

**Providers:**
- `machines/SearchProvider.tsx`
- `machines/DashboardProvider.tsx`

### Persistence (19 files)
- `persistence/postgis/PostGISClient.ts` - @effect/sql-pg client
- `persistence/postgis/GeointRepository.ts` - Base repository
- `persistence/postgis/FlightRepository.ts` - Flight CRUD
- `persistence/postgis/PoiRepository.ts` - POI CRUD
- `persistence/postgis/ImageryRepository.ts` - Imagery CRUD
- `persistence/postgis/WeatherRepository.ts` - Weather CRUD
- `persistence/postgis/materializer.ts` - Entity → DB row mapping
- `persistence/*EntityMaterializer.ts` (3 materializers)
- `persistence/postgis/__tests__/` (5 integration tests)

### Positioning (6 files)
- `positioning/GeoPositionService.ts` - **ACTIVE** - Lat/lon ↔ screen pixel
- `positioning/MapProjectionService.ts` - **ACTIVE** - Projection transformations
- `positioning/SceneGraphBridge.ts` - ⚠️ UNUSED - 3D scene graph integration
- `positioning/traits.ts`
- `positioning/hooks.tsx`

### Schemas (13 files)
- `schemas/search.ts` - **CRITICAL** - SearchResultItem, SearchQuery, SearchResponse
- `schemas/errors.ts` - **CRITICAL** - SearchError discriminated union
- `schemas/core.ts` - Primitives (Position, BBox, Classification)
- `schemas/traits.ts` - GEOINT traits (Spatial, Temporal, Kinetic)
- `schemas/tracks.ts` - Track schemas
- `schemas/features.ts` - GeoJSON feature schemas
- `schemas/analysis.ts` - Spatial analysis schemas
- `schemas/ingestion.ts` - Ingestion request/response schemas
- `schemas/flight-events.ts` - DurableStream flight events
- `schemas/poi-events.ts` - DurableStream POI events
- `schemas/weather-events.ts` - DurableStream weather events
- `schemas/__tests__/schemas.test.ts`

### Server (4 files)
- `server/SearchRpcServer.ts` - **ACTIVE** - Search RPC handler
- `server/IngestionRpcServer.ts` - **ACTIVE** - Ingestion RPC handler
- `server/__tests__/SearchRpcServer.integration.test.ts`

### Services (6 files)
- `services/SearchService.ts` - **CRITICAL** - **ACTIVE** - ALLINT search orchestration
- `services/GeointService.ts` - **ACTIVE** - GEOINT data subscriptions
- `services/FlightStreamHandle.ts` - **ACTIVE** - DurableStream typed access
- `services/OsmStreamHandle.ts` - **ACTIVE** - DurableStream typed access
- `services/WeatherStreamHandle.ts` - **ACTIVE** - DurableStream typed access
- ⚠️ **NO LiveDataService in active services**

### Streaming (3 files)
- `streaming/LiveDataService.ts` - ⚠️ UNUSED
- `streaming/LiveDataProvider.tsx` - ⚠️ UNUSED

### Workspace (3 files)
- `workspace/browser-storage.ts` - LocalStorage integration
- `workspace/schemas.ts` - Workspace schemas

### Tests (48 files)
- `__tests__/` - API clients, components, services tests
- `__tests__/cluster/` (7 cluster node tests)
- `__tests__/integration/` (10 integration tests)
- `__tests__/e2e/` (1 end-to-end test)
- `__tests__/__fixtures__/` - Mock API responses

### Root (3 files)
- `index.ts` - **59 lines** - Barrel export
- `tokens.ts` - Design tokens (colors, timing, easing)
- `INTERFACE_ARCHITECTURE.md` - (existing doc)

**Total: 286 TypeScript files**

---

## Conclusion

The GEOINT library is a **comprehensive, well-architected system** with strong Effect-TS patterns and clean separation of concerns. The architecture follows best practices:

✅ **Strengths:**
- Effect Schema for all domain types (TaggedClass, TaggedStruct, TaggedError)
- Atom-based state management with registry pattern
- Clean wire format → domain schema transformations
- Effect services with `ctx.set()` operations
- XState machines for complex UI orchestration
- Distributed search via Effect Cluster
- PostGIS integration for spatial data

⚠️ **Critical Gap: Integration**

The primary issue is **not** code quality or architecture—it's that **74% of components are orphaned**:
- 38 of 51 components exported but never imported
- Most are feature-complete (have XState machines, compound structure, animations)
- **Minimap** is the canonical example: 537 lines, production-ready, zero usage

**Root Cause:** Architecture evolved faster than integration. Components were built in anticipation of features, but product prioritization shifted.

**Next Steps:**
1. ✅ **Integrate Minimap** (high value, low effort, user-reported)
2. ✅ **Register atomic components** in genifer catalog (enable LLM composition)
3. ✅ **Audit orphaned services** (remove LiveDataService, SceneGraphBridge if unused)
4. ⚠️ **Component backlog review** (integrate Tier 1, archive/remove Tier 3)
5. ⚠️ **XState machine audit** (remove unused machines or integrate components)

This documentation provides a complete architectural overview for future refactoring and integration work.
