/**
 * Rate Limiting Middleware Unit Tests
 *
 * Tests the IIoTRateLimitMiddleware using HttpApiMiddleware.Tag pattern.
 * Validates layer construction, error type, and disabled passthrough.
 *
 * For full HTTP round-trip tests with burst scenarios, per-client isolation,
 * and window reset, see integration/rate-limit-middleware.test.ts.
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, Schema } from 'effect'
import {
  IIoTRateLimitMiddleware,
  IIoTRateLimitEnabledLayer,
  IIoTRateLimitDisabledLayer,
  IIoTRateLimitExceeded,
  type RateLimitConfigShape,
} from '../../middleware/rate-limit'

// =============================================================================
// Layer Construction
// =============================================================================

describe('Rate Limit Middleware — Layer construction', () => {
  it('IIoTRateLimitEnabledLayer returns a valid Layer', () => {
    const layer = IIoTRateLimitEnabledLayer({ maxRequests: 10, windowMs: 60_000 })
    expect(Layer.isLayer(layer)).toBe(true)
  })

  it('IIoTRateLimitDisabledLayer is a valid Layer', () => {
    expect(Layer.isLayer(IIoTRateLimitDisabledLayer)).toBe(true)
  })

  it('IIoTRateLimitEnabledLayer accepts different config values', () => {
    const configs: RateLimitConfigShape[] = [
      { maxRequests: 1, windowMs: 1_000 },
      { maxRequests: 100, windowMs: 60_000 },
      { maxRequests: 10_000, windowMs: 3_600_000 },
    ]
    for (const config of configs) {
      const layer = IIoTRateLimitEnabledLayer(config)
      expect(Layer.isLayer(layer)).toBe(true)
    }
  })
})

// =============================================================================
// Error Type
// =============================================================================

describe('Rate Limit Middleware — IIoTRateLimitExceeded', () => {
  it('IIoTRateLimitExceeded has _tag "IIoTRateLimitExceeded"', () => {
    const err = new IIoTRateLimitExceeded({
      message: 'Too Many Requests',
      retryAfter: 30,
    })
    expect(err._tag).toBe('IIoTRateLimitExceeded')
  })

  it('IIoTRateLimitExceeded carries message and retryAfter fields', () => {
    const err = new IIoTRateLimitExceeded({
      message: 'Rate limit exceeded',
      retryAfter: 15,
    })
    expect(err.message).toBe('Rate limit exceeded')
    expect(err.retryAfter).toBe(15)
  })

  it('IIoTRateLimitExceeded encodes/decodes via Schema', () => {
    const err = new IIoTRateLimitExceeded({
      message: 'Too Many Requests',
      retryAfter: 42,
    })
    // Schema.TaggedError produces a Schema-backed class
    const encoded = Schema.encodeSync(IIoTRateLimitExceeded)(err)
    expect(encoded._tag).toBe('IIoTRateLimitExceeded')
    expect(encoded.retryAfter).toBe(42)

    const decoded = Schema.decodeSync(IIoTRateLimitExceeded)(encoded)
    expect(decoded._tag).toBe('IIoTRateLimitExceeded')
    expect(decoded.retryAfter).toBe(42)
  })
})

// =============================================================================
// Middleware Tag
// =============================================================================

describe('Rate Limit Middleware — IIoTRateLimitMiddleware Tag', () => {
  it('IIoTRateLimitMiddleware is a Context.Tag', () => {
    // HttpApiMiddleware.Tag produces a Context.Tag-like class
    expect(IIoTRateLimitMiddleware.key).toBe('iiot/http/IIoTRateLimitMiddleware')
  })
})

// =============================================================================
// Disabled Layer — Effect-level verification
// =============================================================================

describe('Rate Limit Middleware — disabled layer', () => {
  it('disabled layer resolves middleware to Effect.void (passthrough)', async () => {
    // Build the layer and resolve the service
    const program = Effect.gen(function* () {
      const middleware = yield* IIoTRateLimitMiddleware
      // The middleware should be Effect.void — succeeds with void
      expect(Effect.isEffect(middleware)).toBe(true)
    })

    await Effect.runPromise(
      program.pipe(Effect.provide(IIoTRateLimitDisabledLayer)),
    )
  })
})
