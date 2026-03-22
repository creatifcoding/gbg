/**
 * Basic Entity Test
 *
 * Tests SearchEntity handlers using standard vitest + Effect.runPromise pattern.
 * Uses Effect.scoped to manage Scope requirements from Entity.makeTestClient.
 *
 * @see https://deepwiki.com for Effect testing patterns
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import { SearchEntity } from '../../cluster/SearchEntity'
import { SearchEntityHandlers } from '../../cluster/SearchEntityHandlers'
import {
  OpenSkyClientService,
  OverpassClientService,
  type OpenSkyClient,
  type OverpassClient,
} from '../../api/ExternalApiClient'
import {
  OpenSkyResponse,
  OverpassResponse,
  OpenSkyStateVector,
  OverpassElement,
  Icao24,
  type SearchId,
  type BBox,
} from '../../schemas'

// Sharding config for tests
const TestShardingConfig = ShardingConfig.layer({
  shardsPerGroup: 10,
  entityMailboxCapacity: 10,
  entityTerminationTimeout: 0,
  entityMessagePollInterval: 5000,
  sendRetryInterval: 100,
})

// Static mock OpenSky layer
const MockOpenSkyLayer = Layer.succeed(OpenSkyClientService, {
  getStates: () =>
    Effect.succeed(
      new OpenSkyResponse({
        time: Math.floor(Date.now() / 1000),
        states: [
          new OpenSkyStateVector({
            icao24: 'abc123' as Icao24,
            callsign: 'TEST123 ',
            originCountry: 'United States',
            timePosition: Date.now() / 1000,
            lastContact: Date.now() / 1000,
            longitude: -122.4,
            latitude: 37.8,
            baroAltitude: 10000,
            onGround: false,
            velocity: 250,
            trueTrack: 90,
            verticalRate: 0,
            sensors: null,
            geoAltitude: 10500,
            squawk: '1200',
            spi: false,
            positionSource: 0,
            category: 3,
          }),
        ],
      })
    ),
} satisfies OpenSkyClient)

// Static mock Overpass layer
const MockOverpassLayer = Layer.succeed(OverpassClientService, {
  query: () =>
    Effect.succeed(
      new OverpassResponse({
        version: 0.6,
        generator: 'Overpass API',
        osm3s: {
          timestamp_osm_base: new Date().toISOString(),
          copyright: 'OpenStreetMap contributors',
        },
        elements: [
          new OverpassElement({
            type: 'node' as const,
            id: 1001,
            lat: 37.8,
            lon: -122.4,
            tags: { name: 'Test POI', amenity: 'restaurant' },
          }),
        ],
      })
    ),
  buildQuery: (opts) => {
    const [minLon, minLat, maxLon, maxLat] = opts.bounds
    return `[out:json][timeout:25];(node["amenity"~"restaurant"](${minLat},${minLon},${maxLat},${maxLon}););out center;`
  },
} satisfies OverpassClient)

// Combined mock services layer
const MockServicesLayer = Layer.mergeAll(MockOpenSkyLayer, MockOverpassLayer)

// Test layer - SearchEntityHandlers with mock services
const TestSearchEntityLayer = SearchEntityHandlers.pipe(
  Layer.provide(MockServicesLayer)
)

// Test search ID helper
const testSearchId = () =>
  `test-${Date.now()}-${Math.random().toString(36).slice(2)}` as SearchId

// Test bounding box
const TEST_BBOX: BBox = [-122.5, 37.7, -122.3, 37.9]

describe('Basic SearchEntity Tests', () => {
  it('SearchFlights returns results', async () => {
    const program = Effect.gen(function* () {
      const makeClient = yield* Entity.makeTestClient(SearchEntity, TestSearchEntityLayer)
      const client = yield* makeClient('test-worker')

      const results = yield* client.SearchFlights({
        searchId: testSearchId(),
        bounds: TEST_BBOX,
        limit: 100,
      })

      return results
    }).pipe(
      Effect.scoped, // Manage Scope automatically
      Effect.provide(TestShardingConfig)
    )

    const results = await Effect.runPromise(program)
    expect(results.length).toBeGreaterThan(0)
  })

  it('SearchOsm returns results', async () => {
    const program = Effect.gen(function* () {
      const makeClient = yield* Entity.makeTestClient(SearchEntity, TestSearchEntityLayer)
      const client = yield* makeClient('test-worker')

      const results = yield* client.SearchOsm({
        searchId: testSearchId(),
        bounds: TEST_BBOX,
        limit: 100,
      })

      return results
    }).pipe(
      Effect.scoped,
      Effect.provide(TestShardingConfig)
    )

    const results = await Effect.runPromise(program)
    expect(results.length).toBeGreaterThan(0)
  })
})
