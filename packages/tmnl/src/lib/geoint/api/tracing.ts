/**
 * API Tracing & Metrics Infrastructure
 *
 * Effect-native observability for GEOINT external API clients.
 * Provides:
 * - Request latency histogram
 * - Request counter per source/operation
 * - Error counter per source
 * - Higher-order tracing wrapper with spans
 *
 * @see https://effect.website/docs/observability/metrics
 * @see https://effect.website/docs/observability/tracing
 * @module geoint/api/tracing
 */

import { Effect, Metric, MetricBoundaries } from 'effect'

// =============================================================================
// Types
// =============================================================================

/**
 * Known API sources for type-safe tagging
 */
export type ApiSource =
  | 'opensky'
  | 'overpass'
  | 'adsbLol'
  | 'planet'
  | 'sentinel'
  | 'openMeteo'

/**
 * Array of all API sources for iteration
 */
export const API_SOURCES: readonly ApiSource[] = [
  'opensky',
  'overpass',
  'adsbLol',
  'planet',
  'sentinel',
  'openMeteo',
] as const

/**
 * Error type classification for metrics
 */
export type ApiErrorType =
  | 'timeout'
  | 'rate_limit'
  | 'server_error'
  | 'client_error'
  | 'network_error'

// =============================================================================
// Base Metrics
// =============================================================================

/**
 * Histogram tracking API request latencies in milliseconds.
 * Buckets: Exponential from 10ms to ~10 seconds
 */
export const apiLatencyHistogram = Metric.histogram(
  'geoint.api.latency_ms',
  MetricBoundaries.exponential({ start: 10, factor: 2, count: 10 })
)

/**
 * Counter tracking total API requests.
 */
export const apiRequestCounter = Metric.counter('geoint.api.requests')

/**
 * Counter tracking API errors.
 */
export const apiErrorCounter = Metric.counter('geoint.api.errors')

// =============================================================================
// Metric Recording Helpers
// =============================================================================

/**
 * Record a latency measurement for an API call
 */
export const recordLatency = (source: ApiSource, operation: string, latencyMs: number) =>
  apiLatencyHistogram.pipe(
    Metric.tagged('source', source),
    Metric.tagged('operation', operation),
    (m) => Metric.update(m, latencyMs)
  )

/**
 * Increment the request counter for an API call
 */
export const incrementRequests = (source: ApiSource, operation: string) =>
  apiRequestCounter.pipe(
    Metric.tagged('source', source),
    Metric.tagged('operation', operation),
    (m) => Metric.increment(m)
  )

/**
 * Increment the error counter for an API call
 */
export const incrementErrors = (source: ApiSource, errorType: ApiErrorType) =>
  apiErrorCounter.pipe(
    Metric.tagged('source', source),
    Metric.tagged('error_type', errorType),
    (m) => Metric.increment(m)
  )

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Classify an error into an ApiErrorType for metrics
 */
export const classifyError = (error: unknown): ApiErrorType => {
  if (error && typeof error === 'object' && '_tag' in error) {
    const tag = (error as { _tag: string })._tag
    if (tag === 'TimeoutError') return 'timeout'
    if (tag === 'RateLimitError') return 'rate_limit'
    if (tag === 'ExternalApiError') {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 0
      return statusCode >= 500 ? 'server_error' : 'client_error'
    }
  }
  return 'network_error'
}

// =============================================================================
// Higher-Order Tracing Wrapper
// =============================================================================

/**
 * Wrap an API call with tracing, metrics, and span creation.
 *
 * This higher-order function adds:
 * - Request counter increment
 * - Latency histogram recording
 * - Span creation with source/operation attributes
 * - Error counter increment on failure
 *
 * @example
 * ```typescript
 * const fetchWithTracing = withApiTracing('opensky', 'getStates')(
 *   httpClient.get(url).pipe(Effect.flatMap(res => res.json))
 * )
 * ```
 */
export const withApiTracing = <A, E, R>(
  source: ApiSource,
  operation: string
) => (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
  const startTime = Date.now()

  return effect.pipe(
    // Increment request counter at start
    Effect.tap(() => incrementRequests(source, operation)),
    // Create span around the operation
    Effect.withSpan(`${source}.${operation}`, {
      attributes: { 'api.source': source, 'api.operation': operation },
    }),
    // Record latency and handle errors
    Effect.tapBoth({
      onSuccess: () => {
        const latencyMs = Date.now() - startTime
        return recordLatency(source, operation, latencyMs)
      },
      onFailure: (error) => {
        const latencyMs = Date.now() - startTime
        const errorType = classifyError(error)
        return Effect.all([
          recordLatency(source, operation, latencyMs),
          incrementErrors(source, errorType),
        ])
      },
    })
  )
}

/**
 * Simple timing helper that measures effect execution time.
 *
 * @example
 * ```typescript
 * const [result, duration] = yield* withTiming(myEffect)
 * console.log(`Took ${duration}ms`)
 * ```
 */
export const withTiming = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<readonly [A, number], E, R> =>
  Effect.gen(function* () {
    const start = Date.now()
    const result = yield* effect
    const duration = Date.now() - start
    return [result, duration] as const
  })

/**
 * Add timing information to span attributes.
 * Combines span creation with duration tracking.
 */
export const withTimedSpan = <A, E, R>(
  name: string,
  attributes?: Record<string, unknown>
) => (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const start = Date.now()
    const result = yield* effect.pipe(Effect.withSpan(name, { attributes }))
    const duration = Date.now() - start
    yield* Metric.update(apiLatencyHistogram, duration)
    return result
  })
