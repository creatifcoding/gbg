/**
 * Search Machine Tests
 *
 * Comprehensive XState v5 state machine tests for GEOINT search workflow.
 * Tests cover all states, transitions, guards, actions, and edge cases.
 *
 * @module geoint/machines/__tests__/searchMachine.test
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createActor, type Actor, type SnapshotFrom } from 'xstate'
import { searchMachine } from '../searchMachine'
import type { IntelSource, BBox } from '../../schemas'

// =============================================================================
// Test Helpers
// =============================================================================

/** Create an actor from the search machine */
function createSearchActor() {
  return createActor(searchMachine)
}

/** Start an actor and return it */
function startActor(actor: Actor<typeof searchMachine>) {
  actor.start()
  return actor
}

/** Get current state name */
function getStateName(snapshot: SnapshotFrom<typeof searchMachine>): string {
  return snapshot.value as string
}

/** Sample bounding box for San Francisco */
const SF_BOUNDS: BBox = [-122.5, 37.7, -122.3, 37.8]

/** Sample bounding box for New York */
const NY_BOUNDS: BBox = [-74.0, 40.7, -73.9, 40.8]

// =============================================================================
// Initial State Tests
// =============================================================================

describe('searchMachine', () => {
  describe('initial state', () => {
    it('starts in idle state', () => {
      const actor = startActor(createSearchActor())
      const snapshot = actor.getSnapshot()

      expect(getStateName(snapshot)).toBe('idle')
    })

    it('has empty query initially', () => {
      const actor = startActor(createSearchActor())
      const snapshot = actor.getSnapshot()

      expect(snapshot.context.query).toBe('')
    })

    it('has null bounds initially', () => {
      const actor = startActor(createSearchActor())
      const snapshot = actor.getSnapshot()

      expect(snapshot.context.bounds).toBeNull()
    })

    it('has default sources enabled', () => {
      const actor = startActor(createSearchActor())
      const snapshot = actor.getSnapshot()

      expect(snapshot.context.sources).toEqual(['track', 'osm', 'opensky', 'feature'])
    })

    it('has default filters', () => {
      const actor = startActor(createSearchActor())
      const snapshot = actor.getSnapshot()

      expect(snapshot.context.filters).toEqual({
        minConfidence: 0,
        maxAgeHours: null,
        classifications: [],
        entityTypes: [],
      })
    })

    it('has default options with autoSearch enabled', () => {
      const actor = startActor(createSearchActor())
      const snapshot = actor.getSnapshot()

      expect(snapshot.context.options.autoSearch).toBe(true)
      expect(snapshot.context.options.debounceMs).toBe(300)
      expect(snapshot.context.options.sourceTimeoutMs).toBe(30000)
      expect(snapshot.context.options.maxResultsPerSource).toBe(500)
    })

    it('has zero progress initially', () => {
      const actor = startActor(createSearchActor())
      const snapshot = actor.getSnapshot()

      expect(snapshot.context.progress).toEqual({
        totalSources: 0,
        completedSources: 0,
        totalResults: 0,
        percentage: 0,
      })
    })

    it('has no error initially', () => {
      const actor = startActor(createSearchActor())
      const snapshot = actor.getSnapshot()

      expect(snapshot.context.error).toBeNull()
    })

    it('has all sources in pending status', () => {
      const actor = startActor(createSearchActor())
      const snapshot = actor.getSnapshot()

      const allSources: IntelSource[] = [
        'track',
        'osm',
        'opensky',
        'planet',
        'sentinel',
        'openmeteo',
        'feature',
        'custom',
      ]

      for (const source of allSources) {
        expect(snapshot.context.sourceStatuses[source].status).toBe('pending')
        expect(snapshot.context.sourceStatuses[source].resultCount).toBe(0)
        expect(snapshot.context.sourceStatuses[source].error).toBeNull()
      }
    })
  })

  // ===========================================================================
  // Global Configuration Events
  // ===========================================================================

  describe('global configuration events', () => {
    it('SET_QUERY updates query text', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_QUERY', query: 'coffee shops' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.query).toBe('coffee shops')
      expect(getStateName(snapshot)).toBe('idle') // Stays in idle
    })

    it('SET_BOUNDS updates bounding box', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.bounds).toEqual(SF_BOUNDS)
    })

    it('SET_BOUNDS can clear bounds with null', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SET_BOUNDS', bounds: null })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.bounds).toBeNull()
    })

    it('TOGGLE_SOURCE adds a new source', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'TOGGLE_SOURCE', source: 'openmeteo' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sources).toContain('openmeteo')
    })

    it('TOGGLE_SOURCE removes an existing source', () => {
      const actor = startActor(createSearchActor())

      // osm is in default sources
      expect(actor.getSnapshot().context.sources).toContain('osm')

      actor.send({ type: 'TOGGLE_SOURCE', source: 'osm' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sources).not.toContain('osm')
    })

    it('SET_SOURCES replaces all sources', () => {
      const actor = startActor(createSearchActor())
      const newSources: IntelSource[] = ['planet', 'sentinel']

      actor.send({ type: 'SET_SOURCES', sources: newSources })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sources).toEqual(newSources)
    })

    it('SET_FILTERS merges with existing filters', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_FILTERS', filters: { minConfidence: 0.5 } })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.filters.minConfidence).toBe(0.5)
      expect(snapshot.context.filters.maxAgeHours).toBeNull() // Unchanged
    })

    it('SET_OPTIONS merges with existing options', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_OPTIONS', options: { autoSearch: false } })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.options.autoSearch).toBe(false)
      expect(snapshot.context.options.debounceMs).toBe(300) // Unchanged
    })
  })

  // ===========================================================================
  // Idle → Searching Transition
  // ===========================================================================

  describe('idle → searching transition', () => {
    it('transitions to searching on SEARCH with query', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_QUERY', query: 'test' })
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('searching')
    })

    it('transitions to searching on SEARCH with bounds', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('searching')
    })

    it('does NOT transition to searching without query or bounds', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('idle') // Guard prevents transition
    })

    it('does NOT transition to searching without active sources', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_QUERY', query: 'test' })
      actor.send({ type: 'SET_SOURCES', sources: [] })
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('idle') // Guard prevents transition
    })

    it('generates searchId when transitioning to searching', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.searchId).toMatch(/^search-\d+-[a-z0-9]+$/)
    })

    it('records lastSearchAt timestamp', () => {
      const actor = startActor(createSearchActor())
      const before = Date.now()

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      const after = Date.now()

      expect(snapshot.context.lastSearchAt).toBeGreaterThanOrEqual(before)
      expect(snapshot.context.lastSearchAt).toBeLessThanOrEqual(after)
    })
  })

  // ===========================================================================
  // Debouncing State
  // ===========================================================================

  describe('debouncing state', () => {
    it('transitions to debouncing on VIEWPORT_CHANGED when autoSearch enabled', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'VIEWPORT_CHANGED', bounds: SF_BOUNDS })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('debouncing')
    })

    it('does NOT transition to debouncing when autoSearch disabled', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_OPTIONS', options: { autoSearch: false } })
      actor.send({ type: 'VIEWPORT_CHANGED', bounds: SF_BOUNDS })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('idle')
    })

    it('updates bounds on VIEWPORT_CHANGED', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'VIEWPORT_CHANGED', bounds: SF_BOUNDS })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.bounds).toEqual(SF_BOUNDS)
    })

    it('marks viewport search as pending', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'VIEWPORT_CHANGED', bounds: SF_BOUNDS })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.pendingViewportSearch).toBe(true)
    })

    it('resets debounce timer on subsequent VIEWPORT_CHANGED', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'VIEWPORT_CHANGED', bounds: SF_BOUNDS })
      actor.send({ type: 'VIEWPORT_CHANGED', bounds: NY_BOUNDS })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('debouncing')
      expect(snapshot.context.bounds).toEqual(NY_BOUNDS)
    })

    it('allows manual SEARCH to skip debounce', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'VIEWPORT_CHANGED', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('searching')
      expect(snapshot.context.pendingViewportSearch).toBe(false)
    })

    it('allows CANCEL to return to idle', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'VIEWPORT_CHANGED', bounds: SF_BOUNDS })
      actor.send({ type: 'CANCEL' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('idle')
      expect(snapshot.context.pendingViewportSearch).toBe(false)
    })
  })

  // ===========================================================================
  // Source Progress Tracking
  // ===========================================================================

  describe('source progress tracking', () => {
    let actor: Actor<typeof searchMachine>

    beforeEach(() => {
      actor = startActor(createSearchActor())
      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
    })

    it('marks source as searching on SOURCE_STARTED', () => {
      actor.send({ type: 'SOURCE_STARTED', source: 'osm' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sourceStatuses.osm.status).toBe('searching')
      expect(snapshot.context.sourceStatuses.osm.startTime).not.toBeNull()
    })

    it('updates result count on SOURCE_PROGRESS', () => {
      actor.send({ type: 'SOURCE_STARTED', source: 'osm' })
      actor.send({ type: 'SOURCE_PROGRESS', source: 'osm', resultCount: 25 })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sourceStatuses.osm.resultCount).toBe(25)
    })

    it('updates progress percentage on SOURCE_PROGRESS', () => {
      // Start multiple sources
      actor.send({ type: 'SOURCE_STARTED', source: 'osm' })
      actor.send({ type: 'SOURCE_STARTED', source: 'opensky' })
      actor.send({ type: 'SOURCE_PROGRESS', source: 'osm', resultCount: 10 })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.progress.totalResults).toBe(10)
    })

    it('marks source as complete on SOURCE_COMPLETE', () => {
      actor.send({ type: 'SOURCE_STARTED', source: 'osm' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 50 })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sourceStatuses.osm.status).toBe('complete')
      expect(snapshot.context.sourceStatuses.osm.resultCount).toBe(50)
      expect(snapshot.context.sourceStatuses.osm.endTime).not.toBeNull()
    })

    it('marks source as error on SOURCE_ERROR', () => {
      actor.send({ type: 'SOURCE_STARTED', source: 'osm' })
      actor.send({ type: 'SOURCE_ERROR', source: 'osm', error: 'Network timeout' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sourceStatuses.osm.status).toBe('error')
      expect(snapshot.context.sourceStatuses.osm.error).toBe('Network timeout')
    })

    it('calculates correct progress with multiple sources', () => {
      // Start all 4 default sources
      actor.send({ type: 'SOURCE_STARTED', source: 'track' })
      actor.send({ type: 'SOURCE_STARTED', source: 'osm' })
      actor.send({ type: 'SOURCE_STARTED', source: 'opensky' })
      actor.send({ type: 'SOURCE_STARTED', source: 'feature' })

      // Complete 2 of 4
      actor.send({ type: 'SOURCE_COMPLETE', source: 'track', resultCount: 10 })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 20 })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.progress.totalSources).toBe(4)
      expect(snapshot.context.progress.completedSources).toBe(2)
      expect(snapshot.context.progress.percentage).toBe(50)
      expect(snapshot.context.progress.totalResults).toBe(30)
    })
  })

  // ===========================================================================
  // Searching → Results Transition
  // ===========================================================================

  describe('searching → results transition', () => {
    it('transitions to results on SEARCH_COMPLETE with results', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_STARTED', source: 'osm' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 10 })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 10 })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('results')
      expect(snapshot.context.resultCount).toBe(10)
    })

    it('transitions to idle on SEARCH_COMPLETE with no results', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 0 })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('idle')
    })

    it('sets progress to 100% on completion', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 5 })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 5 })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.progress.percentage).toBe(100)
    })
  })

  // ===========================================================================
  // Searching → Error Transition
  // ===========================================================================

  describe('searching → error transition', () => {
    it('transitions to error on SEARCH_ERROR', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SEARCH_ERROR', error: 'All sources failed' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('error')
      expect(snapshot.context.error).toBe('All sources failed')
    })
  })

  // ===========================================================================
  // Error Recovery
  // ===========================================================================

  describe('error recovery', () => {
    let actor: Actor<typeof searchMachine>

    beforeEach(() => {
      actor = startActor(createSearchActor())
      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SEARCH_ERROR', error: 'Network error' })
    })

    it('RETRY transitions back to searching', () => {
      actor.send({ type: 'RETRY' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('searching')
    })

    it('RETRY requires canSearch guard to pass', () => {
      // Remove all sources to make canSearch fail
      actor.send({ type: 'SET_SOURCES', sources: [] })
      actor.send({ type: 'SET_BOUNDS', bounds: null })
      actor.send({ type: 'RETRY' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('error') // Guard prevents retry
    })

    it('SEARCH from error state starts new search', () => {
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('searching')
    })

    it('CLEAR from error state returns to idle', () => {
      actor.send({ type: 'CLEAR' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('idle')
      expect(snapshot.context.error).toBeNull()
    })
  })

  // ===========================================================================
  // Cancel Functionality
  // ===========================================================================

  describe('cancel functionality', () => {
    it('CANCEL during searching returns to idle', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_STARTED', source: 'osm' })
      actor.send({ type: 'CANCEL' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('idle')
    })

    it('CANCEL marks searching sources as cancelled', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_STARTED', source: 'osm' })
      actor.send({ type: 'SOURCE_STARTED', source: 'opensky' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 5 })
      actor.send({ type: 'CANCEL' })

      const snapshot = actor.getSnapshot()
      // osm was complete, should stay complete
      expect(snapshot.context.sourceStatuses.osm.status).toBe('complete')
      // opensky was searching, should be cancelled
      expect(snapshot.context.sourceStatuses.opensky.status).toBe('cancelled')
    })

    it('CANCEL clears searchId', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      expect(actor.getSnapshot().context.searchId).not.toBeNull()

      actor.send({ type: 'CANCEL' })
      expect(actor.getSnapshot().context.searchId).toBeNull()
    })
  })

  // ===========================================================================
  // Clear Functionality
  // ===========================================================================

  describe('clear functionality', () => {
    it('CLEAR from results returns to idle', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 10 })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 10 })
      actor.send({ type: 'CLEAR' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('idle')
    })

    it('CLEAR resets query and bounds', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_QUERY', query: 'test' })
      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 0 })
      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS }) // Re-set to get into results
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 5 })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 5 })
      actor.send({ type: 'CLEAR' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.query).toBe('')
      expect(snapshot.context.bounds).toBeNull()
    })

    it('CLEAR resets all source statuses', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 10 })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 10 })
      actor.send({ type: 'CLEAR' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sourceStatuses.osm.status).toBe('pending')
      expect(snapshot.context.sourceStatuses.osm.resultCount).toBe(0)
    })

    it('CLEAR resets progress', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 10 })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 10 })
      actor.send({ type: 'CLEAR' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.progress).toEqual({
        totalSources: 0,
        completedSources: 0,
        totalResults: 0,
        percentage: 0,
      })
    })
  })

  // ===========================================================================
  // Results State Behavior
  // ===========================================================================

  describe('results state behavior', () => {
    let actor: Actor<typeof searchMachine>

    beforeEach(() => {
      actor = startActor(createSearchActor())
      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 10 })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 10 })
    })

    it('allows new SEARCH from results', () => {
      actor.send({ type: 'SET_QUERY', query: 'new search' })
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('searching')
    })

    it('VIEWPORT_CHANGED in results starts debouncing', () => {
      actor.send({ type: 'VIEWPORT_CHANGED', bounds: NY_BOUNDS })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('debouncing')
      expect(snapshot.context.bounds).toEqual(NY_BOUNDS)
    })

    it('VIEWPORT_CHANGED does not start debouncing if autoSearch disabled', () => {
      actor.send({ type: 'SET_OPTIONS', options: { autoSearch: false } })
      actor.send({ type: 'VIEWPORT_CHANGED', bounds: NY_BOUNDS })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('results')
    })
  })

  // ===========================================================================
  // Searching State Re-entry
  // ===========================================================================

  describe('searching state re-entry', () => {
    it('allows SEARCH during searching to restart', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      const firstSearchId = actor.getSnapshot().context.searchId

      actor.send({ type: 'SET_QUERY', query: 'new query' })
      actor.send({ type: 'SEARCH' })
      const secondSearchId = actor.getSnapshot().context.searchId

      expect(getStateName(actor.getSnapshot())).toBe('searching')
      expect(secondSearchId).not.toBe(firstSearchId)
    })

    it('queues VIEWPORT_CHANGED during searching', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'VIEWPORT_CHANGED', bounds: NY_BOUNDS })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('searching')
      expect(snapshot.context.bounds).toEqual(NY_BOUNDS)
      expect(snapshot.context.pendingViewportSearch).toBe(true)
    })
  })

  // ===========================================================================
  // Configuration in Different States
  // ===========================================================================

  describe('configuration in different states', () => {
    it('allows SET_FILTERS during searching', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SET_FILTERS', filters: { minConfidence: 0.8 } })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.filters.minConfidence).toBe(0.8)
    })

    it('allows TOGGLE_SOURCE during results', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 5 })
      actor.send({ type: 'SEARCH_COMPLETE', totalResults: 5 })
      actor.send({ type: 'TOGGLE_SOURCE', source: 'openmeteo' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sources).toContain('openmeteo')
    })

    it('allows SET_OPTIONS during error', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SEARCH_ERROR', error: 'Failed' })
      actor.send({ type: 'SET_OPTIONS', options: { sourceTimeoutMs: 60000 } })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.options.sourceTimeoutMs).toBe(60000)
    })
  })

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty query string as no query', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_QUERY', query: '   ' }) // Whitespace only
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('idle') // Guard fails
    })

    it('handles rapid SEARCH events gracefully', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SEARCH' })

      const snapshot = actor.getSnapshot()
      expect(getStateName(snapshot)).toBe('searching')
    })

    it('handles SOURCE_ERROR for all sources', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SET_SOURCES', sources: ['osm', 'opensky'] })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_ERROR', source: 'osm', error: 'Timeout' })
      actor.send({ type: 'SOURCE_ERROR', source: 'opensky', error: 'Rate limited' })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sourceStatuses.osm.status).toBe('error')
      expect(snapshot.context.sourceStatuses.opensky.status).toBe('error')
    })

    it('handles mixed source results (some complete, some error)', () => {
      const actor = startActor(createSearchActor())

      actor.send({ type: 'SET_BOUNDS', bounds: SF_BOUNDS })
      actor.send({ type: 'SET_SOURCES', sources: ['osm', 'opensky', 'track'] })
      actor.send({ type: 'SEARCH' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'osm', resultCount: 10 })
      actor.send({ type: 'SOURCE_ERROR', source: 'opensky', error: 'Failed' })
      actor.send({ type: 'SOURCE_COMPLETE', source: 'track', resultCount: 5 })

      const snapshot = actor.getSnapshot()
      expect(snapshot.context.sourceStatuses.osm.status).toBe('complete')
      expect(snapshot.context.sourceStatuses.opensky.status).toBe('error')
      expect(snapshot.context.sourceStatuses.track.status).toBe('complete')
      expect(snapshot.context.progress.totalResults).toBe(15)
    })
  })
})
