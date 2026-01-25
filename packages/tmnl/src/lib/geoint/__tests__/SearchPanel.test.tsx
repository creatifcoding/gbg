/**
 * SearchPanel Tests (TDD)
 *
 * Tests for the SearchPanel component using SearchProvider context.
 * Written test-first to drive implementation.
 *
 * NOTE: Run with `bunx vitest run` not `bun test` (requires happy-dom)
 *
 * @module geoint/__tests__/SearchPanel.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import { Registry } from '@effect-atom/atom'
import { RegistryContext } from '@effect-atom/atom-react'
import { SearchPanel } from '../components/SearchPanel'
import { SearchProvider, mountSearchRuntime } from '../components/SearchProvider'
import {
  geointRegistry,
  searchStatusAtom,
  resultsAtom,
  activeFiltersAtom,
  searchErrorAtom,
  viewportAtom,
  clearResults,
} from '../atoms'
import {
  SearchResultPoi,
  SearchResultFlight,
  type SearchResultId,
  type PoiId,
  type Icao24,
} from '../schemas'

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestPoi = (id: string = 'poi-1'): SearchResultPoi =>
  new SearchResultPoi({
    id: `osm-${id}` as SearchResultId,
    source: 'osm',
    score: 0.9,
    retrievedAt: new Date(),
    poiId: `osm-node-${id}` as PoiId,
    position: [-122.4, 37.8],
    name: `Test POI ${id}`,
    category: 'amenity',
    tags: { cuisine: 'italian' },
  })

const createTestFlight = (id: string = 'abc123'): SearchResultFlight => {
  // ICAO24 must be 6 hex characters - generate from id hash
  const hexId = id.split('').reduce((acc, c) => acc + c.charCodeAt(0).toString(16), '').padStart(6, '0').slice(0, 6)
  return new SearchResultFlight({
    id: `opensky-${id}` as SearchResultId,
    source: 'opensky',
    score: 0.85,
    retrievedAt: new Date(),
    icao24: hexId as Icao24,
    callsign: 'UAL123',
    position: [-122.3, 37.7, 10000],
    velocity: 250,
    heading: 180,
    verticalRate: 5,
    onGround: false,
    category: 'medium',
    originCountry: 'United States',
    lastContact: new Date(),
  })
}

// =============================================================================
// Test Wrapper
// =============================================================================

/**
 * Create test wrapper with RegistryContext.Provider and SearchProvider.
 * Uses RegistryContext.Provider directly to inject specific registry.
 */
function createTestWrapper(registry: Registry.Registry = geointRegistry) {
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      RegistryContext.Provider,
      { value: registry },
      React.createElement(SearchProvider, { registry }, children)
    )
  }
}

/**
 * Helper to render with wrapper.
 */
function renderWithProvider(
  ui: React.ReactElement,
  registry: Registry.Registry = geointRegistry
) {
  return render(ui, { wrapper: createTestWrapper(registry) })
}

// =============================================================================
// Tests
// =============================================================================

describe('SearchPanel', () => {
  beforeEach(() => {
    // Reset global registry state
    clearResults()
    geointRegistry.set(searchStatusAtom, 'idle')
    geointRegistry.set(searchErrorAtom, null)
    geointRegistry.set(activeFiltersAtom, {
      sources: [],
      textQuery: '',
      geoFilter: 'viewport',
      radiusKm: 50,
      temporalFilter: 'live',
      customTimeRange: null,
    })
    // Set default viewport
    geointRegistry.set(viewportAtom, {
      longitude: -122.42,
      latitude: 37.78,
      zoom: 12,
      pitch: 0,
      bearing: 0,
    })
    // Mount search runtime
    mountSearchRuntime(geointRegistry)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders search input', () => {
      renderWithProvider(<SearchPanel />)
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    })

    it('renders search button', () => {
      renderWithProvider(<SearchPanel />)
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    })

    it('shows status bar with idle state initially', () => {
      renderWithProvider(<SearchPanel />)
      expect(screen.getByText(/ready to search/i)).toBeInTheDocument()
    })
  })

  describe('Status Updates', () => {
    it('shows searching status while search is in progress', () => {
      geointRegistry.set(searchStatusAtom, 'searching')
      renderWithProvider(<SearchPanel />)
      expect(screen.getByText(/searching/i)).toBeInTheDocument()
    })

    it('shows completed status with result count', () => {
      geointRegistry.set(searchStatusAtom, 'completed')
      geointRegistry.set(resultsAtom, [
        createTestPoi('1'),
        createTestPoi('2'),
        createTestPoi('3'),
      ])
      renderWithProvider(<SearchPanel />)
      expect(screen.getByText(/3 results found/i)).toBeInTheDocument()
    })

    it('shows error status with message', () => {
      geointRegistry.set(searchStatusAtom, 'error')
      geointRegistry.set(searchErrorAtom, 'Network timeout')
      renderWithProvider(<SearchPanel />)
      expect(screen.getByText(/error/i)).toBeInTheDocument()
      expect(screen.getByText(/network timeout/i)).toBeInTheDocument()
    })
  })

  describe('Results Display', () => {
    it('shows empty state when no results', () => {
      geointRegistry.set(searchStatusAtom, 'completed')
      geointRegistry.set(resultsAtom, [])
      renderWithProvider(<SearchPanel />)
      expect(screen.getByText(/no results found/i)).toBeInTheDocument()
    })

    it('renders result items', async () => {
      geointRegistry.set(searchStatusAtom, 'completed')
      geointRegistry.set(resultsAtom, [
        createTestPoi('poi-1'),
        createTestFlight('flight-1'),
      ])
      renderWithProvider(<SearchPanel />)

      // Should show POI and Flight results
      await waitFor(() => {
        expect(screen.getByText(/Test POI poi-1/i)).toBeInTheDocument()
        expect(screen.getByText(/UAL123/i)).toBeInTheDocument()
      })
    })

    it('limits displayed results with pagination indicator', async () => {
      // Create 60 results (more than 50 limit)
      const manyResults = Array.from({ length: 60 }, (_, i) =>
        createTestPoi(`poi-${i}`)
      )
      geointRegistry.set(searchStatusAtom, 'completed')
      geointRegistry.set(resultsAtom, manyResults)
      renderWithProvider(<SearchPanel />)

      // Should show pagination indicator
      await waitFor(() => {
        expect(screen.getByText(/showing 50 of 60/i)).toBeInTheDocument()
      })
    })

    it('calls onResultSelect when result is clicked', async () => {
      const onResultSelect = vi.fn()
      geointRegistry.set(searchStatusAtom, 'completed')
      geointRegistry.set(resultsAtom, [createTestPoi('clickable')])

      renderWithProvider(<SearchPanel onResultSelect={onResultSelect} />)

      // VirtualizedSearchResults uses div[role="option"] elements
      const resultItem = await screen.findByText(/Test POI clickable/i)
      const clickableElement = resultItem.closest('[role="option"]')
      expect(clickableElement).not.toBeNull()
      fireEvent.click(clickableElement!)

      expect(onResultSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          _tag: 'SearchResultPoi',
        })
      )
    })
  })

  describe('Text Search', () => {
    it('allows typing in search input', async () => {
      renderWithProvider(<SearchPanel />)
      const input = screen.getByPlaceholderText(/search/i)

      await act(async () => {
        fireEvent.change(input, { target: { value: 'test query' } })
      })

      expect(input).toHaveValue('test query')
    })

    it('triggers search on Enter key', async () => {
      renderWithProvider(<SearchPanel />)
      const input = screen.getByPlaceholderText(/search/i)

      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
      })

      // Should trigger search - status changes from idle
      await waitFor(() => {
        const status = geointRegistry.get(searchStatusAtom)
        expect(['searching', 'completed', 'error']).toContain(status)
      }, { timeout: 5000 })
    })
  })

  describe('Auto Search', () => {
    it('shows auto-search indicator when enabled', () => {
      renderWithProvider(<SearchPanel autoSearch={true} />)
      expect(screen.getByText(/auto-search enabled/i)).toBeInTheDocument()
    })
  })

  describe('Fallback Behavior', () => {
    it('uses onSearch prop when SearchProvider context is not available', async () => {
      const onSearch = vi.fn()

      // Render WITHOUT SearchProvider, just with RegistryContext.Provider
      render(
        React.createElement(
          RegistryContext.Provider,
          { value: geointRegistry },
          React.createElement(SearchPanel, { onSearch })
        )
      )

      const searchButton = screen.getByRole('button', { name: /search/i })
      fireEvent.click(searchButton)

      // Should fall back to onSearch prop
      await waitFor(() => {
        expect(onSearch).toHaveBeenCalled()
      })
    })
  })
})
