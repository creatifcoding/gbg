/**
 * Credential Schemas for Lock Screen Authentication
 *
 * Uses Effect Schema for runtime validation with custom error messages.
 * Supports multiple authentication strategies via tagged unions.
 *
 * @module
 */

import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────

/**
 * Email with format validation
 */
export const Email = Schema.String.pipe(
  Schema.nonEmptyString({ message: () => "Email is required" }),
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: () => "Invalid email format",
  }),
  Schema.brand("Email")
)
export type Email = typeof Email.Type

/**
 * Password with minimum length
 */
export const Password = Schema.String.pipe(
  Schema.nonEmptyString({ message: () => "Password is required" }),
  Schema.minLength(8, {
    message: () => "Password must be at least 8 characters",
  }),
  Schema.brand("Password")
)
export type Password = typeof Password.Type

/**
 * PIN code (4-6 digits)
 */
export const PinCode = Schema.String.pipe(
  Schema.pattern(/^\d{4,6}$/, {
    message: () => "PIN must be 4-6 digits",
  }),
  Schema.brand("PinCode")
)
export type PinCode = typeof PinCode.Type

// ─────────────────────────────────────────────────────────────
// Authentication Types
// ─────────────────────────────────────────────────────────────

/**
 * Supported authentication methods
 */
export const AuthType = Schema.Literal(
  "password",
  "pin",
  "biometric",
  "facial",
  "gesture"
)
export type AuthType = typeof AuthType.Type

// ─────────────────────────────────────────────────────────────
// Credential Schemas (Tagged Union)
// ─────────────────────────────────────────────────────────────

/**
 * Password-based login credentials
 */
export const PasswordCredentials = Schema.TaggedStruct("PasswordCredentials", {
  email: Email,
  password: Password,
  rememberMe: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type PasswordCredentials = typeof PasswordCredentials.Type

/**
 * PIN-based credentials
 */
export const PinCredentials = Schema.TaggedStruct("PinCredentials", {
  userId: Schema.String,
  pin: PinCode,
})
export type PinCredentials = typeof PinCredentials.Type

/**
 * Biometric credentials (fingerprint, etc.)
 */
export const BiometricCredentials = Schema.TaggedStruct("BiometricCredentials", {
  type: Schema.Literal("fingerprint", "iris"),
  token: Schema.String.pipe(Schema.nonEmptyString()),
  timestamp: Schema.DateFromNumber,
  deviceId: Schema.optionalWith(Schema.String, { default: () => "default" }),
})
export type BiometricCredentials = typeof BiometricCredentials.Type

/**
 * Facial recognition credentials
 */
export const FacialCredentials = Schema.TaggedStruct("FacialCredentials", {
  faceEmbedding: Schema.Array(Schema.Number), // 128/512 dim vector
  confidence: Schema.Number.pipe(
    Schema.between(0, 1, {
      message: () => "Confidence must be between 0 and 1",
    })
  ),
  timestamp: Schema.DateFromNumber,
  livenessCheck: Schema.Boolean,
})
export type FacialCredentials = typeof FacialCredentials.Type

/**
 * Gesture-based unlock (for MediaPipe integration)
 */
export const GestureCredentials = Schema.TaggedStruct("GestureCredentials", {
  sequence: Schema.Array(Schema.Literal("up", "down", "left", "right", "pinch", "spread")),
  timestamp: Schema.DateFromNumber,
})
export type GestureCredentials = typeof GestureCredentials.Type

/**
 * Union of all credential types
 */
export const Credentials = Schema.Union(
  PasswordCredentials,
  PinCredentials,
  BiometricCredentials,
  FacialCredentials,
  GestureCredentials
)
export type Credentials = typeof Credentials.Type

// ─────────────────────────────────────────────────────────────
// Form State Schema
// ─────────────────────────────────────────────────────────────

/**
 * Login form state for React
 */
export const LoginFormState = Schema.Struct({
  email: Schema.String,
  password: Schema.String,
  rememberMe: Schema.Boolean,
  isSubmitting: Schema.Boolean,
  errors: Schema.Record({
    key: Schema.String,
    value: Schema.String,
  }),
})
export type LoginFormState = typeof LoginFormState.Type

/**
 * Initial form state factory
 */
export const initialLoginFormState: LoginFormState = {
  email: "",
  password: "",
  rememberMe: false,
  isSubmitting: false,
  errors: {},
}
