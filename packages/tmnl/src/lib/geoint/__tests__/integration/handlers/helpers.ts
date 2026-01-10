/**
 * Shared Integration Test Helpers
 *
 * Provides common configuration and utilities for integration tests
 * that call real external APIs.
 */

import { Layer, Duration } from 'effect'
import { ShardingConfig } from '@effect/cluster'
import { FetchHttpClient } from '@effect/platform'
import {
  OpenSkyClientLive,
  OverpassClientLive,
  AdsbLolClientLive,
  OpenMeteoClientLive,
  ExternalApiClientsLive,
} from '../../../api/ExternalApiClient'
import { SearchEntityHandlers } from '../../../cluster/SearchEntityHandlers'
import type { SearchId, BBox } from '../../../schemas'

// Skip unless explicitly enabled
export const RUN_INTEGRATION_TESTS = process.env['RUN_INTEGRATION_TESTS'] === '1'

// Test bounds
export const SF_BOUNDS: BBox = [-122.5, 37.5, -122.0, 38.0]
export const SF_CENTER: readonly [number, number] = [-122.4, 37.78]
export const FISHERMANS_WHARF: BBox = [-122.42, 37.805, -122.40, 37.815]
export const SFO_AIRPORT: readonly [number, number] = [37.6213, -122.3790]

// Generate unique search ID
export const testSearchId = () =>
  `integ-${Date.now()}-${Math.random().toString(36).slice(2)}` as SearchId

// Sharding config for tests
export const TestShardingConfig = ShardingConfig.layer({
  shardsPerGroup: 10,
  entityMailboxCapacity: 10,
  entityTerminationTimeout: 0,
  entityMessagePollInterval: 5000,
  sendRetryInterval: 100,
})

// HTTP client for real API calls
export const HttpClientLive = FetchHttpClient.layer

// Individual API client layers with HTTP
export const OpenSkyLive = OpenSkyClientLive.pipe(Layer.provide(HttpClientLive))
export const OverpassLive = OverpassClientLive.pipe(Layer.provide(HttpClientLive))
export const AdsbLolLive = AdsbLolClientLive.pipe(Layer.provide(HttpClientLive))
export const OpenMeteoLive = OpenMeteoClientLive.pipe(Layer.provide(HttpClientLive))

// Combined real API clients layer (includes CircuitBreakersLive)
export const RealApiClientsLayer = ExternalApiClientsLive.pipe(
  Layer.provide(HttpClientLive)
)

/**
 * Fresh API clients layer - use for test isolation.
 *
 * Layer.fresh() ensures stateful services (CircuitBreaker, rate limiters)
 * are rebuilt for each test, preventing state pollution between tests.
 *
 * Use this instead of RealApiClientsLayer when tests need isolation.
 */
export const FreshApiClientsLayer = Layer.fresh(RealApiClientsLayer)

// Test handlers layer with real API clients
// Use Layer.provideMerge to ensure CircuitBreakersService is available
// when Entity.makeTestClient runs the handlers
export const RealHandlersLayer = Layer.provideMerge(
  SearchEntityHandlers,
  RealApiClientsLayer
)

/**
 * Fresh handlers layer - use for test isolation with Entity tests.
 *
 * Layer.fresh() ensures stateful services (CircuitBreaker, rate limiters)
 * and handler state are rebuilt for each test.
 *
 * Use this instead of RealHandlersLayer when tests need isolation.
 */
export const FreshHandlersLayer = Layer.fresh(RealHandlersLayer)

// Timeouts
export const TIMEOUT = Duration.seconds(60)
export const LONG_TIMEOUT = Duration.seconds(90)
export const VERY_LONG_TIMEOUT = Duration.seconds(120)
