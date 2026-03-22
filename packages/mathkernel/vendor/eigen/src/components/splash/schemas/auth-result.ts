/**
 * Authentication Result Schemas
 *
 * Tagged union for success/failure outcomes with rich error types.
 *
 * @module
 */

import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────
// User Schema
// ─────────────────────────────────────────────────────────────

/**
 * Authenticated user representation
 */
export const User = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("UserId")),
  email: Schema.String,
  displayName: Schema.String,
  avatarUrl: Schema.optionalWith(Schema.String, { as: "Option" }),
  roles: Schema.Array(Schema.String),
  createdAt: Schema.DateFromNumber,
  lastLoginAt: Schema.optionalWith(Schema.DateFromNumber, { as: "Option" }),
})
export type User = typeof User.Type

// ─────────────────────────────────────────────────────────────
// Session Schema
// ─────────────────────────────────────────────────────────────

/**
 * Session token and metadata
 */
export const Session = Schema.Struct({
  token: Schema.String.pipe(Schema.brand("SessionToken")),
  expiresAt: Schema.DateFromNumber,
  refreshToken: Schema.optionalWith(Schema.String, { as: "Option" }),
  issuedAt: Schema.DateFromNumber,
})
export type Session = typeof Session.Type

// ─────────────────────────────────────────────────────────────
// Error Reasons
// ─────────────────────────────────────────────────────────────

/**
 * Authentication failure reasons
 */
export const AuthFailureReason = Schema.Literal(
  "invalid_credentials",
  "account_locked",
  "account_disabled",
  "session_expired",
  "mfa_required",
  "biometric_failed",
  "facial_not_recognized",
  "gesture_mismatch",
  "rate_limited",
  "network_error",
  "unknown"
)
export type AuthFailureReason = typeof AuthFailureReason.Type

// ─────────────────────────────────────────────────────────────
// Auth Result (Tagged Union)
// ─────────────────────────────────────────────────────────────

/**
 * Successful authentication
 */
export const AuthSuccess = Schema.TaggedStruct("AuthSuccess", {
  user: User,
  session: Session,
  requiresMfa: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type AuthSuccess = typeof AuthSuccess.Type

/**
 * Failed authentication
 */
export const AuthFailure = Schema.TaggedStruct("AuthFailure", {
  reason: AuthFailureReason,
  message: Schema.String,
  retryAfter: Schema.optionalWith(Schema.Number, { as: "Option" }), // seconds
  attemptsRemaining: Schema.optionalWith(Schema.Number, { as: "Option" }),
})
export type AuthFailure = typeof AuthFailure.Type

/**
 * MFA challenge required
 */
export const AuthMfaChallenge = Schema.TaggedStruct("AuthMfaChallenge", {
  challengeId: Schema.String,
  method: Schema.Literal("totp", "sms", "email", "biometric"),
  expiresAt: Schema.DateFromNumber,
  hint: Schema.optionalWith(Schema.String, { as: "Option" }), // e.g., "***-***-1234"
})
export type AuthMfaChallenge = typeof AuthMfaChallenge.Type

/**
 * Union of all auth outcomes
 */
export const AuthResult = Schema.Union(
  AuthSuccess,
  AuthFailure,
  AuthMfaChallenge
)
export type AuthResult = typeof AuthResult.Type

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Type guard for successful auth
 */
export const isAuthSuccess = (result: AuthResult): result is AuthSuccess =>
  result._tag === "AuthSuccess"

/**
 * Type guard for failed auth
 */
export const isAuthFailure = (result: AuthResult): result is AuthFailure =>
  result._tag === "AuthFailure"

/**
 * Type guard for MFA challenge
 */
export const isAuthMfaChallenge = (result: AuthResult): result is AuthMfaChallenge =>
  result._tag === "AuthMfaChallenge"
