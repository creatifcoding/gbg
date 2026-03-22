/**
 * Rate Limiting Service for External APIs
 *
 * Uses Effect's built-in RateLimiter to enforce per-source request limits.
 * Each API source has its own rate limiter configured based on their
 * respective API rate limit policies.
 */

import { Context, Duration, Effect, Layer, RateLimiter } from 'effect'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Collection of rate limiters for each external API source
 */
export interface ApiRateLimiters {
  /** OpenSky Network - 10 requests/minute */
  readonly opensky: RateLimiter.RateLimiter
  /** Overpass API - 20 requests/minute */
  readonly overpass: RateLimiter.RateLimiter
  /** ADS-B Exchange (lol) - 60 requests/minute */
  readonly adsbLol: RateLimiter.RateLimiter
  /** Planet Labs - 30 requests/minute */
  readonly planet: RateLimiter.RateLimiter
  /** Sentinel Hub - 30 requests/minute */
  readonly sentinel: RateLimiter.RateLimiter
  /** Open-Meteo - 60 requests/minute */
  readonly openMeteo: RateLimiter.RateLimiter
}

// ---------------------------------------------------------------------------
// Service Tag
// ---------------------------------------------------------------------------

/**
 * Service tag for accessing API rate limiters
 */
export class ApiRateLimitersService extends Context.Tag('ApiRateLimiters')<
  ApiRateLimitersService,
  ApiRateLimiters
>() {}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

/**
 * Live layer providing rate limiters for all external API sources.
 * Scoped to ensure proper cleanup of rate limiter resources.
 */
export const ApiRateLimitersLive: Layer.Layer<ApiRateLimitersService> = Layer.scoped(
  ApiRateLimitersService,
  Effect.gen(function* () {
    const oneMinute = Duration.minutes(1)

    // Create rate limiters for each API source
    const opensky = yield* RateLimiter.make({ limit: 10, interval: oneMinute })
    const overpass = yield* RateLimiter.make({ limit: 20, interval: oneMinute })
    const adsbLol = yield* RateLimiter.make({ limit: 60, interval: oneMinute })
    const planet = yield* RateLimiter.make({ limit: 30, interval: oneMinute })
    const sentinel = yield* RateLimiter.make({ limit: 30, interval: oneMinute })
    const openMeteo = yield* RateLimiter.make({ limit: 60, interval: oneMinute })

    return {
      opensky,
      overpass,
      adsbLol,
      planet,
      sentinel,
      openMeteo,
    }
  }),
)

// ---------------------------------------------------------------------------
// Convenience Accessors
// ---------------------------------------------------------------------------

/**
 * Get the rate limiter for a specific API source
 */
export const getRateLimiter = (
  source: keyof ApiRateLimiters,
): Effect.Effect<RateLimiter.RateLimiter, never, ApiRateLimitersService> =>
  Effect.map(ApiRateLimitersService, (limiters) => limiters[source])

/**
 * Execute an effect with rate limiting for a specific API source.
 * Waits for a token before executing the effect.
 */
export const withRateLimit = <A, E, R>(
  source: keyof ApiRateLimiters,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | ApiRateLimitersService> =>
  Effect.gen(function* () {
    const limiter = yield* getRateLimiter(source)
    return yield* limiter(effect)
  })
