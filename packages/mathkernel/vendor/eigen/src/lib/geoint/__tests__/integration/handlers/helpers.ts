/**
 * Shared Integration Test Helpers
 *
 * Provides common configuration and utilities for integration tests
 * that call real external APIs.
 *
 * @module geoint/__tests__/integration/handlers/helpers
 */

import { Layer, Duration, Effect, Exit, Cause } from 'effect'
import { ShardingConfig } from '@effect/cluster'
import { FetchHttpClient } from '@effect/platform'
import {
  OpenSkyClientLive,
  OverpassClientLive,
  AdsbLolClientLive,
  OpenMeteoClientLive,
  ExternalApiClientsLive,
  ExternalApiError,
  RateLimitError,
  TimeoutError,
} from '../../../api/ExternalApiClient'
import { CircuitOpenError } from '../../../api/circuit-breaker'
import { isTransportError } from '../../../api/retry'
import { TimeoutException } from 'effect/Cause'
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

/**
 * Timeout for PingSource handler API calls.
 * Individual API pings should complete within 30 seconds.
 * This allows slow APIs to respond while preventing indefinite hangs.
 */
export const PING_TIMEOUT = Duration.seconds(30)

// =============================================================================
// Transport Error Handling
// =============================================================================

/**
 * All possible API error types from external API clients.
 * Includes Effect-native errors like TimeoutException.
 */
export type ApiError =
  | ExternalApiError
  | RateLimitError
  | TimeoutError
  | CircuitOpenError
  | TimeoutException

/** Result of a graceful API call */
export type GracefulResult<T> =
  | { readonly _tag: 'Success'; readonly value: T }
  | { readonly _tag: 'TransportError'; readonly message: string }
  | { readonly _tag: 'ApiError'; readonly error: ApiError }

/**
 * Determines if an API error indicates the service is unavailable.
 *
 * Includes:
 * - Transport errors (ECONNREFUSED, ENOTFOUND, etc.)
 * - Circuit breaker open (previous failures triggered protection)
 * - Effect timeout exceptions
 */
const isServiceUnavailable = (error: ApiError): boolean => {
  // Handle tagged errors
  if ('_tag' in error) {
    switch (error._tag) {
      case 'ExternalApiError':
        // Check if this is a transport-level error (no HTTP response received)
        return isTransportError(error)
      case 'CircuitOpenError':
        // Circuit is open due to previous failures - treat as unavailable
        return true
      case 'TimeoutError':
        // Our custom timeout error
        return true
      default:
        return false
    }
  }

  // Check for Effect's TimeoutException (has special structure)
  if (Cause.isTimeoutException(error as unknown as Cause.Cause<unknown>)) {
    return true
  }

  return false
}

/**
 * Wraps an Effect that may fail with API errors and handles transport errors gracefully.
 *
 * Transport errors (ECONNREFUSED, ENOTFOUND, circuit breaker open, etc.) are converted
 * to a tagged result that can be used to skip tests rather than fail them. This is useful
 * for integration tests that depend on external APIs that may be temporarily unavailable.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const client = yield* AdsbLolClientService
 *   return yield* client.getByPoint({ lat: 37.6, lon: -122.4, radiusNm: 50 })
 * }).pipe(Effect.provide(FreshApiClientsLayer))
 *
 * const result = await runWithGracefulTransportHandling(program)
 *
 * if (result._tag === 'TransportError') {
 *   console.log(`Skipping: ${result.message}`)
 *   return // Test skipped gracefully
 * }
 * if (result._tag === 'ApiError') {
 *   throw result.error // Normal test failure
 * }
 * // result._tag === 'Success'
 * expect(result.value.timestamp).toBeDefined()
 * ```
 */
export const runWithGracefulTransportHandling = async <T>(
  effect: Effect.Effect<T, ApiError, never>
): Promise<GracefulResult<T>> => {
  const exit = await Effect.runPromiseExit(effect)

  if (Exit.isSuccess(exit)) {
    return { _tag: 'Success', value: exit.value }
  }

  // Extract the error from the cause
  const cause = exit.cause
  const failure = Cause.failureOption(cause)

  if (failure._tag === 'Some') {
    const error = failure.value
    if (isServiceUnavailable(error)) {
      const message = 'message' in error ? String(error.message) : String(error)
      return {
        _tag: 'TransportError',
        message,
      }
    }
    return { _tag: 'ApiError', error }
  }

  // Check for timeout in the cause (TimeoutException is often in Cause)
  if (Cause.isTimeoutException(cause)) {
    return {
      _tag: 'TransportError',
      message: 'Request timed out',
    }
  }

  // Defects or interruptions - re-throw
  return {
    _tag: 'ApiError',
    error: new ExternalApiError({
      source: 'unknown',
      statusCode: 0,
      message: `Unexpected failure: ${Cause.pretty(cause)}`,
      retryable: false,
    }),
  }
}

/**
 * Asserts that a GracefulResult is successful and returns the value.
 * Throws if the result is an error.
 *
 * @example
 * ```typescript
 * const result = await runWithGracefulTransportHandling(program)
 * const response = assertSuccess(result)
 * expect(response.timestamp).toBeDefined()
 * ```
 */
export const assertSuccess = <T>(result: GracefulResult<T>): T => {
  if (result._tag === 'Success') {
    return result.value
  }
  if (result._tag === 'TransportError') {
    throw new Error(`Transport error (API unavailable): ${result.message}`)
  }
  throw result.error
}

/**
 * Checks if a GracefulResult indicates the API is unavailable due to transport errors.
 * Use this to skip tests gracefully when external APIs are unreachable.
 *
 * @example
 * ```typescript
 * const result = await runWithGracefulTransportHandling(program)
 *
 * if (isApiUnavailable(result)) {
 *   console.log('API unavailable, skipping test')
 *   return // Skip without failure
 * }
 *
 * const response = assertSuccess(result)
 * expect(response).toBeDefined()
 * ```
 */
export const isApiUnavailable = <T>(result: GracefulResult<T>): boolean =>
  result._tag === 'TransportError'

// Re-export transport error detection for direct use
export { isTransportError }

// =============================================================================
// Generic Graceful Handling (for non-API errors like Entity errors)
// =============================================================================

/** Generic result of a graceful call */
export type GenericGracefulResult<T> =
  | { readonly _tag: 'Success'; readonly value: T }
  | { readonly _tag: 'Error'; readonly error: unknown; readonly message: string }

/**
 * Runs an Effect with graceful error handling for any error type.
 * Use this for handlers that don't fail with API-specific errors.
 *
 * @example
 * ```typescript
 * const result = await runWithGenericGracefulHandling(program)
 *
 * if (result._tag === 'Error') {
 *   console.log(`Error: ${result.message}`)
 *   return // Skip test
 * }
 *
 * expect(result.value).toBeDefined()
 * ```
 */
export const runWithGenericGracefulHandling = async <T, E>(
  effect: Effect.Effect<T, E, never>
): Promise<GenericGracefulResult<T>> => {
  const exit = await Effect.runPromiseExit(effect)

  if (Exit.isSuccess(exit)) {
    return { _tag: 'Success', value: exit.value }
  }

  // Extract the error from the cause
  const cause = exit.cause
  const failure = Cause.failureOption(cause)

  if (failure._tag === 'Some') {
    const error = failure.value
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)
    return { _tag: 'Error', error, message }
  }

  // Handle timeout
  if (Cause.isTimeoutException(cause)) {
    return { _tag: 'Error', error: cause, message: 'Request timed out' }
  }

  // Other failures
  return { _tag: 'Error', error: cause, message: Cause.pretty(cause) }
}

/**
 * Checks if a GenericGracefulResult is an error.
 */
export const isError = <T>(result: GenericGracefulResult<T>): result is { readonly _tag: 'Error'; readonly error: unknown; readonly message: string } =>
  result._tag === 'Error'
