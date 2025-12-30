/**
 * @file Public type definitions for Fermion
 * @module @tmnl/fermion/types
 */

import type { Schema, Effect, Duration } from "effect"
import type { Atom, Registry } from "@effect-atom/atom"
import type * as Result from "@effect-atom/atom/Result"
import type { FermionTypeId } from "./internal/symbols"
import type { FermionAlgebra } from "./algebra"

// ============================================================================
// Key Type Utilities
// ============================================================================

/**
 * Extract field names from a Schema as a union type
 */
export type KeyOf<S extends Schema.Schema.All> = keyof Schema.Schema.Type<S>

/**
 * Extract the type of a specific key field from a Schema
 */
export type KeyType<
  S extends Schema.Schema.All,
  K extends KeyOf<S>
> = Schema.Schema.Type<S>[K]

/**
 * Create a composite key type from multiple fields
 */
export type CompositeKeyType<
  S extends Schema.Schema.All,
  K extends readonly KeyOf<S>[]
> = { readonly [P in K[number]]: Schema.Schema.Type<S>[P] }

// ============================================================================
// Fermion Core Types
// ============================================================================

/**
 * Configuration for building a Fermion family
 */
export interface FermionConfig<A, I, E, R, K> {
  /** The Effect Schema for the entity type */
  readonly schema: Schema.Schema<A, I, R>

  /** The key field(s) - single string or array for composite keys */
  readonly key: string | readonly string[]

  /** The algebra providing fetch/persist/remove operations */
  readonly algebra: FermionAlgebra<A, E, R, K>

  /** Optional TTL for idle atom cleanup */
  readonly ttl?: Duration.Duration

  /**
   * Optional function to generate additional reactivity keys
   * Used for fine-grained subscriptions beyond the primary key
   */
  readonly reactivityKeys?: (key: K, value: A) => readonly unknown[]
}

/**
 * The Fermion family interface - a callable that returns atoms
 *
 * @typeParam A - The entity type (decoded schema type)
 * @typeParam I - The encoded type (for serialization)
 * @typeParam E - The error type from operations
 * @typeParam R - The Effect requirements/context
 * @typeParam K - The key type (single or composite)
 */
export interface Fermion<A, I, E, R, K> {
  /** Type brand for runtime identification */
  readonly [FermionTypeId]: FermionTypeId

  /** Tag discriminator */
  readonly _tag: "Fermion"

  /** The schema this family is based on */
  readonly schema: Schema.Schema<A, I, R>

  /** The key field(s) configuration */
  readonly keyField: string | readonly string[]

  /**
   * Get the atom for a given key (callable interface)
   * Atoms are memoized via Atom.family
   */
  (key: K): Atom.Atom<Result.Result<A, E>>

  // ============================================================================
  // Effectful Operations
  // ============================================================================

  /**
   * Fetch the entity for a key, updating the corresponding atom
   * Returns the fetched value on success
   *
   * Requires AtomRegistry in the Effect context for atom updates.
   */
  readonly fetch: (key: K) => Effect.Effect<A, E, R | Registry.AtomRegistry>

  /**
   * Persist a value, updating the corresponding atom
   * Key is extracted from the value using the configured key field(s)
   *
   * Requires AtomRegistry in the Effect context for atom updates.
   */
  readonly persist: (value: A) => Effect.Effect<void, E, R | Registry.AtomRegistry>

  /**
   * Remove an entity by key, resetting the atom to initial state
   *
   * Requires AtomRegistry in the Effect context for atom updates.
   */
  readonly remove: (key: K) => Effect.Effect<void, E, R | Registry.AtomRegistry>

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Get the atom for a key (explicit method, same as callable)
   */
  readonly atomFor: (key: K) => Atom.Atom<Result.Result<A, E>>

  /**
   * Invalidate an entry, resetting it to initial state without removal
   * Use this to force a refetch on next access
   *
   * Requires AtomRegistry in the Effect context.
   */
  readonly invalidate: (key: K) => Effect.Effect<void, never, Registry.AtomRegistry>

  /**
   * Prefetch multiple keys in parallel
   * Useful for warming the cache before navigation
   *
   * Requires AtomRegistry in the Effect context.
   */
  readonly prefetch: (keys: readonly K[]) => Effect.Effect<void, E, R | Registry.AtomRegistry>
}

// ============================================================================
// Builder State Types
// ============================================================================

/**
 * State tracked during builder chain
 * Used internally to enforce type-safe building
 */
export interface BuilderState<A, I, E, R, L, K> {
  readonly schema: Schema.Schema<A, I, R>
  readonly key?: string | readonly string[]
  readonly algebra?: Partial<FermionAlgebra<A, E, R, K>>
  readonly ttl?: Duration.Duration
  readonly reactivityKeys?: (key: K, value: A) => readonly unknown[]
  readonly layers: readonly unknown[]
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { FermionAlgebra } from "./algebra"
