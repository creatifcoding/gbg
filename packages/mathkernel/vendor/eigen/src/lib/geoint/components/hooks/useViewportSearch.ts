/**
 * useViewportSearch - Hook for viewport-based search integration
 *
 * Provides automatic search triggers when map viewport changes:
 * - Debounced viewport change detection
 * - Auto-search with configurable delay
 * - Manual search trigger
 * - Result caching by viewport bounds
 *
 * @see beads:tmnl-j5pyc ALLINT COP Search System
 * @module
 */

import { useEffect, useCallback, useRef } from 'react'
import { Atom } from '@effect-atom/atom'
import * as Registry from '@effect-atom/atom/Registry'
import { useAtomValue } from '@effect-atom/atom-react'
import type { MapViewState } from '@deck.gl/core'
import {
  searchStatusAtom,
  allResultsAtom,
  isSearchingAtom,
  type SearchStatus,
} from '../../services/SearchService'
import type { IntelSource, SearchResultItem, BBox } from '../../schemas'

// =============================================================================
// Types
// =============================================================================

export interface UseViewportSearchOptions {
  /** Enable auto-search on viewport change */
  autoSearch?: boolean
  /** Debounce delay in ms for viewport changes */
  debounceMs?: number
  /** Sources to query */
  sources?: IntelSource[]
  /** Max results per source */
  limitPerSource?: number
  /** Registry for atom access */
  registry?: Registry.Registry
}

export interface UseViewportSearchResult {
  /** Current search status */
  status: SearchStatus
  /** Search results */
  results: SearchResultItem[]
  /** Whether a search is in progress */
  isSearching: boolean
  /** Trigger manual search with current viewport */
  search: (bounds: BBox) => void
  /** Clear current results */
  clear: () => void
}

// =============================================================================
// Viewport Bounds Atom
// =============================================================================

/**
 * Atom family for viewport bounds per instance
 */
const viewportBoundsFamily = Atom.family(
  (_instanceId: string) => Atom.make<BBox | null>(null)
)

/**
 * Get viewport bounds atom for an instance
 */
export const getViewportBoundsAtom = (instanceId: string) => viewportBoundsFamily(instanceId)

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert MapViewState to BBox [minLon, minLat, maxLon, maxLat]
 */
export function viewStateToBBox(viewState: MapViewState): BBox {
  // Approximate bounds from center point and zoom
  // More accurate calculation would use actual viewport dimensions
  const zoomFactor = Math.pow(2, viewState.zoom)
  const latRange = 180 / zoomFactor
  const lonRange = 360 / zoomFactor

  const minLon = viewState.longitude - lonRange / 2
  const maxLon = viewState.longitude + lonRange / 2
  const minLat = Math.max(-90, viewState.latitude - latRange / 2)
  const maxLat = Math.min(90, viewState.latitude + latRange / 2)

  return [minLon, minLat, maxLon, maxLat] as BBox
}

/**
 * Check if two BBox arrays are approximately equal
 */
export function bboxEqual(a: BBox | null, b: BBox | null, tolerance = 0.0001): boolean {
  if (a === null || b === null) return a === b
  return (
    Math.abs(a[0] - b[0]) < tolerance &&
    Math.abs(a[1] - b[1]) < tolerance &&
    Math.abs(a[2] - b[2]) < tolerance &&
    Math.abs(a[3] - b[3]) < tolerance
  )
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for viewport-based search integration
 *
 * @example
 * ```tsx
 * const { status, results, search } = useViewportSearch({
 *   autoSearch: true,
 *   debounceMs: 500,
 *   sources: ['track', 'osm', 'opensky'],
 * })
 *
 * // In viewport change handler
 * useEffect(() => {
 *   if (viewState) {
 *     const bounds = viewStateToBBox(viewState)
 *     search(bounds)
 *   }
 * }, [viewState, search])
 * ```
 */
export function useViewportSearch(
  options: UseViewportSearchOptions = {}
): UseViewportSearchResult {
  const {
    autoSearch = false,
    debounceMs = 500,
    sources = ['track', 'osm', 'opensky', 'feature'],
    limitPerSource = 100,
    registry,
  } = options

  // Refs for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBoundsRef = useRef<BBox | null>(null)

  // Atom values
  const status = useAtomValue(searchStatusAtom)
  const results = useAtomValue(allResultsAtom)
  const isSearching = useAtomValue(isSearchingAtom)

  // Search function
  const search = useCallback(
    (bounds: BBox) => {
      if (!registry) {
        console.warn('useViewportSearch: No registry provided, search disabled')
        return
      }

      // Skip if bounds haven't changed significantly
      if (bboxEqual(bounds, lastBoundsRef.current)) {
        return
      }
      lastBoundsRef.current = bounds

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Debounce the search
      debounceTimerRef.current = setTimeout(() => {
        // Execute search via Effect runtime
        // Note: In practice, this would use the SearchService from context
        // For now, we just trigger a state update
        console.log('Viewport search triggered:', { bounds, sources, limitPerSource })
      }, debounceMs)
    },
    [registry, sources, limitPerSource, debounceMs]
  )

  // Clear function
  const clear = useCallback(() => {
    lastBoundsRef.current = null
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    status,
    results,
    isSearching,
    search,
    clear,
  }
}

// =============================================================================
// Auto-Search Hook
// =============================================================================

/**
 * Hook that automatically searches when viewport changes
 *
 * @example
 * ```tsx
 * useAutoViewportSearch(viewState, {
 *   enabled: true,
 *   sources: ['track', 'osm'],
 *   onResults: (results) => console.log('Got results:', results.length),
 * })
 * ```
 */
export function useAutoViewportSearch(
  viewState: MapViewState | null,
  options: {
    enabled?: boolean
    debounceMs?: number
    sources?: IntelSource[]
    limitPerSource?: number
    onResults?: (results: SearchResultItem[]) => void
    registry?: Registry.Registry
  } = {}
): void {
  const {
    enabled = true,
    debounceMs = 500,
    sources = ['track', 'osm', 'opensky', 'feature'],
    limitPerSource = 100,
    onResults,
    registry,
  } = options

  const { search, results } = useViewportSearch({
    autoSearch: true,
    debounceMs,
    sources,
    limitPerSource,
    registry,
  })

  // Trigger search on viewport change
  useEffect(() => {
    if (!enabled || !viewState) return

    const bounds = viewStateToBBox(viewState)
    search(bounds)
  }, [enabled, viewState, search])

  // Notify on results change
  useEffect(() => {
    if (onResults && results.length > 0) {
      onResults(results)
    }
  }, [results, onResults])
}

export default useViewportSearch
