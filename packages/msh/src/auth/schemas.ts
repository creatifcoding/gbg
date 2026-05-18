/**
 * MSH Auth Schemas — Discriminated Union for Auth Modes
 *
 * Each auth mode is a Schema.TaggedClass with mode-specific fields.
 * Schema.Redacted enforces I1 (Secret Confinement) at the type level.
 * Credential sources enforce I7 (Credential Provenance).
 *
 * @module @tmnl/msh/auth/schemas
 */

import * as Effect from 'effect-v4/Effect';
import * as Schema from 'effect-v4/Schema';

// =============================================================================
// Credential Sources (I7: Provenance)
// =============================================================================

/** Credentials loaded from a file on disk */
export class CredsFile extends Schema.TaggedClass<CredsFile>()('CredsFile', {
  path: Schema.String,
  watchForChanges: Schema.Boolean.pipe(
    Schema.withDecodingDefault(Effect.succeed(false)),
  ),
}) {}

/** Credentials loaded from an environment variable */
export class CredsEnv extends Schema.TaggedClass<CredsEnv>()('CredsEnv', {
  variable: Schema.String,
}) {}

/** Credentials provided inline (for testing / programmatic use) */
export class CredsInline extends Schema.TaggedClass<CredsInline>()('CredsInline', {
  contents: Schema.Redacted(Schema.String),
}) {}

/** Discriminated union of credential sources */
export const CredsSource = Schema.Union([CredsFile, CredsEnv, CredsInline]);
export type CredsSource = typeof CredsSource.Type;

// =============================================================================
// Auth Modes (Schema.TaggedClass discriminated union)
// =============================================================================

/**
 * NKey authentication — Ed25519 challenge-response.
 * The seed (private key) is Redacted (I1).
 * The server never sees the seed — only the signed challenge.
 */
export class NKeyAuth extends Schema.TaggedClass<NKeyAuth>()('NKeyAuth', {
  /** NKey seed (Ed25519 private key). Redacted — never logged or serialized. */
  seed: Schema.Redacted(Schema.String),
  /** Optional: public key for verification / logging (safe to expose) */
  publicKey: Schema.optionalKey(Schema.String),
}) {}

/**
 * JWT authentication — presents a signed JWT + optionally signs challenges with NKey.
 * Supports token rotation (I3: Temporal Validity).
 */
export class JwtAuth extends Schema.TaggedClass<JwtAuth>()('JwtAuth', {
  /** The JWT token string */
  jwt: Schema.String,
  /** Optional NKey seed for challenge signing. Redacted (I1). */
  seed: Schema.optionalKey(Schema.Redacted(Schema.String)),
  /** Milliseconds before expiry to start rotation (I3). Default: 30s */
  rotationWindowMs: Schema.Number.pipe(
    Schema.withDecodingDefault(Effect.succeed(30_000)),
  ),
}) {}

/**
 * Credentials file authentication — contains both JWT + NKey seed.
 * Source tracks provenance (I7).
 */
export class CredsAuth extends Schema.TaggedClass<CredsAuth>()('CredsAuth', {
  /** Where to load the credentials from */
  source: CredsSource,
}) {}

/**
 * Simple token authentication (username/password or bearer token).
 * Token is Redacted (I1).
 */
export class TokenAuth extends Schema.TaggedClass<TokenAuth>()('TokenAuth', {
  token: Schema.Redacted(Schema.String),
  /** Optional user for user/pass auth */
  user: Schema.optionalKey(Schema.String),
}) {}

/** Discriminated union of all auth modes */
export const MshAuthMode = Schema.Union([NKeyAuth, JwtAuth, CredsAuth, TokenAuth]);
export type MshAuthMode = typeof MshAuthMode.Type;

// =============================================================================
// Auth State + Lifecycle Signals (I5: State Completeness)
// =============================================================================

/** The 8-state auth lifecycle FSM */
export const AuthState = Schema.Literals([
  'unconfigured',
  'loading_credentials',
  'ready',
  'authenticating',
  'authenticated',
  'expiring',
  'rotating',
  'failed',
] as const);
export type AuthState = typeof AuthState.Type;

/**
 * Semantic lifecycle signals that drive auth state changes.
 *
 * These are intentionally named as domain events/intents rather than target
 * states. The service owns the transition table that decides which signals are
 * legal in which states.
 */
export const AuthLifecycleSignal = Schema.Union([
  Schema.TaggedStruct('CredentialLoadRequested', {}),
  Schema.TaggedStruct('CredentialLoadSucceeded', {}),
  Schema.TaggedStruct('CredentialLoadFailed', {}),
  Schema.TaggedStruct('AuthenticationRequested', {}),
  Schema.TaggedStruct('AuthenticationSucceeded', {}),
  Schema.TaggedStruct('AuthenticationFailed', {}),
  Schema.TaggedStruct('CredentialExpiryDetected', {}),
  Schema.TaggedStruct('CredentialRotationRequested', {}),
  Schema.TaggedStruct('CredentialRotationSucceeded', {}),
  Schema.TaggedStruct('CredentialRotationFailed', {}),
  Schema.TaggedStruct('AuthResetRequested', {}),
]);
export type AuthLifecycleSignal = typeof AuthLifecycleSignal.Type;
export type AuthLifecycleSignalTag = AuthLifecycleSignal['_tag'];

// =============================================================================
// Auth Errors
// =============================================================================

/** Credential source could not be loaded (I7 + I8) */
export class CredentialLoadError extends Schema.TaggedErrorClass<CredentialLoadError>(
  '@tmnl/msh/auth/CredentialLoadError',
)('Auth/CredentialLoad', {
  message: Schema.String,
  source: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

/** Authentication challenge-response failed (I4 + I8) */
export class AuthenticationError extends Schema.TaggedErrorClass<AuthenticationError>(
  '@tmnl/msh/auth/AuthenticationError',
)('Auth/Authentication', {
  message: Schema.String,
  mode: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

/** Token expired or rotation failed (I3 + I8) */
export class TokenRotationError extends Schema.TaggedErrorClass<TokenRotationError>(
  '@tmnl/msh/auth/TokenRotationError',
)('Auth/TokenRotation', {
  message: Schema.String,
  expiresAt: Schema.optional(Schema.Number),
  cause: Schema.optional(Schema.Unknown),
}) {}

/** Auth invariant violated — includes which invariant (I8) */
export class AuthInvariantViolation extends Schema.TaggedErrorClass<AuthInvariantViolation>(
  '@tmnl/msh/auth/AuthInvariantViolation',
)('Auth/InvariantViolation', {
  invariant: Schema.Literals(['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9'] as const),
  message: Schema.String,
  context: Schema.optional(Schema.String),
}) {}

/** Union of all auth errors */
export type AuthError =
  | CredentialLoadError
  | AuthenticationError
  | TokenRotationError
  | AuthInvariantViolation;

// =============================================================================
// Auth Metadata (I9: Observability Without Leakage)
// =============================================================================

/** Safe-to-log metadata about current auth state */
export const AuthMetadata = Schema.Struct({
  mode: Schema.Literals(['nkey', 'jwt', 'creds', 'token', 'none'] as const),
  state: AuthState,
  /** Public key (safe to log) — null if not applicable */
  publicKey: Schema.optionalKey(Schema.String),
  /** When the current credential expires (unix ms) — null if N/A */
  expiresAt: Schema.optionalKey(Schema.Number),
  /** When the credential was loaded */
  loadedAt: Schema.optionalKey(Schema.Number),
  /** Credential source type (file/env/inline) — not the actual content */
  sourceType: Schema.optionalKey(Schema.String),
});
export type AuthMetadata = typeof AuthMetadata.Type;
