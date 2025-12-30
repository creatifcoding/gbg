/**
 * @file Generic Effect-based interpreter for Fermion
 * @module @tmnl/fermion/interpreters/effect
 *
 * This interpreter allows users to provide Effect-based functions
 * for the algebra operations.
 */

import type { Effect } from "effect"
import type { FermionAlgebra } from "../algebra"

/**
 * Create an algebra from user-provided Effect functions
 *
 * @example
 * ```ts
 * const userAlgebra = fromFunctions({
 *   fetch: (id: string) =>
 *     Effect.tryPromise(() => fetch(`/api/users/${id}`).then(r => r.json())),
 *   persist: (user) =>
 *     Effect.tryPromise(() =>
 *       fetch(`/api/users/${user.id}`, { method: "PUT", body: JSON.stringify(user) })
 *     ),
 * })
 * ```
 */
export const fromFunctions = <A, E, R, K>(fns: {
  readonly fetch: (key: K) => Effect.Effect<A, E, R>
  readonly persist?: (value: A) => Effect.Effect<void, E, R>
  readonly remove?: (key: K) => Effect.Effect<void, E, R>
  readonly beforeFetch?: (key: K) => Effect.Effect<void, E, R>
  readonly afterFetch?: (key: K, value: A) => Effect.Effect<A, E, R>
  readonly beforePersist?: (value: A) => Effect.Effect<A, E, R>
  readonly afterPersist?: (value: A) => Effect.Effect<void, E, R>
}): FermionAlgebra<A, E, R, K> => fns

/**
 * Create a read-only algebra (fetch only)
 *
 * @example
 * ```ts
 * const readOnlyAlgebra = fromFetch((id: string) =>
 *   Effect.tryPromise(() => fetch(`/api/users/${id}`).then(r => r.json()))
 * )
 * ```
 */
export const fromFetch = <A, E, R, K>(
  fetch: (key: K) => Effect.Effect<A, E, R>
): FermionAlgebra<A, E, R, K> => ({ fetch })

/**
 * Create a CRUD algebra with all operations
 *
 * @example
 * ```ts
 * const crudAlgebra = fromCrud({
 *   fetch: (id) => Effect.tryPromise(() => api.get(id)),
 *   persist: (user) => Effect.tryPromise(() => api.put(user)),
 *   remove: (id) => Effect.tryPromise(() => api.delete(id)),
 * })
 * ```
 */
export const fromCrud = <A, E, R, K>(ops: {
  readonly fetch: (key: K) => Effect.Effect<A, E, R>
  readonly persist: (value: A) => Effect.Effect<void, E, R>
  readonly remove: (key: K) => Effect.Effect<void, E, R>
}): FermionAlgebra<A, E, R, K> => ops
