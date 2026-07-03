/**
 * MSH Authentication Schemas
 *
 * Effect Schema definitions for JWT claims, permissions, and auth configuration.
 *
 * @module @tmnl/msh/core/auth/schemas
 */

import * as Schema from 'effect/Schema';

// =============================================================================
// JWT Claims
// =============================================================================

export const JwtRegisteredClaims = Schema.Struct({
  iss: Schema.optional(Schema.String),
  sub: Schema.optional(Schema.String),
  aud: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  exp: Schema.optional(Schema.Number),
  nbf: Schema.optional(Schema.Number),
  iat: Schema.optional(Schema.Number),
  jti: Schema.optional(Schema.String),
});
export type JwtRegisteredClaims = typeof JwtRegisteredClaims.Type;

export const StreamPermission = Schema.Literals([
  'stream:read', 'stream:write', 'stream:create', 'stream:delete', 'stream:admin',
] as const);
export type StreamPermission = typeof StreamPermission.Type;

export const StreamScope = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^stream:(\*|[a-zA-Z0-9_-]+(\*)?)/)),
);
export type StreamScope = typeof StreamScope.Type;

export const MshClaims = Schema.Struct({
  ...JwtRegisteredClaims.fields,
  permissions: Schema.optional(Schema.Array(StreamPermission)),
  scopes: Schema.optional(Schema.Array(StreamScope)),
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  roles: Schema.optional(Schema.Array(Schema.String)),
  client_id: Schema.optional(Schema.String),
});
export type MshClaims = typeof MshClaims.Type;

// =============================================================================
// Auth Configuration
// =============================================================================

export const JwtAlgorithm = Schema.Literals([
  'HS256', 'HS384', 'HS512',
  'RS256', 'RS384', 'RS512',
  'ES256', 'ES384', 'ES512',
  'PS256', 'PS384', 'PS512',
] as const);
export type JwtAlgorithm = typeof JwtAlgorithm.Type;

export const MshAuthConfig = Schema.Struct({
  issuer: Schema.optional(Schema.String),
  audience: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  secret: Schema.optional(Schema.String),
  publicKey: Schema.optional(Schema.String),
  jwksUrl: Schema.optional(Schema.String),
  algorithms: Schema.optional(Schema.Array(JwtAlgorithm)),
  clockTolerance: Schema.optional(Schema.Number),
  required: Schema.optional(Schema.Boolean),
});
export type MshAuthConfig = typeof MshAuthConfig.Type;

// =============================================================================
// Permissions
// =============================================================================

export const StreamOperation = Schema.Literals([
  'create', 'read', 'append', 'delete', 'metadata',
] as const);
export type StreamOperation = typeof StreamOperation.Type;

export const PermissionRequest = Schema.Struct({
  operation: StreamOperation,
  streamId: Schema.String,
  claims: MshClaims,
});
export type PermissionRequest = typeof PermissionRequest.Type;

export const PermissionResult = Schema.Union([
  Schema.Struct({
    _tag: Schema.tag('Allowed'),
    reason: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.tag('Denied'),
    reason: Schema.String,
    requiredPermission: Schema.String,
  }),
]);
export type PermissionResult = typeof PermissionResult.Type;

// =============================================================================
// Auth Result
// =============================================================================

export const AuthSuccess = Schema.Struct({
  _tag: Schema.tag('AuthSuccess'),
  claims: MshClaims,
  token: Schema.String,
  expiresAt: Schema.optional(Schema.Number),
});
export type AuthSuccess = typeof AuthSuccess.Type;

export const AuthResult = Schema.Union([
  AuthSuccess,
  Schema.Struct({
    _tag: Schema.tag('AuthFailure'),
    reason: Schema.String,
    code: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.tag('Anonymous'),
  }),
]);
export type AuthResult = typeof AuthResult.Type;
