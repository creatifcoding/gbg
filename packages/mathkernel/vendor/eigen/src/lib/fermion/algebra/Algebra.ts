/**
 * @file Fermion Algebra - the injectable operations interface
 * @module @tmnl/fermion/algebra/Algebra
 *
 * The algebra defines the CRUD operations that a Fermion family can perform.
 * Interpreters provide concrete implementations of this algebra.
 */

import { Context, Effect, Layer } from "effect"

/**
 * The Fermion Algebra interface
 *
 * This is the "tagless final" style interface that interpreters implement.
 * Only `fetch` is required; persist and remove are optional.
 *
 * @typeParam A - The entity type
 * @typeParam E - The error type
 * @typeParam R - The Effect requirements
 * @typeParam K - The key type
 */
export interface FermionAlgebra<A, E, R, K> {
  /**
   * Fetch an entity by key
   * This is the only required operation
   */
  readonly fetch: (key: K) => Effect.Effect<A, E, R>

  /**
   * Persist/update an entity
   * Key is typically extracted from the entity itself
   */
  readonly persist?: (value: A) => Effect.Effect<void, E, R>

  /**
   * Remove an entity by key
   */
  readonly remove?: (key: K) => Effect.Effect<void, E, R>

  // ============================================================================
  // Lifecycle Hooks (Optional)
  // ============================================================================

  /**
   * Called before fetch - useful for logging, validation, auth checks
   */
  readonly beforeFetch?: (key: K) => Effect.Effect<void, E, R>

  /**
   * Called after successful fetch - useful for transformation, caching
   * Can modify the fetched value
   */
  readonly afterFetch?: (key: K, value: A) => Effect.Effect<A, E, R>

  /**
   * Called before persist - useful for validation, normalization
   * Can modify the value being persisted
   */
  readonly beforePersist?: (value: A) => Effect.Effect<A, E, R>

  /**
   * Called after successful persist
   */
  readonly afterPersist?: (value: A) => Effect.Effect<void, E, R>
}

/**
 * Create a Context.Tag for a specific FermionAlgebra type
 *
 * @example
 * ```ts
 * const UserAlgebra = makeFermionAlgebraTag<User, ApiError, never, string>("UserAlgebra")
 *
 * const program = Effect.gen(function* () {
 *   const algebra = yield* UserAlgebra
 *   return yield* algebra.fetch("user-123")
 * })
 * ```
 */
export const makeFermionAlgebraTag = <A, E, R, K>(id: string) =>
  Context.GenericTag<FermionAlgebra<A, E, R, K>>(id)

/**
 * Create an algebra from partial operations
 * Provides type-safe construction with defaults
 */
export const makeAlgebra = <A, E, R, K>(
  ops: Pick<FermionAlgebra<A, E, R, K>, "fetch"> &
    Partial<Omit<FermionAlgebra<A, E, R, K>, "fetch">>
): FermionAlgebra<A, E, R, K> => ops

/**
 * Compose two algebras, with the second overriding the first
 */
export const composeAlgebra = <A, E1, E2, R1, R2, K>(
  base: FermionAlgebra<A, E1, R1, K>,
  override: Partial<FermionAlgebra<A, E2, R2, K>>
): FermionAlgebra<A, E1 | E2, R1 | R2, K> => ({
  ...base,
  ...override,
  fetch: override.fetch ?? base.fetch,
} as FermionAlgebra<A, E1 | E2, R1 | R2, K>)

/**
 * Add lifecycle hooks to an existing algebra
 */
export const withHooks = <A, E, R, K>(
  algebra: FermionAlgebra<A, E, R, K>,
  hooks: Pick<
    FermionAlgebra<A, E, R, K>,
    "beforeFetch" | "afterFetch" | "beforePersist" | "afterPersist"
  >
): FermionAlgebra<A, E, R, K> => ({
  ...algebra,
  beforeFetch: hooks.beforeFetch ?? algebra.beforeFetch,
  afterFetch: hooks.afterFetch ?? algebra.afterFetch,
  beforePersist: hooks.beforePersist ?? algebra.beforePersist,
  afterPersist: hooks.afterPersist ?? algebra.afterPersist,
})

// Legacy export for backwards compatibility
export const FermionAlgebraService = makeFermionAlgebraTag
