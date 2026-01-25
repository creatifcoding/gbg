# GEOINT - Implementation Guide

## Development Approach

### Effect-TS Patterns (MANDATORY)
- Use `Effect.gen` for all async operations
- Use `Schema.Struct` for all domain types (no raw interfaces)
- Use `Atom.make()` for state, `ctx.set()` for mutations
- Use `AtomRpc.Tag` for RPC clients with reactivity

### Code Standards
- TypeScript strict mode
- No `any` casts (use Schema.decode)
- Branded types for IDs (TrackId, FeatureId, LayerId)
- 12px minimum font size

### Testing
- Unit tests with `@effect/vitest`
- Registry.make() for atom testing
- Mock RPC protocols for client tests

---

## Phase 1: Foundation (Schemas + Clients)

### 1.1 Create Schema Files

```bash
# Directory already created
ls src/lib/geoint/schemas/
```

**core.ts**
```typescript
import { Schema } from 'effect'

// Branded IDs
export const TrackId = Schema.String.pipe(Schema.brand('TrackId'))
export const FeatureId = Schema.String.pipe(Schema.brand('FeatureId'))
export const LayerId = Schema.String.pipe(Schema.brand('LayerId'))

// GeoJSON primitives
export const Position = Schema.Tuple(Schema.Number, Schema.Number)
export const BBox = Schema.Tuple(
  Schema.Number, Schema.Number,
  Schema.Number, Schema.Number
)

// Classification enum
export const Classification = Schema.Literal(
  'friendly', 'hostile', 'neutral', 'unknown'
)
```

### 1.2 Create AtomRpc Clients

**IntelClient.ts**
```typescript
import * as AtomRpc from '@effect-atom/atom/AtomRpc'
import { Rpc, RpcGroup, RpcSerialization } from '@effect/rpc'
import { RpcClient } from '@effect/rpc/RpcClient'
import { Layer, Schema } from 'effect'
import { Track, TrackId, Classification } from '../schemas'

class IntelRpcs extends RpcGroup.make(
  Rpc.make('getTracks', {
    payload: Schema.Struct({ active: Schema.optional(Schema.Boolean) }),
    success: Schema.Array(Track)
  }),
  Rpc.make('classifyTrack', {
    payload: Schema.Struct({
      trackId: TrackId,
      classification: Classification
    }),
    success: Schema.Boolean
  })
) {}

export class IntelClient extends AtomRpc.Tag<IntelClient>()(
  'geoint/IntelClient',
  {
    group: IntelRpcs,
    protocol: /* ... NATS layer ... */,
    spanPrefix: 'geoint-intel'
  }
) {}
```

---

## Phase 1.5: R3F Overlay

### 1.5.1 Create Overlay Component

**GeointR3FOverlay.tsx**
```typescript
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { useAtomValue } from '@effect-atom/atom-react'
import { Result } from '@effect-atom/atom'
import { GeointService } from '../services'
import { TrackMarker3D } from './TrackMarker3D'

export function GeointR3FOverlay() {
  const tracks = useAtomValue(GeointService.activeTracks)

  return (
    <Canvas
      style={{
        position: 'absolute',
        top: 0, left: 0,
        pointerEvents: 'none'
      }}
      gl={{ alpha: true, antialias: true }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 1000]} />
      <ambientLight intensity={0.5} />

      {Result.match(tracks, {
        onSuccess: (data) => data.map(track => (
          <TrackMarker3D key={track.trackId} track={track} />
        )),
        onFailure: () => null,
        onInitial: () => null
      })}
    </Canvas>
  )
}
```

### 1.5.2 Geo Projection Hook

**useGeoProjection.ts**
```typescript
import { useMemo } from 'react'
import { WebMercatorViewport } from '@deck.gl/core'

export function useGeoProjection(
  viewState: { longitude: number; latitude: number; zoom: number },
  dimensions: { width: number; height: number }
) {
  const viewport = useMemo(
    () => new WebMercatorViewport({ ...viewState, ...dimensions }),
    [viewState, dimensions]
  )

  const project = (lon: number, lat: number): [number, number] => {
    const [x, y] = viewport.project([lon, lat])
    return [x - dimensions.width / 2, dimensions.height / 2 - y]
  }

  return { project, viewport }
}
```

---

## Phase 2: Deck.gl Layers

### 2.1 Track Layer Factory

**tracks.ts**
```typescript
import { PathLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import type { Track } from '../schemas'

const getTrackColor = (classification: string): [number, number, number] => {
  switch (classification) {
    case 'friendly': return [0, 255, 0]
    case 'hostile': return [255, 0, 0]
    case 'neutral': return [255, 255, 0]
    default: return [128, 128, 128]
  }
}

export const createTrackPathLayer = (tracks: Track[]) => new PathLayer({
  id: 'geoint-tracks',
  data: tracks.map(t => ({
    path: t.positions.map(p => [p.lon, p.lat]),
    color: getTrackColor(t.metadata.classification),
    width: t.metadata.confidence > 0.8 ? 3 : 2
  })),
  getPath: d => d.path,
  getColor: d => d.color,
  getWidth: d => d.width,
  widthUnits: 'pixels',
  pickable: true
})

export const createAnimatedTripsLayer = (
  tracks: Track[],
  currentTime: number
) => new TripsLayer({
  id: 'geoint-animated-tracks',
  data: tracks,
  getPath: t => t.positions.map(p => [p.lon, p.lat, p.timestamp.getTime()]),
  getColor: t => getTrackColor(t.metadata.classification),
  currentTime,
  trailLength: 180000, // 3 minutes
  widthMinPixels: 2
})
```

---

## Phase 3: Persistence

### 3.1 TrackStore Service

**TrackStore.ts**
```typescript
import { Effect } from 'effect'
import { DurableStreamClient } from '@/lib/durable-streams'
import type { TrackId, Position } from '../schemas'

export class TrackStore extends Effect.Service<TrackStore>()(
  'geoint/TrackStore',
  {
    dependencies: [DurableStreamClient.layer],
    effect: Effect.gen(function*() {
      const streams = yield* DurableStreamClient

      const appendTrackUpdate = (trackId: TrackId, position: Position) =>
        Effect.gen(function*() {
          const handle = yield* streams.getOrCreate({
            url: `http://localhost:8787/streams/tracks/${trackId}`,
            contentType: 'application/json'
          })
          yield* handle.append({ trackId, position, timestamp: new Date() })
        })

      const replayTrack = (trackId: TrackId) =>
        Effect.gen(function*() {
          const handle = yield* streams.connect({
            url: `http://localhost:8787/streams/tracks/${trackId}`
          })
          return yield* handle.subscribe({ offset: '-1', live: true })
        })

      return { appendTrackUpdate, replayTrack }
    })
  }
) {}
```

---

## Verification

### Unit Tests
```bash
bun test src/lib/geoint
```

### Integration
```bash
# Start services
docker compose up nats durable-streams -d

# Run testbed
bun run tauri:dev
# Navigate to /testbed/geoint
```

### Manual Checklist
- [ ] Tracks render with correct colors
- [ ] Animation plays smoothly (60fps)
- [ ] Layer toggles work
- [ ] 3D markers appear over tracks
- [ ] Classification mutation updates UI
- [ ] Track replay works offline
