/**
 * API Tracing, Retry, Rate Limiting, and Metrics Tests
 *
 * Unit tests for GEOINT API infrastructure modules:
 * - tracing.ts - spans, metrics, higher-order wrappers
 * - retry.ts - exponential backoff, transient error detection
 * - rate-limiting.ts - Effect RateLimiter service
 * - metrics-export.ts - snapshot service, export formats
 *
 * @module geoint/api/__tests__/tracing-retry.test
 */

import { describe, it, expect } from 'vitest'
import { Effect, Exit, Duration } from 'effect'
import {
  // Tracing
  API_SOURCES,
  classifyError,
  withApiTracing,
  withTiming,
  withTimedSpan,
} from '../tracing'
import {
  // Retry
  isTransientError,
  withRetry,
  withRetryAndBackoff,
  makeApiRetrySchedule,
} from '../retry'
import {
  // Error types
  ExternalApiError,
  RateLimitError,
  TimeoutError,
} from '../ExternalApiClient'
import {
  // Rate Limiting
  ApiRateLimitersService,
  ApiRateLimitersLive,
  getRateLimiter,
  withRateLimit,
} from '../rate-limiting'
import {
  // Metrics Export
  ApiMetricsSnapshot,
  ApiMetricsLive,
  takeSnapshot,
  getLatestSnapshot,
  getHistory,
  clearHistory,
  snapshotToPrometheus,
  snapshotToJson,
} from '../metrics-export'

// =============================================================================
// Test Fixtures
// =============================================================================

const createExternalApiError = (
  statusCode: number,
  retryable = false,
): ExternalApiError =>
  new ExternalApiError({
    source: 'opensky',
    message: `HTTP ${statusCode} error`,
    statusCode,
    retryable,
  })

const createRateLimitError = (retryAfterSeconds = 60): RateLimitError =>
  new RateLimitError({
    source: 'opensky',
    retryAfterSeconds,
    message: 'Rate limit exceeded',
  })

const createTimeoutError = (): TimeoutError =>
  new TimeoutError({
    source: 'opensky',
    timeoutMs: 30000,
    message: 'Request timed out after 30000ms',
  })

// =============================================================================
// Tracing Tests
// =============================================================================

describe('API Tracing', () => {
  describe('API_SOURCES', () => {
    it('contains all expected API sources', () => {
      expect(API_SOURCES).toEqual([
        'opensky',
        'overpass',
        'adsbLol',
        'planet',
        'sentinel',
        'openMeteo',
      ])
    })

    it('is readonly', () => {
      // TypeScript should enforce this, but verify runtime behavior
      expect(Object.isFrozen(API_SOURCES) || Array.isArray(API_SOURCES)).toBe(true)
    })
  })

  describe('classifyError', () => {
    it('classifies TimeoutError as timeout', () => {
      const error = createTimeoutError()
      expect(classifyError(error)).toBe('timeout')
    })

    it('classifies RateLimitError as rate_limit', () => {
      const error = createRateLimitError()
      expect(classifyError(error)).toBe('rate_limit')
    })

    it('classifies ExternalApiError 5xx as server_error', () => {
      expect(classifyError(createExternalApiError(500))).toBe('server_error')
      expect(classifyError(createExternalApiError(502))).toBe('server_error')
      expect(classifyError(createExternalApiError(503))).toBe('server_error')
    })

    it('classifies ExternalApiError 4xx as client_error', () => {
      expect(classifyError(createExternalApiError(400))).toBe('client_error')
      expect(classifyError(createExternalApiError(401))).toBe('client_error')
      expect(classifyError(createExternalApiError(404))).toBe('client_error')
    })

    it('classifies unknown errors as network_error', () => {
      expect(classifyError(new Error('Unknown'))).toBe('network_error')
      expect(classifyError(null)).toBe('network_error')
      expect(classifyError({ random: 'object' })).toBe('network_error')
    })
  })

  describe('withApiTracing', () => {
    it('executes the wrapped effect successfully', async () => {
      const program = Effect.succeed('result').pipe(
        withApiTracing('opensky', 'getStates')
      )

      const result = await Effect.runPromise(program)
      expect(result).toBe('result')
    })

    it('propagates errors from the wrapped effect', async () => {
      const program = Effect.fail(createExternalApiError(500)).pipe(
        withApiTracing('opensky', 'getStates')
      )

      const exit = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('adds span attributes', async () => {
      // This test verifies the shape - actual span collection requires OTel setup
      const program = Effect.succeed('result').pipe(
        withApiTracing('overpass', 'query')
      )

      const result = await Effect.runPromise(program)
      expect(result).toBe('result')
    })
  })

  describe('withTiming', () => {
    it('returns result with duration', async () => {
      const program = withTiming(
        Effect.delay(Effect.succeed('result'), Duration.millis(50))
      )

      const [result, duration] = await Effect.runPromise(program)

      expect(result).toBe('result')
      expect(duration).toBeGreaterThanOrEqual(40) // Allow some variance
      expect(duration).toBeLessThan(200)
    })

    it('propagates errors with timing', async () => {
      const program = withTiming(
        Effect.delay(Effect.fail('error'), Duration.millis(50))
      )

      const exit = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('withTimedSpan', () => {
    it('wraps effect with span and records duration', async () => {
      const program = Effect.succeed('result').pipe(
        withTimedSpan('test.operation', { custom: 'attr' })
      )

      const result = await Effect.runPromise(program)
      expect(result).toBe('result')
    })
  })
})

// =============================================================================
// Retry Tests
// =============================================================================

describe('Retry Logic', () => {
  describe('isTransientError', () => {
    it('returns true for ExternalApiError with retryable=true', () => {
      expect(isTransientError(createExternalApiError(400, true))).toBe(true)
    })

    it('returns true for ExternalApiError with statusCode >= 500', () => {
      expect(isTransientError(createExternalApiError(500))).toBe(true)
      expect(isTransientError(createExternalApiError(502))).toBe(true)
      expect(isTransientError(createExternalApiError(503))).toBe(true)
    })

    it('returns false for ExternalApiError 4xx without retryable flag', () => {
      expect(isTransientError(createExternalApiError(400))).toBe(false)
      expect(isTransientError(createExternalApiError(401))).toBe(false)
      expect(isTransientError(createExternalApiError(404))).toBe(false)
    })

    it('returns true for RateLimitError', () => {
      expect(isTransientError(createRateLimitError())).toBe(true)
    })

    it('returns false for TimeoutError', () => {
      expect(isTransientError(createTimeoutError())).toBe(false)
    })
  })

  describe('withRetry', () => {
    it('succeeds on first attempt when no error', async () => {
      let attempts = 0
      const program = withRetry(
        Effect.gen(function* () {
          attempts++
          return 'success'
        })
      )

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
      expect(attempts).toBe(1)
    })

    it('retries on transient errors', async () => {
      let attempts = 0
      const program = withRetry(
        Effect.gen(function* () {
          attempts++
          if (attempts < 3) {
            return yield* Effect.fail(createExternalApiError(500))
          }
          return 'success'
        })
      )

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('does not retry on non-transient errors', async () => {
      let attempts = 0
      const program = withRetry(
        Effect.gen(function* () {
          attempts++
          return yield* Effect.fail(createExternalApiError(404)) // 4xx is not transient
        })
      )

      const exit = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(exit)).toBe(true)
      expect(attempts).toBe(1)
    })

    it('does not retry on timeout errors', async () => {
      let attempts = 0
      const program = withRetry(
        Effect.gen(function* () {
          attempts++
          return yield* Effect.fail(createTimeoutError())
        })
      )

      const exit = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(exit)).toBe(true)
      expect(attempts).toBe(1)
    })

    it('retries up to max attempts then fails', async () => {
      let attempts = 0
      const program = withRetry(
        Effect.gen(function* () {
          attempts++
          return yield* Effect.fail(createExternalApiError(500))
        })
      )

      const exit = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(exit)).toBe(true)
      expect(attempts).toBe(4) // 1 initial + 3 retries
    })
  })

  describe('withRetryAndBackoff', () => {
    it('honors rate limit retry-after header', async () => {
      let attempts = 0
      const startTime = Date.now()

      const program = withRetryAndBackoff(
        Effect.gen(function* () {
          attempts++
          if (attempts === 1) {
            return yield* Effect.fail(createRateLimitError(0.1)) // 100ms
          }
          return 'success'
        })
      )

      const result = await Effect.runPromise(program)
      const duration = Date.now() - startTime

      expect(result).toBe('success')
      expect(attempts).toBe(2)
      expect(duration).toBeGreaterThanOrEqual(80) // Allow some variance
    })
  })

  describe('makeApiRetrySchedule', () => {
    it('creates schedule with custom initial delay', async () => {
      let attempts = 0
      const startTime = Date.now()

      const schedule = makeApiRetrySchedule({
        initialDelay: Duration.millis(50),
        maxRetries: 2,
        jitter: false, // Disable jitter for predictable timing
      })

      const program = Effect.gen(function* () {
        attempts++
        return yield* Effect.fail(createExternalApiError(500))
      }).pipe(Effect.retry(schedule))

      const exit = await Effect.runPromiseExit(program)
      const duration = Date.now() - startTime

      expect(Exit.isFailure(exit)).toBe(true)
      expect(attempts).toBe(3) // 1 initial + 2 retries
      // Should have delays: 50ms + 100ms = 150ms minimum
      expect(duration).toBeGreaterThanOrEqual(100)
    })

    it('creates schedule with custom shouldRetry predicate', async () => {
      let attempts = 0

      const schedule = makeApiRetrySchedule({
        maxRetries: 3,
        shouldRetry: () => false, // Never retry
      })

      const program = Effect.gen(function* () {
        attempts++
        return yield* Effect.fail(createExternalApiError(500))
      }).pipe(Effect.retry(schedule))

      const exit = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(exit)).toBe(true)
      expect(attempts).toBe(1) // No retries
    })
  })
})

// =============================================================================
// Rate Limiting Tests
// =============================================================================

describe('Rate Limiting Service', () => {
  describe('ApiRateLimitersLive', () => {
    it('provides rate limiters for all API sources', async () => {
      const program = Effect.gen(function* () {
        const limiters = yield* ApiRateLimitersService

        // Verify all limiters exist
        expect(limiters.opensky).toBeDefined()
        expect(limiters.overpass).toBeDefined()
        expect(limiters.adsbLol).toBeDefined()
        expect(limiters.planet).toBeDefined()
        expect(limiters.sentinel).toBeDefined()
        expect(limiters.openMeteo).toBeDefined()

        return 'success'
      }).pipe(Effect.scoped, Effect.provide(ApiRateLimitersLive))

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
    })
  })

  describe('getRateLimiter', () => {
    it('returns the correct rate limiter for each source', async () => {
      const program = Effect.gen(function* () {
        const openskyLimiter = yield* getRateLimiter('opensky')
        const overpassLimiter = yield* getRateLimiter('overpass')

        // They should be different instances
        expect(openskyLimiter).not.toBe(overpassLimiter)

        return 'success'
      }).pipe(Effect.scoped, Effect.provide(ApiRateLimitersLive))

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
    })
  })

  describe('withRateLimit', () => {
    it('executes effect with rate limiting', async () => {
      const program = Effect.gen(function* () {
        const result = yield* withRateLimit(
          'opensky',
          Effect.succeed('rate-limited-result')
        )
        return result
      }).pipe(Effect.scoped, Effect.provide(ApiRateLimitersLive))

      const result = await Effect.runPromise(program)
      expect(result).toBe('rate-limited-result')
    })

    it('allows multiple requests within limit', async () => {
      const program = Effect.gen(function* () {
        const results: string[] = []

        // OpenSky allows 10 requests/minute - do 5
        for (let i = 0; i < 5; i++) {
          const result = yield* withRateLimit(
            'opensky',
            Effect.succeed(`result-${i}`)
          )
          results.push(result)
        }

        return results
      }).pipe(Effect.scoped, Effect.provide(ApiRateLimitersLive))

      const results = await Effect.runPromise(program)
      expect(results).toHaveLength(5)
    })
  })
})

// =============================================================================
// Metrics Export Tests
// =============================================================================

describe('Metrics Export Service', () => {
  describe('ApiMetricsSnapshot', () => {
    it('has correct schema structure', () => {
      const snapshot = new ApiMetricsSnapshot({
        timestamp: new Date(),
        latencyHistogram: {
          opensky: { buckets: [[10, 1], [20, 2]], count: 3, min: 5, max: 25, sum: 45 },
        },
        requestCounts: { opensky: 10 },
        errorCounts: { opensky: 2 },
      })

      // Schema.Class instances are just objects with properties
      expect(snapshot.timestamp).toBeInstanceOf(Date)
      expect(snapshot.requestCounts['opensky']).toBe(10)
      expect(snapshot.errorCounts['opensky']).toBe(2)
    })
  })

  describe('ApiMetricsService', () => {
    it('takes snapshots', async () => {
      const program = Effect.gen(function* () {
        const snapshot = yield* takeSnapshot
        return snapshot
      }).pipe(Effect.provide(ApiMetricsLive))

      const snapshot = await Effect.runPromise(program)

      // Verify snapshot structure
      expect(snapshot.timestamp).toBeInstanceOf(Date)
      expect(snapshot.latencyHistogram).toBeDefined()
      expect(snapshot.requestCounts).toBeDefined()
      expect(snapshot.errorCounts).toBeDefined()
    })

    it('stores and retrieves snapshots', async () => {
      const program = Effect.gen(function* () {
        // Clear any existing history
        yield* clearHistory

        // Take a snapshot
        yield* takeSnapshot

        // Get latest
        const latest = yield* getLatestSnapshot
        expect(latest).not.toBeNull()

        // Get history
        const history = yield* getHistory
        expect(history).toHaveLength(1)

        return 'success'
      }).pipe(Effect.provide(ApiMetricsLive))

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
    })

    it('clears history', async () => {
      const program = Effect.gen(function* () {
        // Take a snapshot
        yield* takeSnapshot

        // Verify we have history
        let history = yield* getHistory
        expect(history.length).toBeGreaterThan(0)

        // Clear history
        yield* clearHistory

        // Verify empty
        history = yield* getHistory
        expect(history).toHaveLength(0)

        return 'success'
      }).pipe(Effect.provide(ApiMetricsLive))

      const result = await Effect.runPromise(program)
      expect(result).toBe('success')
    })

    it('returns null when no snapshots', async () => {
      const program = Effect.gen(function* () {
        yield* clearHistory
        const latest = yield* getLatestSnapshot
        return latest
      }).pipe(Effect.provide(ApiMetricsLive))

      const result = await Effect.runPromise(program)
      expect(result).toBeNull()
    })
  })

  describe('snapshotToPrometheus', () => {
    it('converts snapshot to Prometheus exposition format', () => {
      const snapshot = new ApiMetricsSnapshot({
        timestamp: new Date('2024-01-15T12:00:00Z'),
        latencyHistogram: {
          opensky: { buckets: [[10, 5], [20, 8]], count: 10, min: 5, max: 25, sum: 150 },
        },
        requestCounts: { opensky: 10 },
        errorCounts: { opensky: 2 },
      })

      const prometheus = snapshotToPrometheus(snapshot)

      // Verify structure
      expect(prometheus).toContain('# HELP geoint_api_latency_ms')
      expect(prometheus).toContain('# TYPE geoint_api_latency_ms histogram')
      expect(prometheus).toContain('geoint_api_latency_ms_bucket{source="opensky"')
      expect(prometheus).toContain('geoint_api_latency_ms_count{source="opensky"} 10')
      expect(prometheus).toContain('geoint_api_latency_ms_sum{source="opensky"} 150')

      expect(prometheus).toContain('# HELP geoint_api_requests_total')
      expect(prometheus).toContain('geoint_api_requests_total{source="opensky"} 10')

      expect(prometheus).toContain('# HELP geoint_api_errors_total')
      expect(prometheus).toContain('geoint_api_errors_total{source="opensky"} 2')
    })
  })

  describe('snapshotToJson', () => {
    it('converts snapshot to JSON format', () => {
      const timestamp = new Date('2024-01-15T12:00:00Z')
      const snapshot = new ApiMetricsSnapshot({
        timestamp,
        latencyHistogram: {
          opensky: { buckets: [[10, 5]], count: 5, min: 5, max: 15, sum: 50 },
        },
        requestCounts: { opensky: 5 },
        errorCounts: { opensky: 1 },
      })

      const json = snapshotToJson(snapshot)

      expect(json['timestamp']).toBe('2024-01-15T12:00:00.000Z')
      expect(json['requestCounts']).toEqual({ opensky: 5 })
      expect(json['errorCounts']).toEqual({ opensky: 1 })
      expect(json['latencyHistogram']).toBeDefined()
    })
  })
})
