# GEOINT - Technology Stack

## Core Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | React | 18.x | UI rendering |
| Language | TypeScript | 5.x | Type safety |
| Runtime | Bun | latest | Package management, testing |
| Desktop | Tauri | 2.x | Native desktop shell |

## State Management

| Technology | Purpose |
|------------|---------|
| effect-atom | Reactive atoms with Effect integration |
| AtomRpc.Tag | RPC clients with atom-based queries/mutations |
| Atom.family | Keyed atom factories for spatial queries |
| FiberMap | Subscription lifecycle management |
| Effect-TS 3.x | Functional effect system |

## Visualization

### Maps & Layers
- **deck.gl 9.x** - GPU-accelerated WebGL layers
  - PathLayer - Track line visualization
  - TripsLayer - Animated temporal tracks
  - GeoJsonLayer - Vector features
  - TileLayer - Raster tile rendering
  - IconLayer - Marker icons
  - HeatmapLayer - Density visualization

- **mapbox-gl** - Base map rendering
- **react-map-gl** - React bindings for Mapbox

### 3D Overlay
- **react-three-fiber** - React renderer for Three.js
- **@react-three/drei** - Utility components
- **three.js** - 3D graphics library

## Backend & Transport

| System | Purpose |
|--------|---------|
| NATS JetStream | Real-time message transport |
| AvaClientV2 | View subscription and invalidation |
| Durable Streams | Append-only event persistence |
| ElectricSQL (future) | Offline-first PostgreSQL sync |

## Patterns

### AtomRpc.Tag
```typescript
class GeospatialClient extends AtomRpc.Tag<GeospatialClient>()(
  'geoint/GeospatialClient',
  {
    group: GeospatialRpcs,
    protocol: RpcClient.layerProtocolSocket({ retryTransientErrors: true })
  }
) {}
```

### Atom.family for Spatial Queries
```typescript
const featuresInBounds = Atom.family((bounds: BBox) =>
  Atom.make(() => features('queryFeatures', { bounds }))
    .pipe(Atom.setIdleTTL(Duration.minutes(5)))
)
```

### FiberMap for Subscriptions
```typescript
const trackFibers = yield* FiberMap.make<TrackId, void, IntelError>()
// Auto-cleanup on scope close
```

## Dependencies to Add

```json
{
  "@deck.gl/core": "^9.0",
  "@deck.gl/layers": "^9.0",
  "@deck.gl/geo-layers": "^9.0",
  "@react-three/fiber": "^8.15",
  "@react-three/drei": "^9.88",
  "three": "^0.160"
}
```
