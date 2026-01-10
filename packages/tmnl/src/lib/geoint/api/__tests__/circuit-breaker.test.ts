/**
 * Circuit Breaker Tests
 *
 * Comprehensive tests for the circuit breaker pattern implementation.
 * Tests all state transitions: Closed → Open → HalfOpen → Closed
 *
 * @see beads:tmnl-4zjo7 Circuit breaker for API resilience
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, Ref, Option, TestClock, TestContext, Duration, Layer, Fiber } from 'effect'
import {
  make,
  CircuitState,
  CircuitOpenError,
  CircuitBreakersLive,
  CircuitBreakersService,
  getCircuitBreaker,
  withCircuitBreaker,
  resetAll,
  getAllStates,
  shouldTripCircuit,
  initialState,
  type CircuitBreakerConfig,
} from '../circuit-breaker'
import { ExternalApiError, RateLimitError, TimeoutError } from '../ExternalApiClient'

// =============================================================================
// Test Fixtures
// =============================================================================

const testConfig: CircuitBreakerConfig = {
  source: 'test',
  failureThreshold: 3,
  failureWindowMs: 60_000,
  cooldownMs: 30_000,
  resetTimeoutMs: 60_000,
}

const fastConfig: CircuitBreakerConfig = {
  source: 'fast-test',
  failureThreshold: 2,
  failureWindowMs: 5_000,
  cooldownMs: 1_000,
  resetTimeoutMs: 2_000,
}

const successEffect = Effect.succeed('success')
const failureEffect = Effect.fail(new Error('test error'))
const apiError = new ExternalApiError({
  source: 'test',
  statusCode: 500,
  message: 'Server Error',
  retryable: false,
})
const apiErrorEffect = Effect.fail(apiError)
const rateLimitError = new RateLimitError({
  source: 'test',
  retryAfterSeconds: 60,
  message: 'Rate limited',
})
const timeoutError = new TimeoutError({
  source: 'test',
  timeoutMs: 30000,
  message: 'Request timeout',
})

// =============================================================================
// State Type Tests
// =============================================================================

describe('CircuitState', () => {
  it('creates Closed state', () => {
    const state = CircuitState.Closed({ failureCount: 0, lastFailureAt: Option.none() })
    expect(state._tag).toBe('Closed')
    expect(state.failureCount).toBe(0)
  })

  it('creates Open state', () => {
    const state = CircuitState.Open({ openedAt: Date.now(), failureCount: 3 })
    expect(state._tag).toBe('Open')
    expect(state.failureCount).toBe(3)
  })

  it('creates HalfOpen state', () => {
    const state = CircuitState.HalfOpen({ openedAt: Date.now(), trialAttempts: 0 })
    expect(state._tag).toBe('HalfOpen')
    expect(state.trialAttempts).toBe(0)
  })

  it('has correct initial state', () => {
    expect(initialState._tag).toBe('Closed')
    expect(initialState.failureCount).toBe(0)
  })
})

// =============================================================================
// Circuit Breaker Instance Tests
// =============================================================================

describe('CircuitBreaker make()', () => {
  describe('Closed State', () => {
    it('allows successful requests in closed state', async () => {
      const program = Effect.gen(function* () {
        const breaker = yield* make(testConfig)
        const result = yield* breaker.execute(successEffect)
        const state = yield* breaker.getState

        expect(result).toBe('success')
        expect(state._tag).toBe('Closed')
        expect(state.failureCount).toBe(0)
      })

      await Effect.runPromise(program)
    })

    it('increments failure count on errors', async () => {
      const program = Effect.gen(function* () {
        const breaker = yield* make(testConfig)

        // First failure
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        let state = yield* breaker.getState
        expect(state._tag).toBe('Closed')
        expect(state.failureCount).toBe(1)

        // Second failure
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        state = yield* breaker.getState
        expect(state._tag).toBe('Closed')
        expect(state.failureCount).toBe(2)
      })

      await Effect.runPromise(program)
    })

    it('resets failure count on success', async () => {
      const program = Effect.gen(function* () {
        const breaker = yield* make(testConfig)

        // Fail twice
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)

        let state = yield* breaker.getState
        expect(state.failureCount).toBe(2)

        // Success resets count
        yield* breaker.execute(successEffect)
        state = yield* breaker.getState
        expect(state._tag).toBe('Closed')
        expect(state.failureCount).toBe(0)
      })

      await Effect.runPromise(program)
    })

    it('opens circuit after threshold failures', async () => {
      const program = Effect.gen(function* () {
        const breaker = yield* make(testConfig)

        // Fail 3 times (threshold)
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)

        const state = yield* breaker.getState
        expect(state._tag).toBe('Open')
        expect(state.failureCount).toBe(3)
      })

      await Effect.runPromise(program)
    })
  })

  describe('Open State', () => {
    it('rejects requests when circuit is open', async () => {
      const program = Effect.gen(function* () {
        const breaker = yield* make(testConfig)

        // Open the circuit
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)

        // Next request should fail with CircuitOpenError
        const result = yield* breaker.execute(successEffect).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('CircuitOpenError')
          const error = result.left as CircuitOpenError
          expect(error.source).toBe('test')
        }
      })

      await Effect.runPromise(program)
    })

    it('fails fast without executing the effect', async () => {
      let executed = false
      const trackedEffect = Effect.sync(() => {
        executed = true
        return 'executed'
      })

      const program = Effect.gen(function* () {
        const breaker = yield* make(testConfig)

        // Open the circuit
        for (let i = 0; i < 3; i++) {
          yield* breaker.execute(failureEffect).pipe(Effect.either)
        }

        // Try to execute - should fail fast
        yield* breaker.execute(trackedEffect).pipe(Effect.either)

        expect(executed).toBe(false)
      })

      await Effect.runPromise(program)
    })
  })

  describe('Half-Open State', () => {
    it('transitions to half-open after cooldown', async () => {
      // Use a mock time to simulate cooldown
      const program = Effect.gen(function* () {
        const breaker = yield* make(fastConfig) // 1 second cooldown

        // Open the circuit
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)

        // Wait for cooldown (simulated by adjusting time perception)
        yield* Effect.sleep(Duration.millis(1100))

        // Next request should succeed (half-open transition)
        const result = yield* breaker.execute(successEffect).pipe(Effect.either)

        expect(result._tag).toBe('Right')
        if (result._tag === 'Right') {
          expect(result.right).toBe('success')
        }

        const state = yield* breaker.getState
        // Should be back to closed after success
        expect(state._tag).toBe('Closed')
      })

      await Effect.runPromise(program)
    })

    it('closes circuit on successful trial', async () => {
      const program = Effect.gen(function* () {
        const breaker = yield* make(fastConfig)

        // Open the circuit
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)

        // Wait for cooldown
        yield* Effect.sleep(Duration.millis(1100))

        // Successful trial
        yield* breaker.execute(successEffect)

        const state = yield* breaker.getState
        expect(state._tag).toBe('Closed')
        expect(state.failureCount).toBe(0)
      })

      await Effect.runPromise(program)
    })

    it('returns to open on failed trial', async () => {
      const program = Effect.gen(function* () {
        const breaker = yield* make(fastConfig)

        // Open the circuit
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)

        // Wait for cooldown
        yield* Effect.sleep(Duration.millis(1100))

        // Failed trial
        yield* breaker.execute(failureEffect).pipe(Effect.either)

        const state = yield* breaker.getState
        expect(state._tag).toBe('Open')
      })

      await Effect.runPromise(program)
    })
  })

  describe('Reset', () => {
    it('resets circuit to closed state', async () => {
      const program = Effect.gen(function* () {
        const breaker = yield* make(testConfig)

        // Open the circuit
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)
        yield* breaker.execute(failureEffect).pipe(Effect.either)

        let state = yield* breaker.getState
        expect(state._tag).toBe('Open')

        // Reset
        yield* breaker.reset
        state = yield* breaker.getState
        expect(state._tag).toBe('Closed')
        expect(state.failureCount).toBe(0)
      })

      await Effect.runPromise(program)
    })
  })
})

// =============================================================================
// Error Type Guards Tests
// =============================================================================

describe('shouldTripCircuit', () => {
  it('trips on server errors (5xx)', () => {
    const error = new ExternalApiError({
      source: 'test',
      statusCode: 503,
      message: 'Service Unavailable',
      retryable: false,
    })
    expect(shouldTripCircuit(error)).toBe(true)
  })

  it('trips on retryable errors', () => {
    const error = new ExternalApiError({
      source: 'test',
      statusCode: 400,
      message: 'Bad Request',
      retryable: true,
    })
    expect(shouldTripCircuit(error)).toBe(true)
  })

  it('does not trip on client errors (4xx non-retryable)', () => {
    const error = new ExternalApiError({
      source: 'test',
      statusCode: 404,
      message: 'Not Found',
      retryable: false,
    })
    expect(shouldTripCircuit(error)).toBe(false)
  })

  it('does not trip on rate limit errors', () => {
    expect(shouldTripCircuit(rateLimitError)).toBe(false)
  })

  it('trips on timeout errors', () => {
    expect(shouldTripCircuit(timeoutError)).toBe(true)
  })

  it('does not trip on CircuitOpenError', () => {
    const error = new CircuitOpenError({
      source: 'test',
      openedAt: Date.now(),
      cooldownMs: 30000,
      message: 'Circuit open',
    })
    expect(shouldTripCircuit(error)).toBe(false)
  })
})

// =============================================================================
// Service Layer Tests
// =============================================================================

describe('CircuitBreakersService', () => {
  it('provides all circuit breakers', async () => {
    const program = Effect.gen(function* () {
      const breakers = yield* CircuitBreakersService

      expect(breakers.opensky).toBeDefined()
      expect(breakers.overpass).toBeDefined()
      expect(breakers.adsbLol).toBeDefined()
      expect(breakers.planet).toBeDefined()
      expect(breakers.sentinel).toBeDefined()
      expect(breakers.openMeteo).toBeDefined()
    }).pipe(Effect.provide(CircuitBreakersLive))

    await Effect.runPromise(program)
  })

  it('getAllStates returns states for all breakers', async () => {
    const program = Effect.gen(function* () {
      const states = yield* getAllStates

      expect(states.opensky._tag).toBe('Closed')
      expect(states.overpass._tag).toBe('Closed')
      expect(states.adsbLol._tag).toBe('Closed')
      expect(states.planet._tag).toBe('Closed')
      expect(states.sentinel._tag).toBe('Closed')
      expect(states.openMeteo._tag).toBe('Closed')
    }).pipe(Effect.provide(CircuitBreakersLive))

    await Effect.runPromise(program)
  })

  it('resetAll resets all circuit breakers', async () => {
    const program = Effect.gen(function* () {
      const breakers = yield* CircuitBreakersService

      // Open one circuit
      yield* breakers.opensky.execute(failureEffect).pipe(Effect.either)
      yield* breakers.opensky.execute(failureEffect).pipe(Effect.either)
      yield* breakers.opensky.execute(failureEffect).pipe(Effect.either)
      yield* breakers.opensky.execute(failureEffect).pipe(Effect.either)
      yield* breakers.opensky.execute(failureEffect).pipe(Effect.either)

      let state = yield* breakers.opensky.getState
      expect(state._tag).toBe('Open')

      // Reset all
      yield* resetAll

      state = yield* breakers.opensky.getState
      expect(state._tag).toBe('Closed')
    }).pipe(Effect.provide(CircuitBreakersLive))

    await Effect.runPromise(program)
  })
})

// =============================================================================
// Convenience Helper Tests
// =============================================================================

describe('getCircuitBreaker', () => {
  it('returns the correct circuit breaker', async () => {
    const program = Effect.gen(function* () {
      const breaker = yield* getCircuitBreaker('opensky')
      expect(breaker.config.source).toBe('opensky')
    }).pipe(Effect.provide(CircuitBreakersLive))

    await Effect.runPromise(program)
  })
})

describe('withCircuitBreaker', () => {
  it('executes effect with circuit breaker protection', async () => {
    const program = Effect.gen(function* () {
      const result = yield* withCircuitBreaker('opensky', successEffect)
      expect(result).toBe('success')
    }).pipe(Effect.provide(CircuitBreakersLive))

    await Effect.runPromise(program)
  })

  it('propagates circuit open error', async () => {
    const program = Effect.gen(function* () {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        yield* withCircuitBreaker('opensky', failureEffect).pipe(Effect.either)
      }

      // Next request should fail with CircuitOpenError
      const result = yield* withCircuitBreaker('opensky', successEffect).pipe(Effect.either)

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('CircuitOpenError')
      }
    }).pipe(Effect.provide(CircuitBreakersLive))

    await Effect.runPromise(program)
  })
})

// =============================================================================
// Configuration Tests
// =============================================================================

describe('Circuit Breaker Configurations', () => {
  it('opensky has correct configuration', async () => {
    const program = Effect.gen(function* () {
      const breaker = yield* getCircuitBreaker('opensky')
      expect(breaker.config.failureThreshold).toBe(5)
      expect(breaker.config.cooldownMs).toBe(30_000)
    }).pipe(Effect.provide(CircuitBreakersLive))

    await Effect.runPromise(program)
  })

  it('overpass has higher threshold and longer cooldown', async () => {
    const program = Effect.gen(function* () {
      const breaker = yield* getCircuitBreaker('overpass')
      expect(breaker.config.failureThreshold).toBe(3)
      expect(breaker.config.cooldownMs).toBe(60_000) // Longer due to slower API
    }).pipe(Effect.provide(CircuitBreakersLive))

    await Effect.runPromise(program)
  })
})

// =============================================================================
// Failure Window Tests
// =============================================================================

describe('Failure Window', () => {
  it('resets failure count when outside window', async () => {
    // This test simulates failures outside the failure window
    // The failure window is used to prevent old failures from counting
    const program = Effect.gen(function* () {
      const breaker = yield* make({
        ...fastConfig,
        failureWindowMs: 100, // Very short window for testing
      })

      // First failure
      yield* breaker.execute(failureEffect).pipe(Effect.either)
      let state = yield* breaker.getState
      expect(state.failureCount).toBe(1)

      // Wait longer than failure window
      yield* Effect.sleep(Duration.millis(150))

      // Second failure should reset count (outside window)
      yield* breaker.execute(failureEffect).pipe(Effect.either)
      state = yield* breaker.getState

      // Should be 1 because the old failure was outside the window
      expect(state.failureCount).toBe(1)
    })

    await Effect.runPromise(program)
  })
})
