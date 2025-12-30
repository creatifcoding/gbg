/**
 * @file In-memory interpreter for Fermion
 * @module @tmnl/fermion/interpreters/memory
 *
 * Provides an in-memory Map-based store for testing and prototyping.
 */

import { Effect, Option } from "effect"
import type { FermionAlgebra } from "../algebra"

/**
 * Error thrown when an entity is not found in the memory store
 */
export class NotFoundError {
  readonly _tag = "NotFoundError"
  constructor(readonly key: unknown) {}
  get message(): string {
    return `Entity not found: ${JSON.stringify(this.key)}`
  }
}

/**
 * Create a simpler memory algebra using a plain Map
 * Useful for synchronous testing scenarios
 */
export const makeSimpleMemoryAlgebra = <A, K>(
  keyExtractor: (value: A) => K,
  initialData?: ReadonlyMap<K, A>
): {
  algebra: FermionAlgebra<A, NotFoundError, never, K>
  store: Map<K, A>
} => {
  const store = new Map<K, A>(initialData)

  const algebra: FermionAlgebra<A, NotFoundError, never, K> = {
    fetch: (key: K) =>
      Effect.suspend(() => {
        const value = store.get(key)
        if (value === undefined) {
          return Effect.fail(new NotFoundError(key))
        }
        return Effect.succeed(value)
      }),

    persist: (value: A) =>
      Effect.sync(() => {
        const key = keyExtractor(value)
        store.set(key, value)
      }),

    remove: (key: K) =>
      Effect.sync(() => {
        store.delete(key)
      }),
  }

  return { algebra, store }
}

/**
 * Create a memory algebra with async-like behavior (for testing Effect patterns)
 */
export const makeMemoryAlgebra = <A, K>(
  keyExtractor: (value: A) => K,
  initialData?: ReadonlyMap<K, A>
): {
  algebra: FermionAlgebra<A, NotFoundError, never, K>
  store: Map<K, A>
  setData: (data: ReadonlyMap<K, A>) => void
  getData: () => Map<K, A>
  clear: () => void
} => {
  const store = new Map<K, A>(initialData)

  const algebra: FermionAlgebra<A, NotFoundError, never, K> = {
    fetch: (key: K) =>
      Effect.suspend(() => {
        const value = store.get(key)
        if (value === undefined) {
          return Effect.fail(new NotFoundError(key))
        }
        return Effect.succeed(value)
      }),

    persist: (value: A) =>
      Effect.sync(() => {
        const key = keyExtractor(value)
        store.set(key, value)
      }),

    remove: (key: K) =>
      Effect.sync(() => {
        store.delete(key)
      }),
  }

  return {
    algebra,
    store,
    setData: (data: ReadonlyMap<K, A>) => {
      store.clear()
      data.forEach((v, k) => {
        store.set(k, v)
      })
    },
    getData: () => store,
    clear: () => store.clear(),
  }
}
