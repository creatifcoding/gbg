# GEOINT - Project Structure

## Directory Layout

```
src/lib/geoint/
├── index.ts                    # Barrel export
│
├── schemas/                    # Effect Schema definitions
│   ├── core.ts                 # Branded types (TrackId, FeatureId, LayerId)
│   ├── tracks.ts               # Track, TrackPosition, TrackMetadata
│   ├── features.ts             # Feature, Layer, FeatureCollection
│   ├── analysis.ts             # SpatialAnalysis, BBox, Buffer
│   └── index.ts                # Barrel
│
├── clients/                    # AtomRpc.Tag clients
│   ├── GeospatialClient.ts     # Tiles, imagery operations
│   ├── FeatureClient.ts        # Vector feature queries
│   ├── IntelClient.ts          # Track operations, classification
│   └── index.ts                # Barrel
│
├── services/                   # Effect.Service compositions
│   ├── GeointService.ts        # Main service with atom properties
│   └── index.ts                # Barrel
│
├── layers/                     # Deck.gl layer factories
│   ├── tracks.ts               # PathLayer, TripsLayer, IconLayer
│   ├── features.ts             # GeoJsonLayer, PolygonLayer
│   ├── tiles.ts                # TileLayer, BitmapLayer
│   ├── heatmap.ts              # HeatmapLayer
│   └── index.ts                # Barrel
│
├── r3f/                        # React-Three-Fiber overlay
│   ├── GeointR3FOverlay.tsx    # Main Canvas overlay
│   ├── TrackMarker3D.tsx       # 3D track markers
│   ├── ThreatVolume.tsx        # 3D threat envelopes
│   ├── hooks/
│   │   └── useGeoProjection.ts # Lat/lon to screen projection
│   └── index.ts                # Barrel
│
├── persistence/                # Durable streams integration
│   ├── TrackStore.ts           # Track history persistence
│   └── index.ts                # Barrel
│
├── components/                 # React UI components
│   ├── GeointDashboard.tsx     # Main dashboard (DeckGL + R3F)
│   ├── LayerPalette.tsx        # Layer toggle controls
│   ├── IntelSummaryPanel.tsx   # Intelligence summary stats
│   └── index.ts                # Barrel
│
└── testbed/
    └── GeointTestbed.tsx       # Development testbed
```

## Architecture Diagram

```
                           GEOINT LAYERING SYSTEM
+=========================================================================+
|                              React Layer                                 |
|  +------------------+  +------------------+  +----------------------+   |
|  | GeointDashboard  |  | LayerPalette     |  | IntelSummaryPanel    |   |
|  | - DeckGL canvas  |  | - Toggle layers  |  | - Track counts       |   |
|  | - Mapbox base    |  | - Style configs  |  | - Threat levels      |   |
|  | - R3F overlay    |  | - Layer opacity  |  | - Recent anomalies   |   |
|  +------------------+  +------------------+  +----------------------+   |
+=========================================================================+
                                    |
                                    v
+=========================================================================+
|                         Atom Layer (effect-atom)                        |
|  +------------------------------------------------------------------+  |
|  | GeointService.deckGlLayers     (derived, auto-generates configs) |  |
|  | GeointService.activeTracks     (FiberMap-managed subscriptions)  |  |
|  | GeointService.featuresInBounds (Atom.family with spatial cache)  |  |
|  | GeointService.satelliteImagery (Stream-backed tiles)             |  |
|  | GeointService.classifyTrack    (mutation with reactivity keys)   |  |
|  +------------------------------------------------------------------+  |
+=========================================================================+
                                    |
                                    v
+=========================================================================+
|                      Effect Service Layer                               |
|  +----------------------+  +----------------------+  +----------------+ |
|  | GeospatialClient     |  | FeatureClient        |  | IntelClient    | |
|  | (AtomRpc.Tag)        |  | (AtomRpc.Tag)        |  | (AtomRpc.Tag)  | |
|  | - getMapTiles        |  | - queryFeatures      |  | - getTracks    | |
|  | - getSatelliteImagery|  | - spatialAnalysis    |  | - classify     | |
|  +----------------------+  +----------------------+  +----------------+ |
+=========================================================================+
                                    |
                    +---------------+---------------+
                    |               |               |
                    v               v               v
+------------------+  +------------------+  +------------------+
|    AVA Backend   |  | Durable Streams  |  |   ElectricSQL    |
| (NATS JetStream) |  | (Persistence)    |  | (PGlite - future)|
| - Real-time sub  |  | - Append-only    |  | - Offline-first  |
| - Delta updates  |  | - Replay         |  | - Shape sync     |
+------------------+  +------------------+  +------------------+
```

## Key Existing Files

| File | Purpose |
|------|---------|
| `src/lib/primitives/map/BaseMap.tsx` | Core DeckGL+Mapbox primitive |
| `src/lib/primitives/map/schemas.ts` | Effect schemas for AI streaming |
| `src/lib/editor/v3/extensions/blocks/MapBlock/MapBlockView.tsx` | Editor block |
| `src/lib/ava/services/AvaClientV2.ts` | NATS-based streaming |
| `src/lib/durable-streams/service.ts` | Persistence layer |
