/**
 * GEOINT Search → Pipeline → Entity Hydration Integration Tests
 *
 * Tests the full search-to-hydration flow:
 * 1. Mock search results creation
 * 2. GeointKoriBridge.hydrateFromSearch() spawning entities
 * 3. Entity atoms population (entityLiveDataFamily, entityUIStateFamily)
 * 4. entityOps selection/hover operations on hydrated entities
 * 5. Stats tracking correctness
 *
 * @module geoint/kori/__tests__/search-to-hydration.integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Effect, HashSet, Option } from 'effect'
import {
  GeointKoriBridge,
  GeointKoriBridgeLive,
  hydrateEntities,
  getBridgeStats,
} from '../GeointKoriBridge'
import {
  geointRegistry,
  entityOps,
  entityLiveDataFamily,
  entityUIStateFamily,
  selectedEntityIds,
  hoveredEntityId,
  pinnedEntityIds,
} from '../entity-atoms'
import type { SearchResultItem, SearchResultId, Icao24, PoiId } from '../../schemas/search'
import {
  SearchResultFlight,
  SearchResultPoi,
  SearchResultTrack,
  SearchResultFeature,
} from '../../schemas/search'

// =============================================================================
// Mock Data Factories
// =============================================================================

/**
 * Create a unique search result ID.
 */
function createSearchResultId(prefix: string): SearchResultId {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as SearchResultId
}

/**
 * Create a mock ICAO24 hex code for flight tracking.
 * Must be exactly 6 hex characters to match schema pattern ^[0-9a-f]{6}$.
 */
function createIcao24(index: number): Icao24 {
  // Pad to 6 hex chars: e.g., index=1 -> "000001", index=255 -> "0000ff"
  return index.toString(16).padStart(6, '0') as Icao24
}

/**
 * Create a mock POI ID.
 */
function createPoiId(suffix: string): PoiId {
  return `osm-poi-${suffix}` as PoiId
}

/**
 * Create a mock flight search result.
 */
function createMockFlight(opts: {
  icao24Index?: number
  callsign?: string
  position?: [number, number, number]
  velocity?: number
  heading?: number
  onGround?: boolean
}): SearchResultFlight {
  const icao24 = createIcao24(opts.icao24Index ?? 1)
  return new SearchResultFlight({
    id: createSearchResultId('flight'),
    source: 'opensky',
    score: 0.95,
    retrievedAt: new Date(),
    icao24,
    callsign: opts.callsign ?? 'UAL123',
    position: opts.position ?? [-122.4, 37.8, 10000],
    velocity: opts.velocity ?? 250,
    heading: opts.heading ?? 180,
    verticalRate: 0,
    onGround: opts.onGround ?? false,
    category: 'medium',
    originCountry: 'United States',
    lastContact: new Date(),
  })
}

/**
 * Create a mock POI search result.
 */
function createMockPoi(opts: {
  id?: string
  name?: string
  category?: 'amenity' | 'building' | 'highway'
  position?: [number, number]
}): SearchResultPoi {
  return new SearchResultPoi({
    id: createSearchResultId('poi'),
    source: 'osm',
    score: 0.85,
    retrievedAt: new Date(),
    poiId: createPoiId(opts.id ?? '001'),
    name: opts.name ?? 'Test Hospital',
    category: opts.category ?? 'amenity',
    position: opts.position ?? [-122.41, 37.79],
    tags: { amenity: 'hospital', name: opts.name ?? 'Test Hospital' },
  })
}

/**
 * Create a mock track search result.
 */
function createMockTrack(opts: {
  trackId?: string
  label?: string
  position?: [number, number, number]
}): SearchResultTrack {
  const trackId = `trk-${opts.trackId ?? '001'}` as any
  return new SearchResultTrack({
    id: createSearchResultId('track'),
    source: 'track',
    score: 0.9,
    retrievedAt: new Date(),
    trackId,
    position: opts.position ?? [-122.42, 37.78, 500],
    heading: 45,
    speed: 150,
    classification: 'friendly',
    objectType: 'aircraft',
    label: opts.label ?? 'Alpha-1',
  })
}

/**
 * Create a mock feature search result.
 */
function createMockFeature(opts: {
  featureId?: string
  label?: string
  position?: [number, number]
}): SearchResultFeature {
  const featureId = `feat-${opts.featureId ?? '001'}` as any
  return new SearchResultFeature({
    id: createSearchResultId('feature'),
    source: 'feature',
    score: 0.8,
    retrievedAt: new Date(),
    featureId,
    position: opts.position ?? [-122.43, 37.77],
    geometryType: 'Point',
    properties: { type: 'landmark' },
    label: opts.label ?? 'Test Landmark',
  })
}

/**
 * Create a mixed batch of search results for testing.
 */
function createMixedSearchResults(count: number): SearchResultItem[] {
  const results: SearchResultItem[] = []

  for (let i = 0; i < count; i++) {
    const suffix = String(i).padStart(3, '0')
    switch (i % 4) {
      case 0:
        // Use numeric index for flights (i + 1000 to avoid collisions)
        results.push(createMockFlight({ icao24Index: i + 1000, callsign: `UAL${i}` }))
        break
      case 1:
        results.push(createMockPoi({ id: suffix, name: `POI ${i}` }))
        break
      case 2:
        results.push(createMockTrack({ trackId: suffix, label: `Track-${i}` }))
        break
      case 3:
        results.push(createMockFeature({ featureId: suffix, label: `Feature-${i}` }))
        break
    }
  }

  return results
}

// =============================================================================
// Test Suite
// =============================================================================

describe('Search → Pipeline → Entity Hydration Integration', () => {
  // Clean up atoms before each test
  beforeEach(() => {
    entityOps.clearAll()
  })

  afterEach(() => {
    entityOps.clearAll()
  })

  describe('Mock Search Result Creation', () => {
    it('creates valid flight search results', () => {
      const flight = createMockFlight({
        icao24Index: 0x123, // 291 in decimal -> "000123" in hex
        callsign: 'TEST456',
        position: [-122.0, 37.5, 35000],
      })

      expect(flight._tag).toBe('SearchResultFlight')
      expect(flight.icao24).toBe('000123')
      expect(flight.callsign).toBe('TEST456')
      expect(flight.position).toEqual([-122.0, 37.5, 35000])
      expect(flight.source).toBe('opensky')
    })

    it('creates valid POI search results', () => {
      const poi = createMockPoi({
        id: 'hospital-001',
        name: 'SF General Hospital',
        category: 'amenity',
      })

      expect(poi._tag).toBe('SearchResultPoi')
      expect(poi.name).toBe('SF General Hospital')
      expect(poi.category).toBe('amenity')
      expect(poi.source).toBe('osm')
    })

    it('creates valid track search results', () => {
      const track = createMockTrack({
        trackId: 'alpha-001',
        label: 'Alpha Squad',
      })

      expect(track._tag).toBe('SearchResultTrack')
      expect(track.label).toBe('Alpha Squad')
      expect(track.classification).toBe('friendly')
    })

    it('creates mixed search results batch', () => {
      const results = createMixedSearchResults(8)

      expect(results).toHaveLength(8)
      expect(results.filter((r) => r._tag === 'SearchResultFlight')).toHaveLength(2)
      expect(results.filter((r) => r._tag === 'SearchResultPoi')).toHaveLength(2)
      expect(results.filter((r) => r._tag === 'SearchResultTrack')).toHaveLength(2)
      expect(results.filter((r) => r._tag === 'SearchResultFeature')).toHaveLength(2)
    })
  })

  describe('GeointKoriBridge.hydrateFromSearch()', () => {
    it('spawns entities from flight search results', async () => {
      const flight = createMockFlight({ icao24Index: 0xf01, callsign: 'UAL999' })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])

        expect(spawned).toHaveLength(1)
        expect(spawned[0].entityType).toBe('flight')
        expect(spawned[0].label).toBe('UAL999')
        expect(spawned[0].entityId).toBe('flight:000f01')

        return spawned
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('spawns entities from POI search results', async () => {
      const poi = createMockPoi({ id: 'p01', name: 'Test Cafe' })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([poi])

        expect(spawned).toHaveLength(1)
        expect(spawned[0].entityType).toBe('poi')
        expect(spawned[0].label).toBe('Test Cafe')
        expect(spawned[0].entityId).toContain('poi:')

        return spawned
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('spawns multiple entities from mixed search results', async () => {
      const results = createMixedSearchResults(4)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        expect(spawned).toHaveLength(4)

        const entityTypes = spawned.map((s) => s.entityType)
        expect(entityTypes).toContain('flight')
        expect(entityTypes).toContain('poi')
        expect(entityTypes).toContain('track')
        expect(entityTypes).toContain('feature')

        return spawned
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('skips already-spawned entities and updates them instead', async () => {
      const flight = createMockFlight({ icao24Index: 0xd001, callsign: 'DUP001' })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge

        // First hydration
        const firstSpawn = yield* bridge.hydrateFromSearch([flight])
        expect(firstSpawn).toHaveLength(1)

        // Second hydration with same entity
        const secondSpawn = yield* bridge.hydrateFromSearch([flight])
        expect(secondSpawn).toHaveLength(0) // Should skip duplicate

        // Stats should still show only 1 entity
        const stats = yield* bridge.getStats()
        expect(stats.totalEntities).toBe(1)

        return { firstSpawn, secondSpawn }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })
  })

  describe('Entity Atom Population', () => {
    it('populates entityLiveDataFamily after hydration', async () => {
      const flight = createMockFlight({
        icao24Index: 0xaaaa,
        callsign: 'LIVE001',
        position: [-122.5, 37.9, 20000],
      })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])

        const entityId = spawned[0].entityId
        const liveDataAtom = entityLiveDataFamily(entityId)
        const liveData = geointRegistry.get(liveDataAtom)

        expect(liveData).not.toBeNull()
        expect(liveData?.entityId).toBe(entityId)
        expect(liveData?.entityType).toBe('flight')
        expect(liveData?.label).toBe('LIVE001')
        expect(liveData?.position.lon).toBe(-122.5)
        expect(liveData?.position.lat).toBe(37.9)
        expect(liveData?.position.altitudeM).toBe(20000)
        expect(liveData?.isLive).toBe(false)

        return liveData
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('populates entityUIStateFamily with defaults after hydration', async () => {
      const poi = createMockPoi({ id: 'ui1', name: 'UI Test POI' })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([poi])

        const entityId = spawned[0].entityId
        const uiStateAtom = entityUIStateFamily(entityId)
        const uiState = geointRegistry.get(uiStateAtom)

        expect(uiState.selected).toBe(false)
        expect(uiState.hovered).toBe(false)
        expect(uiState.expanded).toBe(false)
        expect(uiState.highlighted).toBe(false)
        expect(uiState.pinned).toBe(false)
        expect(uiState.viewed).toBe(false)

        return uiState
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('populates heading and speed for flight entities', async () => {
      const flight = createMockFlight({
        icao24Index: 0xbbbb,
        heading: 270,
        velocity: 450,
      })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])

        const entityId = spawned[0].entityId
        const liveData = geointRegistry.get(entityLiveDataFamily(entityId))

        expect(liveData?.heading).toBe(270)
        expect(liveData?.speed).toBe(450)

        return liveData
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })
  })

  describe('entityOps Selection/Hover on Hydrated Entities', () => {
    it('selects a hydrated entity', async () => {
      const flight = createMockFlight({ icao24Index: 0xcccc })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])
        const entityId = spawned[0].entityId

        // Select the entity
        entityOps.select(entityId)

        // Verify selection in global atom
        const selectedIds = geointRegistry.get(selectedEntityIds)
        expect(HashSet.has(selectedIds, entityId)).toBe(true)

        // Verify selection in entity UI state
        const uiState = geointRegistry.get(entityUIStateFamily(entityId))
        expect(uiState.selected).toBe(true)

        return { entityId, selectedIds }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('deselects a hydrated entity', async () => {
      const flight = createMockFlight({ icao24Index: 0xdddd })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])
        const entityId = spawned[0].entityId

        // Select then deselect
        entityOps.select(entityId)
        expect(geointRegistry.get(entityUIStateFamily(entityId)).selected).toBe(true)

        entityOps.deselect(entityId)

        // Verify deselection
        const selectedIds = geointRegistry.get(selectedEntityIds)
        expect(HashSet.has(selectedIds, entityId)).toBe(false)
        expect(geointRegistry.get(entityUIStateFamily(entityId)).selected).toBe(false)

        return { entityId }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('toggles selection on a hydrated entity', async () => {
      const poi = createMockPoi({ id: 'tog1' })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([poi])
        const entityId = spawned[0].entityId

        // Toggle on
        entityOps.toggleSelect(entityId)
        expect(geointRegistry.get(entityUIStateFamily(entityId)).selected).toBe(true)

        // Toggle off
        entityOps.toggleSelect(entityId)
        expect(geointRegistry.get(entityUIStateFamily(entityId)).selected).toBe(false)

        return { entityId }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('selectOnly clears other selections', async () => {
      const results = [
        createMockFlight({ icao24Index: 0x1111 }),
        createMockFlight({ icao24Index: 0x2222 }),
        createMockFlight({ icao24Index: 0x3333 }),
      ]

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        const [e1, e2, e3] = spawned.map((s) => s.entityId)

        // Select first two entities
        entityOps.select(e1)
        entityOps.select(e2)
        expect(HashSet.size(geointRegistry.get(selectedEntityIds))).toBe(2)

        // selectOnly on third entity
        entityOps.selectOnly(e3)

        // Only e3 should be selected
        const selectedIds = geointRegistry.get(selectedEntityIds)
        expect(HashSet.size(selectedIds)).toBe(1)
        expect(HashSet.has(selectedIds, e3)).toBe(true)
        expect(HashSet.has(selectedIds, e1)).toBe(false)
        expect(HashSet.has(selectedIds, e2)).toBe(false)

        return { e1, e2, e3 }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('hovers a hydrated entity', async () => {
      const flight = createMockFlight({ icao24Index: 0x4444 })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])
        const entityId = spawned[0].entityId

        // Hover the entity
        entityOps.hover(entityId)

        // Verify hover in global atom
        const hovered = geointRegistry.get(hoveredEntityId)
        expect(Option.isSome(hovered)).toBe(true)
        expect(Option.getOrNull(hovered)).toBe(entityId)

        // Verify hover in entity UI state
        const uiState = geointRegistry.get(entityUIStateFamily(entityId))
        expect(uiState.hovered).toBe(true)

        return { entityId }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('unhover clears hover state', async () => {
      const flight = createMockFlight({ icao24Index: 0x5555 })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])
        const entityId = spawned[0].entityId

        entityOps.hover(entityId)
        expect(geointRegistry.get(entityUIStateFamily(entityId)).hovered).toBe(true)

        entityOps.unhover(entityId)

        const hovered = geointRegistry.get(hoveredEntityId)
        expect(Option.isNone(hovered)).toBe(true)
        expect(geointRegistry.get(entityUIStateFamily(entityId)).hovered).toBe(false)

        return { entityId }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('hover switches between entities correctly', async () => {
      const results = [
        createMockFlight({ icao24Index: 0x6666 }),
        createMockFlight({ icao24Index: 0x7777 }),
      ]

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)
        const [e1, e2] = spawned.map((s) => s.entityId)

        // Hover first entity
        entityOps.hover(e1)
        expect(geointRegistry.get(entityUIStateFamily(e1)).hovered).toBe(true)
        expect(geointRegistry.get(entityUIStateFamily(e2)).hovered).toBe(false)

        // Hover second entity (should unhover first)
        entityOps.hover(e2)
        expect(geointRegistry.get(entityUIStateFamily(e1)).hovered).toBe(false)
        expect(geointRegistry.get(entityUIStateFamily(e2)).hovered).toBe(true)

        return { e1, e2 }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('pins a hydrated entity', async () => {
      const flight = createMockFlight({ icao24Index: 0x8888 })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])
        const entityId = spawned[0].entityId

        entityOps.pin(entityId)

        const pinnedIds = geointRegistry.get(pinnedEntityIds)
        expect(HashSet.has(pinnedIds, entityId)).toBe(true)
        expect(geointRegistry.get(entityUIStateFamily(entityId)).pinned).toBe(true)

        return { entityId }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('togglePin toggles pin state', async () => {
      const poi = createMockPoi({ id: 'tpin1' })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([poi])
        const entityId = spawned[0].entityId

        // Toggle on
        entityOps.togglePin(entityId)
        expect(geointRegistry.get(entityUIStateFamily(entityId)).pinned).toBe(true)

        // Toggle off
        entityOps.togglePin(entityId)
        expect(geointRegistry.get(entityUIStateFamily(entityId)).pinned).toBe(false)

        return { entityId }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })
  })

  describe('Stats Tracking', () => {
    it('returns correct stats after hydration', async () => {
      const results = createMixedSearchResults(10)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        yield* bridge.hydrateFromSearch(results)

        const stats = yield* bridge.getStats()

        expect(stats.totalEntities).toBe(10)
        expect(stats.liveEntities).toBe(0) // No live tracking started
        expect(stats.pinnedEntities).toBe(0) // None pinned
        expect(stats.selectedEntities).toBe(0) // None selected

        return stats
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('stats reflect selection changes', async () => {
      const results = createMixedSearchResults(5)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        // Select 3 entities
        entityOps.select(spawned[0].entityId)
        entityOps.select(spawned[1].entityId)
        entityOps.select(spawned[2].entityId)

        const stats = yield* bridge.getStats()

        expect(stats.totalEntities).toBe(5)
        expect(stats.selectedEntities).toBe(3)

        return stats
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('stats reflect pin changes', async () => {
      const results = createMixedSearchResults(4)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        // Pin 2 entities
        entityOps.pin(spawned[0].entityId)
        entityOps.pin(spawned[3].entityId)

        const stats = yield* bridge.getStats()

        expect(stats.totalEntities).toBe(4)
        expect(stats.pinnedEntities).toBe(2)

        return stats
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('stats update after entity disposal', async () => {
      const results = createMixedSearchResults(3)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        let stats = yield* bridge.getStats()
        expect(stats.totalEntities).toBe(3)

        // Despawn one entity
        yield* bridge.despawn(spawned[0].entityId)

        stats = yield* bridge.getStats()
        expect(stats.totalEntities).toBe(2)

        return stats
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })
  })

  describe('Convenience Effects', () => {
    it('hydrateEntities effect works correctly', async () => {
      const results = [
        createMockFlight({ icao24Index: 0x9999 }),
        createMockPoi({ id: 'eff2' }),
      ]

      const program = hydrateEntities(results).pipe(Effect.provide(GeointKoriBridgeLive))

      const spawned = await Effect.runPromise(program)

      expect(spawned).toHaveLength(2)
      expect(spawned[0].entityType).toBe('flight')
      expect(spawned[1].entityType).toBe('poi')
    })

    it('getBridgeStats effect works correctly', async () => {
      const results = createMixedSearchResults(6)

      const program = Effect.gen(function* () {
        yield* hydrateEntities(results)
        return yield* getBridgeStats()
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      const stats = await Effect.runPromise(program)

      expect(stats.totalEntities).toBe(6)
    })
  })

  describe('Entity Query Operations', () => {
    it('isSelected returns correct state', async () => {
      const flight = createMockFlight({ icao24Index: 0xaaab })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])
        const entityId = spawned[0].entityId

        expect(entityOps.isSelected(entityId)).toBe(false)

        entityOps.select(entityId)
        expect(entityOps.isSelected(entityId)).toBe(true)

        entityOps.deselect(entityId)
        expect(entityOps.isSelected(entityId)).toBe(false)

        return { entityId }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('isPinned returns correct state', async () => {
      const poi = createMockPoi({ id: 'isp1' })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([poi])
        const entityId = spawned[0].entityId

        expect(entityOps.isPinned(entityId)).toBe(false)

        entityOps.pin(entityId)
        expect(entityOps.isPinned(entityId)).toBe(true)

        entityOps.unpin(entityId)
        expect(entityOps.isPinned(entityId)).toBe(false)

        return { entityId }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('selectionCount returns correct count', async () => {
      const results = createMixedSearchResults(5)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        expect(entityOps.selectionCount()).toBe(0)

        entityOps.select(spawned[0].entityId)
        expect(entityOps.selectionCount()).toBe(1)

        entityOps.select(spawned[1].entityId)
        entityOps.select(spawned[2].entityId)
        expect(entityOps.selectionCount()).toBe(3)

        entityOps.clearSelection()
        expect(entityOps.selectionCount()).toBe(0)

        return { spawned }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('getSelectedIds returns array of selected entity IDs', async () => {
      const results = createMixedSearchResults(4)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        entityOps.select(spawned[0].entityId)
        entityOps.select(spawned[2].entityId)

        const selectedIds = entityOps.getSelectedIds()
        expect(selectedIds).toHaveLength(2)
        expect(selectedIds).toContain(spawned[0].entityId)
        expect(selectedIds).toContain(spawned[2].entityId)

        return { spawned, selectedIds }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })
  })

  describe('Clear Operations', () => {
    it('clearSelection removes all selections', async () => {
      const results = createMixedSearchResults(4)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        // Select all
        spawned.forEach((s) => entityOps.select(s.entityId))
        expect(entityOps.selectionCount()).toBe(4)

        // Clear selection
        entityOps.clearSelection()

        expect(entityOps.selectionCount()).toBe(0)
        spawned.forEach((s) => {
          expect(geointRegistry.get(entityUIStateFamily(s.entityId)).selected).toBe(false)
        })

        return { spawned }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('clearNonPinned preserves pinned entities', async () => {
      const results = createMixedSearchResults(4)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        // Pin first entity
        entityOps.pin(spawned[0].entityId)

        // Clear non-pinned
        yield* bridge.clearNonPinned()

        // Stats should show only 1 entity (the pinned one)
        const stats = yield* bridge.getStats()
        expect(stats.totalEntities).toBe(1)
        expect(stats.pinnedEntities).toBe(1)

        return { spawned, stats }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })
  })

  describe('Entity Type Mapping', () => {
    it('getEntityType returns correct type for each result', async () => {
      const results = createMixedSearchResults(4)

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch(results)

        expect(spawned[0].entityType).toBe('flight')
        expect(spawned[1].entityType).toBe('poi')
        expect(spawned[2].entityType).toBe('track')
        expect(spawned[3].entityType).toBe('feature')

        return spawned
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })

    it('entityOps.getEntityType returns correct type', async () => {
      const flight = createMockFlight({ icao24Index: 0xabcd })

      const program = Effect.gen(function* () {
        const bridge = yield* GeointKoriBridge
        const spawned = yield* bridge.hydrateFromSearch([flight])
        const entityId = spawned[0].entityId

        const entityType = entityOps.getEntityType(entityId)
        expect(Option.isSome(entityType)).toBe(true)
        expect(Option.getOrNull(entityType)).toBe('flight')

        return { entityId, entityType }
      }).pipe(Effect.provide(GeointKoriBridgeLive))

      await Effect.runPromise(program)
    })
  })
})
