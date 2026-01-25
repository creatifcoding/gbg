/**
 * TokenRegistry — Core Types
 *
 * Effect-native branded registry with runtime validation.
 * Inspired by Emacs's obarray and defcustom patterns.
 *
 * @module
 */

import { Schema, Brand } from "effect"

// ─────────────────────────────────────────────────────────────────────────────
// Token Brands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Brand for registered tokens.
 *
 * Tokens are strings that have been validated through a registry.
 * You cannot create a Token<N> without going through the registry's
 * `register()` or `get()` methods.
 *
 * The N parameter is the namespace, providing type-level discrimination
 * between different registries (e.g., Token<"scope"> vs Token<"layer">).
 */
export type Token<N extends string> = string & Brand.Brand<N>

/**
 * Schema for creating branded tokens.
 *
 * This schema validates that a string is non-empty and brands it.
 * The actual registry membership check happens at the service level.
 */
export const TokenSchema = <N extends string>(namespace: N) =>
  Schema.String.pipe(
    Schema.nonEmptyString(),
    Schema.brand(namespace)
  )

// ─────────────────────────────────────────────────────────────────────────────
// Registry Entry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metadata associated with a registered token.
 *
 * Generic over M to allow registry-specific metadata shapes.
 */
export interface TokenEntry<M = unknown> {
  /** The token's unique identifier within its namespace */
  readonly id: string
  /** Human-readable name */
  readonly name: string
  /** Optional description */
  readonly description?: string
  /** Registration source for debugging/precedence */
  readonly source: TokenSource
  /** Registry-specific metadata */
  readonly metadata: M
  /** Timestamp of registration */
  readonly registeredAt: number
}

/**
 * Where a token was registered from.
 * Useful for conflict resolution and debugging.
 */
export const TokenSource = Schema.Literal("builtin", "user", "extension", "runtime")
export type TokenSource = typeof TokenSource.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registry Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for creating a TokenRegistry.
 */
export interface TokenRegistryConfig<N extends string, M = unknown> {
  /** Namespace identifier (e.g., "scope", "layer", "command") */
  readonly namespace: N
  /** Human-readable name for the registry */
  readonly name: string
  /** Whether to allow runtime registration after initialization */
  readonly allowRuntimeRegistration: boolean
  /** Whether to allow overwriting existing tokens */
  readonly allowOverwrite: boolean
  /** Default metadata for tokens without explicit metadata */
  readonly defaultMetadata?: M
  /** Built-in tokens to pre-register */
  readonly builtins?: ReadonlyArray<TokenRegistration<M>>
}

/**
 * Input for registering a token.
 */
export interface TokenRegistration<M = unknown> {
  /** Token identifier */
  readonly id: string
  /** Human-readable name */
  readonly name: string
  /** Optional description */
  readonly description?: string
  /** Registration source */
  readonly source?: TokenSource
  /** Registry-specific metadata */
  readonly metadata?: M
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry Events (for reactive systems)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Events emitted by the registry.
 * Useful for reactive UI updates.
 */
export const TokenRegistryEvent = Schema.Union(
  Schema.TaggedStruct("TokenRegistered", {
    id: Schema.String,
    source: TokenSource,
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct("TokenRemoved", {
    id: Schema.String,
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct("TokenUpdated", {
    id: Schema.String,
    timestamp: Schema.Number,
  })
)
export type TokenRegistryEvent = typeof TokenRegistryEvent.Type

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Errors that can occur during registry operations.
 */
export class TokenNotFoundError {
  readonly _tag = "TokenNotFoundError"
  constructor(
    readonly namespace: string,
    readonly id: string
  ) {}

  get message(): string {
    return `Token "${this.id}" not found in registry "${this.namespace}"`
  }
}

export class TokenAlreadyExistsError {
  readonly _tag = "TokenAlreadyExistsError"
  constructor(
    readonly namespace: string,
    readonly id: string,
    readonly existingSource: TokenSource
  ) {}

  get message(): string {
    return `Token "${this.id}" already exists in registry "${this.namespace}" (source: ${this.existingSource})`
  }
}

export class RegistrationDisabledError {
  readonly _tag = "RegistrationDisabledError"
  constructor(readonly namespace: string) {}

  get message(): string {
    return `Runtime registration is disabled for registry "${this.namespace}"`
  }
}

export type TokenRegistryError =
  | TokenNotFoundError
  | TokenAlreadyExistsError
  | RegistrationDisabledError
