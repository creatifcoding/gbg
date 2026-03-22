/**
 * Circuit Breaker Service for External APIs
 *
 * Implements the circuit breaker pattern to prevent cascade failures
 * when external APIs become unresponsive or fail repeatedly.
 *
 * ## States
 * - **Closed**: Normal operation, requests pass through
 * - **Open**: Failures exceeded threshold, requests fail fast
 * - **Half-Open**: After cooldown, allow single request to test recovery
 *
 * @see beads:tmnl-4zjo7 Circuit breaker for API resilience
 * @module
 */

import {
  Context,
  Data,
  Effect,
  Layer,
  Option,
  Ref,
  Schema,
} from 'effect'
import { Metric } from 'effect'
import { ExternalApiError, RateLimitError, TimeoutError } from './ExternalApiClient'

// =============================================================================
// Circuit Breaker Error
// =============================================================================

/**
 * Error thrown when circuit is open and requests are rejected.
 */
export class CircuitOpenError extends Schema.TaggedError<CircuitOpenError>()(
  'CircuitOpenError',
  {
    source: Schema.String,
    openedAt: Schema.Number,
    cooldownMs: Schema.Number,
    message: Schema.String,
  }
) {}

// =============================================================================
// Circuit State Types
// =============================================================================

/**
 * Circuit breaker state - discriminated union.
 */
export type CircuitState = Data.TaggedEnum<{
  /** Normal operation, tracking failures */
  Closed: { readonly failureCount: number; readonly lastFailureAt: Option.Option<number> }
  /** Circuit tripped, rejecting requests */
  Open: { readonly openedAt: number; readonly failureCount: number }
  /** Testing recovery with single request */
  HalfOpen: { readonly openedAt: number; readonly trialAttempts: number }
}>

export const CircuitState = Data.taggedEnum<CircuitState>()

/**
 * Initial closed state with no failures.
 */
export const initialState: CircuitState = CircuitState.Closed({
  failureCount: 0,
  lastFailureAt: Option.none(),
})

// =============================================================================
// Configuration
// =============================================================================

/**
 * Circuit breaker configuration per API source.
 */
export interface CircuitBreakerConfig {
  /** Name of the API source */
  readonly source: string
  /** Number of failures before opening circuit */
  readonly failureThreshold: number
  /** Window for counting failures (resets if no failure in this window) */
  readonly failureWindowMs: number
  /** Time to wait before transitioning to half-open */
  readonly cooldownMs: number
  /** Time in half-open before forcing closed if no requests */
  readonly resetTimeoutMs: number
}

/**
 * Source names for circuit breakers
 */
export type CircuitBreakerSource = 'opensky' | 'overpass' | 'adsbLol' | 'planet' | 'sentinel' | 'openMeteo'

/**
 * Default configurations per API source.
 */
export const CircuitBreakerConfigs = {
  opensky: {
    source: 'opensky',
    failureThreshold: 5,
    failureWindowMs: 60_000, // 1 minute
    cooldownMs: 30_000, // 30 seconds
    resetTimeoutMs: 60_000, // 1 minute
  },
  overpass: {
    source: 'overpass',
    failureThreshold: 3,
    failureWindowMs: 60_000,
    cooldownMs: 60_000, // 60 seconds (Overpass is slower to recover)
    resetTimeoutMs: 120_000,
  },
  adsbLol: {
    source: 'adsbLol',
    failureThreshold: 5,
    failureWindowMs: 60_000,
    cooldownMs: 30_000,
    resetTimeoutMs: 60_000,
  },
  planet: {
    source: 'planet',
    failureThreshold: 3,
    failureWindowMs: 60_000,
    cooldownMs: 30_000,
    resetTimeoutMs: 60_000,
  },
  sentinel: {
    source: 'sentinel',
    failureThreshold: 3,
    failureWindowMs: 60_000,
    cooldownMs: 30_000,
    resetTimeoutMs: 60_000,
  },
  openMeteo: {
    source: 'openMeteo',
    failureThreshold: 5,
    failureWindowMs: 60_000,
    cooldownMs: 30_000,
    resetTimeoutMs: 60_000,
  },
} as const

// =============================================================================
// Metrics
// =============================================================================

/** Counter for circuit state transitions */
export const circuitStateTransitions = Metric.counter('geoint.circuit.transitions')

/** Counter for rejected requests (circuit open) */
export const circuitRejections = Metric.counter('geoint.circuit.rejections')

/** Gauge for current failure count */
export const circuitFailureCount = Metric.gauge('geoint.circuit.failure_count')

// =============================================================================
// Metric Recording Helpers
// =============================================================================

/**
 * Record a circuit state transition
 */
const recordTransition = (source: string, from: string, to: string) =>
  circuitStateTransitions.pipe(
    Metric.tagged('source', source),
    Metric.tagged('from', from),
    Metric.tagged('to', to),
    (m) => Metric.increment(m)
  )

/**
 * Record a circuit rejection
 */
const recordRejection = (source: string) =>
  circuitRejections.pipe(
    Metric.tagged('source', source),
    (m) => Metric.increment(m)
  )

/**
 * Record failure count
 */
const recordFailureCount = (source: string, count: number) =>
  circuitFailureCount.pipe(
    Metric.tagged('source', source),
    (m) => Metric.set(m, count)
  )

// =============================================================================
// Circuit Breaker Instance
// =============================================================================

/**
 * A single circuit breaker instance for one API source.
 */
export interface CircuitBreaker {
  /** Execute effect with circuit breaker protection */
  readonly execute: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | CircuitOpenError, R>
  /** Get current state (for debugging/monitoring) */
  readonly getState: Effect.Effect<CircuitState>
  /** Force reset to closed state (for testing/admin) */
  readonly reset: Effect.Effect<void>
  /** Get the configuration */
  readonly config: CircuitBreakerConfig
}

/**
 * Create a circuit breaker for a specific API source.
 */
export const make = (config: CircuitBreakerConfig): Effect.Effect<CircuitBreaker> =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<CircuitState>(initialState)

    const now = (): number => Date.now()

    const getState = Ref.get(stateRef)

    const reset = Ref.set(stateRef, initialState)

    const recordSuccess = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      switch (state._tag) {
        case 'Closed':
          // Reset failure count on success
          yield* Ref.set(stateRef, CircuitState.Closed({
            failureCount: 0,
            lastFailureAt: Option.none(),
          }))
          break

        case 'HalfOpen':
          // Success in half-open: close the circuit
          yield* Effect.logInfo(`Circuit ${config.source}: HalfOpen → Closed (success)`)
          yield* recordTransition(config.source, 'half_open', 'closed')
          yield* Ref.set(stateRef, CircuitState.Closed({
            failureCount: 0,
            lastFailureAt: Option.none(),
          }))
          break

        case 'Open':
          // Should not happen - we don't execute in open state
          break
      }
    })

    const recordFailure = Effect.gen(function* () {
      const currentTime = now()
      const state = yield* Ref.get(stateRef)

      switch (state._tag) {
        case 'Closed': {
          // Check if we should reset failure count (outside window)
          const inWindow = Option.match(state.lastFailureAt, {
            onNone: () => true,
            onSome: (last) => currentTime - last < config.failureWindowMs,
          })

          const newFailureCount = inWindow ? state.failureCount + 1 : 1

          if (newFailureCount >= config.failureThreshold) {
            // Open the circuit
            yield* Effect.logWarning(`Circuit ${config.source}: Closed → Open (threshold ${config.failureThreshold} reached)`)
            yield* recordTransition(config.source, 'closed', 'open')
            yield* Ref.set(stateRef, CircuitState.Open({
              openedAt: currentTime,
              failureCount: newFailureCount,
            }))
          } else {
            yield* Ref.set(stateRef, CircuitState.Closed({
              failureCount: newFailureCount,
              lastFailureAt: Option.some(currentTime),
            }))
          }
          yield* recordFailureCount(config.source, newFailureCount)
          break
        }

        case 'HalfOpen':
          // Failure in half-open: back to open
          yield* Effect.logWarning(`Circuit ${config.source}: HalfOpen → Open (trial failed)`)
          yield* recordTransition(config.source, 'half_open', 'open')
          yield* Ref.set(stateRef, CircuitState.Open({
            openedAt: currentTime,
            failureCount: state.trialAttempts + 1,
          }))
          break

        case 'Open':
          // Already open, just update the timestamp
          yield* Ref.set(stateRef, CircuitState.Open({
            openedAt: currentTime,
            failureCount: state.failureCount + 1,
          }))
          break
      }
    })

    const execute = <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ): Effect.Effect<A, E | CircuitOpenError, R> =>
      Effect.gen(function* () {
        const currentTime = now()
        const state = yield* Ref.get(stateRef)

        switch (state._tag) {
          case 'Closed':
            // Execute normally, track failures
            return yield* effect.pipe(
              Effect.tap(() => recordSuccess),
              Effect.tapError(() => recordFailure)
            )

          case 'Open': {
            // Check if cooldown has passed
            const elapsed = currentTime - state.openedAt
            if (elapsed >= config.cooldownMs) {
              // Transition to half-open and try
              yield* Effect.logInfo(`Circuit ${config.source}: Open → HalfOpen (cooldown ${config.cooldownMs}ms elapsed)`)
              yield* recordTransition(config.source, 'open', 'half_open')
              yield* Ref.set(stateRef, CircuitState.HalfOpen({
                openedAt: state.openedAt,
                trialAttempts: 0,
              }))
              // Execute trial request
              return yield* effect.pipe(
                Effect.tap(() => recordSuccess),
                Effect.tapError(() => recordFailure)
              )
            }

            // Circuit is open, reject request
            yield* recordRejection(config.source)
            return yield* Effect.fail(
              new CircuitOpenError({
                source: config.source,
                openedAt: state.openedAt,
                cooldownMs: config.cooldownMs - elapsed,
                message: `Circuit breaker is open for ${config.source}. Try again in ${Math.ceil((config.cooldownMs - elapsed) / 1000)}s`,
              })
            )
          }

          case 'HalfOpen': {
            // Already in half-open, allow this request as trial
            yield* Ref.update(stateRef, (s) =>
              s._tag === 'HalfOpen'
                ? CircuitState.HalfOpen({ ...s, trialAttempts: s.trialAttempts + 1 })
                : s
            )
            return yield* effect.pipe(
              Effect.tap(() => recordSuccess),
              Effect.tapError(() => recordFailure)
            )
          }
        }
      })

    return {
      execute,
      getState,
      reset,
      config,
    }
  })

// =============================================================================
// Circuit Breaker Service (All Sources)
// =============================================================================

/**
 * Collection of circuit breakers for all API sources.
 */
export interface CircuitBreakers {
  readonly opensky: CircuitBreaker
  readonly overpass: CircuitBreaker
  readonly adsbLol: CircuitBreaker
  readonly planet: CircuitBreaker
  readonly sentinel: CircuitBreaker
  readonly openMeteo: CircuitBreaker
}

/**
 * Service tag for accessing circuit breakers.
 */
export class CircuitBreakersService extends Context.Tag('CircuitBreakers')<
  CircuitBreakersService,
  CircuitBreakers
>() {}

/**
 * Live layer providing circuit breakers for all API sources.
 */
export const CircuitBreakersLive: Layer.Layer<CircuitBreakersService> = Layer.effect(
  CircuitBreakersService,
  Effect.gen(function* () {
    const opensky = yield* make(CircuitBreakerConfigs.opensky)
    const overpass = yield* make(CircuitBreakerConfigs.overpass)
    const adsbLol = yield* make(CircuitBreakerConfigs.adsbLol)
    const planet = yield* make(CircuitBreakerConfigs.planet)
    const sentinel = yield* make(CircuitBreakerConfigs.sentinel)
    const openMeteo = yield* make(CircuitBreakerConfigs.openMeteo)

    return {
      opensky,
      overpass,
      adsbLol,
      planet,
      sentinel,
      openMeteo,
    }
  })
)

// =============================================================================
// Convenience Helpers
// =============================================================================

/**
 * Get the circuit breaker for a specific API source.
 */
export const getCircuitBreaker = (
  source: keyof CircuitBreakers
): Effect.Effect<CircuitBreaker, never, CircuitBreakersService> =>
  Effect.map(CircuitBreakersService, (breakers) => breakers[source])

/**
 * Execute an effect with circuit breaker protection.
 */
export const withCircuitBreaker = <A, E, R>(
  source: keyof CircuitBreakers,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | CircuitOpenError, R | CircuitBreakersService> =>
  Effect.gen(function* () {
    const breaker = yield* getCircuitBreaker(source)
    return yield* breaker.execute(effect)
  })

/**
 * Get the state of all circuit breakers (for monitoring).
 */
export const getAllStates = Effect.gen(function* () {
  const breakers = yield* CircuitBreakersService
  const [opensky, overpass, adsbLol, planet, sentinel, openMeteo] = yield* Effect.all([
    breakers.opensky.getState,
    breakers.overpass.getState,
    breakers.adsbLol.getState,
    breakers.planet.getState,
    breakers.sentinel.getState,
    breakers.openMeteo.getState,
  ])
  return { opensky, overpass, adsbLol, planet, sentinel, openMeteo }
})

/**
 * Reset all circuit breakers (for testing/admin).
 */
export const resetAll = Effect.gen(function* () {
  const breakers = yield* CircuitBreakersService
  yield* Effect.all([
    breakers.opensky.reset,
    breakers.overpass.reset,
    breakers.adsbLol.reset,
    breakers.planet.reset,
    breakers.sentinel.reset,
    breakers.openMeteo.reset,
  ])
})

// =============================================================================
// Error Type Guards
// =============================================================================

/**
 * Check if an error should trip the circuit breaker.
 *
 * Excludes:
 * - Rate limit errors (handled by rate limiter)
 * - Timeout errors (may be transient network issues)
 * - Client errors (4xx except 429)
 */
export const shouldTripCircuit = (
  error: ExternalApiError | RateLimitError | TimeoutError | CircuitOpenError
): boolean => {
  switch (error._tag) {
    case 'ExternalApiError':
      // Only trip on server errors or explicit retryable failures
      return error.statusCode >= 500 || error.retryable
    case 'RateLimitError':
      // Don't trip on rate limits - the rate limiter handles these
      return false
    case 'TimeoutError':
      // Consider timeouts as potential circuit trip triggers
      return true
    case 'CircuitOpenError':
      // Don't re-trip if already open
      return false
    default:
      return false
  }
}
