# GEOINT - Feature Specifications

## F001: Track Visualization

**Priority:** P0 | **Status:** Planned

Display moving object tracks (aircraft, vehicles, vessels) with animated trails.

### Layers
- `PathLayer` - Static track history lines
- `TripsLayer` - Animated temporal tracks with trail fade
- `IconLayer` - Current position markers with heading

### Schemas
```typescript
const Track = Schema.Struct({
  trackId: TrackId,
  positions: Schema.Array(TrackPosition),
  metadata: TrackMetadata
})

const TrackPosition = Schema.Struct({
  lat: Schema.Number,
  lon: Schema.Number,
  timestamp: Schema.Date,
  heading: Schema.Number,
  speed: Schema.Number,
  altitude: Schema.optionalWith(Schema.Number, { default: () => 0 })
})

const TrackMetadata = Schema.Struct({
  objectType: Schema.Literal('aircraft', 'vehicle', 'vessel', 'person'),
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  classification: Schema.Literal('friendly', 'hostile', 'neutral', 'unknown'),
  source: Schema.String
})
```

### Behavior
- Animate currentTime prop for TripsLayer at 60fps
- Color tracks by classification (green=friendly, red=hostile, yellow=neutral)
- Width scaled by confidence (0.8+ = 3px, else 2px)
- Trail length: 3 minutes of history

---

## F002: Feature Layers

**Priority:** P0 | **Status:** Planned

Display static vector features (buildings, roads, POIs) with styling.

### Layers
- `GeoJsonLayer` - Standard GeoJSON rendering
- `PolygonLayer` - Filled polygon areas

### Schemas
```typescript
const Feature = Schema.Struct({
  id: FeatureId,
  geometry: Schema.Unknown, // GeoJSON geometry
  properties: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  layerId: LayerId
})

const Layer = Schema.Struct({
  id: LayerId,
  name: Schema.String,
  type: Schema.Literal('vector', 'raster', 'imagery'),
  visible: Schema.Boolean,
  opacity: Schema.Number.pipe(Schema.between(0, 1))
})
```

### Behavior
- Toggle visibility per layer via LayerPalette
- Opacity slider per layer
- Color by feature properties
- Pickable for click interactions

---

## F003: Satellite Imagery

**Priority:** P1 | **Status:** Planned

Stream satellite imagery tiles with sensor metadata.

### Layers
- `TileLayer` - XYZ tile rendering
- `BitmapLayer` - Single image overlays

### Schemas
```typescript
const ImageryChunk = Schema.Struct({
  tileId: Schema.String,
  imageData: Schema.Uint8Array,
  metadata: Schema.Struct({
    sensorType: Schema.Literal('optical', 'sar', 'thermal'),
    acquisitionTime: Schema.Date,
    cloudCover: Schema.Number,
    resolution: Schema.Number
  })
})
```

### Behavior
- Stream tiles progressively as they load
- Show cloud cover percentage in tooltip
- Support thermal/SAR color mapping

---

## F004: 3D Visualization

**Priority:** P1 | **Status:** Planned

React-Three-Fiber overlay for 3D track markers and threat volumes.

### Components
- `GeointR3FOverlay` - Main Canvas overlay
- `TrackMarker3D` - 3D cone markers with heading
- `ThreatVolume` - Translucent 3D threat envelopes

### Behavior
- Canvas overlays deck.gl with `pointerEvents: 'none'`
- Markers project lat/lon to screen coordinates
- Cones rotate to show heading
- Threat volumes pulse when high confidence

---

## F005: Track Classification

**Priority:** P1 | **Status:** Planned

Classify tracks as friendly/hostile/neutral with confidence scoring.

### Mutations
```typescript
const classifyTrack = intel.mutation("updateTrackClassification")

// Usage
classifyTrack({
  payload: { trackId, classification: 'hostile' },
  reactivityKeys: ['tracks', trackId]
})
```

### Behavior
- Click track to open classification panel
- Select friendly/hostile/neutral/unknown
- Auto-invalidates track queries via reactivity keys

---

## F006: Spatial Queries

**Priority:** P0 | **Status:** Planned

Query features within bounding box with caching.

### Atoms
```typescript
const featuresInBounds = Atom.family((bounds: BBox) =>
  Atom.make(() => features('queryFeatures', { bounds, layers: ['all'] }))
    .pipe(Atom.setIdleTTL(Duration.minutes(5)))
)
```

### Behavior
- Cache results for 5 minutes
- Auto-dispose when component unmounts
- Reactivity keys: `['features', bounds.join(',')]`

---

## F007: Durable Persistence

**Priority:** P2 | **Status:** Planned

Persist track history to durable streams with replay.

### Service
```typescript
class TrackStore extends Effect.Service<TrackStore>()('geoint/TrackStore', {
  dependencies: [DurableStreamClient.layer],
  effect: Effect.gen(function*() {
    const appendTrackUpdate = (trackId, position) => /* ... */
    const replayTrack = (trackId) => /* ... */
    return { appendTrackUpdate, replayTrack }
  })
}) {}
```

### Behavior
- Append position updates to per-track streams
- Replay full track history on demand
- Support offline operation
