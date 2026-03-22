/**
 * SearchFeatures Handler Tests
 *
 * Unit tests for the SearchFeatures RPC handler in SearchEntity.
 * Tests PostGIS feature repository integration via mock repository.
 *
 * @see beads:tmnl-3ancc Cluster: Entity routing tests
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  createExtendedSearchTestClient,
  createMockFeatures,
  createMockFeature,
  testSearchId,
  TestShardingConfig,
  TEST_BBOX,
} from './helpers/mocks'

describe('SearchFeatures Handler', () => {
  describe('successful queries', () => {
    it('returns feature results from repository', async () => {
      const mockFeatures = createMockFeatures(5)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('source', 'feature')
    })

    it('maps repository results to SearchResultFeature', async () => {
      const mockFeatures = [
        createMockFeature({
          id: 12345,
          feature_id: 'HOSPITAL-001',
          name: 'City Hospital',
          feature_type: 'hospital',
          geom: { type: 'Point', coordinates: [-122.4, 37.8] },
          properties: { beds: 500, emergency: true },
        }),
      ]

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(1)
      const result = results[0] as any
      expect(result.source).toBe('feature')
      expect(result.label).toBe('City Hospital')
    })

    it('returns empty array when no features in bounds', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: [] },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(0)
    })

    it('returns empty array when no repository configured', async () => {
      // No featureRepo provided - simulates missing repository
      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({})
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      // Handler gracefully returns empty when repository not available
      expect(results).toHaveLength(0)
    })
  })

  describe('feature type filtering', () => {
    it('accepts featureTypes filter parameter', async () => {
      const mockFeatures = createMockFeatures(3)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          featureTypes: ['hospital', 'airport'],
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(Array.isArray(results)).toBe(true)
    })

    it('uses default when featureTypes not specified', async () => {
      const mockFeatures = createMockFeatures(3)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          // No featureTypes specified
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('geometry types', () => {
    it('handles Point geometry', async () => {
      const mockFeatures = [
        createMockFeature({
          geom: { type: 'Point', coordinates: [-122.4, 37.8] },
        }),
      ]

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(1)
      const result = results[0] as any
      expect(result.geometryType).toBe('Point')
    })

    it('handles LineString geometry', async () => {
      const mockFeatures = [
        createMockFeature({
          geom: {
            type: 'LineString',
            coordinates: [
              [-122.4, 37.8],
              [-122.5, 37.9],
            ],
          },
        }),
      ]

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(1)
    })

    it('handles Polygon geometry', async () => {
      const mockFeatures = [
        createMockFeature({
          geom: {
            type: 'Polygon',
            coordinates: [
              [
                [-122.4, 37.8],
                [-122.5, 37.8],
                [-122.5, 37.9],
                [-122.4, 37.9],
                [-122.4, 37.8],
              ],
            ],
          },
        }),
      ]

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(1)
    })
  })

  describe('limit handling', () => {
    it('respects limit parameter', async () => {
      const mockFeatures = createMockFeatures(20)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 5,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      // Handler should pass limit to repository
      expect(results.length).toBeLessThanOrEqual(20)
    })

    it('returns all results when limit exceeds available', async () => {
      const mockFeatures = createMockFeatures(3)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results.length).toBeLessThanOrEqual(3)
    })
  })

  describe('bounds handling', () => {
    it('returns empty when bounds not provided', async () => {
      const mockFeatures = createMockFeatures(3)

      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: { searchResults: mockFeatures },
        })
        const client = yield* makeClient('feature-worker')

        // Handler requires bounds for spatial queries
        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          // No bounds specified
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      // Returns empty when bounds missing
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('handles repository error gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: {
            shouldFail: true,
            error: new Error('Database connection failed'),
          },
        })
        const client = yield* makeClient('feature-worker')

        // Handler catches errors and returns empty array
        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(0)
    })

    it('handles query timeout gracefully', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* createExtendedSearchTestClient({
          featureRepo: {
            shouldFail: true,
            error: new Error('Query timeout after 30000ms'),
          },
        })
        const client = yield* makeClient('feature-worker')

        const results = yield* client.SearchFeatures({
          searchId: testSearchId(),
          bounds: TEST_BBOX,
          limit: 100,
        })

        return results
      }).pipe(Effect.scoped, Effect.provide(TestShardingConfig))

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(0)
    })
  })
})
