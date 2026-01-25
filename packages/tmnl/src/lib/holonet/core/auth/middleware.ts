/**
 * Holonet Authorization Middleware
 *
 * Effect HttpApiMiddleware.Tag implementation for JWT-based authentication.
 * Integrates HolonetAuthService with Effect's HTTP API framework.
 *
 * @module holonet/core/auth/middleware
 */

import {
  Context,
  Effect,
  Layer,
  Redacted,
  Schema,
} from 'effect';
import {
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
} from '@effect/platform';
import type { HolonetClaims } from './schemas';
import { HolonetAuthService } from './HolonetAuthService';

// =============================================================================
// Error Types with HTTP Status Annotations
// =============================================================================

/**
 * Unauthorized error - 401 status
 */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  'Unauthorized',
  {
    message: Schema.String,
    code: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 401 })
) {}

/**
 * Forbidden error - 403 status
 * Used when authenticated but lacking permissions
 */
export class Forbidden extends Schema.TaggedError<Forbidden>()(
  'Forbidden',
  {
    message: Schema.String,
    operation: Schema.optional(Schema.String),
    streamId: Schema.optional(Schema.String),
    requiredPermission: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 403 })
) {}

// =============================================================================
// Context Tags
// =============================================================================

/**
 * Context tag for the current authenticated user's claims
 * Provided by AuthorizationMiddleware after successful authentication
 */
export class CurrentHolonetClaims extends Context.Tag('holonet/core/CurrentHolonetClaims')<
  CurrentHolonetClaims,
  HolonetClaims
>() {}

/**
 * Context tag for optional claims (when auth is not required)
 * Contains claims if authenticated, or undefined if anonymous
 */
export class OptionalHolonetClaims extends Context.Tag('holonet/core/OptionalHolonetClaims')<
  OptionalHolonetClaims,
  HolonetClaims | undefined
>() {}

// =============================================================================
// Authorization Middleware
// =============================================================================

/**
 * Authorization middleware for durable-streams API
 *
 * Uses HttpApiSecurity.bearer for token extraction and HolonetAuthService
 * for JWT validation. Provides CurrentHolonetClaims to downstream handlers.
 *
 * @example
 * ```typescript
 * // Define API with authorization
 * const api = HttpApi.make('durable-streams')
 *   .add(
 *     HttpApiGroup.make('streams')
 *       .add(
 *         HttpApiEndpoint.get('read', '/stream/:id')
 *           .middleware(AuthorizationMiddleware)
 *       )
 *   )
 *
 * // In handler, access claims:
 * const claims = yield* CurrentHolonetClaims
 * ```
 */
export class AuthorizationMiddleware extends HttpApiMiddleware.Tag<AuthorizationMiddleware>()(
  'holonet/core/AuthorizationMiddleware',
  {
    failure: Unauthorized,
    provides: CurrentHolonetClaims,
    security: {
      bearer: HttpApiSecurity.bearer,
    },
  }
) {}

/**
 * Optional authorization middleware
 *
 * Same as AuthorizationMiddleware but allows anonymous access.
 * Provides OptionalHolonetClaims (undefined for anonymous).
 */
export class OptionalAuthorizationMiddleware extends HttpApiMiddleware.Tag<OptionalAuthorizationMiddleware>()(
  'holonet/core/OptionalAuthorizationMiddleware',
  {
    failure: Unauthorized,
    provides: OptionalHolonetClaims,
    security: {
      bearer: HttpApiSecurity.bearer,
    },
    optional: true,
  }
) {}

// =============================================================================
// Middleware Implementations
// =============================================================================

/**
 * Live implementation of AuthorizationMiddleware
 *
 * Requires HolonetAuthService in the layer context.
 */
export const AuthorizationMiddlewareLive: Layer.Layer<
  AuthorizationMiddleware,
  never,
  HolonetAuthService
> = Layer.effect(
  AuthorizationMiddleware,
  Effect.gen(function* () {
    const authService = yield* HolonetAuthService;

    yield* Effect.logDebug('AuthorizationMiddleware initialized');

    return {
      bearer: (bearerToken: Redacted.Redacted<string>) =>
        Effect.gen(function* () {
          const token = Redacted.value(bearerToken);

          const result = yield* authService.validateToken(token).pipe(
            Effect.mapError((error) => {
              switch (error._tag) {
                case 'JwtExpiredError':
                  return new Unauthorized({
                    message: 'Token has expired',
                    code: 'token_expired',
                  });
                case 'JwtNotYetValidError':
                  return new Unauthorized({
                    message: 'Token is not yet valid',
                    code: 'token_not_valid_yet',
                  });
                case 'JwtValidationError':
                  return new Unauthorized({
                    message: error.message,
                    code: error.code,
                  });
              }
            })
          );

          yield* Effect.logDebug(`Authentication successful: ${result.sub ?? 'unknown'}`);

          return result;
        }),
    };
  })
);

/**
 * Live implementation of OptionalAuthorizationMiddleware
 *
 * Allows anonymous access when no token is provided.
 */
export const OptionalAuthorizationMiddlewareLive: Layer.Layer<
  OptionalAuthorizationMiddleware,
  never,
  HolonetAuthService
> = Layer.effect(
  OptionalAuthorizationMiddleware,
  Effect.gen(function* () {
    const authService = yield* HolonetAuthService;

    yield* Effect.logDebug('OptionalAuthorizationMiddleware initialized');

    return {
      bearer: (bearerToken: Redacted.Redacted<string> | undefined) =>
        Effect.gen(function* () {
          if (!bearerToken) {
            yield* Effect.logDebug('Anonymous access - no token provided');
            return undefined;
          }

          const token = Redacted.value(bearerToken);

          const result = yield* authService.validateToken(token).pipe(
            Effect.mapError((error) => {
              switch (error._tag) {
                case 'JwtExpiredError':
                  return new Unauthorized({
                    message: 'Token has expired',
                    code: 'token_expired',
                  });
                case 'JwtNotYetValidError':
                  return new Unauthorized({
                    message: 'Token is not yet valid',
                    code: 'token_not_valid_yet',
                  });
                case 'JwtValidationError':
                  return new Unauthorized({
                    message: error.message,
                    code: error.code,
                  });
              }
            })
          );

          yield* Effect.logDebug(`Authentication successful: ${result.sub ?? 'unknown'}`);

          return result;
        }),
    };
  })
);

// =============================================================================
// Convenience Layers
// =============================================================================

/**
 * Combined layer for authorization middleware with default auth service
 */
export const AuthorizationLive = AuthorizationMiddlewareLive.pipe(
  Layer.provide(HolonetAuthService.Default)
);

/**
 * Create authorization layer with custom secret
 */
export const makeAuthorizationLayer = (secret: string) =>
  AuthorizationMiddlewareLive.pipe(
    Layer.provide(HolonetAuthService.withSecret(secret))
  );

/**
 * Create authorization layer with JWKS endpoint
 */
export const makeJwksAuthorizationLayer = (jwksUrl: string) =>
  AuthorizationMiddlewareLive.pipe(
    Layer.provide(HolonetAuthService.withJwks(jwksUrl))
  );
