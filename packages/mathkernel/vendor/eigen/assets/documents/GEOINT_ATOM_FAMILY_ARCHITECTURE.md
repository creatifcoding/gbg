# GEOINT Atom.family + AtomRpc.Tag Architecture

**Document Type**: Architecture Design
**Status**: Draft
**Beads**: tmnl-39ee4, tmnl-evgyz, tmnl-gi7nq
**Date**: 2026-01-10

---

## Problem Statement

Current GEOINT atom architecture uses **static atoms** and **plain functions**:

```typescript
// Current: Static array atom
export const resultsAtom = Atom.make<readonly SearchResultItem[]>([])

// Current: Plain function actions
export const clearResults = () => {
  geointRegistry.set(resultsAtom, [])
  geointRegistry.set(selectedResultAtom, null)
}
```

**Issues**:
1. Cannot have per-entity reactive state
2. No Effect service integration for actions
3. No error boundaries or retry logic
4. No cache invalidation patterns

---

## Solution: Atom.family + AtomRpc.Tag

### Atom.family Pattern

`Atom.family` creates **parameterized atoms** - one atom instance per unique key:

```typescript
import { Atom } from '@effect-atom/atom'

// Per-entity state family
export const entityStateFamily = Atom.family((entityId: string) =>
  Atom.make<EntityUIState>({
    selected: false,
    hovered: false,
    expanded: false,
    highlighted: false,
  })
)

// Usage: each entityId gets its own atom
const entity1State = entityStateFamily('entity-123')  // Atom<EntityUIState>
const entity2State = entityStateFamily('entity-456')  // Different atom instance
```

**Benefits**:
- Hyper-granular state per element
- Automatic cleanup via WeakRef/FinalizationRegistry
- No array diffing needed for updates
- Each entity subscribes only to its own state

### AtomRpc.Tag Pattern

`AtomRpc.Tag` creates **Effect service atoms** with query/mutation patterns:

```typescript
import { AtomRpc } from '@effect-atom/atom'
import { RpcGroup, Rpc } from '@effect/rpc'
import { Schema } from 'effect'

// 1. Define RPC group for GEOINT operations
class GeointRpcs extends RpcGroup.make(
  Rpc.make('search', {
    payload: SearchQuerySchema,
    success: Schema.Array(SearchResultItemSchema),
  }),
  Rpc.make('getEntity', {
    payload: Schema.String,
    success: EntityDetailSchema,
  }),
  Rpc.make('updateBookmark', {
    payload: BookmarkUpdateSchema,
  }),
) {}

// 2. Create AtomRpc client
class GeointClient extends AtomRpc.Tag<GeointClient>()('GeointClient', {
  group: GeointRpcs,
  protocol: RpcClient.layerProtocolHttp({
    url: '/api/geoint/rpc',
  }).pipe(Layer.provide(RpcSerialization.layerJson)),
}) {}

// 3. Query atoms (read operations)
export const searchResultsAtom = GeointClient.query('search', defaultQuery, {
  reactivityKeys: ['search-results'],
  timeToLive: Duration.minutes(5),
})

export const entityDetailAtom = (entityId: string) =>
  GeointClient.query('getEntity', entityId, {
    reactivityKeys: [`entity-${entityId}`],
  })

// 4. Mutation atoms (write operations)
export const updateBookmarkFn = GeointClient.mutation('updateBookmark')
```

**Benefits**:
- Automatic caching with TTL
- Reactivity keys for cache invalidation
- Effect error handling
- Type-safe RPC contracts

---

## GEOINT-Specific Implementation

### 1. Entity State Family

```typescript
// src/lib/geoint/atoms/entityFamily.ts

import { Atom } from '@effect-atom/atom'
import type { SearchResultItem } from '../schemas'

/** Per-entity UI state */
export interface EntityUIState {
  readonly selected: boolean
  readonly hovered: boolean
  readonly expanded: boolean
  readonly highlighted: boolean
  readonly pinned: boolean
}

const DEFAULT_ENTITY_STATE: EntityUIState = {
  selected: false,
  hovered: false,
  expanded: false,
  highlighted: false,
  pinned: false,
}

/** Atom family for per-entity UI state */
export const entityStateFamily = Atom.family((entityId: string) =>
  Atom.make<EntityUIState>(DEFAULT_ENTITY_STATE).pipe(Atom.keepAlive)
)

/** Bulk operations on entity state */
export const entityStateOps = {
  select: (entityId: string) => {
    const current = geointRegistry.get(entityStateFamily(entityId))
    geointRegistry.set(entityStateFamily(entityId), { ...current, selected: true })
  },

  deselect: (entityId: string) => {
    const current = geointRegistry.get(entityStateFamily(entityId))
    geointRegistry.set(entityStateFamily(entityId), { ...current, selected: false })
  },

  deselectAll: (entityIds: readonly string[]) => {
    entityIds.forEach((id) => {
      const current = geointRegistry.get(entityStateFamily(id))
      geointRegistry.set(entityStateFamily(id), { ...current, selected: false })
    })
  },

  setHovered: (entityId: string, hovered: boolean) => {
    const current = geointRegistry.get(entityStateFamily(entityId))
    geointRegistry.set(entityStateFamily(entityId), { ...current, hovered })
  },

  toggleExpanded: (entityId: string) => {
    const current = geointRegistry.get(entityStateFamily(entityId))
    geointRegistry.set(entityStateFamily(entityId), { ...current, expanded: !current.expanded })
  },
}
```

### 2. Floating Panel Family

```typescript
// src/lib/geoint/atoms/floatingPanelFamily.ts

import { Atom } from '@effect-atom/atom'
import type { FloatingPanelId, FloatingPanelConfig } from './layoutAtoms'

const DEFAULT_PANEL_CONFIGS: Record<FloatingPanelId, Omit<FloatingPanelConfig, 'id'>> = {
  layers: { visible: true, minimized: false, position: { x: 16, y: 80 }, size: { width: 200, height: 300 }, zIndex: 1 },
  entity: { visible: true, minimized: false, position: { x: -396, y: 80 }, size: { width: 380, height: 400 }, zIndex: 2 },
  timeline: { visible: true, minimized: false, position: { x: 32, y: -120 }, size: { width: 800, height: 80 }, zIndex: 3 },
  search: { visible: false, minimized: false, position: { x: 0, y: 80 }, size: { width: 400, height: 48 }, zIndex: 10 },
}

/** Atom family for per-panel configuration */
export const floatingPanelFamily = Atom.family((id: FloatingPanelId) =>
  Atom.make<FloatingPanelConfig>({
    id,
    ...DEFAULT_PANEL_CONFIGS[id],
  }).pipe(Atom.keepAlive)
)

/** Z-index counter for bring-to-front */
export const maxZIndexAtom = Atom.make(10)

/** Panel operations */
export const floatingPanelOps = {
  move: (id: FloatingPanelId, position: { x: number; y: number }) => {
    const current = geointRegistry.get(floatingPanelFamily(id))
    geointRegistry.set(floatingPanelFamily(id), { ...current, position })
  },

  resize: (id: FloatingPanelId, size: { width?: number; height?: number }) => {
    const current = geointRegistry.get(floatingPanelFamily(id))
    geointRegistry.set(floatingPanelFamily(id), {
      ...current,
      size: { ...current.size, ...size },
    })
  },

  toggleVisibility: (id: FloatingPanelId) => {
    const current = geointRegistry.get(floatingPanelFamily(id))
    geointRegistry.set(floatingPanelFamily(id), { ...current, visible: !current.visible })
  },

  bringToFront: (id: FloatingPanelId) => {
    const maxZ = geointRegistry.get(maxZIndexAtom)
    const newZ = maxZ + 1
    geointRegistry.set(maxZIndexAtom, newZ)
    const current = geointRegistry.get(floatingPanelFamily(id))
    geointRegistry.set(floatingPanelFamily(id), { ...current, zIndex: newZ })
  },
}
```

### 3. Search Results Family (Nested)

```typescript
// src/lib/geoint/atoms/resultsFamily.ts

import { Atom } from '@effect-atom/atom'
import type { SearchResultItem, IntelSource } from '../schemas'

/** Per-result metadata atom family */
export const resultMetaFamily = Atom.family((resultId: string) =>
  Atom.make<{
    relevanceScore: number
    sourceConfidence: number
    lastUpdated: number
    viewed: boolean
  }>({
    relevanceScore: 0,
    sourceConfidence: 1,
    lastUpdated: Date.now(),
    viewed: false,
  })
)

/** Nested family: per-source, per-result */
export const sourceResultFamily = Atom.family(
  ({ source, resultId }: { source: IntelSource; resultId: string }) =>
    Atom.make<{
      position: number
      highlighted: boolean
      filtered: boolean
    }>({
      position: 0,
      highlighted: false,
      filtered: false,
    })
)

/** Usage example */
// const osmResult = sourceResultFamily({ source: 'osm', resultId: 'node-123' })
// const trackResult = sourceResultFamily({ source: 'track', resultId: 'track-456' })
```

### 4. GeointRpc Service (Effect Integration)

```typescript
// src/lib/geoint/services/GeointRpcClient.ts

import { AtomRpc, Atom } from '@effect-atom/atom'
import { RpcGroup, Rpc, RpcClient, RpcSerialization } from '@effect/rpc'
import { Schema, Duration, Layer, Effect } from 'effect'
import {
  SearchQuerySchema,
  SearchResultItemSchema,
  EntityDetailSchema,
  BBoxSchema,
} from '../schemas'

// RPC definitions
class GeointRpcs extends RpcGroup.make(
  // Search operations
  Rpc.make('searchArea', {
    payload: Schema.Struct({
      bbox: BBoxSchema,
      sources: Schema.Array(Schema.String),
      query: Schema.optional(Schema.String),
    }),
    success: Schema.Array(SearchResultItemSchema),
  }),

  // Entity operations
  Rpc.make('getEntityDetail', {
    payload: Schema.String, // entityId
    success: EntityDetailSchema,
  }),

  // Bookmark operations
  Rpc.make('saveBookmark', {
    payload: Schema.Struct({
      entityId: Schema.String,
      name: Schema.String,
      notes: Schema.optional(Schema.String),
    }),
    success: Schema.Struct({ id: Schema.String }),
  }),

  // Collection operations
  Rpc.make('addToCollection', {
    payload: Schema.Struct({
      collectionId: Schema.String,
      entityIds: Schema.Array(Schema.String),
    }),
  }),
) {}

// AtomRpc client
export class GeointClient extends AtomRpc.Tag<GeointClient>()('GeointClient', {
  group: GeointRpcs,
  protocol: RpcClient.layerProtocolHttp({
    url: '/api/geoint/rpc',
  }).pipe(Layer.provide(RpcSerialization.layerJson)),
}) {}

// Query atoms
export const createSearchQuery = (bbox: BBox, sources: IntelSource[]) =>
  GeointClient.query('searchArea', { bbox, sources }, {
    reactivityKeys: ['search-results', `bbox-${bbox.join('-')}`],
    timeToLive: Duration.minutes(2),
  })

export const entityDetailQuery = (entityId: string) =>
  GeointClient.query('getEntityDetail', entityId, {
    reactivityKeys: [`entity-${entityId}`],
    timeToLive: Duration.minutes(10),
  })

// Mutation atoms
export const saveBookmarkMutation = GeointClient.mutation('saveBookmark')
export const addToCollectionMutation = GeointClient.mutation('addToCollection')

// Custom Effect operations using runtime
export const searchWithRetry = GeointClient.runtime.fn<{
  bbox: BBox
  sources: IntelSource[]
}>()(({ bbox, sources }) =>
  Effect.gen(function* () {
    const client = yield* GeointClient
    return yield* client('searchArea', { bbox, sources }).pipe(
      Effect.retry({ times: 3 }),
      Effect.timeout(Duration.seconds(30)),
    )
  })
)
```

---

## Migration Path

### Phase 1: Create Atom Families (tmnl-39ee4, tmnl-gi7nq)

1. Create `entityStateFamily` for per-entity UI state
2. Create `floatingPanelFamily` for floating panels
3. Create `resultMetaFamily` for per-result metadata

### Phase 2: Implement AtomRpc.Tag (tmnl-evgyz)

1. Define `GeointRpcs` RPC group
2. Create `GeointClient` AtomRpc.Tag
3. Migrate search/entity/bookmark operations to RPC

### Phase 3: Update Components

1. Replace `useState` with `useAtomValue(entityStateFamily(id))`
2. Replace manual fetch with `GeointClient.query`
3. Replace direct API calls with `GeointClient.mutation`

### Phase 4: Integrate with XState (tmnl-8w3ig)

1. Use `GeointClient.runtime` in machine actions
2. Sync query results to machine context
3. Trigger mutations from machine events

---

## Hook Integration

```typescript
// src/lib/geoint/hooks/useGeointEntity.ts

import { useAtomValue } from '@effect-atom/atom-react'
import { entityStateFamily, entityStateOps } from '../atoms/entityFamily'

export function useGeointEntity(entityId: string) {
  const state = useAtomValue(entityStateFamily(entityId))

  return {
    ...state,
    select: () => entityStateOps.select(entityId),
    deselect: () => entityStateOps.deselect(entityId),
    toggleExpanded: () => entityStateOps.toggleExpanded(entityId),
    setHovered: (h: boolean) => entityStateOps.setHovered(entityId, h),
  }
}
```

---

## Testing

```typescript
import { Registry } from '@effect-atom/atom'
import { entityStateFamily, entityStateOps } from '../atoms/entityFamily'

describe('entityStateFamily', () => {
  it('creates unique atoms per entityId', () => {
    const registry = Registry.make()

    const state1 = registry.get(entityStateFamily('entity-1'))
    const state2 = registry.get(entityStateFamily('entity-2'))

    expect(state1.selected).toBe(false)
    expect(state2.selected).toBe(false)

    entityStateOps.select('entity-1')

    expect(registry.get(entityStateFamily('entity-1')).selected).toBe(true)
    expect(registry.get(entityStateFamily('entity-2')).selected).toBe(false)
  })
})
```

---

## References

- effect-atom source: `submodules/effect-atom/packages/atom/src/Atom.ts:1316`
- AtomRpc source: `submodules/effect-atom/packages/atom/src/AtomRpc.ts`
- `/effect-atom-integration` skill
- `/fermion-patterns` skill
