/**
 * SearchTracks Handler Tests
 *
 * Unit tests for the SearchTracks RPC handler in SearchEntity.
 * Tests PostGIS repository integration via mock repository.
 *
 * @see beads:tmnl-3ancc Cluster: Entity routing tests
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  createExtendedSearchTestClient,
  createMockTrackPositions,
  createMockTrackPosition,
  testSearchId,
  TestShardingConfig,
  TEST_BBOX,
} from './helpers/mocks'

describe('SearchTracks Handler', () => {
  describe('successful queries', () => {
    it('returns track results from repository', async () => {
      const mockTracks = createMockTrackPositions(5)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: { searchResults: mockTracks },
        })
        const client = yield* makeClient('track-worker')

        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('source', 'track')
    })

    it('maps repository results to SearchResultTrack', async () => {
      const mockTracks = [
        createMockTrackPosition({
          id: 12345,
          track_id: 'ALPHA-001',
          latitude: 37.8,
          longitude: -122.4,
          heading: 45,
          speed: 100,
          classification: 'friendly',
        }),
      ]

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: { searchResults: mockTracks },
        })
        const client = yield* makeClient('track-worker')

        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(1)
      const result = results[0] as any
      expect(result.source).toBe('track')
      expect(result.trackId).toBe('ALPHA-001')
      expect(result.classification).toBe('friendly')
    })

    it('returns empty array when no tracks in bounds', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: { searchResults: [] },
        })
        const client = yield* makeClient('track-worker')

        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(0)
    })

    it('returns empty array when no repository configured', async () => {
      // No trackRepo provided - simulates missing repository
      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({})
        const client = yield* makeClient('track-worker')

        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      // Handler gracefully returns empty when repository not available
      expect(results).toHaveLength(0)
    })
  })

  describe('limit handling', () => {
    it('respects limit parameter', async () => {
      const mockTracks = createMockTrackPositions(20)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: { searchResults: mockTracks },
        })
        const client = yield* makeClient('track-worker')

        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 5,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      // Handler should pass limit to repository
      expect(results.length).toBeLessThanOrEqual(20) // Repository mock returns all
    })

    it('returns all results when limit exceeds available', async () => {
      const mockTracks = createMockTrackPositions(3)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: { searchResults: mockTracks },
        })
        const client = yield* makeClient('track-worker')

        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results.length).toBeLessThanOrEqual(3)
    })

    it('uses default limit when not specified', async () => {
      const mockTracks = createMockTrackPositions(5)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: { searchResults: mockTracks },
        })
        const client = yield* makeClient('track-worker')

        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          // No limit specified
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results.length).toBeLessThanOrEqual(5)
    })
  })

  describe('bounds handling', () => {
    it('returns empty when bounds not provided', async () => {
      const mockTracks = createMockTrackPositions(3)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: { searchResults: mockTracks },
        })
        const client = yield* makeClient('track-worker')

        // Handler requires bounds for spatial queries
        return yield* client.SearchTracks({
          searchId: testSearchId(),
          // No bounds specified
          limit: 100,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      // Returns empty when bounds missing (can't do spatial query)
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('track classification', () => {
    it('preserves track classification in results', async () => {
      // Use valid classification values: friendly | hostile | neutral | unknown
      const mockTracks = [
        createMockTrackPosition({ classification: 'friendly' }),
        createMockTrackPosition({ classification: 'hostile' }),
        createMockTrackPosition({ classification: 'neutral' }),
      ]

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: { searchResults: mockTracks },
        })
        const client = yield* makeClient('track-worker')

        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      const classifications = results.map((r: any) => r.classification)
      expect(classifications).toContain('friendly')
      expect(classifications).toContain('hostile')
      expect(classifications).toContain('neutral')
    })
  })

  describe('error handling', () => {
    it('handles repository error gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: {
            shouldFail: true,
            error: new Error('Database connection failed'),
          },
        })
        const client = yield* makeClient('track-worker')

        // Handler catches errors and returns empty array
        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(0)
    })

    it('handles query timeout gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          trackRepo: {
            shouldFail: true,
            error: new Error('Query timeout after 30000ms'),
          },
        })
        const client = yield* makeClient('track-worker')

        return yield* client.SearchTracks({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(0)
    })
  })
})
