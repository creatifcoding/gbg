/**
 * Holonet Authentication Service
 *
 * JWT-based authentication service for durable-streams HTTP API.
 * Supports HMAC (HS*), RSA (RS*), ECDSA (ES*), and RSASSA-PSS (PS*) algorithms.
 *
 * @module holonet/core/auth/HolonetAuthService
 */

import { Context, Data, Effect, Layer, Schema, pipe } from 'effect';
import * as jose from 'jose';
import {
  type HolonetClaims,
  type HolonetAuthConfig,
  type StreamOperation,
  type AuthResult,
  HolonetClaims as HolonetClaimsSchema,
} from './schemas';
import { checkPermission, PermissionDeniedError } from './permissions';

// =============================================================================
// Error Types
// =============================================================================

/**
 * JWT validation failed
 */
export class JwtValidationError extends Data.TaggedError('JwtValidationError')<{
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * JWT expired
 */
export class JwtExpiredError extends Data.TaggedError('JwtExpiredError')<{
  readonly expiredAt: Date;
}> {}

/**
 * JWT not yet valid (nbf claim)
 */
export class JwtNotYetValidError extends Data.TaggedError('JwtNotYetValidError')<{
  readonly validFrom: Date;
}> {}

/**
 * Missing or malformed Authorization header
 */
export class MissingAuthHeaderError extends Data.TaggedError('MissingAuthHeaderError')<{
  readonly message: string;
}> {}

/**
 * Auth error union
 */
export type HolonetAuthError =
  | JwtValidationError
  | JwtExpiredError
  | JwtNotYetValidError
  | MissingAuthHeaderError
  | PermissionDeniedError;

// =============================================================================
// Validation Error Type
// =============================================================================

type ValidationError = JwtValidationError | JwtExpiredError | JwtNotYetValidError;

// =============================================================================
// Service Shape
// =============================================================================

/**
 * Holonet Authentication Service interface
 */
export interface HolonetAuthServiceShape {
  /**
   * Validate a JWT token and extract claims
   */
  readonly validateToken: (
    token: string
  ) => Effect.Effect<HolonetClaims, ValidationError>;

  /**
   * Extract token from Authorization header (Bearer scheme)
   */
  readonly extractToken: (
    authHeader: string | undefined
  ) => Effect.Effect<string, MissingAuthHeaderError>;

  /**
   * Validate Authorization header and extract claims
   * Combines extractToken + validateToken
   */
  readonly authenticate: (
    authHeader: string | undefined
  ) => Effect.Effect<AuthResult, never>;

  /**
   * Authorize an operation on a stream
   * Validates both authentication and permissions
   */
  readonly authorizeOperation: (
    authHeader: string | undefined,
    operation: StreamOperation,
    streamId: string
  ) => Effect.Effect<HolonetClaims, HolonetAuthError>;

  /**
   * Check if a claims object has permission for an operation
   * Does NOT validate the token - assumes already authenticated
   */
  readonly checkPermission: (
    claims: HolonetClaims,
    operation: StreamOperation,
    streamId: string
  ) => Effect.Effect<void, PermissionDeniedError>;

  /**
   * Get service configuration
   */
  readonly getConfig: () => HolonetAuthConfig;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Convert jose error to our error types
 */
const mapJoseError = (error: unknown): ValidationError => {
  if (error instanceof jose.errors.JWTExpired) {
    // JWTExpired.claim contains the exp value (as string in error)
    const expValue = error.payload?.exp;
    return new JwtExpiredError({
      expiredAt: new Date((typeof expValue === 'number' ? expValue : Date.now() / 1000) * 1000),
    });
  }

  if (error instanceof jose.errors.JWTClaimValidationFailed && error.claim === 'nbf') {
    return new JwtNotYetValidError({
      validFrom: new Date((error.payload?.nbf as number) * 1000),
    });
  }

  if (error instanceof jose.errors.JOSEError) {
    return new JwtValidationError({
      code: error.code || 'jose_error',
      message: error.message,
      cause: error,
    });
  }

  return new JwtValidationError({
    code: 'unknown',
    message: `JWT validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    cause: error,
  });
};

/**
 * Verify JWT with HMAC secret
 */
const DEFAULT_CLOCK_TOLERANCE = 60;

const verifyWithSecret = (
  token: string,
  secret: string,
  config: HolonetAuthConfig
): Effect.Effect<jose.JWTPayload, ValidationError> =>
  Effect.tryPromise({
    try: async () => {
      const secretKey = new TextEncoder().encode(secret);
      const result = await jose.jwtVerify(token, secretKey, {
        issuer: config.issuer,
        audience: config.audience as string | string[] | undefined,
        clockTolerance: config.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE,
        algorithms: config.algorithms as jose.JWTVerifyOptions['algorithms'],
      });
      return result.payload;
    },
    catch: mapJoseError,
  });

/**
 * Verify JWT with public key
 */
const verifyWithPublicKey = (
  token: string,
  publicKey: string,
  config: HolonetAuthConfig
): Effect.Effect<jose.JWTPayload, ValidationError> =>
  Effect.tryPromise({
    try: async () => {
      const key = await jose.importSPKI(publicKey, 'RS256');
      const result = await jose.jwtVerify(token, key, {
        issuer: config.issuer,
        audience: config.audience as string | string[] | undefined,
        clockTolerance: config.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE,
        algorithms: config.algorithms as jose.JWTVerifyOptions['algorithms'],
      });
      return result.payload;
    },
    catch: mapJoseError,
  });

/**
 * Verify JWT with JWKS endpoint
 */
const verifyWithJwks = (
  token: string,
  jwksUrl: string,
  config: HolonetAuthConfig
): Effect.Effect<jose.JWTPayload, ValidationError> =>
  Effect.tryPromise({
    try: async () => {
      const JWKS = jose.createRemoteJWKSet(new URL(jwksUrl));
      const result = await jose.jwtVerify(token, JWKS, {
        issuer: config.issuer,
        audience: config.audience as string | string[] | undefined,
        clockTolerance: config.clockTolerance ?? DEFAULT_CLOCK_TOLERANCE,
        algorithms: config.algorithms as jose.JWTVerifyOptions['algorithms'],
      });
      return result.payload;
    },
    catch: mapJoseError,
  });

/**
 * Decode JWT without verification (DANGEROUS - only for development)
 */
const decodeOnly = (token: string): Effect.Effect<jose.JWTPayload, ValidationError> =>
  Effect.try({
    try: () => jose.decodeJwt(token),
    catch: mapJoseError,
  });

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the auth service implementation
 */
const makeAuthService = (config: HolonetAuthConfig): HolonetAuthServiceShape => ({
  getConfig: () => config,

  extractToken: (authHeader) => {
    if (!authHeader) {
      if (!config.required) {
        return Effect.succeed('');
      }
      return Effect.fail(
        new MissingAuthHeaderError({ message: 'Authorization header is required' })
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return Effect.fail(
        new MissingAuthHeaderError({
          message: 'Invalid Authorization header format. Expected: Bearer <token>',
        })
      );
    }

    return Effect.succeed(parts[1]);
  },

  validateToken: (token) =>
    Effect.gen(function* () {
      if (!token) {
        return {} as HolonetClaims;
      }

      let payload: jose.JWTPayload;

      if (config.secret) {
        payload = yield* verifyWithSecret(token, config.secret, config);
      } else if (config.publicKey) {
        payload = yield* verifyWithPublicKey(token, config.publicKey, config);
      } else if (config.jwksUrl) {
        payload = yield* verifyWithJwks(token, config.jwksUrl, config);
      } else {
        payload = yield* decodeOnly(token);
      }

      // Parse claims schema
      const claims = yield* pipe(
        Schema.decodeUnknown(HolonetClaimsSchema)(payload),
        Effect.mapError(
          (e): JwtValidationError =>
            new JwtValidationError({
              code: 'invalid_claims',
              message: 'JWT claims do not match expected schema',
              cause: e,
            })
        )
      );

      return claims;
    }),

  authenticate: (authHeader) =>
    Effect.gen(function* () {
      // Try to extract token
      const tokenResult = yield* Effect.either(
        makeAuthService(config).extractToken(authHeader)
      );

      if (tokenResult._tag === 'Left') {
        if (!config.required) {
          return { _tag: 'Anonymous' } as AuthResult;
        }
        return {
          _tag: 'AuthFailure',
          reason: tokenResult.left.message,
          code: 'missing_auth',
        } as AuthResult;
      }

      const token = tokenResult.right;
      if (!token) {
        return { _tag: 'Anonymous' } as AuthResult;
      }

      // Validate token
      const claimsResult = yield* Effect.either(
        makeAuthService(config).validateToken(token)
      );

      if (claimsResult._tag === 'Left') {
        const error = claimsResult.left;
        return {
          _tag: 'AuthFailure',
          reason:
            error._tag === 'JwtExpiredError'
              ? 'Token has expired'
              : error._tag === 'JwtNotYetValidError'
                ? 'Token is not yet valid'
                : error.message,
          code: error._tag,
        } as AuthResult;
      }

      return {
        _tag: 'AuthSuccess',
        claims: claimsResult.right,
        token,
        expiresAt: claimsResult.right.exp
          ? new Date(claimsResult.right.exp * 1000)
          : undefined,
      } as AuthResult;
    }),

  authorizeOperation: (authHeader, operation, streamId) =>
    Effect.gen(function* () {
      const svc = makeAuthService(config);

      // Extract and validate token
      const token = yield* svc.extractToken(authHeader);
      const claims = yield* svc.validateToken(token);

      // Check permissions
      yield* svc.checkPermission(claims, operation, streamId);

      return claims;
    }),

  checkPermission: (claims, operation, streamId) =>
    checkPermission(claims, operation, streamId),
});

// =============================================================================
// Service Tag and Layers
// =============================================================================

export class HolonetAuthService extends Context.Tag('holonet/core/HolonetAuthService')<
  HolonetAuthService,
  HolonetAuthServiceShape
>() {
  /**
   * Create a service layer with custom configuration
   */
  static make = (config: HolonetAuthConfig): Layer.Layer<HolonetAuthService> =>
    Layer.succeed(HolonetAuthService, makeAuthService(config));

  /**
   * Default layer with no verification (decode-only, anonymous allowed)
   * ONLY FOR DEVELOPMENT/TESTING
   */
  static Default = HolonetAuthService.make({
    required: false,
    clockTolerance: 300,
  });

  /**
   * Create a layer with HMAC (HS256) secret verification
   */
  static withSecret = (secret: string, options?: Partial<HolonetAuthConfig>) =>
    HolonetAuthService.make({
      secret,
      algorithms: ['HS256'],
      required: true,
      clockTolerance: 60,
      ...options,
    });

  /**
   * Create a layer with JWKS endpoint verification
   */
  static withJwks = (jwksUrl: string, options?: Partial<HolonetAuthConfig>) =>
    HolonetAuthService.make({
      jwksUrl,
      required: true,
      clockTolerance: 60,
      ...options,
    });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a test JWT token for development/testing
 * WARNING: Uses HS256 with hardcoded secret - NEVER use in production!
 */
export const createTestToken = (
  claims: Partial<HolonetClaims>,
  secret: string = 'test-secret-do-not-use-in-production'
): Effect.Effect<string, JwtValidationError> =>
  Effect.tryPromise({
    try: async () => {
      const secretKey = new TextEncoder().encode(secret);

      const now = Math.floor(Date.now() / 1000);
      // Build payload explicitly to handle readonly arrays
      const payload: jose.JWTPayload = {
        sub: claims.sub,
        iss: claims.iss,
        iat: claims.iat ?? now,
        exp: claims.exp ?? now + 3600,
        nbf: claims.nbf,
        jti: claims.jti,
        name: claims.name,
        email: claims.email,
        client_id: claims.client_id,
        // Convert readonly arrays to mutable (type assertion needed due to readonly)
        aud: claims.aud
          ? (Array.isArray(claims.aud) ? [...claims.aud] : claims.aud) as string | string[]
          : undefined,
        permissions: claims.permissions ? [...claims.permissions] : undefined,
        scopes: claims.scopes ? [...claims.scopes] : undefined,
        roles: claims.roles ? [...claims.roles] : undefined,
      };

      return await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .sign(secretKey);
    },
    catch: (e) =>
      new JwtValidationError({
        code: 'token_creation_failed',
        message: `Failed to create test token: ${e instanceof Error ? e.message : 'Unknown error'}`,
        cause: e,
      }),
  });
