/**
 * GEOINT Atom Families Test Harness
 *
 * Verifies panel-scoped atom family implementation:
 * - Memoization (same panelId → same atom instance)
 * - Isolation (different panelIds → independent state)
 * - Integration (multi-panel scenarios)
 *
 * @module geoint/atoms/__tests__/families
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Registry } from '@effect-atom/atom'
import {
  asPanelId,
  getPanelAtoms,
  type PanelId,
  type ViewportState,
  type ActiveFilters,
} from '../families'
import {
  SearchResultWeather,
  SearchResultImagery,
  type SearchResultItem,
} from '../../schemas'

// Helper to create branded SearchResultId (for tests only)
function asSearchResultId(id: string): typeof import('../../schemas').SearchResultId.Type {
  return id as any
}

// Available sources for filter tests
const AVAILABLE_SOURCES = ['track', 'feature', 'osm', 'opensky', 'adsb-lol', 'planet', 'sentinel', 'openmeteo', 'custom'] as const

describe('GEOINT Atom Families', () => {
  let registry: ReturnType<typeof Registry.make>

  beforeEach(() => {
    registry = Registry.make()
  })

  // =============================================================================
  // MEMOIZATION TESTS
  // =============================================================================

  describe('Atom Memoization', () => {
    it('should return the same atom instance for the same panelId', () => {
      const panelId = asPanelId('test-panel')

      const atoms1 = getPanelAtoms(panelId)
      const atoms2 = getPanelAtoms(panelId)

      // getPanelAtoms() returns a new object wrapper each time,
      // but the atoms inside ARE memoized by Atom.family
      expect(atoms1).not.toBe(atoms2) // Wrapper objects are different

      // Verify each atom IS memoized (same references)
      expect(atoms1.viewportAtom).toBe(atoms2.viewportAtom)
      expect(atoms1.resultsAtom).toBe(atoms2.resultsAtom)
      expect(atoms1.activeFiltersAtom).toBe(atoms2.activeFiltersAtom)
      expect(atoms1.selectedResultsAtom).toBe(atoms2.selectedResultsAtom)
      expect(atoms1.searchStatusAtom).toBe(atoms2.searchStatusAtom)
    })

    it('should return different atom instances for different panelIds', () => {
      const panelId1 = asPanelId('panel-1')
      const panelId2 = asPanelId('panel-2')

      const atoms1 = getPanelAtoms(panelId1)
      const atoms2 = getPanelAtoms(panelId2)

      // Different object references
      expect(atoms1).not.toBe(atoms2)

      // Each atom family creates separate instances
      expect(atoms1.viewportAtom).not.toBe(atoms2.viewportAtom)
      expect(atoms1.resultsAtom).not.toBe(atoms2.resultsAtom)
      expect(atoms1.activeFiltersAtom).not.toBe(atoms2.activeFiltersAtom)
    })
  })

  // =============================================================================
  // ISOLATION TESTS
  // =============================================================================

  describe('Panel State Isolation', () => {
    it('should maintain independent viewport state per panel', () => {
      const panel1 = asPanelId('panel-1')
      const panel2 = asPanelId('panel-2')

      const atoms1 = getPanelAtoms(panel1)
      const atoms2 = getPanelAtoms(panel2)

      // Set different viewport for panel 1
      const viewport1: ViewportState = {
        longitude: -122.4,
        latitude: 37.8,
        zoom: 12,
        pitch: 0,
        bearing: 0,
      }
      registry.set(atoms1.viewportAtom, viewport1)

      // Set different viewport for panel 2
      const viewport2: ViewportState = {
        longitude: 0,
        latitude: 51.5,
        zoom: 10,
        pitch: 45,
        bearing: 90,
      }
      registry.set(atoms2.viewportAtom, viewport2)

      // Verify isolation
      const retrieved1 = registry.get(atoms1.viewportAtom)
      const retrieved2 = registry.get(atoms2.viewportAtom)

      expect(retrieved1).toEqual(viewport1)
      expect(retrieved2).toEqual(viewport2)
      expect(retrieved1).not.toEqual(retrieved2)
    })

    it('should maintain independent search results per panel', () => {
      const panel1 = asPanelId('panel-1')
      const panel2 = asPanelId('panel-2')

      const atoms1 = getPanelAtoms(panel1)
      const atoms2 = getPanelAtoms(panel2)

      // Panel 1: imagery (satellite) results
      const results1: SearchResultItem[] = [
        new SearchResultImagery({
          id: asSearchResultId('sat-1'),
          source: 'planet',
          score: 0.95,
          retrievedAt: new Date('2026-01-20T00:00:00Z'),
          itemId: 'planet-item-123',
          provider: 'planet',
          collection: 'PSScene',
          position: [-122.4, 37.8] as const,
          acquired: new Date('2026-01-19T12:00:00Z'),
          cloudCover: 10,
          gsd: 3.0,
        }),
      ]
      registry.set(atoms1.resultsAtom, results1)

      // Panel 2: weather results
      const results2: SearchResultItem[] = [
        new SearchResultWeather({
          id: asSearchResultId('weather-1'),
          source: 'openmeteo',
          score: 0.85,
          retrievedAt: new Date('2026-01-20T00:00:00Z'),
          locationName: 'London, UK',
          position: [0, 51.5] as const,
          temperature: 15,
          forecastTime: new Date('2026-01-20T12:00:00Z'),
          windSpeed: 10,
          weatherDescription: 'Partly Cloudy',
        }),
      ]
      registry.set(atoms2.resultsAtom, results2)

      // Verify isolation
      const retrieved1 = registry.get(atoms1.resultsAtom)
      const retrieved2 = registry.get(atoms2.resultsAtom)

      expect(retrieved1).toHaveLength(1)
      expect(retrieved2).toHaveLength(1)
      expect(retrieved1[0].source).toBe('planet')
      expect(retrieved2[0].source).toBe('openmeteo')
    })

    it('should maintain independent filters per panel', () => {
      const panel1 = asPanelId('panel-1')
      const panel2 = asPanelId('panel-2')

      const atoms1 = getPanelAtoms(panel1)
      const atoms2 = getPanelAtoms(panel2)

      // Panel 1: filter by planet only
      const filters1: ActiveFilters = {
        sources: ['planet'],
        textQuery: '',
        geoFilter: 'viewport',
        radiusKm: 50,
        temporalFilter: 'live',
        customTimeRange: null,
      }
      registry.set(atoms1.activeFiltersAtom, filters1)

      // Panel 2: filter by multiple sources
      const filters2: ActiveFilters = {
        sources: ['openmeteo', 'osm'],
        textQuery: 'london',
        geoFilter: 'radius',
        radiusKm: 100,
        temporalFilter: 'custom',
        customTimeRange: null,
      }
      registry.set(atoms2.activeFiltersAtom, filters2)

      // Verify isolation
      const retrieved1 = registry.get(atoms1.activeFiltersAtom)
      const retrieved2 = registry.get(atoms2.activeFiltersAtom)

      expect(retrieved1.sources).toEqual(['planet'])
      expect(retrieved2.sources).toEqual(['openmeteo', 'osm'])
      expect(retrieved1.textQuery).toBe('')
      expect(retrieved2.textQuery).toBe('london')
    })

    it('should maintain independent selection state per panel', () => {
      const panel1 = asPanelId('panel-1')
      const panel2 = asPanelId('panel-2')

      const atoms1 = getPanelAtoms(panel1)
      const atoms2 = getPanelAtoms(panel2)

      // Create test results for selection
      const result1 = new SearchResultWeather({
        id: asSearchResultId('weather-1'),
        source: 'openmeteo',
        score: 0.9,
        retrievedAt: new Date(),
        locationName: 'Location 1',
        position: [0, 0] as const,
        temperature: 20,
        forecastTime: new Date(),
      })

      const result2 = new SearchResultWeather({
        id: asSearchResultId('weather-2'),
        source: 'openmeteo',
        score: 0.8,
        retrievedAt: new Date(),
        locationName: 'Location 2',
        position: [1, 1] as const,
        temperature: 18,
        forecastTime: new Date(),
      })

      const result3 = new SearchResultImagery({
        id: asSearchResultId('img-1'),
        source: 'sentinel',
        score: 0.95,
        retrievedAt: new Date(),
        itemId: 'sentinel-123',
        provider: 'sentinel',
        collection: 'S2',
        position: [2, 2] as const,
        acquired: new Date(),
      })

      // Panel 1: select results 1 and 2
      registry.set(atoms1.selectedResultsAtom, [result1, result2])

      // Panel 2: select result 3
      registry.set(atoms2.selectedResultsAtom, [result3])

      // Verify isolation
      const selected1 = registry.get(atoms1.selectedResultsAtom)
      const selected2 = registry.get(atoms2.selectedResultsAtom)

      expect(selected1).toHaveLength(2)
      expect(selected2).toHaveLength(1)
      expect(selected1[0].id).toBe(asSearchResultId('weather-1'))
      expect(selected1[1].id).toBe(asSearchResultId('weather-2'))
      expect(selected2[0].id).toBe(asSearchResultId('img-1'))
    })

    it('should maintain independent search status per panel', () => {
      const panel1 = asPanelId('panel-1')
      const panel2 = asPanelId('panel-2')

      const atoms1 = getPanelAtoms(panel1)
      const atoms2 = getPanelAtoms(panel2)

      // Panel 1: searching
      registry.set(atoms1.searchStatusAtom, 'searching')

      // Panel 2: completed
      registry.set(atoms2.searchStatusAtom, 'completed')

      // Verify isolation
      expect(registry.get(atoms1.searchStatusAtom)).toBe('searching')
      expect(registry.get(atoms2.searchStatusAtom)).toBe('completed')
    })
  })

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================

  describe('Multi-Panel Integration', () => {
    it('should support 3+ panels with independent state', () => {
      const panelIds: PanelId[] = [
        asPanelId('panel-1'),
        asPanelId('panel-2'),
        asPanelId('panel-3'),
      ]

      const allAtoms = panelIds.map(getPanelAtoms)

      // Set different viewport zoom for each panel
      allAtoms.forEach((atoms, index) => {
        const viewport: ViewportState = {
          longitude: 0,
          latitude: 0,
          zoom: 10 + index, // 10, 11, 12
          pitch: 0,
          bearing: 0,
        }
        registry.set(atoms.viewportAtom, viewport)
      })

      // Verify each panel has its own zoom level
      const zooms = allAtoms.map((atoms) => registry.get(atoms.viewportAtom).zoom)
      expect(zooms).toEqual([10, 11, 12])
    })

    it('should handle rapid panel creation and disposal', () => {
      // Create and access many panels
      const panelIds = Array.from({ length: 100 }, (_, i) => asPanelId(`panel-${i}`))

      // Access atoms for all panels
      const allAtoms = panelIds.map(getPanelAtoms)

      // Set state for half of them
      allAtoms.slice(0, 50).forEach((atoms) => {
        registry.set(atoms.searchStatusAtom, 'searching')
      })

      // Verify the first 50 are searching
      const firstHalf = allAtoms.slice(0, 50).map((atoms) =>
        registry.get(atoms.searchStatusAtom)
      )
      expect(firstHalf.every((status) => status === 'searching')).toBe(true)

      // Verify the second 50 are idle (default)
      const secondHalf = allAtoms.slice(50).map((atoms) =>
        registry.get(atoms.searchStatusAtom)
      )
      expect(secondHalf.every((status) => status === 'idle')).toBe(true)
    })

    it('should work with realistic multi-panel scenario', () => {
      // Scenario: 2-panel dashboard (overview + detail)
      const overviewPanel = asPanelId('overview')
      const detailPanel = asPanelId('detail')

      const overviewAtoms = getPanelAtoms(overviewPanel)
      const detailAtoms = getPanelAtoms(detailPanel)

      // Overview panel: wide view, all sources
      const overviewViewport: ViewportState = {
        longitude: -95.7,
        latitude: 37.1,
        zoom: 4, // Continental US
        pitch: 0,
        bearing: 0,
      }
      registry.set(overviewAtoms.viewportAtom, overviewViewport)
      registry.set(overviewAtoms.activeFiltersAtom, {
        sources: [...AVAILABLE_SOURCES],
        textQuery: '',
        geoFilter: 'viewport',
        radiusKm: 50,
        temporalFilter: 'live',
        customTimeRange: null,
      })

      // Detail panel: zoomed in, specific source
      const detailViewport: ViewportState = {
        longitude: -122.4,
        latitude: 37.8,
        zoom: 15, // City level
        pitch: 60,
        bearing: 45,
      }
      registry.set(detailAtoms.viewportAtom, detailViewport)
      registry.set(detailAtoms.activeFiltersAtom, {
        sources: ['planet'],
        textQuery: 'recent',
        geoFilter: 'viewport',
        radiusKm: 50,
        temporalFilter: 'live',
        customTimeRange: null,
      })

      // Verify overview panel state
      expect(registry.get(overviewAtoms.viewportAtom).zoom).toBe(4)
      expect(registry.get(overviewAtoms.activeFiltersAtom).sources).toHaveLength(
        AVAILABLE_SOURCES.length
      )

      // Verify detail panel state
      expect(registry.get(detailAtoms.viewportAtom).zoom).toBe(15)
      expect(registry.get(detailAtoms.activeFiltersAtom).sources).toEqual(['planet'])
      expect(registry.get(detailAtoms.activeFiltersAtom).textQuery).toBe('recent')
    })
  })

  // =============================================================================
  // BRANDED TYPE TESTS
  // =============================================================================

  describe('PanelId Branded Type', () => {
    it('should create branded PanelId from string', () => {
      const panelId = asPanelId('test-panel')

      // Type assertion (if this compiles, the brand is working)
      const _typeCheck: PanelId = panelId
      expect(panelId).toBe('test-panel')
    })

    it('should allow same string to create different branded instances', () => {
      const id1 = asPanelId('panel')
      const id2 = asPanelId('panel')

      // Same value
      expect(id1).toBe(id2)

      // Used to get the same memoized atoms
      const atoms1 = getPanelAtoms(id1)
      const atoms2 = getPanelAtoms(id2)

      // Wrapper objects are different, but atoms inside are memoized
      expect(atoms1).not.toBe(atoms2)
      expect(atoms1.viewportAtom).toBe(atoms2.viewportAtom)
      expect(atoms1.resultsAtom).toBe(atoms2.resultsAtom)
    })
  })

  // =============================================================================
  // DEFAULT VALUES TESTS
  // =============================================================================

  describe('Default Atom Values', () => {
    it('should have correct default viewport', () => {
      const atoms = getPanelAtoms(asPanelId('test'))
      const defaultViewport = registry.get(atoms.viewportAtom)

      expect(defaultViewport).toEqual({
        longitude: -122.42,
        latitude: 37.78,
        zoom: 12,
        pitch: 0,
        bearing: 0,
      })
    })

    it('should have empty results array by default', () => {
      const atoms = getPanelAtoms(asPanelId('test'))
      const defaultResults = registry.get(atoms.resultsAtom)

      expect(defaultResults).toEqual([])
    })

    it('should have all sources enabled by default', () => {
      const atoms = getPanelAtoms(asPanelId('test'))
      const defaultFilters = registry.get(atoms.activeFiltersAtom)

      expect(defaultFilters.sources).toEqual([])
      expect(defaultFilters.textQuery).toBe('')
    })

    it('should have no selected entities by default', () => {
      const atoms = getPanelAtoms(asPanelId('test'))
      const defaultSelection = registry.get(atoms.selectedResultsAtom)

      expect(defaultSelection).toEqual([])
    })

    it('should have idle search status by default', () => {
      const atoms = getPanelAtoms(asPanelId('test'))
      const defaultStatus = registry.get(atoms.searchStatusAtom)

      expect(defaultStatus).toBe('idle')
    })

    it('should have no search error by default', () => {
      const atoms = getPanelAtoms(asPanelId('test'))
      const defaultError = registry.get(atoms.searchErrorAtom)

      expect(defaultError).toBeNull()
    })
  })
})
