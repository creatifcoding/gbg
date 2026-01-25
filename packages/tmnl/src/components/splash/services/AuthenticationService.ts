/**
 * Authentication Service with Strategy Pattern
 *
 * Supports multiple authentication strategies (password, biometric, facial, gesture)
 * via dependency injection using Effect Layers.
 *
 * @module
 */

import { Context, Data, Effect, Layer, Schema, ParseResult } from "effect"
import type {
  Credentials,
  PasswordCredentials,
  BiometricCredentials,
  FacialCredentials,
  GestureCredentials,
  AuthType,
} from "../schemas/credentials"
import {
  PasswordCredentials as PasswordCredentialsSchema,
  BiometricCredentials as BiometricCredentialsSchema,
  FacialCredentials as FacialCredentialsSchema,
  GestureCredentials as GestureCredentialsSchema,
} from "../schemas/credentials"
import type { AuthResult, User } from "../schemas/auth-result"

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly reason: string
  readonly message: string
  readonly retryable: boolean
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
  readonly issues: ReadonlyArray<ParseResult.ArrayFormatterIssue>
}> {}

export class StrategyNotFoundError extends Data.TaggedError("StrategyNotFoundError")<{
  readonly strategy: string
}> {}

// ─────────────────────────────────────────────────────────────
// Authenticator Interface (Strategy Pattern)
// ─────────────────────────────────────────────────────────────

/**
 * Core authenticator interface - each strategy implements this
 */
export interface Authenticator {
  readonly strategyId: AuthType
  readonly authenticate: (
    credentials: Credentials
  ) => Effect.Effect<AuthResult, AuthenticationError | ValidationError>
  readonly supports: (credentials: Credentials) => boolean
}

/**
 * Context tag for authenticator service
 */
export class AuthenticatorTag extends Context.Tag("tmnl/splash/Authenticator")<
  AuthenticatorTag,
  Authenticator
>() {}

// ─────────────────────────────────────────────────────────────
// Password Strategy
// ─────────────────────────────────────────────────────────────

const passwordAuthenticator: Authenticator = {
  strategyId: "password",

  supports: (credentials): credentials is PasswordCredentials =>
    credentials._tag === "PasswordCredentials",

  authenticate: (credentials) =>
    Effect.gen(function* () {
      // Validate credentials schema
      const validated = yield* Schema.decodeUnknown(PasswordCredentialsSchema)(
        credentials
      ).pipe(
        Effect.mapError((error) =>
          new ValidationError({
            field: "credentials",
            message: "Invalid password credentials",
            issues: ParseResult.ArrayFormatter.formatErrorSync(error),
          })
        )
      )

      // DUMMY: Simulate authentication check
      // In production, this would call a backend service
      if (
        validated.email === "demo@selfcharters.com" &&
        validated.password === "password123"
      ) {
        const now = Date.now()
        return {
          _tag: "AuthSuccess" as const,
          user: {
            id: "user-001" as User["id"],
            email: validated.email,
            displayName: "Demo User",
            avatarUrl: { _tag: "None" as const },
            roles: ["user"],
            createdAt: new Date(now - 86400000), // 1 day ago
            lastLoginAt: { _tag: "Some" as const, value: new Date(now) },
          },
          session: {
            token: `session-${crypto.randomUUID()}` as never,
            expiresAt: new Date(now + 3600000), // 1 hour
            refreshToken: { _tag: "None" as const },
            issuedAt: new Date(now),
          },
          requiresMfa: false,
        }
      }

      return {
        _tag: "AuthFailure" as const,
        reason: "invalid_credentials" as const,
        message: "Invalid email or password",
        retryAfter: { _tag: "None" as const },
        attemptsRemaining: { _tag: "Some" as const, value: 3 },
      }
    }),
}

export const PasswordAuthenticator = Layer.succeed(
  AuthenticatorTag,
  passwordAuthenticator
)

// ─────────────────────────────────────────────────────────────
// Biometric Strategy
// ─────────────────────────────────────────────────────────────

const biometricAuthenticator: Authenticator = {
  strategyId: "biometric",

  supports: (credentials): credentials is BiometricCredentials =>
    credentials._tag === "BiometricCredentials",

  authenticate: (credentials) =>
    Effect.gen(function* () {
      const validated = yield* Schema.decodeUnknown(BiometricCredentialsSchema)(
        credentials
      ).pipe(
        Effect.mapError((error) =>
          new ValidationError({
            field: "credentials",
            message: "Invalid biometric credentials",
            issues: ParseResult.ArrayFormatter.formatErrorSync(error),
          })
        )
      )

      // DUMMY: Biometric verification
      // In production, this would verify against stored biometric template
      if (validated.token === "valid-biometric-token") {
        const now = Date.now()
        return {
          _tag: "AuthSuccess" as const,
          user: {
            id: "user-001" as User["id"],
            email: "demo@selfcharters.com",
            displayName: "Biometric User",
            avatarUrl: { _tag: "None" as const },
            roles: ["user"],
            createdAt: new Date(now - 86400000),
            lastLoginAt: { _tag: "Some" as const, value: new Date(now) },
          },
          session: {
            token: `session-${crypto.randomUUID()}` as never,
            expiresAt: new Date(now + 3600000),
            refreshToken: { _tag: "None" as const },
            issuedAt: new Date(now),
          },
          requiresMfa: false,
        }
      }

      return {
        _tag: "AuthFailure" as const,
        reason: "biometric_failed" as const,
        message: "Biometric verification failed",
        retryAfter: { _tag: "None" as const },
        attemptsRemaining: { _tag: "Some" as const, value: 3 },
      }
    }),
}

export const BiometricAuthenticator = Layer.succeed(
  AuthenticatorTag,
  biometricAuthenticator
)

// ─────────────────────────────────────────────────────────────
// Facial Recognition Strategy
// ─────────────────────────────────────────────────────────────

const facialAuthenticator: Authenticator = {
  strategyId: "facial",

  supports: (credentials): credentials is FacialCredentials =>
    credentials._tag === "FacialCredentials",

  authenticate: (credentials) =>
    Effect.gen(function* () {
      const validated = yield* Schema.decodeUnknown(FacialCredentialsSchema)(
        credentials
      ).pipe(
        Effect.mapError((error) =>
          new ValidationError({
            field: "credentials",
            message: "Invalid facial credentials",
            issues: ParseResult.ArrayFormatter.formatErrorSync(error),
          })
        )
      )

      // DUMMY: Facial recognition verification
      // In production, this would:
      // 1. Verify liveness check passed
      // 2. Compare face embedding against stored templates
      // 3. Check confidence threshold
      if (validated.livenessCheck && validated.confidence > 0.85) {
        const now = Date.now()
        return {
          _tag: "AuthSuccess" as const,
          user: {
            id: "user-001" as User["id"],
            email: "demo@selfcharters.com",
            displayName: "Facial User",
            avatarUrl: { _tag: "None" as const },
            roles: ["user"],
            createdAt: new Date(now - 86400000),
            lastLoginAt: { _tag: "Some" as const, value: new Date(now) },
          },
          session: {
            token: `session-${crypto.randomUUID()}` as never,
            expiresAt: new Date(now + 3600000),
            refreshToken: { _tag: "None" as const },
            issuedAt: new Date(now),
          },
          requiresMfa: false,
        }
      }

      return {
        _tag: "AuthFailure" as const,
        reason: "facial_not_recognized" as const,
        message: validated.livenessCheck
          ? "Face not recognized"
          : "Liveness check failed",
        retryAfter: { _tag: "None" as const },
        attemptsRemaining: { _tag: "Some" as const, value: 3 },
      }
    }),
}

export const FacialAuthenticator = Layer.succeed(
  AuthenticatorTag,
  facialAuthenticator
)

// ─────────────────────────────────────────────────────────────
// Gesture Strategy (MediaPipe)
// ─────────────────────────────────────────────────────────────

const gestureAuthenticator: Authenticator = {
  strategyId: "gesture",

  supports: (credentials): credentials is GestureCredentials =>
    credentials._tag === "GestureCredentials",

  authenticate: (credentials) =>
    Effect.gen(function* () {
      const validated = yield* Schema.decodeUnknown(GestureCredentialsSchema)(
        credentials
      ).pipe(
        Effect.mapError((error) =>
          new ValidationError({
            field: "credentials",
            message: "Invalid gesture credentials",
            issues: ParseResult.ArrayFormatter.formatErrorSync(error),
          })
        )
      )

      // DUMMY: Gesture sequence verification
      // Expected pattern: up, up, down, pinch
      const expectedSequence = ["up", "up", "down", "pinch"]
      const matches =
        validated.sequence.length === expectedSequence.length &&
        validated.sequence.every((g, i) => g === expectedSequence[i])

      if (matches) {
        const now = Date.now()
        return {
          _tag: "AuthSuccess" as const,
          user: {
            id: "user-001" as User["id"],
            email: "demo@selfcharters.com",
            displayName: "Gesture User",
            avatarUrl: { _tag: "None" as const },
            roles: ["user"],
            createdAt: new Date(now - 86400000),
            lastLoginAt: { _tag: "Some" as const, value: new Date(now) },
          },
          session: {
            token: `session-${crypto.randomUUID()}` as never,
            expiresAt: new Date(now + 3600000),
            refreshToken: { _tag: "None" as const },
            issuedAt: new Date(now),
          },
          requiresMfa: false,
        }
      }

      return {
        _tag: "AuthFailure" as const,
        reason: "gesture_mismatch" as const,
        message: "Gesture sequence did not match",
        retryAfter: { _tag: "None" as const },
        attemptsRemaining: { _tag: "Some" as const, value: 3 },
      }
    }),
}

export const GestureAuthenticator = Layer.succeed(
  AuthenticatorTag,
  gestureAuthenticator
)

// ─────────────────────────────────────────────────────────────
// Authentication Service (Orchestrator)
// ─────────────────────────────────────────────────────────────

/**
 * High-level authentication service that dispatches to appropriate strategy
 */
export interface AuthenticationServiceShape {
  /**
   * Authenticate with any supported credentials
   */
  readonly authenticate: (
    credentials: Credentials
  ) => Effect.Effect<AuthResult, AuthenticationError | ValidationError>

  /**
   * Get available authentication methods
   */
  readonly availableMethods: () => Effect.Effect<ReadonlyArray<AuthType>>

  /**
   * Validate credentials without authenticating
   */
  readonly validateCredentials: (
    credentials: unknown
  ) => Effect.Effect<Credentials, ValidationError>
}

export class AuthenticationService extends Context.Tag(
  "tmnl/splash/AuthenticationService"
)<AuthenticationService, AuthenticationServiceShape>() {
  /**
   * Default layer using password authentication
   */
  static Default = Layer.succeed(this, {
    authenticate: (credentials) =>
      Effect.gen(function* () {
        // Dispatch to appropriate strategy based on credential type
        switch (credentials._tag) {
          case "PasswordCredentials":
            return yield* passwordAuthenticator.authenticate(credentials)
          case "BiometricCredentials":
            return yield* biometricAuthenticator.authenticate(credentials)
          case "FacialCredentials":
            return yield* facialAuthenticator.authenticate(credentials)
          case "GestureCredentials":
            return yield* gestureAuthenticator.authenticate(credentials)
          default:
            return yield* Effect.fail(
              new AuthenticationError({
                reason: "unknown",
                message: "Unsupported credential type",
                retryable: false,
              })
            )
        }
      }),

    availableMethods: () =>
      Effect.succeed(["password", "biometric", "facial", "gesture"] as const),

    validateCredentials: (credentials) =>
      Effect.gen(function* () {
        // Try each schema until one matches
        const schemas = [
          PasswordCredentialsSchema,
          BiometricCredentialsSchema,
          FacialCredentialsSchema,
          GestureCredentialsSchema,
        ]

        for (const schema of schemas) {
          const result = Schema.decodeUnknownEither(schema)(credentials)
          if (result._tag === "Right") {
            return result.right as Credentials
          }
        }

        return yield* Effect.fail(
          new ValidationError({
            field: "credentials",
            message: "Invalid credentials format",
            issues: [],
          })
        )
      }),
  })
}
