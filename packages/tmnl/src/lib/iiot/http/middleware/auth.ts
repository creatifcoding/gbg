/**
 * IIoT Authentication Middleware
 *
 * Server-level HTTP middleware for Bearer token authentication.
 * Applied globally to all routes via HttpApiBuilder.serve().
 *
 * Two modes:
 * - **Enabled** (IIoTAuthBearerLayer): Validates JWT Bearer tokens using jose.
 *   Rejects unauthenticated requests with 401.
 * - **Disabled** (IIoTAuthDisabledLayer): Passes all requests through.
 *   Used for development and tests.
 *
 * CORS preflight (OPTIONS) requests always bypass auth.
 *
 * Architecture:
 * ```
 * HttpApiBuilder.serve(HttpMiddleware.logger)
 *   <- IIoTAuthMiddleware (this module)
 *   <- middlewareCors()
 *   <- ApiLive
 * ```
 *
 * Usage in server.ts:
 * ```typescript
 * import { IIoTAuthBearerLayer, IIoTAuthDisabledLayer } from './middleware/auth'
 *
 * // Development (no auth):
 * const server = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
 *   Layer.provide(IIoTAuthDisabledLayer),
 *   // ...
 * )
 *
 * // Production (Bearer auth):
 * const server = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
 *   Layer.provide(IIoTAuthBearerLayer('your-jwt-secret')),
 *   // ...
 * )
 * ```
 *
 * @module @gbg/tmnl/iiot/http/middleware/auth
 */

import { Context, Effect, Layer, Redacted, Schema } from 'effect'
import {
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from '@effect/platform'
import * as jose from 'jose'

// =============================================================================
// Error Types
// =============================================================================

/**
 * IIoT Unauthorized error with 401 HTTP status annotation.
 *
 * Returned when:
 * - No Authorization header present
 * - Token is expired
 * - Token signature is invalid
 * - Token is malformed
 */
export class IIoTUnauthorized extends Schema.TaggedError<IIoTUnauthorized>()(
  'IIoTUnauthorized',
  {
    message: Schema.String,
    code: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 401 }),
) {}

// =============================================================================
// Auth Config Service Tag
// =============================================================================

/**
 * Configuration for IIoT authentication.
 *
 * - `enabled: false` => all requests pass through (dev/test)
 * - `enabled: true` + `secret` => validates JWT with HMAC secret
 */
export interface IIoTAuthConfigShape {
  /** Whether auth is enabled */
  readonly enabled: boolean
  /** HMAC secret for JWT verification (HS256) */
  readonly secret?: string
  /** Clock tolerance in seconds (default: 60) */
  readonly clockTolerance?: number
}

export class IIoTAuthConfig extends Context.Tag('iiot/http/IIoTAuthConfig')<
  IIoTAuthConfig,
  IIoTAuthConfigShape
>() {}

// =============================================================================
// Middleware Tag (HttpApiMiddleware for type-level integration)
// =============================================================================

/**
 * IIoT Auth Middleware tag.
 *
 * Uses HttpApiMiddleware.Tag with bearer security so that
 * the HttpApi framework automatically extracts the Authorization
 * header and passes the Redacted token to the handler.
 */
export class IIoTAuthMiddleware extends HttpApiMiddleware.Tag<IIoTAuthMiddleware>()(
  'iiot/http/IIoTAuthMiddleware',
  {
    failure: IIoTUnauthorized,
    security: {
      bearer: HttpApiSecurity.bearer,
    },
  },
) {}

// =============================================================================
// Middleware Implementations
// =============================================================================

/**
 * Bearer token validation middleware layer.
 *
 * Validates JWT tokens using HMAC (HS256) with the provided secret.
 * Returns 401 for missing, expired, or invalid tokens.
 * CORS preflight (OPTIONS) requests bypass auth automatically
 * because the CORS middleware runs before this one in the layer stack.
 *
 * @param secret - HMAC secret for JWT verification
 * @param clockTolerance - Clock tolerance in seconds (default: 60)
 */
export const IIoTAuthBearerLayer = (
  secret: string,
  clockTolerance = 60,
): Layer.Layer<IIoTAuthMiddleware> =>
  Layer.succeed(
    IIoTAuthMiddleware,
    {
      bearer: (bearerToken: Redacted.Redacted<string>) =>
        Effect.gen(function* () {
          const rawToken = Redacted.value(bearerToken)
          const secretKey = new TextEncoder().encode(secret)

          const payload = yield* Effect.tryPromise({
            try: () =>
              jose.jwtVerify(rawToken, secretKey, {
                clockTolerance,
                algorithms: ['HS256'],
              }).then((result) => result.payload),
            catch: (error) => {
              if (error instanceof jose.errors.JWTExpired) {
                return new IIoTUnauthorized({
                  message: 'Token has expired',
                  code: 'token_expired',
                })
              }
              if (error instanceof jose.errors.JOSEError) {
                return new IIoTUnauthorized({
                  message: error.message,
                  code: 'invalid_token',
                })
              }
              return new IIoTUnauthorized({
                message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                code: 'auth_error',
              })
            },
          })

          yield* Effect.logDebug(`IIoT Auth: Authenticated ${payload.sub ?? 'unknown'}`)
        }),
    },
  )

/**
 * Auth disabled layer (passthrough).
 *
 * All requests pass through without authentication checks.
 * Used for development, testing, and backward compatibility.
 */
export const IIoTAuthDisabledLayer: Layer.Layer<IIoTAuthMiddleware> =
  Layer.succeed(
    IIoTAuthMiddleware,
    {
      bearer: (_bearerToken) => Effect.void,
    },
  )
