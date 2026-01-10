/**
 * Retry Logic for External API Clients
 *
 * Provides Effect Schedule-based retry logic with exponential backoff,
 * jitter, and error-type-aware retry policies.
 *
 * @see beads:tmnl-cds9q HttpApi: External API Integrations
 * @module
 */

import { Effect, Schedule, Duration, pipe } from 'effect'
import {
  ExternalApiError,
  RateLimitError,
  TimeoutError,
} from './ExternalApiClient'

// =============================================================================
// Error Predicates
// =============================================================================

/**
 * Network-level error patterns that indicate transport failures.
 * These are typically socket/connection errors from Node.js.
 */
const TRANSPORT_ERROR_PATTERNS = [
  'ECONNREFUSED',   // Connection refused (server not running)
  'ENOTFOUND',      // DNS lookup failed
  'ECONNRESET',     // Connection reset by peer
  'ETIMEDOUT',      // Connection timed out
  'EHOSTUNREACH',   // No route to host
  'ENETUNREACH',    // Network unreachable
  'ECONNABORTED',   // Connection aborted
  'EPIPE',          // Broken pipe
  'EAI_AGAIN',      // DNS temporary failure
  'CERT_',          // Certificate errors
  'socket hang up', // Socket closed unexpectedly
  'fetch failed',   // Fetch API failure
]

/**
 * Determines if an ExternalApiError is a transport-level error.
 *
 * Transport errors occur when the network request fails before
 * receiving an HTTP response. These include:
 * - ECONNREFUSED (server not running)
 * - ENOTFOUND (DNS failure)
 * - ECONNRESET (connection dropped)
 * - Socket/connection timeouts
 *
 * @example
 * ```typescript
 * if (isTransportError(error)) {
 *   console.log('Network unavailable, skipping test')
 *   return
 * }
 * ```
 */
export const isTransportError = (
  error: ExternalApiError | RateLimitError | TimeoutError
): boolean => {
  if (error._tag !== 'ExternalApiError') return false

  // Transport errors have statusCode: 0 (no HTTP response received)
  if (error.statusCode !== 0) return false

  // Check message for transport error patterns
  const message = error.message.toLowerCase()
  return TRANSPORT_ERROR_PATTERNS.some(
    pattern => message.includes(pattern.toLowerCase())
  )
}

/**
 * Determines if an error is transient and should be retried.
 *
 * Transient errors include:
 * - ExternalApiError with retryable=true OR statusCode >= 500
 * - RateLimitError (always retry after delay)
 * - NOT TimeoutError (don't retry timeouts by default)
 */
export const isTransientError = (
  error: ExternalApiError | RateLimitError | TimeoutError
): boolean => {
  switch (error._tag) {
    case 'ExternalApiError':
      return error.retryable || error.statusCode >= 500
    case 'RateLimitError':
      return true
    case 'TimeoutError':
      return false
    default:
      return false
  }
}

// =============================================================================
// Retry Schedules
// =============================================================================

/**
 * Base exponential backoff schedule with jitter.
 *
 * - Starts at 100ms
 * - Exponential growth with random jitter
 * - Max 3 retries
 */
const baseExponentialSchedule = pipe(
  Schedule.exponential(Duration.millis(100)),
  Schedule.jittered,
  Schedule.compose(Schedule.recurs(3))
)

/**
 * API retry schedule that only retries on transient errors.
 *
 * - Exponential backoff starting at 100ms
 * - Jittered delays for thundering herd prevention
 * - Max 3 retries
 * - Only retries on:
 *   - ExternalApiError where retryable=true OR statusCode >= 500
 *   - RateLimitError (always retry after delay)
 *   - NOT TimeoutError
 */
export const apiRetrySchedule: Schedule.Schedule<
  number,
  ExternalApiError | RateLimitError | TimeoutError
> = pipe(
  baseExponentialSchedule,
  Schedule.whileInput(isTransientError)
)

// =============================================================================
// Retry Helpers
// =============================================================================

/**
 * Wraps an Effect with the standard API retry schedule.
 *
 * Uses exponential backoff with jitter, max 3 retries,
 * and only retries on transient errors.
 *
 * @example
 * ```typescript
 * const fetchWithRetry = withRetry(
 *   Effect.gen(function* () {
 *     const client = yield* OpenSkyClientService
 *     return yield* client.getStates({ bounds: [0, 0, 10, 10] })
 *   })
 * )
 * ```
 */
export const withRetry = <A, R>(
  effect: Effect.Effect<A, ExternalApiError | RateLimitError | TimeoutError, R>
): Effect.Effect<A, ExternalApiError | RateLimitError | TimeoutError, R> =>
  Effect.retry(effect, apiRetrySchedule)

// Note: Rate limit backoff is handled in withRetryAndBackoff using Effect.sleep
// rather than a Schedule, since we need to inspect the error to get the delay

/**
 * Wraps an Effect with retry logic that honors rate limit backoff.
 *
 * When a RateLimitError is encountered, waits for the specified
 * retryAfterSeconds before retrying. For other transient errors,
 * uses standard exponential backoff with jitter.
 *
 * @example
 * ```typescript
 * const fetchWithBackoff = withRetryAndBackoff(
 *   Effect.gen(function* () {
 *     const client = yield* AdsbLolClientService
 *     return yield* client.getByPoint({ lat: 51.5, lon: -0.12, radiusNm: 50 })
 *   })
 * )
 * ```
 */
export const withRetryAndBackoff = <A, R>(
  effect: Effect.Effect<A, ExternalApiError | RateLimitError | TimeoutError, R>
): Effect.Effect<A, ExternalApiError | RateLimitError | TimeoutError, R> =>
  Effect.gen(function* () {
    let attempts = 0
    const maxAttempts = 4 // 1 initial + 3 retries

    while (attempts < maxAttempts) {
      const result = yield* Effect.either(effect)

      if (result._tag === 'Right') {
        return result.right
      }

      const error = result.left
      attempts++

      // Check if we should retry
      if (attempts >= maxAttempts || !isTransientError(error)) {
        return yield* Effect.fail(error)
      }

      // Calculate delay based on error type
      if (error._tag === 'RateLimitError') {
        // Honor the retry-after header
        yield* Effect.sleep(Duration.seconds(error.retryAfterSeconds))
      } else {
        // Exponential backoff with jitter for other transient errors
        const baseDelay = 100 * Math.pow(2, attempts - 1) // 100, 200, 400ms
        const jitter = Math.random() * baseDelay * 0.5 // Up to 50% jitter
        const delay = baseDelay + jitter
        yield* Effect.sleep(Duration.millis(delay))
      }
    }

    // This should never be reached, but TypeScript needs it
    return yield* Effect.die('Unreachable: retry loop exited unexpectedly')
  })

// =============================================================================
// Typed Retry Helpers
// =============================================================================

/**
 * Type-safe retry for effects that may fail with API errors.
 * Preserves the full error union type.
 */
export const retryApiCall = <A, E extends ExternalApiError | RateLimitError | TimeoutError, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.retry(
    effect,
    pipe(
      Schedule.exponential(Duration.millis(100)),
      Schedule.jittered,
      Schedule.compose(Schedule.recurs(3)),
      Schedule.whileInput((error: E) => {
        if (error._tag === 'TimeoutError') return false
        if (error._tag === 'RateLimitError') return true
        if (error._tag === 'ExternalApiError') {
          return error.retryable || error.statusCode >= 500
        }
        return false
      })
    )
  )

/**
 * Creates a custom retry schedule with configurable parameters.
 *
 * @param options Configuration options for the retry schedule
 * @returns A Schedule configured with the specified options
 */
export const makeApiRetrySchedule = (options: {
  /** Initial delay before first retry (default: 100ms) */
  initialDelay?: Duration.DurationInput
  /** Maximum number of retries (default: 3) */
  maxRetries?: number
  /** Whether to apply jitter (default: true) */
  jitter?: boolean
  /** Custom predicate for retryable errors */
  shouldRetry?: (error: ExternalApiError | RateLimitError | TimeoutError) => boolean
}): Schedule.Schedule<number, ExternalApiError | RateLimitError | TimeoutError> => {
  const {
    initialDelay = Duration.millis(100),
    maxRetries = 3,
    jitter = true,
    shouldRetry = isTransientError,
  } = options

  let schedule = pipe(
    Schedule.exponential(Duration.decode(initialDelay)),
    Schedule.compose(Schedule.recurs(maxRetries))
  )

  if (jitter) {
    schedule = Schedule.jittered(schedule)
  }

  return Schedule.whileInput(schedule, shouldRetry)
}
