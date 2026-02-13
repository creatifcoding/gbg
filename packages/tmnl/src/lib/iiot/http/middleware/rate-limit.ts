/**
 * IIoT Rate Limiting Middleware
 *
 * Token bucket rate limiter using HttpApiMiddleware.Tag for declarative
 * integration with the HttpApi framework — same pattern as auth middleware.
 *
 * The middleware is declared at the API level via `.middleware(IIoTRateLimitMiddleware)`
 * on IIoTApi. The framework calls the middleware Effect on every request.
 * If the effect fails with IIoTRateLimitExceeded, the framework auto-returns 429.
 * If the effect succeeds (void), the request passes through.
 *
 * Token Bucket Algorithm:
 *   Each client gets a bucket with { count, windowStart }.
 *   On each request:
 *     1. If windowStart + windowMs <= now, reset bucket (new window)
 *     2. If count >= maxRequests, fail with IIoTRateLimitExceeded (429)
 *     3. Otherwise, increment count and succeed (void)
 *
 * Two modes:
 * - **Enabled** (IIoTRateLimitEnabledLayer): Enforces per-client rate limiting.
 * - **Disabled** (IIoTRateLimitDisabledLayer): Passes all requests through.
 *
 * @module @gbg/tmnl/iiot/http/middleware/rate-limit
 */

import { Effect, Layer, Ref, Clock, Schema } from 'effect'
import {
  HttpApiMiddleware,
  HttpApiSchema,
  HttpServerRequest,
} from '@effect/platform'

// =============================================================================
// Error Type
// =============================================================================

/**
 * Rate limit exceeded error with 429 HTTP status annotation.
 *
 * The framework automatically converts this to a 429 response
 * when the middleware Effect fails with this error.
 */
export class IIoTRateLimitExceeded extends Schema.TaggedError<IIoTRateLimitExceeded>()(
  'IIoTRateLimitExceeded',
  {
    message: Schema.String,
    retryAfter: Schema.Number,
  },
  HttpApiSchema.annotations({ status: 429 }),
) {}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Rate limit configuration shape.
 */
export interface RateLimitConfigShape {
  /** Maximum requests per window */
  readonly maxRequests: number
  /** Window duration in milliseconds */
  readonly windowMs: number
}

// =============================================================================
// Bucket Types
// =============================================================================

/**
 * Per-client bucket entry.
 */
export interface RateLimitBucket {
  /** Number of requests in the current window */
  readonly count: number
  /** Timestamp (ms) when the current window started */
  readonly windowStart: number
}

// =============================================================================
// Middleware Tag (HttpApiMiddleware — no security, pure interception)
// =============================================================================

/**
 * IIoT Rate Limit Middleware tag.
 *
 * Uses HttpApiMiddleware.Tag WITHOUT security — the middleware runs on
 * every request, checks the token bucket, and either:
 * - Succeeds (void) → request passes to next middleware/handler
 * - Fails (IIoTRateLimitExceeded) → framework returns 429
 */
export class IIoTRateLimitMiddleware extends HttpApiMiddleware.Tag<IIoTRateLimitMiddleware>()(
  'iiot/http/IIoTRateLimitMiddleware',
  {
    failure: IIoTRateLimitExceeded,
  },
) {}

// =============================================================================
// Client Key Extraction
// =============================================================================

/**
 * Extract a client identifier from the request.
 *
 * Priority:
 * 1. X-Forwarded-For header (first IP in chain)
 * 2. X-Real-IP header
 * 3. Fallback to 'unknown'
 */
const extractClientKey = (request: HttpServerRequest.HttpServerRequest): string => {
  const xff = request.headers['x-forwarded-for']
  if (xff) {
    return xff.split(',')[0].trim()
  }

  const xri = request.headers['x-real-ip']
  if (xri) {
    return xri.trim()
  }

  return 'unknown'
}

// =============================================================================
// Middleware Implementations
// =============================================================================

/**
 * Enabled rate limit layer.
 *
 * Creates a per-process Ref<Map<string, Bucket>> at layer construction,
 * then returns a per-request Effect that atomically checks and updates
 * the bucket for each client.
 *
 * @param config - Rate limit configuration
 */
export const IIoTRateLimitEnabledLayer = (
  config: RateLimitConfigShape,
): Layer.Layer<IIoTRateLimitMiddleware> =>
  Layer.effect(
    IIoTRateLimitMiddleware,
    Effect.gen(function* () {
      // One Ref per process — created when the layer is built
      const buckets = yield* Ref.make(new Map<string, RateLimitBucket>())

      // Per-request middleware effect
      return Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const key = extractClientKey(request)
        const now = yield* Clock.currentTimeMillis

        // Atomically check-and-update the bucket
        const result = yield* Ref.modify(buckets, (map): [
          { readonly _tag: 'allowed' } | { readonly _tag: 'limited'; readonly retryAfterMs: number },
          Map<string, RateLimitBucket>,
        ] => {
          const existing = map.get(key)
          const newMap = new Map(map)

          // Case 1: No bucket or expired window — start fresh
          if (!existing || existing.windowStart + config.windowMs <= now) {
            newMap.set(key, { count: 1, windowStart: now })
            return [{ _tag: 'allowed' }, newMap]
          }

          // Case 2: At or over limit
          if (existing.count >= config.maxRequests) {
            const elapsed = now - existing.windowStart
            const retryAfterMs = config.windowMs - elapsed
            return [
              { _tag: 'limited', retryAfterMs: Math.max(0, retryAfterMs) },
              newMap,
            ]
          }

          // Case 3: Under limit — increment
          newMap.set(key, { ...existing, count: existing.count + 1 })
          return [{ _tag: 'allowed' }, newMap]
        })

        if (result._tag === 'limited') {
          return yield* Effect.fail(new IIoTRateLimitExceeded({
            message: 'Too Many Requests',
            retryAfter: Math.ceil(result.retryAfterMs / 1000),
          }))
        }
        // void — request passes through
      })
    }),
  )

/**
 * Disabled rate limit layer (passthrough).
 *
 * All requests pass through without rate limiting.
 * Used for development, testing, and backward compatibility.
 */
export const IIoTRateLimitDisabledLayer: Layer.Layer<IIoTRateLimitMiddleware> =
  Layer.succeed(IIoTRateLimitMiddleware, Effect.void)
