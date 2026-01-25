/**
 * Holonet Authentication Schemas
 *
 * Effect Schema definitions for JWT claims, permissions, and auth configuration.
 *
 * @module holonet/core/auth/schemas
 */

import { Schema } from 'effect';

// =============================================================================
// JWT Claims Schema
// =============================================================================

/**
 * Standard JWT registered claims (RFC 7519)
 */
export const JwtRegisteredClaims = Schema.Struct({
  /** Issuer - who issued the token */
  iss: Schema.optional(Schema.String),
  /** Subject - the principal (usually user ID) */
  sub: Schema.optional(Schema.String),
  /** Audience - who the token is intended for */
  aud: Schema.optional(Schema.Union(Schema.String, Schema.Array(Schema.String))),
  /** Expiration time (Unix timestamp) */
  exp: Schema.optional(Schema.Number),
  /** Not before (Unix timestamp) */
  nbf: Schema.optional(Schema.Number),
  /** Issued at (Unix timestamp) */
  iat: Schema.optional(Schema.Number),
  /** JWT ID - unique identifier */
  jti: Schema.optional(Schema.String),
});

export type JwtRegisteredClaims = typeof JwtRegisteredClaims.Type;

/**
 * Stream permission type
 */
export const StreamPermission = Schema.Literal(
  'stream:read',
  'stream:write',
  'stream:create',
  'stream:delete',
  'stream:admin'
);

export type StreamPermission = typeof StreamPermission.Type;

/**
 * Stream scope pattern - e.g., "stream:*", "stream:my-stream-*"
 */
export const StreamScope = Schema.String.pipe(
  Schema.pattern(/^stream:(\*|[a-zA-Z0-9_-]+(\*)?)/),
  Schema.annotations({
    description: 'Stream scope pattern for permission matching',
    examples: ['stream:*', 'stream:my-stream-*', 'stream:sensors-001'],
  })
);

export type StreamScope = typeof StreamScope.Type;

/**
 * Holonet-specific claims for durable-streams
 */
export const HolonetClaims = Schema.Struct({
  /** Standard JWT claims */
  ...JwtRegisteredClaims.fields,

  /** Stream permissions array */
  permissions: Schema.optional(Schema.Array(StreamPermission)),

  /** Allowed stream scopes (patterns) */
  scopes: Schema.optional(Schema.Array(StreamScope)),

  /** User display name */
  name: Schema.optional(Schema.String),

  /** User email */
  email: Schema.optional(Schema.String),

  /** User roles */
  roles: Schema.optional(Schema.Array(Schema.String)),

  /** Client ID (for service-to-service auth) */
  client_id: Schema.optional(Schema.String),
});

export type HolonetClaims = typeof HolonetClaims.Type;

// =============================================================================
// Auth Configuration
// =============================================================================

/**
 * JWT verification algorithm
 */
export const JwtAlgorithm = Schema.Literal(
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'PS256',
  'PS384',
  'PS512'
);

export type JwtAlgorithm = typeof JwtAlgorithm.Type;

/**
 * Auth service configuration
 */
export const HolonetAuthConfig = Schema.Struct({
  /** Expected JWT issuer (iss claim) */
  issuer: Schema.optional(Schema.String),

  /** Expected JWT audience (aud claim) */
  audience: Schema.optional(Schema.Union(Schema.String, Schema.mutable(Schema.Array(Schema.String)))),

  /** HMAC secret (for HS* algorithms) */
  secret: Schema.optional(Schema.String),

  /** Public key or JWKS URL (for RS, ES, PS algorithms) */
  publicKey: Schema.optional(Schema.String),

  /** JWKS endpoint URL */
  jwksUrl: Schema.optional(Schema.String),

  /** Allowed algorithms */
  algorithms: Schema.optional(Schema.Array(JwtAlgorithm)),

  /** Clock tolerance in seconds for exp/nbf validation (default: 60) */
  clockTolerance: Schema.optional(Schema.Number),

  /** Whether auth is required - false allows anonymous (default: true) */
  required: Schema.optional(Schema.Boolean),
});

export type HolonetAuthConfig = typeof HolonetAuthConfig.Type;

// =============================================================================
// Permission Definitions
// =============================================================================

/**
 * Stream operation types
 */
export const StreamOperation = Schema.Literal(
  'create',
  'read',
  'append',
  'delete',
  'metadata'
);

export type StreamOperation = typeof StreamOperation.Type;

/**
 * Permission check request
 */
export const PermissionRequest = Schema.Struct({
  operation: StreamOperation,
  streamId: Schema.String,
  claims: HolonetClaims,
});

export type PermissionRequest = typeof PermissionRequest.Type;

/**
 * Permission check result
 */
export const PermissionResult = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Allowed'),
    reason: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Denied'),
    reason: Schema.String,
    requiredPermission: Schema.String,
  })
);

export type PermissionResult = typeof PermissionResult.Type;

// =============================================================================
// Auth Result Types
// =============================================================================

/**
 * Successful auth result
 */
export const AuthSuccess = Schema.Struct({
  _tag: Schema.Literal('AuthSuccess'),
  claims: HolonetClaims,
  token: Schema.String,
  expiresAt: Schema.optional(Schema.DateFromNumber),
});

export type AuthSuccess = typeof AuthSuccess.Type;

/**
 * Auth result union
 */
export const AuthResult = Schema.Union(
  AuthSuccess,
  Schema.Struct({
    _tag: Schema.Literal('AuthFailure'),
    reason: Schema.String,
    code: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('Anonymous'),
  })
);

export type AuthResult = typeof AuthResult.Type;
