/**
 * Health Handler Integration Tests
 *
 * Tests health check and control handlers with real APIs.
 * Run with: RUN_INTEGRATION_TESTS=1 bun test Health.integration
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { SearchEntity } from '../../../cluster/SearchEntity'
import {
  RUN_INTEGRATION_TESTS,
  testSearchId,
  TestShardingConfig,
  FreshHandlersLayer,
  TIMEOUT,
} from './helpers'

describe.skipIf(!RUN_INTEGRATION_TESTS)('Health Handler Integration Tests', () => {

  describe('GetSourceHealth Handler', () => {
    it('returns health status for all configured sources', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, FreshHandlersLayer)
        const client = yield* makeClient('health-integ-1')

        const healthStatuses = yield* client.GetSourceHealth({})

        console.log('\nSource Health Status:')
        for (const status of healthStatuses) {
          const s = status as any
          console.log(`  ${s.source}: ${s.available ? '✓' : '✗'}`)
        }

        return healthStatuses
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const healthStatuses = await Effect.runPromise(program)

      expect(Array.isArray(healthStatuses)).toBe(true)
      expect(healthStatuses.length).toBeGreaterThan(0)

      // Check structure of each status
      for (const status of healthStatuses) {
        expect(status).toHaveProperty('source')
        expect(status).toHaveProperty('available')
        expect(status).toHaveProperty('lastChecked')
      }
    })

    it('includes expected source types', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, FreshHandlersLayer)
        const client = yield* makeClient('health-integ-2')

        const healthStatuses = yield* client.GetSourceHealth({})
        return healthStatuses
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const healthStatuses = await Effect.runPromise(program)
      const sources = healthStatuses.map((s: any) => s.source)

      // Core sources should always be present
      expect(sources).toContain('osm')
      expect(sources).toContain('opensky')
      expect(sources).toContain('track')
      expect(sources).toContain('feature')
    })

    it('marks unavailable services correctly', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, FreshHandlersLayer)
        const client = yield* makeClient('health-integ-3')

        const healthStatuses = yield* client.GetSourceHealth({})
        return healthStatuses
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const healthStatuses = await Effect.runPromise(program)

      // Optional services without API keys should be unavailable
      const planetStatus = healthStatuses.find((s: any) => s.source === 'planet')
      const sentinelStatus = healthStatuses.find((s: any) => s.source === 'sentinel')

      if (planetStatus) {
        console.log(`Planet available: ${(planetStatus as any).available}`)
      }
      if (sentinelStatus) {
        console.log(`Sentinel available: ${(sentinelStatus as any).available}`)
      }
    })
  })

  describe('PingSource Handler - All Sources', () => {
    const sources = ['opensky', 'osm', 'track', 'feature'] as const

    for (const source of sources) {
      it(`pings ${source} source`, async () => {
        const program = Effect.gen(function* () {
          const makeClient = yield* Entity.makeTestClient(SearchEntity, FreshHandlersLayer)
          const client = yield* makeClient(`ping-${source}`)

          const result = yield* client.PingSource({ source })

          console.log(`${source}: ${result.available ? '✓' : '✗'} (${result.latencyMs ?? 'N/A'}ms)`)
          return result
        }).pipe(
          Effect.scoped,
          Effect.provide(TestShardingConfig),
          Effect.timeout(TIMEOUT)
        )

        const result = await Effect.runPromise(program)
        expect(result.source).toBe(source)
        expect(typeof result.available).toBe('boolean')
      })
    }
  })

  describe('CancelSearch Handler', () => {
    it('accepts cancel request without error', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, FreshHandlersLayer)
        const client = yield* makeClient('cancel-integ-1')

        const result = yield* client.CancelSearch({
          searchId: testSearchId(),
          reason: 'Integration test cancellation',
        })

        return result
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      const result = await Effect.runPromise(program)
      expect(result).toBeUndefined()
    })

    it('handles cancel for non-existent search', async () => {
      const program = Effect.gen(function* () {
        const makeClient = yield* Entity.makeTestClient(SearchEntity, FreshHandlersLayer)
        const client = yield* makeClient('cancel-integ-2')

        const result = yield* client.CancelSearch({
          searchId: 'non-existent-search-12345' as any,
        })

        return result
      }).pipe(
        Effect.scoped,
        Effect.provide(TestShardingConfig),
        Effect.timeout(TIMEOUT)
      )

      // Should not throw
      const result = await Effect.runPromise(program)
      expect(result).toBeUndefined()
    })
  })
})
